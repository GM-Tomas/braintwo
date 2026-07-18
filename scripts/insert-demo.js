import Database from 'better-sqlite3';
import * as sqliteVec from 'sqlite-vec';
import { join } from 'path';
import crypto from 'crypto';

// Paths matching the Electron app configuration
const appData = join(process.env.APPDATA || (process.platform === 'darwin' ? join(process.env.HOME, 'Library/Application Support') : join(process.env.HOME, '.config')), 'braintwo');
const dbPath = join(appData, 'braintwo.db');
const cacheDir = join(appData, 'models');
const modelName = 'Xenova/multilingual-e5-base';
const VEC_DIM = 768;

console.log('Database path:', dbPath);
console.log('Models cache directory:', cacheDir);

function sha1(str) {
  return crypto.createHash('sha1').update(str).digest('hex');
}

async function run() {
  // 1. Initialize SQLite
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  
  let vecPath = sqliteVec.getLoadablePath();
  db.loadExtension(vecPath);
  console.log('SQLite and sqlite-vec extension loaded successfully.');

  // Clean up any previous demo messages to start clean
  try {
    const deleteEmbs = db.prepare("DELETE FROM message_embeddings WHERE msg_id IN (SELECT id FROM messages WHERE wa_msg_id LIKE 'demo:%')");
    deleteEmbs.run();
    const deleteMsgs = db.prepare("DELETE FROM messages WHERE wa_msg_id LIKE 'demo:%'");
    deleteMsgs.run();
    console.log('Cleaned up previous demo messages from database.');
  } catch (err) {
    console.log('No previous demo messages to clean or error cleaning:', err.message);
  }

  // 2. Load Transformers Pipeline
  console.log('Loading Transformers pipeline...');
  const { pipeline } = await import('@xenova/transformers');
  const { env } = await import('@xenova/transformers');
  env.cacheDir = cacheDir;

  const pipe = await pipeline('feature-extraction', modelName, {
    progress_callback: (evt) => {
      if (evt.status === 'downloading') {
        console.log(`Downloading model: ${evt.file} - ${Math.round(evt.progress || 0)}%`);
      }
    }
  });
  console.log('Model loaded.');

  // Embedding helper
  async function embed(text) {
    const output = await pipe(`passage: ${text}`, { pooling: 'mean', normalize: true });
    let data;
    if (output.data instanceof Float32Array) {
      data = output.data;
    } else if (Array.isArray(output.data)) {
      data = Float32Array.from(output.data);
    } else if (Array.isArray(output)) {
      data = Float32Array.from(output);
    } else {
      throw new Error('Unexpected output format from pipeline');
    }

    if (data.length !== VEC_DIM) {
      const adjusted = new Float32Array(VEC_DIM);
      adjusted.set(data.slice(0, VEC_DIM));
      let mag = 0;
      for (let i = 0; i < adjusted.length; i++) mag += adjusted[i] * adjusted[i];
      mag = Math.sqrt(mag) || 1;
      for (let i = 0; i < adjusted.length; i++) adjusted[i] /= mag;
      return adjusted;
    }
    return data;
  }

  function vecToBuffer(vec) {
    return Buffer.from(vec.buffer, vec.byteOffset, vec.byteLength);
  }

  // All 15 messages from the 5 questions
  const messagesList = [
    // Pregunta 1: ¿Cómo está estructurada la aplicación a nivel general?
    "Acordate de explicar que usamos Electron para que sea una app de escritorio instalable y React para la pantalla. Así corre nativa en Windows y Mac.",
    "Clave decirles que está separada en dos: la parte visual (pantalla) y el motor interno que hace el trabajo pesado en segundo plano. Si la interfaz se actualiza, el motor sigue procesando chats sin frenarse.",
    "Se comunican por un canal interno hiper seguro (IPC). El diseño es robusto porque la pantalla no puede tocar la base de datos ni internet directamente, todo pasa por el motor de fondo.",
    
    // Pregunta 2: ¿Dónde se guardan los datos y cómo funciona la búsqueda inteligente?
    "Los chats se guardan en SQLite, que es la base de datos local estándar de la industria (súper confiable y no se corrompe).",
    "Para la búsqueda por significado (búsqueda vectorial), le sumamos una extensión que se llama sqlite-vec que corre en C puro. Todo integrado en el mismo archivo.",
    "Lo bueno de esto es que no necesitamos instalar servidores de bases de datos pesados ni usar servicios en la nube. Hacemos las consultas matemáticas súper rápido en el disco del usuario.",
    
    // Pregunta 3: ¿Cómo hace para conectarse y capturar los mensajes de WhatsApp en tiempo real?
    "Para WhatsApp usamos una librería que se llama Baileys. Se conecta directo al sistema de WhatsApp Web usando WebSockets.",
    "Diferencia clave con otros productos: no levantamos un navegador Chrome invisible en segundo plano. Eso consumiría un montón de memoria y pondría lenta la compu. Baileys es ultra liviano.",
    "Captura los mensajes que te mandás a vos mismo al instante. Y si la app estuvo cerrada, apenas se abre sincroniza automáticamente lo que quedó pendiente.",
    
    // Pregunta 4: ¿De qué manera procesa los mensajes con Inteligencia Artificial sin usar internet?
    "Para traducir el texto a \"ideas\" (embeddings) usamos la librería Transformers.js. Nos permite correr el modelo de IA directo en la compu del usuario.",
    "El modelo de IA que lee el significado de los mensajes pesa solo 120MB y corre de forma local.",
    "Esto es un golazo comercial: el cliente no tiene que pagar APIs externas (como OpenAI) por cada búsqueda ni instalar programas complejos como Ollama. Funciona solo con instalar la app.",
    
    // Pregunta 5: ¿Por qué este diseño de arquitectura asegura que el producto es 100% privado y seguro?
    "Cero servidores en el medio. Los mensajes viajan directo desde los servidores encriptados de WhatsApp a la base de datos local del cliente.",
    "Las claves de la sesión de WhatsApp se guardan encriptadas en la PC del usuario. Nadie más (ni nosotros como creadores de la app) puede ver o interceptar sus chats.",
    "Es una arquitectura \"local-first\". Ante cualquier auditoría de seguridad del cliente, el argumento es que sus datos corporativos nunca salen de su propia máquina física."
  ];

  const baseTime = Date.now() - 2 * 24 * 60 * 60 * 1000; // Start 2 days ago
  const intervalMs = 15 * 60 * 1000; // Space messages by 15 minutes

  console.log(`Starting insertion of ${messagesList.length} demo messages...`);

  const insertMsgStmt = db.prepare(`
    INSERT INTO messages
      (wa_msg_id, timestamp, text, source, raw_json, kind, media_meta, from_me)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertEmbStmt = db.prepare(`
    INSERT OR REPLACE INTO message_embeddings(msg_id, embedding) VALUES (?, ?)
  `);

  for (let i = 0; i < messagesList.length; i++) {
    const text = messagesList[i];
    const timestamp = baseTime + (i * intervalMs);
    const wa_msg_id = `demo:msg_${sha1(timestamp + '|' + text).slice(0, 16)}`;
    
    try {
      const result = insertMsgStmt.run(
        wa_msg_id,
        timestamp,
        text,
        'realtime', // source
        null, // raw_json
        'text', // kind
        null, // media_meta
        1 // from_me (sent by me to myself)
      );
      const msgId = result.lastInsertRowid;
      console.log(`Inserted message ${i + 1}/${messagesList.length} with ID ${msgId}.`);

      // Compute and insert embedding
      console.log(`Computing embedding for message ${i + 1}...`);
      const vec = await embed(text);
      const buffer = vecToBuffer(vec);
      insertEmbStmt.run(BigInt(msgId), buffer);
      console.log(`Embedding saved for message ID ${msgId}.`);

    } catch (err) {
      console.error(`Error processing message ${i + 1}:`, err);
    }
  }

  db.close();
  console.log('Finished inserting all 15 demo messages successfully!');
}

run().catch(console.error);
