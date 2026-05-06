/**
 * Use Case for deleting an installed bot.
 */
class DeleteBot {
    /**
     * @param {Object} dependencies
     * @param {Object} dependencies.botRepository Interface to read/write bots.
     * @param {Object} dependencies.fileRepository Interface for file system operations.
     */
    constructor({ botRepository, fileRepository }) {
        this.botRepository = botRepository;
        this.fileRepository = fileRepository;
    }

    /**
     * Executes the use case.
     * @param {string} botName The name of the bot to delete.
     */
    async execute(botName) {
        // 1. Get the bot to know its path
        const bot = this.botRepository.getBotByName(botName);

        // 2. Delete from repository (config.json)
        this.botRepository.deleteBot(botName);

        // 3. Delete directory from filesystem
        if (bot && bot.botPath) {
            this.fileRepository.deleteDirectoryRecursive(bot.botPath);
        }
    }
}

module.exports = DeleteBot;
