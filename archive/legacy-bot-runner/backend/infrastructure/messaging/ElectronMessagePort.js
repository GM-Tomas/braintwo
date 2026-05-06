/**
 * Adapter to send messages through Electron's IPC back to the frontend.
 */
class ElectronMessagePort {
    constructor(browserWindow) {
        this.win = browserWindow;
    }

    sendProgress(botName, title, message, percentage) {
        if (!this.win) return;
        this.win.webContents.send("downloadStatus", {
            type: "custom-progress",
            bot_name: botName,
            title: title,
            message: message,
            percentage: percentage,
        });
    }

    sendSuccess(botName, message) {
        if (!this.win) return;
        this.win.webContents.send("downloadStatus", {
            type: "successful-transaction",
            bot_name: botName,
            message: message,
        });
    }

    sendError(botName, detail) {
        if (!this.win) return;
        this.win.webContents.send("downloadStatus", {
            type: "custom-error",
            bot_name: botName,
            detail: detail,
        });
    }
}

module.exports = ElectronMessagePort;
