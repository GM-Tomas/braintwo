const fs = require('fs');
const path = require('path');

/**
 * BrainTwoLogger — Writes persistent, timestamped log files for BrainTwo operations.
 *
 * Each operation (install / run) gets its own log file:
 *   instalacion_<botName>_<YYYYMMDD_HHmmss>.txt
 *   ejecucion_<botName>_<YYYYMMDD_HHmmss>.txt
 *
 * @example
 *   const logger = new BrainTwoLogger('/abs/path/to/logs');
 *   const session = logger.startSession('install', 'MiBot');
 *   session.step('Descomprimiendo ZIP...');
 *   session.error('Instalando pip', new Error('exit code 1. Detail: ...'));
 *   session.close();
 */
class BrainTwoLogger {
    /**
     * @param {string} logsDir - Absolute path to the directory where log files will be written.
     */
    constructor(logsDir) {
        this.logsDir = logsDir;
        try {
            if (!fs.existsSync(logsDir)) {
                fs.mkdirSync(logsDir, { recursive: true });
            }
        } catch (e) {
            console.error('[BrainTwoLogger] No se pudo crear el directorio de logs:', e.message);
        }
    }

    /**
     * Opens a new log session for a single operation on a bot.
     * @param {'install'|'run'} operationType
     * @param {string} botName
     * @returns {LogSession}
     */
    startSession(operationType, botName) {
        const prefix = operationType === 'install' ? 'instalacion' : 'ejecucion';
        const safeName = botName.replace(/[^a-zA-Z0-9_-]/g, '_');
        const timestamp = this._timestamp().replace(/[:\s]/g, '_').replace(/[-]/g, '');
        const fileName = `${prefix}_${safeName}_${timestamp}.txt`;
        const filePath = path.join(this.logsDir, fileName);

        return new LogSession(filePath, botName, operationType);
    }

    _timestamp() {
        const now = new Date();
        const pad = (n) => String(n).padStart(2, '0');
        return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    }
}

/**
 * A scoped log session for one BrainTwo operation.
 * Not meant to be instantiated directly — use `BrainTwoLogger.startSession()`.
 */
class LogSession {
    constructor(filePath, botName, operationType) {
        this.filePath = filePath;
        this.botName = botName;
        this.operationType = operationType;
        this._lines = [];
        this._write(`=== BrainTwo Log | Operación: ${operationType.toUpperCase()} | Bot: ${botName} ===`);
        this._write(`Inicio: ${new Date().toISOString()}`);
        this._write('');
    }

    step(message) {
        this._write(`[${this._ts()}] [PASO] ${message}`);
    }

    info(message) {
        this._write(`[${this._ts()}] [INFO] ${message}`);
    }

    warn(message) {
        this._write(`[${this._ts()}] [ADVERTENCIA] ${message}`);
    }

    error(step, error, context = {}) {
        this._write(`[${this._ts()}] [ERROR] *** ERROR DURANTE: ${step} ***`);
        this._write(`[${this._ts()}] [ERROR] Mensaje: ${error.message}`);
        if (error.stack) {
            this._write(`[${this._ts()}] [ERROR] Stack trace:`);
            error.stack.split('\n').forEach(line => this._write(`    ${line}`));
        }
        const contextKeys = Object.keys(context);
        if (contextKeys.length > 0) {
            this._write(`[${this._ts()}] [ERROR] Contexto adicional:`);
            for (const key of contextKeys) {
                this._write(`    ${key}: ${context[key]}`);
            }
        }
        this._flush();
    }

    success(message = 'Operación completada con éxito.') {
        this._write('');
        this._write(`[${this._ts()}] [OK] ${message}`);
        this._flush();
    }

    close() {
        this._flush();
    }

    // ------------------------------------------------------------------ private

    _write(line) {
        this._lines.push(line);
    }

    _flush() {
        try {
            fs.writeFileSync(this.filePath, this._lines.join('\r\n') + '\r\n', 'utf8');
        } catch (e) {
            console.error('[BrainTwoLogger] No se pudo escribir el log:', e.message);
        }
    }

    _ts() {
        const now = new Date();
        const pad = (n) => String(n).padStart(2, '0');
        return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
    }
}

module.exports = BrainTwoLogger;
