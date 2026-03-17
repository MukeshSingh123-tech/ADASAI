# 🚗 AiLanDetection — Setup Guide

> Complete step-by-step setup for the dual-environment ADAS architecture combining AI lane detection, Adaptive AUTOSAR vehicle software, and Hyperledger Besu blockchain forensics.

---

## 📋 Table of Contents

- [Architecture Overview](#architecture-overview)
- [Prerequisites](#prerequisites)
- [Project Structure](#project-structure)
- [Part A — Ubuntu / WSL](#part-a--ubuntu--wsl)
- [Part B — Windows / VS Code](#part-b--windows--vs-code)
- [MetaMask Setup](#metamask-setup)
- [Tamper Detection Demo](#tamper-detection-demo)
- [Environment Variables](#environment-variables)
- [Besu Network Details](#besu-network-details)
- [Troubleshooting](#troubleshooting)

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                          ADAS Pipeline                           │
├─────────────────┬───────────────────┬───────────────────────────┤
│  Ubuntu / WSL   │   Windows Host    │      Blockchain Layer      │
│                 │                   │                            │
│  C++ Vehicle    │    FastAPI        │   Hyperledger Besu         │
│  Software       │  Orchestrator     │   (4-node IBFT 2.0)        │
│       ↕         │       ↕           │           ↕                │
│  LaneNet AI     │  React Dashboard  │   ForensicLogger           │
│  (Python)       │  localhost:3000   │   Smart Contract           │
│                 │                   │                            │
│       └─────────┤─── ZeroMQ ────────┤──── Web3 Bridge ──────────┘
└─────────────────┴───────────────────┴───────────────────────────┘
```

---

## ✅ Prerequisites

| Software | Version | Install From | Purpose |
|---|---|---|---|
| **Ubuntu / WSL** | 22.04+ | `wsl --install` (PowerShell admin) | C++ vehicle software + AI |
| **Docker Desktop** | Latest | [docker.com](https://www.docker.com/products/docker-desktop) | Besu blockchain nodes |
| **Node.js** | ≥ 18 | [nodejs.org](https://nodejs.org) | Hardhat + React dashboard |
| **Python** | 3.11+ | deadsnakes PPA (see Step 5) | FastAPI, Web3, AI inference |
| **MetaMask** | Browser extension | [metamask.io](https://metamask.io) | Dashboard wallet |
| **CMake** | ≥ 3.16 | via apt | C++ build system |

---

## 📁 Project Structure

```
AiLanDetection/
├── adas_ai_release/           # Python LaneNet AI model
│   ├── inference.py
│   ├── train.py
│   ├── lanenet_today.pth      # Trained weights (generated)
│   └── requirements.txt
├── vehicle_software/          # C++ AUTOSAR vehicle stack
│   ├── CMakeLists.txt
│   └── build/                 # Build output (generated)
│       └── adas_vehicle       # Compiled executable
├── blockchain/
│   ├── besu-network/          # 4-node Hyperledger Besu
│   │   ├── docker-compose.yml
│   │   ├── genesis.json
│   │   └── keys/              # Node keypairs (node1–node4)
│   ├── blockchain/            # Hardhat project (nested)
│   │   ├── hardhat.config.ts
│   │   ├── contracts/
│   │   │   └── ForensicLogger.sol
│   │   └── scripts/
│   │       └── deploy.js
│   └── python/                # Web3 bridge + auditor
├── frontend/                  # React forensic dashboard
├── data/                      # 🎬 Video files
│   ├── lane_video.mp4         # Primary dashcam test video (960×540 @ 25fps)
│   ├── lane_video1.mp4        # Secondary dashcam test video
│   ├── output.mp4             # Annotated inference output (generated)
│   └── output1.mp4            # Secondary annotated output (generated)
└── SETUP.md
```

---

## Part A: Ubuntu / WSL

> All commands in this section run inside an **Ubuntu WSL terminal**.  
> Open VS Code → `` Ctrl+Shift+` `` → dropdown → **Ubuntu (WSL)**

### Step 1 — Navigate to Project

```bash
cd /mnt/c/Users/mukes/OneDrive/Desktop/AiLanDetection
```

### Step 2 — Install C++ Dependencies

```bash
sudo apt-get update
sudo apt-get install -y cmake g++ libopencv-dev libssl-dev libzmq3-dev
```

### Step 3 — Install cppzmq from Source

> **Note:** `libcppzmq-dev` is unavailable on Ubuntu 22.04+. cppzmq must be built from source to provide the `cppzmqConfig.cmake` file required by CMake.

```bash
cd /tmp
git clone https://github.com/zeromq/cppzmq.git
cd cppzmq
mkdir build && cd build
cmake -DCPPZMQ_BUILD_TESTS=OFF ..
sudo make install
```

Expected output includes:
```
-- Installing: /usr/local/share/cmake/cppzmq/cppzmqConfig.cmake
```

> **If CMake fails later** with `Could not find cppzmq`, re-run this step before retrying the build.

### Step 4 — Build C++ Vehicle Software

```bash
cd /mnt/c/Users/mukes/OneDrive/Desktop/AiLanDetection/vehicle_software
mkdir -p build && cd build
cmake ..
cmake --build .
```

Expected: Compiles 5 source files and produces the `adas_vehicle` executable with no errors.

### Step 5 — Install Python 3.11

> **Note:** AI dependencies require Python 3.11+. Ubuntu 22.04 ships Python 3.10 by default.

```bash
sudo apt install software-properties-common -y
sudo add-apt-repository ppa:deadsnakes/ppa -y
sudo apt update
sudo apt install python3.11 python3.11-venv -y

# Install pip for Python 3.11
curl -sS https://bootstrap.pypa.io/get-pip.py | python3.11

# Add python alias — do NOT use update-alternatives (breaks apt)
echo "alias python='python3.11'" >> ~/.bashrc
source ~/.bashrc
```

> ⚠️ **Never** run `sudo update-alternatives --install /usr/bin/python3 python3 /usr/bin/python3.11` — this breaks Ubuntu system tools (`apt`, `add-apt-repository`) that depend on Python 3.10's `apt_pkg` module.

### Step 6 — Install AI Dependencies

```bash
cd /mnt/c/Users/mukes/OneDrive/Desktop/AiLanDetection/adas_ai_release
python3.11 -m pip install -r requirements.txt
```

> ⚠️ Always use `python3.11 -m pip` — not `pip3`. Using `pip3` installs packages into Python 3.10 and they will not be found at runtime.

### Step 7 — Train AI Model (Optional)

Pre-trained weights (`lanenet_today.pth`) are included. Re-training is optional.

```bash
cd /mnt/c/Users/mukes/OneDrive/Desktop/AiLanDetection/adas_ai_release

# Quick test (1 epoch, ~52 seconds)
python train.py --quick

# Full training (recommended — ~18 minutes on CPU)
python train.py --data-dir ./dataset --epochs 20

# Resume from checkpoint
python train.py --resume lanenet_today.pth --epochs 10
```

Output files: `lanenet_today.pth` (weights) + `training_log.json` (metrics)

**Expected training results (20 epochs):**
```
Epoch   1/20  loss=0.429457
Epoch  10/20  loss=0.018475
Epoch  20/20  loss=0.013254  ★ best
```

### Step 8 — Run AI Inference

Two test videos are available in the `data/` folder:

```bash
cd /mnt/c/Users/mukes/OneDrive/Desktop/AiLanDetection/adas_ai_release

# Primary video
python inference.py /mnt/c/Users/mukes/OneDrive/Desktop/AiLanDetection/data/lane_video.mp4 \
  --output /mnt/c/Users/mukes/OneDrive/Desktop/AiLanDetection/data/output.mp4

# Secondary video
python inference.py /mnt/c/Users/mukes/OneDrive/Desktop/AiLanDetection/data/lane_video1.mp4 \
  --output /mnt/c/Users/mukes/OneDrive/Desktop/AiLanDetection/data/output1.mp4
```

> ⚠️ Do **not** use `--preview` in WSL — it crashes with a Qt display error. Use `--output` to save the annotated video and open it in Windows Explorer.

**Expected results — lane_video.mp4:**
```
[AI MODEL] LaneNet loaded on cpu
[AI MODEL] Parameters: 32,833
[AI MODEL] Resolution: 960×540 @ 25fps, 681 frames
[AI MODEL] Detection rate: 681/681 (100.0%)
[AI MODEL] Avg confidence: 0.509
[AI MODEL] Avg |offset|:   0.047m
```

**Expected results — lane_video1.mp4:**
```
[AI MODEL] Resolution: 960×540 @ 25fps, 221 frames
[AI MODEL] Detection rate: 221/221 (100.0%)
[AI MODEL] Avg confidence: 0.418
[AI MODEL] Avg |offset|:   0.037m
```

View annotated output videos directly in Windows:
```
C:\Users\mukes\OneDrive\Desktop\AiLanDetection\data\output.mp4
C:\Users\mukes\OneDrive\Desktop\AiLanDetection\data\output1.mp4
```

### Step 9 — Run Vehicle Software

```bash
cd /mnt/c/Users/mukes/OneDrive/Desktop/AiLanDetection/vehicle_software/build

# Primary video
./adas_vehicle /mnt/c/Users/mukes/OneDrive/Desktop/AiLanDetection/data/lane_video.mp4

# Secondary video
./adas_vehicle /mnt/c/Users/mukes/OneDrive/Desktop/AiLanDetection/data/lane_video1.mp4
```

Expected output — lane departure events with SHA-256 hashes published over ZeroMQ:
```
[DECISION] ⚠  LANE_DEPARTURE_RIGHT  dev=50.25px  conf=30  hash=939702b8...  (total=1)
...
[DECISION] Shutting down. Published 173 events.
```

**Keep this terminal running** when using the Web3 bridge — it continuously publishes ADAS events over ZeroMQ on `tcp://*:5555`.

---

## Part B: Windows / VS Code

> All commands in this section run in a **regular PowerShell terminal** (not WSL).  
> Open VS Code → `` Ctrl+Shift+` `` → ensure terminal type is **PowerShell**.

### Step 10 — Install Root Python Dependencies

```powershell
cd C:\Users\mukes\OneDrive\Desktop\AiLanDetection
pip install -r requirements.txt
```

### Step 11 — Start FastAPI Orchestrator

```powershell
python main.py
```

Open **http://localhost:8000/docs** — Swagger API documentation.

### Step 12 — Setup and Start Besu Blockchain Network

> ⚠️ The Besu network requires correctly generated node keys and genesis configuration. Run all sub-steps below on first setup.

**12a — Ensure Docker Desktop is running** (check system tray icon, wait for "Engine running").

**12b — Regenerate Besu node keys and genesis using Besu's own tool:**

```powershell
cd C:\Users\mukes\OneDrive\Desktop\AiLanDetection\blockchain\besu-network

# Write Besu config without BOM encoding
$config = '{"genesis":{"config":{"chainId":1337,"berlinBlock":0,"ibft2":{"blockperiodseconds":2,"epochlength":30000,"requesttimeoutseconds":4}},"nonce":"0x0","timestamp":"0x58ee40ba","gasLimit":"0x1fffffffffffff","difficulty":"0x1","mixHash":"0x63746963616c2062797a616e74696e65206661756c7420746f6c6572616e6365","coinbase":"0x0000000000000000000000000000000000000000","alloc":{"fe3b557e8fb62b89f4916b721be55ceb828dbd73":{"balance":"0xad78ebc5ac6200000"},"627306090abaB3A6e1400e9345bC60c78a8BEf57":{"balance":"0xad78ebc5ac6200000"},"f17f52151EbEF6C7334FAD080c5704D77216b732":{"balance":"0xad78ebc5ac6200000"}}},"blockchain":{"nodes":{"generate":true,"count":4}}}'
$utf8NoBom = New-Object System.Text.UTF8Encoding $false
New-Item -ItemType Directory -Force -Path "C:\temp\besu-input" | Out-Null
New-Item -ItemType Directory -Force -Path "C:\temp\besu-output" | Out-Null
Remove-Item "C:\temp\besu-output\*" -Recurse -Force 2>$null
[System.IO.File]::WriteAllText("C:\temp\besu-input\config.json", $config, $utf8NoBom)

# Generate keys and genesis using Besu's own tool
docker run --rm `
  -v "C:\temp\besu-input:/input" `
  -v "C:\temp\besu-output:/output" `
  hyperledger/besu:latest `
  operator generate-blockchain-config `
  --config-file=/input/config.json `
  --to=/output `
  --private-key-file-name=key

# Copy genesis.json
Copy-Item "C:\temp\besu-output\genesis.json" ".\genesis.json" -Force

# Copy node keys
$dirs = Get-ChildItem "C:\temp\besu-output\keys" -Directory | Sort-Object Name
$i = 1
foreach ($dir in $dirs) {
    $dest = ".\keys\node$i"
    New-Item -ItemType Directory -Force -Path $dest | Out-Null
    Copy-Item "$($dir.FullName)\key" "$dest\key" -Force
    Copy-Item "$($dir.FullName)\key.pub" "$dest\key.pub" -Force
    $i++
}

# Update docker-compose.yml bootnode with correct node1 public key
$pub = (Get-Content ".\keys\node1\key.pub").Trim().Replace("0x","")
$bootnode = "enode://${pub}@172.16.239.11:30303"
(Get-Content ".\docker-compose.yml") -replace 'enode://.*@172.16.239.11:30303', $bootnode | Set-Content ".\docker-compose.yml"
Write-Host "Besu config regenerated successfully"
```

**12c — Add shanghaiTime to genesis** (required for Solidity 0.8.28 PUSH0 opcode support):

```powershell
$genesis = Get-Content ".\genesis.json" | ConvertFrom-Json
$genesis.config | Add-Member -NotePropertyName "shanghaiTime" -NotePropertyValue 0 -Force
$genesis | ConvertTo-Json -Depth 10 | Set-Content ".\genesis.json"
Write-Host "shanghaiTime added to genesis.json"
```

**12d — Start the network:**

```powershell
docker-compose down -v
docker-compose up -d
```

Wait ~60 seconds, then verify all 4 nodes are healthy:

```powershell
docker-compose ps
```

Expected — all nodes show `(healthy)`:
```
NAME         STATUS
besu-node1   Up 1 minute (healthy)
besu-node2   Up 1 minute (healthy)
besu-node3   Up 1 minute (healthy)
besu-node4   Up 1 minute (healthy)
```

> On subsequent runs, just `docker-compose up -d` — no need to regenerate keys.

### Step 13 — Deploy Smart Contract

> **Important:** The Hardhat project is inside `blockchain/blockchain/` (nested folder), not `blockchain/`.

```powershell
cd C:\Users\mukes\OneDrive\Desktop\AiLanDetection\blockchain\blockchain
npm install
npx hardhat run scripts/deploy.js --network besu
```

Expected output:
```
ForensicLogger deployed to: 0x8CdaF0CD259887258Bc13a92C0a6dA92698644C0
Deployment info saved to: deployments/besu.json
Frontend config saved to: frontend/public/config.json
```

> The contract address is automatically saved to `frontend/public/config.json` — no manual copy needed.

### Step 14 — Start React Dashboard

```powershell
cd C:\Users\mukes\OneDrive\Desktop\AiLanDetection\blockchain\blockchain\frontend
npm install
npm run dev
```

Opens **http://localhost:3000** — the dashboard automatically:
- Connects to FastAPI at `:8000` via Vite proxy
- Loads contract address from `config.json`
- Displays live system health (Besu, Contract, AI, ZMQ, Vehicle Log)

### Step 15 — Run Web3 Bridge

```powershell
cd C:\Users\mukes\OneDrive\Desktop\AiLanDetection\blockchain\python
pip install -r requirements.txt
python web3_bridge.py --contract 0x8CdaF0CD259887258Bc13a92C0a6dA92698644C0
```

> Replace the contract address with the one printed during Step 13.

### Step 16 — Forensic Audit

After running the system for 10–30 seconds, stop the vehicle software and bridge, then audit:

```powershell
python auditor.py --contract 0x8CdaF0CD259887258Bc13a92C0a6dA92698644C0 --log-file vehicle_log.txt
```

---

## 🦊 MetaMask Setup

### Add Besu Local Network

| Field | Value |
|---|---|
| Network Name | `Besu Local` |
| RPC URL | `http://127.0.0.1:8545` |
| Chain ID | `1337` |
| Currency Symbol | `ETH` |

### Import Pre-funded Test Account

Private key (200 ETH pre-funded in genesis):
```
0xc87509a1c067bbde78beb793e6fa76530b6382a4c0241e5e4a9ec0a0f44dc0d3
```

> ⚠️ Local development key only. Never use on mainnet or with real funds.

---

## 🔍 Tamper Detection Demo

1. Run the full pipeline (Steps 9 + 15) for 10–30 seconds then stop both
2. Open `vehicle_log.txt` in any text editor and modify any field:
   ```
   "confidence": 98.5  →  "confidence": 10.0
   ```
3. Re-run the auditor:
   ```powershell
   python auditor.py --contract 0x<ADDRESS> --log-file vehicle_log.txt
   ```
4. Expected output:
   ```
   Line    3  [ALERT] Tampering Detected
              This hash does NOT exist on the blockchain!
   ```

---

## ⚙️ Environment Variables

Copy `.env.example` to `.env` and configure:

| Variable | Description | Default |
|---|---|---|
| `BESU_RPC_URL` | Besu JSON-RPC endpoint | `http://127.0.0.1:8545` |
| `ADAS_CONTRACT_ADDRESS` | Deployed ForensicLogger address | Auto-detected from `config.json` |
| `ADAS_PRIVATE_KEY` | Ethereum private key (hex) | Pre-funded genesis account |
| `ZMQ_ENDPOINT` | ZeroMQ publisher address | `tcp://127.0.0.1:5555` |
| `API_HOST` / `API_PORT` | FastAPI server bind | `0.0.0.0:8000` |

---

## 📊 Besu Network Details

| Setting | Value |
|---|---|
| Consensus | IBFT 2.0 |
| Block Period | 2 seconds |
| Gas Price | 0 (free transactions) |
| Chain ID | 1337 |
| EVM Version | Shanghai (PUSH0 opcode support) |
| JSON-RPC | `localhost:8545` |
| Validators | 4 nodes |

---

## 🛠️ Troubleshooting

| Problem | Solution |
|---|---|
| `libcppzmq-dev` not found | Build cppzmq from source — see Step 3 |
| `Could not find cppzmq` in CMake | Re-run Step 3, then re-run `cmake ..` |
| `ModuleNotFoundError: No module named 'cv2'` | Run `python3.11 -m pip install opencv-python` |
| `ModuleNotFoundError: No module named 'torch'` | Wrong Python version — run `python3.11 -m pip install -r requirements.txt` |
| `command 'python' not found` | Add alias: `echo "alias python='python3.11'" >> ~/.bashrc && source ~/.bashrc` |
| `No module named 'apt_pkg'` | Caused by `update-alternatives` — revert: `sudo update-alternatives --remove python3 /usr/bin/python3.11` |
| `[AI MODEL] ERROR: Cannot open video` | Use absolute path: `/mnt/c/Users/mukes/.../data/lane_video.mp4` |
| `--preview` crashes in WSL | Qt requires a display — use `--output output.mp4` instead |
| `contourpy==1.3.3` not found | Requires Python 3.11+ — use `python3.11 -m pip install` |
| Docker won't start | Open Docker Desktop from Start menu, wait for "Engine running" |
| Besu nodes stuck at `health: starting` | Wait 90 seconds. If still failing: `docker logs besu-node2 --tail 20` |
| Besu `Invalid enode URL` or wrong key length | Re-run Step 12b to regenerate node keys using Besu's own tool |
| Besu `Cannot read a arbitrary bytes value` | Corrupted genesis extraData — re-run Step 12b |
| Besu `Invalid opcode: 0x5f` on deploy | Add `shanghaiTime: 0` to genesis — see Step 12c |
| `Gas price below configured minimum` | Add `gasPrice: 0` to besu network in `hardhat.config.ts` |
| `Error HHE3: No Hardhat config file found` | Wrong directory — use `blockchain/blockchain/` not `blockchain/` |
| ZMQ connection refused | Start C++ vehicle software (Step 9) before Python bridge (Step 15) |
| Contract deployment fails | All 4 Besu nodes must show `(healthy)`: `docker-compose ps` |
| Dashboard shows "FastAPI unreachable" | Run `python main.py` in a separate terminal |
| Wrong chain ID in MetaMask | Set Chain ID to `1337` in MetaMask network settings |

---

<div align="center">

Built with ❤️ — LaneNet AI · AUTOSAR C++ · Hyperledger Besu · React

</div>
