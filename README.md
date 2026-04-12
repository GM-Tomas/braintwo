# BrainTwo

> Tu segundo cerebro, local y privado. Capturá ideas desde WhatsApp, buscalas con lenguaje natural.

## Qué hace

- Captura mensajes de texto, audios e imágenes desde tu chat de WhatsApp
- Transcribe audios automáticamente con Gemini
- Categoriza notas con IA
- Búsqueda semántica RAG en lenguaje natural
- Todo corre en tu disco — sin servidores, sin suscripciones ocultas

## Requisitos

- Node.js 18+
- Una cuenta de Google AI Studio (para la API key de Gemini)

## Instalación

```bash
git clone https://github.com/tu-usuario/braintwo
cd braintwo
npm install
npm start
```

## Configuración

1. Al abrir la app, escaneá el QR con WhatsApp para vincular tu sesión
2. Ir a **Configuración** y pegar tu Gemini API key
   - Obtenela gratis en [aistudio.google.com](https://aistudio.google.com/app/apikey)
3. Configurar el nombre del chat donde te mandás notas a vos mismo

## Estructura del proyecto

```
braintwo/
├── main.js          ← proceso principal Electron
├── preload.js       ← puente seguro Node ↔ renderer
├── src/
│   ├── db.js        ← SQLite + sqlite-vec (base local)
│   ├── whatsapp.js  ← captura con whatsapp-web.js
│   ├── sync.js      ← orquestador de ingesta
│   └── ai.js        ← Gemini API (embeddings, RAG, transcripción)
└── renderer/
    ├── onboarding.html
    ├── notes.html
    ├── config.html
    ├── css/
    └── js/
```

## Modelo de negocio

- **Tier gratuito (BYOK):** traés tu propia API key de Gemini
- **Tier Pro ($8–12/mes):** IA llave en mano, sin configurar nada *(próximamente)*

## Roadmap v0 → v1

- [x] Onboarding con QR
- [x] Ingesta de texto, audio e imagen
- [x] Búsqueda semántica RAG
- [x] Configuración de API key
- [ ] Sync en segundo plano (sistema tray)
- [ ] Filtros por fecha y tipo
- [ ] Multi-chat
- [ ] Exportar a Markdown

---

Construido con Electron, whatsapp-web.js, SQLite, sqlite-vec y Gemini API.
