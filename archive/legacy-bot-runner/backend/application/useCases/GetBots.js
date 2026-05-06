/**
 * Use Case for retrieving the list of installed bots.
 */
class GetBots {
    /**
     * @param {Object} dependencies
     * @param {Object} dependencies.botRepository Interface to read/write bots.
     */
    constructor({ botRepository }) {
        this.botRepository = botRepository;
    }

    /**
     * Executes the use case.
     * @returns {Array} List of installed bots.
     */
    async execute() {
        return this.botRepository.getAllBots();
    }
}

module.exports = GetBots;
