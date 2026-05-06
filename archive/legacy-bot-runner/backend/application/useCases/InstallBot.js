const Bot = require("../../domain/Bot");
const path = require("path");

/**
 * Use Case for installing a new Python Bot from a zip file.
 */
class InstallBot {
    /**
     * @param {Object} dependencies
     * @param {Object} dependencies.botRepository   Interface to read/write bots.
     * @param {Object} dependencies.fileRepository  Interface for file system operations.
     * @param {Object} dependencies.commandRunner   Interface to run system commands.
     * @param {Object} dependencies.messagePort     Interface to send messages to the UI.
     * @param {Object} dependencies.logger          BrainTwoLogger instance for persistent logging.
     */
    constructor({ botRepository, fileRepository, commandRunner, logger }) {
        this.botRepository = botRepository;
        this.fileRepository = fileRepository;
        this.commandRunner = commandRunner;
        this.logger = logger;
    }

    /**
     * Executes the use case.
     * @param {string} botName           The desired name for the installed bot.
     * @param {string} zipFilePath       The full path to the uploaded ZIP file.
     * @param {string} defaultPythonPath The path to the portable python.exe.
     * @param {Object} messagePort       Interface to send messages to the UI.
     */
    async execute(botName, zipFilePath, defaultPythonPath, messagePort) {
        const session = this.logger ? this.logger.startSession('install', botName) : null;
        const log = {
            step: (msg) => { if (session) session.step(msg); },
            info: (msg) => { if (session) session.info(msg); },
            warn: (msg) => { if (session) session.warn(msg); },
            error: (step, err, ctx) => { if (session) session.error(step, err, ctx); },
            success: (msg) => { if (session) session.success(msg); },
        };

        const configDir = this.botRepository.getBotsFolder();
        const botPath = this.fileRepository.joinPath(configDir, botName);
        const tempZipPath = `${botPath}.zip`;

        // venvPath and venvPythonPath are derived after locating Main.py
        let scriptDir, venvPath, venvPythonPath;

        log.info(`ZIP origen: ${zipFilePath}`);
        log.info(`Destino bot: ${botPath}`);
        log.info(`Python portable: ${defaultPythonPath}`);
        log.info(`(virtualenv se crea con: python.exe -m virtualenv)`);

        let currentStep = 'Inicio';
        try {
            // 1. Validate file exists
            currentStep = 'Validar ZIP';
            log.step('Validando que el archivo ZIP existe...');
            if (!this.fileRepository.exists(zipFilePath)) {
                throw new Error("El archivo ZIP no existe en la ruta especificada.");
            }

            // 2. Clean previous installations
            currentStep = 'Limpiar instalación anterior';
            log.step('Limpiando instalación anterior si existe...');
            if (this.fileRepository.exists(botPath)) {
                this.fileRepository.deleteDirectoryRecursive(botPath);
                log.info(`Carpeta previa eliminada: ${botPath}`);
            }
            this.botRepository.deleteBot(botName);

            // 3. Copy ZIP to automations folder to decouple from drag origin
            currentStep = 'Copiar ZIP';
            log.step(`Copiando ZIP a carpeta local: ${tempZipPath}`);
            messagePort.sendProgress(botName, "Instalando", "Copiando archivo ZIP localmente...", 5);
            this.fileRepository.copyFile(zipFilePath, tempZipPath);

            // 4. Unzip Files
            currentStep = 'Descomprimir ZIP';
            log.step(`Descomprimiendo en: ${botPath}`);
            messagePort.sendProgress(botName, "Instalando", "Descomprimiendo archivos...", 10);
            await this.fileRepository.unzip(tempZipPath, botPath);

            // 5. Locate Main.py inside the extracted contents
            currentStep = 'Localizar Main.py';
            log.step('Buscando Main.py en los archivos extraídos...');
            const mainPyPath = this.fileRepository.findFileRecursively(botPath, "Main.py");
            if (!mainPyPath) {
                throw new Error("No se encontró Main.py dentro del ZIP. Verificá que el archivo esté presente.");
            }
            scriptDir = path.dirname(mainPyPath);
            venvPath = path.join(scriptDir, "___venv___");
            venvPythonPath = path.join(venvPath, "Scripts", "python.exe");
            log.info(`Main.py encontrado en: ${scriptDir}`);

            // 6. Delete the temp zip now that it's extracted
            currentStep = 'Eliminar ZIP temporal';
            log.step('Eliminando ZIP temporal...');
            this.fileRepository.deleteFile(tempZipPath);

            // 7. Create virtual environment using python.exe -m virtualenv (avoids shim path issues)
            currentStep = 'Crear entorno virtual (virtualenv)';
            log.step(`Creando entorno virtual en: ${venvPath}`);
            messagePort.sendProgress(botName, "Instalando", "Creando entorno virtual...", 30);
            await this.commandRunner.createVenv(defaultPythonPath, venvPath, scriptDir);
            log.info('Entorno virtual creado correctamente.');

            // 8. Install dependencies using the venv's own pip.exe directly (no PowerShell)
            currentStep = 'Instalar dependencias (pip)';
            const reqPath = this.fileRepository.findFileRecursively(scriptDir, "requirements.txt");

            if (reqPath) {
                log.step(`Instalando dependencias desde: ${reqPath}`);
                log.info(`venv python: ${venvPythonPath}`);
                messagePort.sendProgress(botName, "Instalando", "Instalando dependencias de Python...", 60);
                await this.commandRunner.pipInstall(venvPythonPath, reqPath);
                log.info('Dependencias instaladas correctamente.');
            } else {
                log.warn('No se encontró requirements.txt — se omite la instalación de dependencias.');
                messagePort.sendProgress(botName, "Instalando", "Instalando dependencias de Python...", 60);
            }

            // 9. Register in DB
            currentStep = 'Registrar bot en la base de datos';
            log.step('Registrando bot en la configuración...');
            const bot = new Bot({
                name: botName,
                botPath: scriptDir,
                fileName: "Main.py",
                version: "1.0",
                downloaded: true,
            });
            this.botRepository.saveBot(bot);

            // 10. Report Success
            log.success(`${botName} instalado exitosamente.`);
            messagePort.sendSuccess(botName, `${botName} instalado exitosamente.`);

        } catch (e) {
            // Log the full error before attempting cleanup
            log.error(currentStep, e, {
                botName,
                zipFilePath,
                botPath,
                defaultPythonPath,
                venvPythonPath,
            });
            console.error(`[InstallBot] Error en paso "${currentStep}":`, e);

            // Attempt cleanup, but don't crash if files are locked
            try {
                if (this.fileRepository.exists(botPath)) {
                    this.fileRepository.deleteDirectoryRecursive(botPath);
                    log.info('Carpeta del bot eliminada durante limpieza post-error.');
                }
            } catch (cleanupErr) {
                log.warn(`Limpieza post-error falló (archivos bloqueados?): ${cleanupErr.message}`);
                console.error("Cleanup failed (files may be locked):", cleanupErr.message);
            }

            if (session) session.close();
            messagePort.sendError(botName, `Error durante la instalación: ${e.message}`);
        }
    }
}

module.exports = InstallBot;

