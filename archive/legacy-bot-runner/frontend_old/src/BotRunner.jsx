import React, { useState, useEffect } from 'react';
import './BotRunner.css';

const BotRunner = () => {
    const [bots, setBots] = useState([]);
    const [error, setError] = useState(null);
    const [statusMap, setStatusMap] = useState({});
    const [zipPath, setZipPath] = useState('');
    const [appVersion, setAppVersion] = useState('Unknown');

    useEffect(() => {
        if (!window?.ipc) return;

        window.ipc.getAppVersion().then(version => {
            setAppVersion(version);
        }).catch(err => console.error("Could not get version:", err));

        const removeReceiveBots = window.ipc.receiveBots((event, botList) => {
            setBots(botList);
        });

        const removeDownloadStatus = window.ipc.downloadStatus((event, data) => {
            setStatusMap(prev => ({
                ...prev,
                [data.bot_name]: data
            }));
        });

        const hasBotListError = window.ipc.botListError(() => {
            setError("Error al cargar bots desde el backend.");
        });

        // Solicitar lista inicial
        window.ipc.send('askForBots');

        return () => {
            removeReceiveBots();
            removeDownloadStatus();
            hasBotListError();
        };
    }, []);

    const handleInstall = () => {
        if (!zipPath || zipPath.trim() === '') {
            setError("Por favor ingresa una ruta válida.");
            return;
        }

        const trimmedPath = zipPath.trim();

        if (!trimmedPath.toLowerCase().endsWith('.zip')) {
            setError("La ruta debe apuntar a un archivo .zip");
            return;
        }

        // Extraer nombre básico del bot de la ruta
        let botName = trimmedPath.split('\\').pop().split('/').pop();
        botName = botName.replace('.zip', '');

        setError(null);
        window.ipc.send('zipRepoCreate', { botName, zipFilePath: trimmedPath });
        setZipPath('');
    };

    const runBot = (botName) => {
        setStatusMap(prev => {
            const newMap = { ...prev };
            delete newMap[botName];
            return newMap;
        });
        window.ipc.send('runBot', botName);
    };

    const deleteBot = (botName) => {
        window.ipc.send('deleteBot', botName);
    };

    return (
        <div className="bot-runner-container">
            <header className="br-header">
                <h1>BrainTwo</h1>
                <p>BrainTwo</p>
                <div>
                    <span style={{ color: 'red', fontSize: '12px' }}>by TomasGM</span>
                    <span style={{ color: '#888', fontSize: '10px', marginLeft: '10px' }}>v{appVersion}</span>
                </div>
            </header>

            {error && <div className="br-error">{error}</div>}

            <div className="br-main">
                <div className="br-manual-install">
                    <h3>Instalar Bot desde ZIP</h3>
                    <div className="br-install-controls">
                        <input
                            type="text"
                            className="br-path-input"
                            placeholder="Ejemplo: C:\Usuarios\TuNombre\Downloads\MiBot.zip"
                            value={zipPath}
                            onChange={(e) => setZipPath(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') handleInstall(); }}
                        />
                        <button className="br-install-btn" onClick={handleInstall}>Instalar</button>
                    </div>
                </div>

                {/* === Activity Log: shows ALL progress/status messages === */}
                {Object.keys(statusMap).length > 0 && (
                    <div className="br-activity-log">
                        <h3>Actividad</h3>
                        {Object.entries(statusMap).map(([botName, status]) => (
                            <div key={botName} className={`br-activity-item ${status.type === 'custom-error' ? 'error' : ''} ${status.type === 'successful-transaction' ? 'success' : ''}`}>
                                <div className="br-activity-header">
                                    <span className="br-activity-bot">{botName}</span>
                                    <span className="br-activity-type">{status.title || status.type}</span>
                                </div>
                                <div className="br-activity-msg">{status.message || status.detail}</div>
                                {(status.type === 'custom-progress' || status.type === 'download-progress-bar') && (
                                    <div className="br-progress-bar">
                                        <div className="br-progress-fill" style={{ width: `${status.percentage || 0}%` }}></div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                <div className="br-bots-list">
                    <h2>Automatizaciones Instaladas</h2>
                    {bots.length === 0 ? (
                        <p className="br-empty">Aún no hay bots instalados.</p>
                    ) : (
                        <div className="br-bots-grid">
                            {bots.map((bot, index) => (
                                <div key={index} className="br-bot-card">
                                    <div className="br-bot-header">
                                        <h3>{bot.name}</h3>
                                        <div className="br-bot-actions">
                                            <button onClick={() => window.ipc.send('openBotFolder', bot.name)} className="btn-folder" title="Abrir carpeta">📂</button>
                                            <button onClick={() => runBot(bot.name)} className="btn-run">▶ </button>
                                            <button onClick={() => deleteBot(bot.name)} className="btn-delete">✖</button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default BotRunner;
