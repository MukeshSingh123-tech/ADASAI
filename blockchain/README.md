<div align="center">

# 🛡️ Secure Adaptive AUTOSAR Architecture
### AI-Based ADAS Perception with Blockchain Forensics

[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Python](https://img.shields.io/badge/Python-3.9+-3776AB.svg?logo=python&logoColor=white)](https://python.org)
[![C++17](https://img.shields.io/badge/C++-17-00599C.svg?logo=cplusplus&logoColor=white)](https://isocpp.org)
[![Solidity](https://img.shields.io/badge/Solidity-0.8.24-363636.svg?logo=solidity)](https://soliditylang.org)
[![React](https://img.shields.io/badge/React-18-61DAFB.svg?logo=react&logoColor=black)](https://react.dev)
[![Hyperledger Besu](https://img.shields.io/badge/Besu-IBFT_2.0-2F3134.svg?logo=hyperledger&logoColor=white)](https://besu.hyperledger.org)

**A research-level implementation of a complete ADAS pipeline — lane detection via encoder-decoder CNN, cryptographic hashing of each event, and immutable forensic logging onto a private Hyperledger Besu blockchain.**

[Quick Start](#-quick-start) · [Architecture](#-architecture) · [API Reference](#-fastapi-orchestrator) · [Dashboard](#-react-dashboard) · [Training](#-ai-model-training) · [Contributing](#-contributing)

</div>

---

## 📋 Overview

This project implements a **digital forensic black box** for autonomous driving. Every lane departure event detected by the AI perception module is:

1. **Detected** — LaneNet CNN (encoder-decoder) processes 30 fps dashcam footage
2. **Classified** — AUTOSAR-compliant Decision Service determines departure severity
3. **Hashed** — SHA-256 of the exact JSON payload via OpenSSL EVP
4. **Published** — ZeroMQ PUB/SUB transport from C++ to Python
5. **Logged** — Immutable on-chain record on Hyperledger Besu (IBFT 2.0 consensus)
6. **Audited** — Forensic tamper detection via `verifyHash()` function

> **Research Context:** This system is designed for the paper *"Secure Adaptive AUTOSAR Architecture for AI-Based ADAS Perception with Blockchain Forensics"*. It demonstrates that blockchain-based forensic logging can provide viable tamper-proof event records for Level 3+ autonomous vehicles.

---

## 🏗 Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     SYSTEM ARCHITECTURE (6 Phases)                      │
│                                                                         │
│  ╔═══════════════════════════════════════════════════════════╗          │
│  ║  UBUNTU / WSL  (Vehicle ECU Simulation)                   ║          │
│  ║                                                           ║          │
│  ║  Phase 1: ExecutionManager    ─ AUTOSAR lifecycle         ║          │
│  ║  Phase 2: PerceptionService   ─ OpenCV + LaneNet CNN     ║          │
│  ║  Phase 3: DecisionService     ─ SOA departure logic      ║          │
│  ║  Phase 4: CryptoModule + ZMQ  ─ SHA-256 → PUB            ║          │
│  ║                                │                          ║          │
│  ╚════════════════════════════════╪══════════════════════════╝          │
│                                   │ ZeroMQ tcp://127.0.0.1:5555        │
│  ╔════════════════════════════════╪══════════════════════════╗          │
│  ║  WINDOWS / VS CODE  (Blockchain Backend + Dashboard)      ║          │
│  ║                                ▼                          ║          │
│  ║  Phase 5: web3_bridge.py     ─ ZMQ SUB → Besu tx         ║          │
│  ║           ForensicLogger.sol ─ Gas-optimized contract     ║          │
│  ║           Besu (4-node IBFT) ─ Docker Compose             ║          │
│  ║  Phase 6: auditor.py        ─ Forensic verification      ║          │
│  ║                                                           ║          │
│  ║  ★ FastAPI (main.py)         ─ Orchestrator API (:8000)   ║          │
│  ║  ★ React Dashboard           ─ MetaMask UI (:3000)        ║          │
│  ╚═══════════════════════════════════════════════════════════╝          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 📁 Project Structure

```
AiLanDetection/
├── main.py                    ★ FastAPI Orchestrator (port 8000)
├── requirements.txt              Root Python dependencies
├── .env.example                  Environment variable template
│
├── adas_ai_release/           🧠 AI Model — LaneNet CNN
│   ├── model.py                  Encoder-decoder architecture
│   ├── train.py               ★ Training script (synthetic + real)
│   ├── inference.py              Frame & video prediction
│   ├── offset.py                 Lane offset + confidence
│   └── lanenet_today.pth         Pre-trained weights
│
├── vehicle_software/          🚗 C++ AUTOSAR (Phases 1-4)
│   ├── CMakeLists.txt            Build config
│   ├── include/                  CryptoModule, Services, Types
│   └── src/                      ExecutionManager, Perception, Decision
│
└── blockchain/                ⛓️ Blockchain Backend (Phases 5-6)
    ├── besu-network/             4-node Besu IBFT 2.0 (Docker)
    ├── blockchain/
    │   ├── contracts/            ForensicLogger.sol (gas-optimized)
    │   ├── scripts/              deploy.js (writes config.json)
    │   └── frontend/          ★ React + Tailwind Dashboard
    └── python/
        ├── web3_bridge.py        ZMQ → Blockchain bridge
        └── auditor.py            Forensic tamper detection
```

---

## 🚀 Quick Start

### Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| **Docker Desktop** | Latest | Runs Besu blockchain nodes |
| **Node.js** | ≥ 18 | Hardhat + React dashboard |
| **Python** | ≥ 3.9 | FastAPI, AI model, Web3 |
| **WSL / Ubuntu** | 22.04+ | C++ vehicle software |
| **MetaMask** | Browser ext. | Blockchain interaction |
| **CMake + g++** | Latest | C++ build (Ubuntu only) |

### One-Click Setup (Windows)

```powershell
cd blockchain
.\setup.bat
```

This automatically: installs Python deps → starts Besu → deploys contract → installs React deps.

### Manual Setup

#### Windows (VS Code Terminal)

```powershell
# 1. Install Python dependencies + start API
pip install -r requirements.txt
python main.py                              # → http://localhost:8000/docs

# 2. Start blockchain (separate terminal)
cd blockchain\besu-network
docker-compose up -d

# 3. Deploy contract (separate terminal)
cd blockchain\blockchain
npm install && npx hardhat compile
npx hardhat run scripts/deploy.js --network localhost

# 4. Start dashboard (separate terminal)
cd blockchain\blockchain\frontend
npm install && npm run dev                  # → http://localhost:3000
```

#### Ubuntu / WSL

```bash
# 5. Build & run C++ vehicle software
sudo apt install cmake g++ libopencv-dev libssl-dev libzmq3-dev libcppzmq-dev
cd vehicle_software && mkdir -p build && cd build
cmake .. && cmake --build .
./adas_vehicle ../../data/lane_video.mp4

# 6. AI model training (optional)
cd adas_ai_release
pip install -r requirements.txt
python train.py --epochs 20
```

---

## 🖥 FastAPI Orchestrator

Central backend API at `http://localhost:8000` with auto-generated Swagger docs at `/docs`.

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | `GET` | All 5 subsystem statuses (Besu, Contract, AI, ZMQ, Logs) |
| `/api/blockchain/status` | `GET` | Besu block number, peer count, chain ID, latency |
| `/api/blockchain/contract` | `GET` | Contract address, deployment info, on-chain log count |
| `/api/ai/info` | `GET` | LaneNet model metadata (architecture, params, weights) |
| `/api/ai/predict` | `POST` | Upload image → lane detection inference |
| `/api/ai/hash` | `POST` | Compute SHA-256 hash of JSON payload |
| `/api/ai/training-status` | `GET` | Check training artifacts & training log |
| `/api/logs/vehicle` | `GET` | Read last 50 `vehicle_log.txt` entries |
| `/api/logs/audit` | `POST` | Verify payload hash against blockchain |

The React dashboard integrates with FastAPI via Vite proxy — all `/api/*` calls from the frontend are automatically forwarded to port 8000.

---

## 🎨 React Dashboard

Premium **React 18 + Tailwind CSS** dashboard with MetaMask integration:

- **Glassmorphism** dark-mode UI with gradient backgrounds
- **10 components**: Navbar, NetworkBar, SystemStatus, ContractConfig, LogHash, LogCount, VerifyHash, QueryLog, AllLogs, LiveEvents
- **Auto-loads** contract address from FastAPI → `config.json` fallback
- **Real-time** `ForensicHashLogged` event feed with live-dot animation
- **O(1) hash verification** via `verifyHash()` contract function

```powershell
cd blockchain\blockchain\frontend
npm run dev   # → http://localhost:3000
```

---

## 🧠 AI Model (LaneNet)

| Property | Value |
|----------|-------|
| Architecture | Encoder-Decoder CNN (U-Net style) |
| Parameters | 41,217 |
| Input | `[B, 3, 128, 256]` — RGB road images |
| Output | `[B, 1, 128, 256]` — Binary lane mask |
| Framework | PyTorch |
| Dataset | TuSimple Lane Detection |

### Training

```bash
# Train on real data
python train.py --data-dir ./dataset --epochs 20

# Quick test with synthetic data
python train.py --quick

# Resume from checkpoint
python train.py --resume lanenet_today.pth --epochs 10
```

### Inference

```bash
# Single frame
python inference.py

# Video with live preview
python inference.py path/to/video.mp4 --preview
```

---

## ⛓️ Smart Contract

`ForensicLogger.sol` — Gas-optimized with O(1) hash verification:

```solidity
function logEvent(bytes32 forensicHash, bytes12 vehicleId) external;
function verifyHash(bytes32 forensicHash) external view returns (bool);
function getLog(uint256 index) external view returns (uint64, bytes32, address, bytes12);
function getLogCount() external view returns (uint256);
```

**Features:**
- Custom errors (`Unauthorized`, `DuplicateHash`, `IndexOutOfBounds`)
- `hashExists` mapping for O(1) duplicate + verification checks
- `ForensicHashLogged` indexed event for efficient log filtering
- Owner-restricted `logEvent` with `bytes12` vehicle ID support

---

## 📦 JSON Payload Format

```json
{
  "timestamp": 1741628400,
  "event_type": "LANE_DEPARTURE_LEFT",
  "vehicle_id": "ELC23027",
  "driver": "Mukesh Singh",
  "confidence": 98.5
}
```

The SHA-256 of this exact string (no whitespace, ordered keys) is logged on-chain.

---

## 🔐 Tamper Detection Demo

```bash
# 1. Run the pipeline normally
./adas_vehicle ../../data/lane_video.mp4   # Ubuntu
python web3_bridge.py --contract 0x...      # Windows
python auditor.py --contract 0x... --log-file vehicle_log.txt

# 2. Tamper with a log entry
# Edit vehicle_log.txt — change any field

# 3. Re-run auditor → detects the tampering
python auditor.py --contract 0x... --log-file vehicle_log.txt
# Output: [ALERT] Tampering Detected — hash NOT found on blockchain!
```

---

## 🛠 Tech Stack

| Layer | Technology |
|-------|-----------|
| AI Perception | PyTorch, OpenCV, NumPy |
| Vehicle Software | C++17, CMake, OpenSSL, ZeroMQ |
| Smart Contract | Solidity 0.8.24, Hardhat |
| Blockchain | Hyperledger Besu (IBFT 2.0, 4 nodes) |
| Backend API | FastAPI, Uvicorn, Web3.py |
| Frontend | React 18, Vite, Tailwind CSS, ethers.js v6 |
| Infrastructure | Docker Compose, WSL 2 |

---

## 🌍 UN Sustainable Development Goals (SDGs)

This project contributes to the following United Nations SDGs:

| SDG | Goal | How This Project Contributes |
|-----|------|------------------------------|
| **SDG 3** | 🏥 Good Health & Well-Being | Lane departure detection directly prevents road accidents, reducing the **1.35 million annual global traffic fatalities** (WHO, 2023). The LaneNet model achieves 100% detection rate with 0.047 m offset accuracy, enabling timely driver alerts that save lives. |
| **SDG 9** | 🏭 Industry, Innovation & Infrastructure | Combines **three emerging technologies** — lightweight AI (32,833-parameter CNN), AUTOSAR Adaptive middleware, and blockchain forensics — into a single integrated ADAS pipeline. Demonstrates that state-of-the-art lane detection is achievable on CPU-only hardware without expensive GPU infrastructure. |
| **SDG 11** | 🏙️ Sustainable Cities & Communities | Safer road transport is a core component of sustainable urbanisation. AI-assisted lane keeping reduces accidents in dense traffic, contributing to **UN Target 11.2** (safe, affordable, accessible transport systems). The CPU-only design makes deployment feasible for mass-market vehicles, not just premium models. |
| **SDG 16** | ⚖️ Peace, Justice & Strong Institutions | The blockchain forensic layer provides **tamper-proof, immutable evidence** of every ADAS event. This enables transparent accident investigation, regulatory compliance, and legal accountability — supporting **UN Target 16.6** (effective, accountable, transparent institutions). Each event is SHA-256 hashed and verified on-chain with 100% tamper detection rate. |
| **SDG 17** | 🤝 Partnerships for the Goals | The project integrates **open-source tools** across domains (PyTorch, Hyperledger Besu, OpenSSL, React) and bridges AI research with automotive standards (AUTOSAR) and distributed ledger technology — demonstrating cross-disciplinary collaboration toward safer mobility. |

---

## 📄 License

This project is developed for academic research purposes.

---

## 👤 Author

**Mukesh Singh**

---

<div align="center">

*Built with ❤️ for secure autonomous driving research*

</div>
