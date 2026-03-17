@echo off
REM ===========================================================================
REM  setup.bat — One-Click Setup for ADAS Blockchain Module (Windows / VS Code)
REM ===========================================================================
REM
REM  Run this from the blockchain/ directory in VS Code PowerShell/CMD terminal.
REM
REM  Prerequisites:
REM    - Docker Desktop (running)
REM    - Node.js >= 18
REM    - Python >= 3.9  (pip)
REM
REM  What this script does:
REM    1. Installs root Python deps (FastAPI, PyTorch, Web3)
REM    2. Starts the 4-node Besu IBFT 2.0 network via Docker Compose
REM    3. Installs Hardhat dependencies (npm install)
REM    4. Compiles and deploys ForensicLogger.sol to the Besu network
REM    5. Installs React dashboard dependencies (npm install)
REM    6. Prints next steps
REM
REM  Author: Mukesh Singh
REM  Date:   2026-03-11
REM ===========================================================================

echo.
echo ================================================================
echo   ADAS Blockchain Forensics — Automated Setup v2.0
echo   Secure Adaptive AUTOSAR Architecture
echo   Author: Mukesh Singh
echo ================================================================
echo.

REM ---- Step 1: Root Python deps ----
echo [1/5] Installing root Python dependencies (FastAPI, PyTorch, Web3)...
cd /d "%~dp0.."
pip install -r requirements.txt
if %ERRORLEVEL% NEQ 0 (
    echo WARNING: pip install had issues. Check your Python environment.
)
cd /d "%~dp0"

REM ---- Step 2: Start Besu network ----
echo.
echo [2/5] Starting 4-node Besu IBFT 2.0 network...
echo       (requires Docker Desktop to be running)
echo.
cd /d "%~dp0besu-network"
docker-compose up -d
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ERROR: docker-compose failed.
    echo   - Is Docker Desktop running?
    echo   - Try: docker-compose down -v   then re-run this script
    pause
    exit /b 1
)

echo.
echo Waiting 20 seconds for Besu nodes to initialise and form consensus...
timeout /t 20 /nobreak >nul

REM Verify Besu is responding
echo Verifying Besu JSON-RPC...
curl -s http://localhost:8545 -X POST --data "{\"jsonrpc\":\"2.0\",\"method\":\"eth_blockNumber\",\"params\":[],\"id\":1}" -H "Content-Type: application/json" >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo WARNING: Besu JSON-RPC not responding yet. It may need more time.
) else (
    echo Besu is running and responding on http://localhost:8545
)

REM ---- Step 3: Install Hardhat deps + compile + deploy ----
echo.
echo [3/5] Installing Hardhat dependencies and deploying contract...
cd /d "%~dp0blockchain"
call npm install
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: npm install failed. Is Node.js >= 18 installed?
    pause
    exit /b 1
)

call npx hardhat compile
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Hardhat compile failed.
    pause
    exit /b 1
)

call npx hardhat run scripts/deploy.js --network localhost
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Deployment failed. Is the Besu network running?
    pause
    exit /b 1
)

REM ---- Step 4: React dashboard deps ----
echo.
echo [4/5] Installing React dashboard dependencies...
cd /d "%~dp0blockchain\frontend"
call npm install
if %ERRORLEVEL% NEQ 0 (
    echo WARNING: React dashboard npm install had issues.
)

REM ---- Step 5: Python bridge deps ----
echo.
echo [5/5] Installing Python bridge dependencies...
cd /d "%~dp0python"
pip install -r requirements.txt
if %ERRORLEVEL% NEQ 0 (
    echo WARNING: pip install had issues.
)

echo.
echo ================================================================
echo   Setup Complete!
echo ================================================================
echo.
echo   The ForensicLogger contract has been deployed.
echo   Copy the contract address printed above.
echo.
echo   NEXT STEPS:
echo.
echo   Terminal 1 (VS Code - FastAPI):
echo     cd ..
echo     python main.py
echo     (opens API at http://localhost:8000/docs)
echo.
echo   Terminal 2 (VS Code - React Dashboard):
echo     cd blockchain\blockchain\frontend
echo     npm run dev
echo     (opens dashboard at http://localhost:3000)
echo.
echo   Terminal 3 (VS Code - Web3 Bridge):
echo     cd blockchain\python
echo     python web3_bridge.py --contract 0x^<ADDRESS^>
echo.
echo   Terminal 4 (Ubuntu/WSL - Vehicle Software):
echo     cd vehicle_software/build
echo     ./adas_vehicle ../../data/lane_video.mp4
echo.
echo   Terminal 5 (Ubuntu/WSL - AI Training, optional):
echo     cd adas_ai_release
echo     python train.py --epochs 20
echo.
echo ================================================================
echo.
pause
