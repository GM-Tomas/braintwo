/**
 * Use Case for executing an installed Python Bot.
 */
class RunBot {
    /**
     * @param {Object} dependencies
     * @param {Object} dependencies.botRepository   Interface to read/write bots.
     * @param {Object} dependencies.commandRunner   Interface to execute system processes.
     * @param {Object} dependencies.messagePort     Interface to send messages to the UI.
     * @param {Object} dependencies.fileRepository  Interface for file system operations.
     * @param {Object} dependencies.logger          BrainTwoLogger instance for persistent logging.
     */
    constructor({ botRepository, commandRunner, fileRepository, logger }) {
        this.botRepository = botRepository;
        this.commandRunner = commandRunner;
        this.fileRepository = fileRepository;
        this.logger = logger;
    }

    /**
     * Executes the use case.
     * @param {string} botName The name of the bot to run.
     * @param {Object} messagePort Interface to send messages to the UI.
     */
    async execute(botName, messagePort) {
        const session = this.logger ? this.logger.startSession('run', botName) : null;
        const log = {
            step: (msg) => { if (session) session.step(msg); },
            info: (msg) => { if (session) session.info(msg); },
            error: (step, err, ctx) => { if (session) session.error(step, err, ctx); },
            success: (msg) => { if (session) session.success(msg); },
        };

        const bot = this.botRepository.getBotByName(botName);

        if (!bot || !bot.botPath || !this.fileRepository.exists(bot.botPath)) {
            const errMsg = "No se pudo ejecutar la automatización. No se encontró la carpeta.";
            log.error('Buscar bot', new Error(errMsg), { botName });
            if (session) session.close();
            this.botRepository.deleteBot(botName);
            messagePort.sendError(botName, errMsg);
            return;
        }

        const { botPath, fileName } = bot;
        const pythonExe = this.fileRepository.joinPath(botPath, '___venv___', 'Scripts', 'python.exe');

        log.info(`botPath: ${botPath}`);
        log.info(`script: ${fileName}`);
        log.info(`python: ${pythonExe}`);

        const options = {
            pythonPath: pythonExe,
            scriptPath: botPath,
            pythonOptions: ["-u"]
        };

        try {
            log.step('Iniciando ejecución del bot...');
            messagePort.sendProgress(botName, "Iniciando...", "Arrancando bot de Python...", 10);

            // We pass the messagePort to the runner so it can stream stdout
            await this.commandRunner.runPythonScript(options, fileName, botName, messagePort);

            log.success('Ejecución finalizada correctamente.');
            messagePort.sendSuccess(botName, "Ejecución finalizada.");
        } catch (e) {
            log.error('Ejecutar script Python', e, {
                botName,
                botPath,
                fileName,
                pythonExe,
            });
            console.error(`[RunBot] Error ejecutando ${botName}:`, e);
            if (session) session.close();
            messagePort.sendError(botName, `La automatización se ejecutó con un error severo: ${e.message}`);
        }
    }
}

module.exports = RunBot;

