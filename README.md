# Bioryx

An enterprise-grade, high-performance biometric attendance synchronization desktop application. **Bioryx** bridges physical **ZKTeco biometric terminals** with a cloud-based or local **MongoDB** cluster, featuring **offline-first buffering**, local backups, auto-recovery, and real-time punch event streaming.

---

## Key Features

### 1. **Robust Biometric Integration**
* **Hardware Connectivity**: Connects to physical ZKTeco hardware readers via TCP/IP (standard port `4370`) using the robust `zkteco-js` library.
* **Real-time Streaming**: Dynamically listens to real-time log and attendance punch events directly from the terminal socket, instantly propagating them to the user interface.
* **Periodic Background Sync**: Runs a scheduled periodic background sync (defaulting to every 5 minutes) to pull users and logs, ensuring local archives and databases stay up-to-date with hardware state.

### 2. **Direct MongoDB Sync & Daily Aggregation**
* **Dynamic Daily Records**: Groups attendance logs by date (`YYYY-MM-DD`). Automatically computes `inTime` (first punch of the day) and `outTime` (latest punch of the day) for each user seamlessly, avoiding cluttered log tables.
* **DNS Override**: Automatically overrides DNS servers (`8.8.8.8` / `8.8.4.4`) in the Electron app to guarantee ultra-stable MongoDB Atlas SRV connection resolution on any local area network.

### 3. **Fault-Tolerant Offline-First Buffering**
* **Resilient Offline Cache**: When MongoDB is offline, real-time and device-fetched punches are buffered locally in `local_punch_cache.json` under the secure OS `appData` path.
* **Auto-Sync on Reconnect**: Automatically detects database recovery (during manual sync requests or reconnection events), flushing and synchronizing cached punches in strict chronological order to maintain historical accuracy.
* **7-Day Local Backup Archive**: Maintains a local fallback file (`device_logs_archive.json`) which stores the last 7 days of attendance logs as an offline backup.

### 4. **Premium Frameless Desktop Interface**
* **Modern Aesthetics**: Built with customized modern typography (Poppins), elegant glassmorphism effects, responsive sidebar navigation, and interactive animations.
* **IPC-Driven Event Streams**: Operates entirely asynchronously with robust Electron Inter-Process Communication (IPC) handlers to ensure that network operations never freeze the desktop UI.

---

## Project Architecture

```
Bioryx/
├── backend/
│   ├── db/
│   │   └── attendanceDb.ts      # MongoDB connection & punch aggregator service
│   └── device/
│       └── zktecoService.ts     # ZKTeco biometric device wrapper & TCP socket manager
├── electron/
│   ├── main.ts                  # Electron Main Process, IPC Handlers, and cache sync logic
│   └── preload.ts               # Secure context isolation bridge exposing APIs to renderer
├── renderer/
│   ├── core/                    # Global styles, gooey toasts, sidebar logic
│   ├── dashboard/               # Main Dashboard page layout, styling, and controller
│   ├── splash/                  # Elegant startup loading splash screen
│   ├── device-manager/          # UI components for connecting & managing ZKTeco terminals
│   └── attendance/              # Modern grid/table view of punch logs
├── tsconfig.json                # TypeScript project compilation configurations
├── package.json                 # Project dependencies, scripts, and details
└── .env                         # Environmental configuration variables (Not required for production)
```

---

## Configuration & Environment (Not required for production)

Create a `.env` file in the root directory to customize the application's configuration:

```ini
# MongoDB Connection URI (supports SRV cloud clusters)
MONGODB_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/bioryx

# Biometric Device Settings
DEVICE_IP=192.168.1.201
DEVICE_PORT=4370

# Periodic Sync Interval in milliseconds (e.g., 300000 ms = 5 minutes)
SYNC_INTERVAL=300000
```

---

## Getting Started

### Prerequisites

* **Node.js** (v18 or higher recommended)
* **npm** (v9 or higher)
* A physical or simulated ZKTeco attendance machine reachable via your local network.
* A MongoDB instance (local database or MongoDB Atlas cloud cluster).

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/VimukthiPramudantha/Bioryx.git
   cd Bioryx
   ```

2. Install project dependencies:
   ```bash
   npm install
   ```

### Running the Application

To compile TypeScript and start the Electron application concurrently:

```bash
npm start
```

### Build & Compilation

To manually compile TypeScript files from the source directories into the `dist/` build directory:

* Run a single compilation build:
  ```bash
  npm run build
  ```
* Run in watch mode (auto-recompiles on save):
  ```bash
  npm run watch
  ```

---

## Technical Implementation Details

### **How the Daily Attendance Aggregator Works**
Rather than logging hundreds of flat, raw entries in the database, the database layer structures attendance under a daily document format:
```json
{
  "_id": "ObjectId",
  "date": "2026-05-24",
  "records": [
    {
      "userId": "101",
      "name": "Jane Doe",
      "inTime": "2026-05-24T08:02:15.000Z",
      "outTime": "2026-05-24T17:05:42.000Z"
    }
  ]
}
```
* **First punch** of the day initializes the daily document and records the `inTime`.
* **Any subsequent punch** on the same day checks if the new time is later than the stored `inTime` and sets or updates `outTime` to the new punch.

### **Reliable Offline Synchronization**
* Punches gathered while the MongoDB instance is offline are saved locally to:
  `%APPDATA%/bioryx/local_punch_cache.json`
* Once MongoDB connectivity is restored, a chronological batch update is automatically performed to sync all buffered records, ensuring zero data loss and accurate audits.

---

## License

Distributed under the **ISC License**. See `package.json` for details.
