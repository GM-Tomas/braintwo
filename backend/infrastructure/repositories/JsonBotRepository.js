const fs = require('fs');
const path = require('path');
const Bot = require('../../domain/Bot');

class JsonBotRepository {
    constructor(configFilePath, templateFilePath, appRoot) {
        this.configFilePath = configFilePath;
        this.templateFilePath = templateFilePath;
        this.appRoot = appRoot || process.cwd();
    }

    _getConfig() {
        if (!fs.existsSync(this.configFilePath)) {
            // If it doesn't exist, try to copy from configTemplate.json
            const templatePath = this.templateFilePath || path.join(process.cwd(), "configTemplate.json");
            if (fs.existsSync(templatePath)) {
                const dir = path.dirname(this.configFilePath);
                if (!fs.existsSync(dir)) {
                    fs.mkdirSync(dir, { recursive: true });
                }
                fs.copyFileSync(templatePath, this.configFilePath);
            } else {
                throw new Error(`config.json and configTemplate.json not found at ${templatePath}`);
            }
        }

        const config = fs.readFileSync(this.configFilePath, "utf8");
        return JSON.parse(config);
    }

    _saveConfig(config) {
        const updatedConfig = JSON.stringify(config, null, 2);
        fs.writeFileSync(this.configFilePath, updatedConfig, "utf8");
    }

    getAllBots() {
        const config = this._getConfig();
        return config.installedBots || [];
    }

    getBotByName(botName) {
        const bots = this.getAllBots();
        const rawBot = bots.find(b => b.name === botName);
        if (!rawBot) return null;
        return new Bot(rawBot);
    }

    getBotsFolder() {
        const config = this._getConfig();
        const botsFolder = config.botsFolder || 'automations';
        // Resolve relative paths against the userData folder ensures write access
        if (!path.isAbsolute(botsFolder)) {
            return path.resolve(path.dirname(this.configFilePath), botsFolder);
        }
        return botsFolder;
    }

    getDefaultPythonPath() {
        const config = this._getConfig();
        const pythonPath = config.pythonPath;
        // Resolve relative paths against appRoot (where resources/ is)
        if (pythonPath && !path.isAbsolute(pythonPath)) {
            return path.resolve(this.appRoot, pythonPath);
        }
        return pythonPath;
    }

    saveBot(botEntity) {
        const config = this._getConfig();
        // Assuming we override if already exists
        config.installedBots = config.installedBots.filter(b => b.name !== botEntity.name);
        config.installedBots.push(botEntity.toJSON());
        this._saveConfig(config);
    }

    deleteBot(botName) {
        const config = this._getConfig();
        config.installedBots = config.installedBots.filter(b => b.name !== botName);
        this._saveConfig(config);
    }
}

module.exports = JsonBotRepository;
