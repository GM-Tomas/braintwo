const { shell } = require("electron");
const path = require("path");
const ElectronMessagePort = require("../infrastructure/messaging/ElectronMessagePort");

/**
 * Presentation layer.
 * Adapts Electron IPC events into Application Use Case executions.
 */
class BotController {
    constructor(dependencies) {
        this.getBotsUseCase = dependencies.getBotsUseCase;
        this.deleteBotUseCase = dependencies.deleteBotUseCase;
        this.runBotUseCase = dependencies.runBotUseCase;
        this.installBotUseCase = dependencies.installBotUseCase;
        this.botRepository = dependencies.botRepository;
    }

    /**
     * Subscribes to the events on the provided ipcMain.
     * @param {Object} ipcMain from Electron
     */
    registerChannels(ipcMain) {
        ipcMain.handle("askForBots", async (event) => {
            try {
                const hasPython = !!this.botRepository.getDefaultPythonPath();
                const bots = await this.getBotsUseCase.execute();
                return { success: true, hasPython, bots };
            } catch (err) {
                console.error(err);
                return { success: false, error: "Error al cargar bots desde el backend." };
            }
        });

        ipcMain.handle("deleteBot", async (event, botName) => {
            try {
                await this.deleteBotUseCase.execute(botName);
                const bots = await this.getBotsUseCase.execute();
                return { success: true, bots };
            } catch (err) {
                console.error("Error deleting bot:", err);
                return { success: false, error: err.message };
            }
        });

        ipcMain.on("runBot", async (event, botName) => {
            // Create a fresh message port for this specific run
            const messagePort = new ElectronMessagePort({ webContents: event.sender });

            await this.runBotUseCase.execute(botName, messagePort);

            // Refresh list in case bot deleted itself or something
            const bots = await this.getBotsUseCase.execute();
            event.sender.send("receiveBots", bots);
        });

        ipcMain.on("zipRepoCreate", async (event, data) => {
            try {
                const { botName, zipFilePath } = data;
                const messagePort = new ElectronMessagePort({ webContents: event.sender });

                const defaultPythonPath = this.botRepository.getDefaultPythonPath();
                await this.installBotUseCase.execute(botName, zipFilePath, defaultPythonPath, messagePort);

                const bots = await this.getBotsUseCase.execute();
                event.sender.send("receiveBots", bots);
            } catch (err) {
                console.error("Installation failed:", err);
                event.sender.send("downloadStatus", {
                    type: "custom-error",
                    bot_name: data.botName,
                    detail: err.message
                });
            }
        });

        ipcMain.on("openBotFolder", (event, botName) => {
            const botsFolder = this.botRepository.getBotsFolder();
            const botPath = path.resolve(botsFolder, botName);
            shell.openPath(botPath);
        });
    }
}

module.exports = BotController;
