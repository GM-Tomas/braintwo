const { app, BrowserWindow, ipcMain } = require("electron/main");

const path = require("path");
let win;

/*
---------------- IMPORTANT! -----------------------------------------------------------------------------------------------------------------------

__dirname (for relative paths) must be used for internal files. Files that will be inside the app.asar generated. Otherwise the .exe will fail.
process.cwd() (for realative paths) must be used for external files. Files that will be outside app.asar. Otherwise the .exe will fail.

---------------------------------------------------------------------------------------------------------------------------------------------------
*/

function createWindow() {
  win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
    },
  });
  win.setMinimumSize(900, 700);

  //REMOVE UPPER MENU
  win.removeMenu();

  win.on("close", (event) => {
    event.preventDefault();
    win.destroy();
  });

  win.maximize();

  if (process.env.BRAINTWO_HOST === "dev") {
    win.loadURL("http://localhost:3000");
  } else {
    win.loadFile(path.join(__dirname, "frontend", "build", "index.html"));
  }

  ipcMain.handle("get-app-version", () => {
    return app.getVersion();
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

//-------------- Clean Architecture Dependency Injection -------------------------
const JsonBotRepository = require("./backend/infrastructure/repositories/JsonBotRepository");
const LocalFileRepository = require("./backend/infrastructure/repositories/LocalFileRepository");
const WindowsCommandRunner = require("./backend/infrastructure/runners/WindowsCommandRunner");
const BrainTwoLogger = require("./backend/infrastructure/logger/BrainTwoLogger");

const GetBots = require("./backend/application/useCases/GetBots");
const DeleteBot = require("./backend/application/useCases/DeleteBot");
const RunBot = require("./backend/application/useCases/RunBot");
const InstallBot = require("./backend/application/useCases/InstallBot");

const BotController = require("./backend/presentation/BotController");

const fs = require("fs");
const configPath = process.env.BRAINTWO_HOST === "dev" ? path.join(process.cwd(), "userData", "config.json") : path.join(app.getPath("userData"), "config.json");
const templatePath = path.join(__dirname, "configTemplate.json");
const appRoot = process.env.BRAINTWO_HOST === "dev" ? process.cwd() : path.dirname(process.execPath);
const logsDir = process.env.BRAINTWO_HOST === "dev" ? path.join(process.cwd(), "logs") : path.join(path.dirname(process.execPath), "logs");

// 1. Instantiate Repositories (Infrastructure)
const botRepository = new JsonBotRepository(configPath, templatePath, appRoot);
const fileRepository = new LocalFileRepository();
const commandRunner = new WindowsCommandRunner();
const brainTwoLogger = new BrainTwoLogger(logsDir);

// 2. Instantiate Use Cases (Application)
const getBotsUseCase = new GetBots({ botRepository });
const deleteBotUseCase = new DeleteBot({ botRepository, fileRepository });
const runBotUseCase = new RunBot({ botRepository, commandRunner, fileRepository, messagePort: null, logger: brainTwoLogger });
const installBotUseCase = new InstallBot({ botRepository, fileRepository, commandRunner, messagePort: null, logger: brainTwoLogger });

// 3. Instantiate Controller (Presentation) and Register
const botController = new BotController({
  getBotsUseCase,
  deleteBotUseCase,
  runBotUseCase,
  installBotUseCase,
  botRepository
});

botController.registerChannels(ipcMain);

