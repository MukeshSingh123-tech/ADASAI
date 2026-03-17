# 🚗 AiLanDetection — Complete Setup Guide

Welcome to the **AiLanDetection** project! This system is a high-performance ADAS (Advanced Driver Assistance System) prototype that combines **AI Perception**, **Real-Time Vehicle Software**, and **Blockchain Forensics**.

---

## 🏗️ System Architecture

- **Perception Layer (WSL/Ubuntu)**: C++ software running a LaneNet AI model to detect lane departures in real-time.
- **Orchestration Layer (Windows)**: A FastAPI backend that streams events via WebSockets to a React Dashboard.
- **Forensic Layer (Blockchain)**: A 4-node Hyperledger Besu network that stores immutable SHA-256 hashes of every vehicle event for cross-verification.

---

## ✅ Prerequisites

| Software | Version | Purpose |
|---|---|---|
| **Ubuntu / WSL** | 22.04+ | Running the C++ Vehicle Software |
| **Docker Desktop** | Latest | Running the 4-node Besu Network |
| **Node.js** | ≥ 18 | React Frontend + Smart Contract Deployment |
| **Python** | 3.11+ | Central FastAPI API + Web3 Bridge |

---

## 📁 Project Structure

```
AiLanDetection/
├── adas_ai_release/           # LaneNet AI Model (PyTorch)
├── vehicle_software/          # C++ Vehicle Stack (ZeroMQ)
├── blockchain/
│   ├── besu-network/          # 4-node Local Blockchain
│   ├── blockchain/            # Hardhat Project (ForensicLogger.sol)
│   └── python/                # Web3 Bridge & vehicle_log.txt (Forensic Log)
├── frontend/                  # React Forensic Dashboard
└── main.py                    # FastAPI Central Orchestrator
```

---

## 🚀 Step-by-Step Execution

### Part 1: Start the Blockchain (Windows)
1. **Launch Besu**:
   ```powershell
   cd blockchain/besu-network
   docker-compose up -d
   ```
2. **Deploy Contract**:
   ```powershell
   cd ../blockchain
   npm install && npx hardhat run scripts/deploy.js --network besu
   ```

### Part 2: Start the Central API (Windows)
```powershell
pip install -r requirements.txt
python main.py
```

### Part 3: Start the Vehicle perception (WSL/Ubuntu)
```bash
cd vehicle_software/build
./adas_vehicle ../../data/lane_video.mp4
```

### Part 4: Start the Dashboard & Bridge (Windows)
1. **Frontend**:
   ```powershell
   cd blockchain/blockchain/frontend
   npm install && npm run dev
   ```
2. **Web3 Bridge**:
   ```powershell
   cd blockchain/python
   python web3_bridge.py --contract <DEPLOYED_ADDRESS>
   ```

---

## 🛡️ Forensic Audit Demo

This project features a powerful **Forensic Integrity Suite** that you can test directly from the browser at **localhost:3000**:

### 1. Simulate an Attack
In the **Off-Chain Vehicle Logs** card, click the red **! Tamper Data** button. This mimics an attacker modifying the local log file after an accident.

### 2. Run Full Audit
Click the **🔍 Full Audit** button. The system will perform a sub-second batch scan of the entire log file against the blockchain and generate a report showing exactly which line was corrupted.

### 3. Live Analytics
Watch the **📈 AI Perception Confidence** chart. It streams live data from the vehicle to show how the AI perceives the road in real-time.

### 4. Export Evidence
Click **📥 Export CSV** to download a verifiable forensic report that cross-references local logs with on-chain blockchain proofs.

---

## 🛠️ Environmental Settings
- **RPC URL**: `http://localhost:8545`
- **Dashboard**: `http://localhost:3000`
- **API Docs**: `http://localhost:8000/docs`

---
<div align="center">
Built for AI Safety and Blockchain Accountability.
</div>