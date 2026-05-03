const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');

/**
 * Adapter for File System operations (fs, path).
 */
class LocalFileRepository {
    exists(filePath) {
        return fs.existsSync(filePath);
    }

    joinPath(...paths) {
        return path.join(...paths);
    }

    deleteDirectoryRecursive(folderPath) {
        if (!fs.existsSync(folderPath)) {
            return;
        }
        fs.rmSync(folderPath, { recursive: true, force: true });
    }

    copyFile(source, destination) {
        const destDir = path.dirname(destination);
        if (!fs.existsSync(destDir)) {
            fs.mkdirSync(destDir, { recursive: true });
        }
        fs.copyFileSync(source, destination);
    }

    deleteFile(filePath) {
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
    }

    // Uses adm-zip (pure Node.js) to unzip — no PowerShell or shell involved
    unzip(zipFilePath, destFolder) {
        if (!fs.existsSync(destFolder)) {
            fs.mkdirSync(destFolder, { recursive: true });
        }

        return new Promise((resolve, reject) => {
            try {
                const zip = new AdmZip(zipFilePath);
                zip.extractAllTo(destFolder, /*overwrite=*/true);
                resolve();
            } catch (err) {
                reject(new Error(`Failed to unzip: ${err.message}`));
            }
        });
    }

    findFileRecursively(folder, targetFile) {
        if (!fs.existsSync(folder)) return null;

        let foundPath = null;
        const searchDirectory = (currentFolder) => {
            const items = fs.readdirSync(currentFolder);
            for (const item of items) {
                const itemPath = path.join(currentFolder, item);
                const stats = fs.statSync(itemPath);

                if (stats.isFile() && item === targetFile) {
                    foundPath = itemPath;
                    return true;
                } else if (stats.isDirectory()) {
                    if (searchDirectory(itemPath)) return true;
                }
            }
            return false;
        };

        searchDirectory(folder);
        return foundPath;
    }

}

module.exports = LocalFileRepository;
