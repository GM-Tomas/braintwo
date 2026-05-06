/**
 * Domain Entity representing a Python Bot.
 * This class encapsulates the fundamental properties and simple rules of a Bot.
 */
class Bot {
    /**
     * @param {Object} params
     * @param {string} params.name The unique name of the bot.
     * @param {string} params.botPath The local path where the bot is installed.
     * @param {string} params.fileName The entry point file name (e.g., 'Main.py').
     * @param {string} params.version The bot version.
     * @param {boolean} params.downloaded Indicates if the bot is currently downloaded/installed.
     * @param {string} [params.tags] Optional tags associated with the bot.
     */
    constructor({ name, botPath, fileName = "Main.py", version = "1.0", downloaded = false, tags = "#python" }) {
        if (!name) {
            throw new Error("Bot must have a name.");
        }
        this.name = name;
        this.botPath = botPath;
        this.fileName = fileName;
        this.version = version;
        this.downloaded = downloaded;
        this.tags = tags;
    }

    /**
     * Returns a plain object representation of the Bot.
     */
    toJSON() {
        return {
            name: this.name,
            botPath: this.botPath,
            fileName: this.fileName,
            version: this.version,
            downloaded: this.downloaded,
            tags: this.tags,
        };
    }
}

module.exports = Bot;
