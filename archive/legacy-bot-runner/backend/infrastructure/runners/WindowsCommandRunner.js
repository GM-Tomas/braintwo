const { spawn } = require('child_process');
const { PythonShell } = require('python-shell');

/**
 * Adapter to run system commands and python scripts (Windows environments).
 */
class WindowsCommandRunner {

    /**
     * Spawns any executable directly (no shell, no PowerShell).
     * Avoids corporate ExecutionPolicy restrictions entirely.
     * @param {string} executable - Absolute path to the executable.
     * @param {string[]} args - Arguments to pass.
     * @param {string|null} cwd - Working directory (or null to inherit).
     */
    _spawnDirect(executable, args, cwd) {
        return new Promise((resolve, reject) => {
            const options = { shell: false };
            if (cwd) options.cwd = cwd;

            const child = spawn(executable, args, options);
            let stderrData = '';
            let stdoutData = '';

            child.stdout.on('data', (data) => {
                stdoutData += data.toString();
                console.log(`[spawn stdout]: ${data.toString().trim()}`);
            });

            child.stderr.on('data', (data) => {
                stderrData += data.toString();
                console.error(`[spawn stderr]: ${data.toString().trim()}`);
            });

            child.on('exit', (code) => {
                if (code === 0) resolve(true);
                else {
                    const detail = stderrData.trim() || stdoutData.trim() || 'Sin detalles adicionales';
                    reject(new Error(`Process exit code: ${code}. Detalle: ${detail}`));
                }
            });

            child.on('error', (err) => {
                reject(err);
            });
        });
    }

    /**
     * Creates a virtual environment using `python.exe -m virtualenv`.
     * Avoids the virtualenv.exe shim which has the build-machine Python path hardcoded.
     * @param {string} pythonExePath   - Absolute path to the portable python.exe.
     * @param {string} venvTargetPath  - Absolute path where the venv should be created.
     * @param {string} cwd             - Working directory.
     */
    createVenv(pythonExePath, venvTargetPath, cwd) {
        return this._spawnDirect(pythonExePath, ['-m', 'virtualenv', venvTargetPath], cwd);
    }

    /**
     * Installs pip requirements using the venv's python.exe -m pip.
     * Avoids using pip.exe shim (which can also have hardcoded paths).
     * @param {string} venvPythonExePath - Absolute path to the venv's python.exe
     * @param {string} requirementsPath  - Absolute path to requirements.txt
     */
    pipInstall(venvPythonExePath, requirementsPath) {
        return this._spawnDirect(venvPythonExePath, ['-m', 'pip', 'install', '-r', requirementsPath], null);
    }

    runPythonScript(options, fileName, botName, messagePort) {
        return new Promise((resolve, reject) => {
            const pyshell = new PythonShell(fileName, options);

            pyshell.on('message', function (message) {
                try {
                    // If the bot prints json progress, we relay it
                    const parsed = JSON.parse(message);
                    if (parsed && typeof parsed.percentage === 'number') {
                        messagePort.sendProgress(botName, "Ejecutando", parsed.message || "Procesando...", parsed.percentage);
                    }
                } catch (e) {
                    // Normal log output
                    console.log(`[${botName}]: ${message}`);
                }
            });

            pyshell.end((err, code, signal) => {
                if (err) reject(err);
                else resolve({ code, signal });
            });
        });
    }
}

module.exports = WindowsCommandRunner;
