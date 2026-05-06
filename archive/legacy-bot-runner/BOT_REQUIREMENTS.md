# Requisitos para la Creación e Instalación de Bots (Python)

Para que un bot escrito en Python funcione correctamente dentro de **BrainTwo** (pueda ser instalado desde un ZIP, crear su entorno virtual, ejecutar sus tareas y enviar reportes de progreso a la interfaz), debe cumplir con las siguientes reglas estructurales y de comunicación.

---

## 1. Estructura del Archivo ZIP

Cuando subes un bot a BrainTwo mediante un archivo `.zip`, el sistema espera una estructura específica para poder configurarlo.

El contenido del `.zip` debe ser el código fuente de tu bot, **sin la carpeta contenedora principal**. Es decir, al abrir el ZIP, debes ver directamente los archivos de código (no una carpeta que contenga los archivos).

**Archivos Requeridos:**
1. **`Main.py` (Obligatorio):** BrainTwo siempre buscará y ejecutará este archivo como el punto de entrada principal del bot. Si tu archivo principal se llama de otra manera, la ejecución fallará.
2. **`requirements.txt` (Opcional pero recomendado):** Si tu bot utiliza dependencias externas (como `pandas`, `requests`, `selenium`, etc.), debes incluir este archivo. 
   - Durante la instalación, BrainTwo creará un Entorno Virtual de Python (`___venv___`) aislando tu bot de otros.
   - Si BrainTwo detecta un `requirements.txt`, ejecutará automáticamente `pip install -r requirements.txt` dentro del entorno virtual del bot.

**Ejemplo de estructura correcta dentro del ZIP:**
```
bot_automatizacion.zip
├── Main.py
├── requirements.txt
├── config.json
└── utils/
    ├── __init__.py
    └── helpers.py
```

---

## 2. Proceso de Instalación en el Backend

Cuando un usuario arrastra un `.zip` al frontend, esto es lo que hace el sistema (`backend/application/useCases/InstallBot.js`):
1. **Borrado por seguridad:** Si ya existe un bot con ese nombre, borra la carpeta anterior para evitar conflictos.
2. **Descompresión:** Extrae todos los archivos del ZIP en una carpeta dedicada para el bot.
3. **Entorno Virtual:** Ejecuta `python -m venv ___venv___` para crear un ambiente asilado.
4. **Dependencias:** Busca el archivo `requirements.txt`. Si lo encuentra, instala las librerías necesarias.
5. **Registro:** Guarda la información del bot en la base de datos local (`config.json`), marcando su archivo base como `Main.py`.

---

## 3. Comunicación Bot -> Frontend (Progress Bar y Logs)

Una vez que el bot se está ejecutando (`backend/infrastructure/runners/WindowsCommandRunner.js`), BrainTwo escucha todo lo que el script de Python imprime en la consola (`stdout`).

### A- Enviar mensajes de progreso (Barra de carga)
Para que el Frontend de React muestre la barra de progreso avanzando y un mensaje de estado ("Procesando Excel...", "Descargando PDF..."), el bot de Python **debe imprimir un JSON estricto en la consola** a través de un simple `print()`.

El JSON debe tener exactamente este formato:
```json
{"percentage": 85, "message": "Procesando archivo final..."}
```

**Ejemplo en Python (`Main.py`):**
```python
import json
import time

def enviar_progreso(porcentaje, mensaje):
    # Imprimimos el JSON en una sola línea para que BrainTwo lo capture
    print(json.dumps({"percentage": porcentaje, "message": mensaje}))

enviar_progreso(10, "Iniciando script...")
time.sleep(1)

enviar_progreso(50, "Procesando datos...")
time.sleep(2)

enviar_progreso(100, "Proceso finalizado con éxito.")
```
*Nota: El backend (`WindowsCommandRunner.js`) intentará hacer `JSON.parse()` de cada línea impresa. Si tiene una propiedad `percentage` numérica, se la enviará al Frontend a través de los canales IPC de Electron.*

### B- Imprimir Logs normales
Si tu bot hace un `print("Hola mundo")` que **no es un JSON válido**, el backend simplemente lo capturará en un bloque `catch` y lo imprimirá en su propia consola del servidor Node.js/Electron como un log normal:  
`[NombreDelBot]: Hola mundo`. 
(Esto es útil para debuguear tu bot, pero no actualizará la barra de progreso en la UI).

---

## 4. Finalización de Ejecución y Errores

- **Éxito (Exit Code 0):** Para que BrainTwo detecte que el bot terminó correctamente y envíe la señal de éxito al frontend, el script de Python debe terminar su ejecución de forma normal (llegando al final del archivo) o usando `sys.exit(0)`.
- **Error (Exit Code > 0):** Si tu bot falla, lanza una excepción no controlada, o usas `sys.exit(1)`, BrainTwo lo interpretará como un error de ejecución y el frontend mostrará una alerta de fallo al usuario.
