# BrainTwo - Bot Management System

BrainTwo is a bot management system built following the **Clean Architecture** patterns. This architecture ensures that the core business logic (Domain) is completely isolated from external frameworks, databases, and UI, making the application highly maintainable, testable, and scalable.

---

## 🏗️ Project Structure overview

The repository is divided into two main applications:
- **`frontend/`**: A React application (likely created with Vite or Create React App) that serves as the user interface.
- **`backend/`**: A Node.js application that handles the core logic, bot execution, and API endpoints. It is strictly organized into Clean Architecture layers.

## 🧠 Backend Architecture (Clean Architecture)

The `backend` directory is organized into four distinct layers. The golden rule of Clean Architecture is the **Dependency Rule**: *Source code dependencies must point only inward, toward higher-level policies (Domain).*

### 1. `domain/` (Enterprise Business Rules)
This is the core of the application. It contains the fundamental business entities and rules.
- **Rules:** It doesn't know about databases, web frameworks, or UI. It has NO dependencies on any other layer.
- **Files conceptually here:**
  - `Bot.js`: An entity representing a Bot, containing only pure business logic and properties (e.g., name, version, validation).

### 2. `application/` (Application Business Rules)
This layer orchestrates the flow of data to and from the entities (Domain) and directs those entities to use their enterprise business rules to achieve the goals of the use case.
- **Rules:** It depends ONLY on the `domain` layer.
- **Folders:**
  - `useCases/`: Contains the specific actions the system can perform (e.g., `GetBots.js`, `RunBot.js`). These orchestrate the flow.
  - `ports/`: **(Important)** This folder contains *Interfaces* (or abstract class contracts in JS). It defines *what* the application needs from the outside world without knowing *how* it's implemented. For example, it would define a `BotRepositoryPort` saying "I need a way to save and get bots", but it doesn't care if it's saved in JSON, SQL, or MongoDB. 
  *(Note: It is perfectly normal for `ports` to be empty temporarily in JavaScript if you are defining duck-typing interfaces implicitly or relying on JSDoc interfaces instead of TypeScript).*

### 3. `infrastructure/` (Frameworks and Drivers)
This layer contains the concrete implementations of the interfaces (ports) defined in the application layer. It interacts with the outside world (databases, file systems, external APIs, executing other processes).
- **Rules:** It depends on the `application` layer (to implement its ports) and the `domain` layer.
- **Folders:**
  - `repositories/`: Concrete implementations of data storage. E.g., `JsonBotRepository.js` knows exactly how to read/write from `config.json` using the `fs` module.
  - `runners/`: Concrete implementations for executing things. E.g., `PythonRunner.js` knows how to spawn a Python child process.
  - `messaging/`: Concrete implementations for communication, like handling WebSockets or specific event emitters.

### 4. `presentation/` (Interface Adapters)
This layer acts as a translator between the external agency (like the web, REST APIs, UI) and the internal `application` layer.
- **Rules:** It depends on the `application` layer to trigger use cases.
- **Folders:**
  - Contains API Routes, Controllers, and Express.js setup. It takes an HTTP request, translates it into input for a Use Case in the `application` layer, and then translates the output back into an HTTP response (JSON).

---

## 📂 Root Level Files

- `config.json` / `configTemplate.json`: Application configuration files (acting as our makeshift database for this iteration).
- `package.json`: Manages the root workspace dependencies and scripts.
