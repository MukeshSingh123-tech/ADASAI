"""
main.py — FastAPI Orchestrator for ADAS Blockchain Forensics
═════════════════════════════════════════════════════════════

Central backend API that coordinates all system components:
  • Hyperledger Besu blockchain health monitoring
  • ForensicLogger smart contract interaction
  • AI model (LaneNet) inference
  • ZeroMQ service status
  • Vehicle software monitoring

┌─────────────────────────────────────────────────────────────────────┐
│  API ARCHITECTURE                                                   │
│                                                                     │
│  React Dashboard ──► FastAPI (:8000) ──┬──► Besu RPC (:8545)       │
│  (localhost:3000)    (this file)       ├──► LaneNet CNN             │
│                                       ├──► ZMQ Status              │
│                                       └──► Vehicle Log Files       │
└─────────────────────────────────────────────────────────────────────┘

Runs on: Windows (VS Code terminal) — same machine as blockchain
Usage:   uvicorn main:app --reload --port 8000

@author  Mukesh Singh
@date    2026-03-11
"""

import os
import sys
import json
import time
import hashlib
import logging
from pathlib import Path
from typing import Optional
from datetime import datetime

try:
    import numpy as np
except ImportError:
    np = None
from fastapi import FastAPI, HTTPException, UploadFile, File, WebSocket, WebSocketDisconnect, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import asyncio
from pydantic import BaseModel

# ─────────────────────────────────────────────────────────────────────
#  Logging
# ─────────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)-5s] %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("adas-api")

# ─────────────────────────────────────────────────────────────────────
#  Constants & Configuration
# ─────────────────────────────────────────────────────────────────────
PROJECT_ROOT = Path(__file__).resolve().parent
AI_MODEL_DIR = PROJECT_ROOT / "adas_ai_release"
BLOCKCHAIN_DIR = PROJECT_ROOT / "blockchain"
VEHICLE_DIR = PROJECT_ROOT / "vehicle_software"

BESU_RPC_URL = os.getenv("BESU_RPC_URL", "http://127.0.0.1:8545")
CONTRACT_ADDRESS = os.getenv("ADAS_CONTRACT_ADDRESS", "0x8CdaF0CD259887258Bc13a92C0a6dA92698644C0")
ZMQ_ENDPOINT = os.getenv("ZMQ_ENDPOINT", "tcp://127.0.0.1:5555")

# ─────────────────────────────────────────────────────────────────────
#  FastAPI App
# ─────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="ADAS Blockchain Forensics API",
    description="Central orchestrator for the Secure Adaptive AUTOSAR Architecture "
                "with AI-Based ADAS Perception and Blockchain Forensics.",
    version="2.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS — allow React dashboard at :3000
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─────────────────────────────────────────────────────────────────────
#  WebSocket Manager
# ─────────────────────────────────────────────────────────────────────
class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception:
                pass

manager = ConnectionManager()

# ─────────────────────────────────────────────────────────────────────
#  Lazy AI Model Loading (only loaded when needed)
# ─────────────────────────────────────────────────────────────────────
_ai_model = None
_ai_device = None


def _load_ai_model():
    """Lazy-load LaneNet model on first inference request."""
    global _ai_model, _ai_device
    if _ai_model is not None:
        return _ai_model, _ai_device

    try:
        import torch
        # Add adas_ai_release to Python path
        sys.path.insert(0, str(AI_MODEL_DIR))
        from model import LaneNet
        from offset import compute_offset

        device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        model = LaneNet().to(device)

        weights_path = AI_MODEL_DIR / "lanenet_today.pth"
        if weights_path.exists():
            model.load_state_dict(
                torch.load(str(weights_path), map_location=device, weights_only=True)
            )
            model.eval()
            logger.info(f"LaneNet loaded on {device} ({sum(p.numel() for p in model.parameters()):,} params)")
        else:
            logger.warning(f"Weights not found at {weights_path} — model is untrained")

        _ai_model = model
        _ai_device = device
        return model, device

    except ImportError as e:
        logger.error(f"PyTorch/model import failed: {e}")
        raise HTTPException(status_code=503, detail=f"AI model unavailable: {e}")


# ─────────────────────────────────────────────────────────────────────
#  REQUEST / RESPONSE MODELS
# ─────────────────────────────────────────────────────────────────────

class HashRequest(BaseModel):
    """Request to compute SHA-256 hash of an ADAS JSON payload."""
    payload: str  # Raw JSON string


class HashResponse(BaseModel):
    sha256: str
    payload_length: int
    timestamp: str


class ServiceStatus(BaseModel):
    name: str
    status: str   # "online", "offline", "unknown"
    details: Optional[str] = None
    latency_ms: Optional[float] = None


# =====================================================================
#  HEALTH & STATUS ENDPOINTS
# =====================================================================

@app.get("/", tags=["Health"])
async def root():
    """API root — basic health check."""
    return {
        "service": "ADAS Blockchain Forensics API",
        "version": "2.0.0",
        "status": "online",
        "timestamp": datetime.now().isoformat(),
        "docs": "/docs",
    }


@app.get("/api/health", tags=["Health"])
async def health_check():
    """Comprehensive health check of all subsystems."""
    services = []

    # 1. Check Besu blockchain
    besu_status = await _check_besu()
    services.append(besu_status)

    # 2. Check contract deployment
    contract_status = await _check_contract()
    services.append(contract_status)

    # 3. Check AI model
    ai_status = _check_ai_model()
    services.append(ai_status)

    # 4. Check ZMQ endpoint
    zmq_status = _check_zmq()
    services.append(zmq_status)

    # 5. Check vehicle log file
    log_status = _check_vehicle_log()
    services.append(log_status)

    all_online = all(s.status == "online" for s in services)

    return {
        "overall": "healthy" if all_online else "degraded",
        "timestamp": datetime.now().isoformat(),
        "services": [s.dict() for s in services],
    }


# =====================================================================
#  BLOCKCHAIN ENDPOINTS
# =====================================================================

@app.get("/api/blockchain/status", tags=["Blockchain"])
async def blockchain_status():
    """Check Hyperledger Besu network status via JSON-RPC."""
    import urllib.request

    try:
        # eth_blockNumber
        payload = json.dumps({
            "jsonrpc": "2.0", "method": "eth_blockNumber", "params": [], "id": 1
        }).encode()

        start = time.time()
        req = urllib.request.Request(
            BESU_RPC_URL, data=payload,
            headers={"Content-Type": "application/json"}
        )
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = json.loads(resp.read())
        latency = (time.time() - start) * 1000

        block_number = int(data["result"], 16) if "result" in data else 0

        # eth_chainId
        chain_payload = json.dumps({
            "jsonrpc": "2.0", "method": "eth_chainId", "params": [], "id": 2
        }).encode()
        req2 = urllib.request.Request(
            BESU_RPC_URL, data=chain_payload,
            headers={"Content-Type": "application/json"}
        )
        with urllib.request.urlopen(req2, timeout=5) as resp2:
            chain_data = json.loads(resp2.read())
        chain_id = int(chain_data["result"], 16) if "result" in chain_data else 0

        # net_peerCount
        peer_payload = json.dumps({
            "jsonrpc": "2.0", "method": "net_peerCount", "params": [], "id": 3
        }).encode()
        req3 = urllib.request.Request(
            BESU_RPC_URL, data=peer_payload,
            headers={"Content-Type": "application/json"}
        )
        with urllib.request.urlopen(req3, timeout=5) as resp3:
            peer_data = json.loads(resp3.read())
        peer_count = int(peer_data["result"], 16) if "result" in peer_data else 0

        return {
            "status": "online",
            "rpc_url": BESU_RPC_URL,
            "chain_id": chain_id,
            "block_number": block_number,
            "peer_count": peer_count,
            "consensus": "IBFT 2.0",
            "latency_ms": round(latency, 1),
        }

    except Exception as e:
        return {
            "status": "offline",
            "rpc_url": BESU_RPC_URL,
            "error": str(e),
        }


@app.get("/api/blockchain/contract", tags=["Blockchain"])
async def contract_status():
    """Check ForensicLogger contract deployment and log count."""
    # Try to load from deployment file
    deploy_file = BLOCKCHAIN_DIR / "blockchain" / "deployments" / "localhost.json"
    config_file = BLOCKCHAIN_DIR / "blockchain" / "frontend" / "public" / "config.json"

    address = CONTRACT_ADDRESS
    deploy_info = {}

    for f in [deploy_file, config_file]:
        if f.exists():
            try:
                data = json.loads(f.read_text())
                if not address and "contractAddress" in data:
                    address = data["contractAddress"]
                deploy_info = data
                break
            except Exception:
                pass

    if not address:
        return {
            "status": "not_deployed",
            "message": "No contract address found. Deploy via: npx hardhat run scripts/deploy.js --network besu",
        }

    # Query getLogCount via JSON-RPC
    log_count = None
    try:
        import urllib.request
        # Call getLogCount() — function selector = 0x7f6e4e45
        call_payload = json.dumps({
            "jsonrpc": "2.0",
            "method": "eth_call",
            "params": [{"to": address, "data": "0x7f6e4e45"}, "latest"],
            "id": 1
        }).encode()
        req = urllib.request.Request(
            BESU_RPC_URL, data=call_payload,
            headers={"Content-Type": "application/json"}
        )
        with urllib.request.urlopen(req, timeout=5) as resp:
            result = json.loads(resp.read())
        if "result" in result and result["result"] != "0x":
            log_count = int(result["result"], 16)
    except Exception:
        pass

    return {
        "status": "deployed",
        "address": address,
        "log_count": log_count,
        "deploy_info": deploy_info,
    }


# =====================================================================
#  AI MODEL ENDPOINTS
# =====================================================================

@app.get("/api/ai/info", tags=["AI Model"])
async def ai_model_info():
    """Get AI model metadata and availability."""
    weights_path = AI_MODEL_DIR / "lanenet_today.pth"
    weights_exist = weights_path.exists()
    weights_size = weights_path.stat().st_size if weights_exist else 0

    return {
        "model": "LaneNet",
        "architecture": "Encoder-Decoder CNN (U-Net style)",
        "parameters": 41217,
        "input_shape": "[B, 3, 128, 256]",
        "output_shape": "[B, 1, 128, 256]",
        "weights_file": str(weights_path.name),
        "weights_exists": weights_exist,
        "weights_size_kb": round(weights_size / 1024, 1),
        "training_dataset": "TuSimple Lane Detection",
        "framework": "PyTorch",
    }


@app.post("/api/ai/predict", tags=["AI Model"])
async def ai_predict(file: UploadFile = File(...)):
    """
    Run lane detection inference on an uploaded image.

    Upload a JPEG/PNG image of a road — returns lane offset,
    confidence, and detection status.
    """
    import cv2
    import torch

    model, device = _load_ai_model()
    sys.path.insert(0, str(AI_MODEL_DIR))
    from offset import compute_offset

    # Read uploaded image
    contents = await file.read()
    np_arr = np.frombuffer(contents, np.uint8)
    frame = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)

    if frame is None:
        raise HTTPException(status_code=400, detail="Invalid image file")

    # Pre-process
    img = cv2.resize(frame, (256, 128)).astype(np.float32) / 255.0
    tensor = torch.tensor(img).permute(2, 0, 1).unsqueeze(0).to(device)

    # Inference
    with torch.no_grad():
        mask = model(tensor)

    offset, confidence = compute_offset(mask)

    return {
        "lane_offset": round(float(offset), 4),
        "confidence": round(float(confidence), 4),
        "lane_detected": bool(confidence > 0.2),
        "image_size": {"width": frame.shape[1], "height": frame.shape[0]},
        "model_device": str(device),
    }


@app.post("/api/ai/hash", tags=["AI Model"])
async def compute_hash(req: HashRequest):
    """Compute SHA-256 hash of an ADAS JSON payload (same as CryptoModule)."""
    sha256 = hashlib.sha256(req.payload.encode("utf-8")).hexdigest()
    return HashResponse(
        sha256=sha256,
        payload_length=len(req.payload),
        timestamp=datetime.now().isoformat(),
    )


@app.get("/api/ai/training-status", tags=["AI Model"])
async def training_status():
    """Check if training artifacts exist and report model status."""
    weights_path = AI_MODEL_DIR / "lanenet_today.pth"
    log_path = AI_MODEL_DIR / "training_log.json"

    result = {
        "weights_exists": weights_path.exists(),
        "training_log_exists": log_path.exists(),
    }

    if weights_path.exists():
        stat = weights_path.stat()
        result["weights_modified"] = datetime.fromtimestamp(stat.st_mtime).isoformat()
        result["weights_size_kb"] = round(stat.st_size / 1024, 1)

    if log_path.exists():
        try:
            log_data = json.loads(log_path.read_text())
            result["training_log"] = log_data
        except Exception:
            pass

    return result


# =====================================================================
#  VEHICLE LOG ENDPOINTS
# =====================================================================

@app.get("/api/logs/vehicle", tags=["Logs"])
async def get_vehicle_logs(
    limit: int = Query(10, ge=1, le=1000), 
    offset: int = Query(0, ge=0),
    search: Optional[str] = None,
    event_type: Optional[str] = None
):
    """Read the latest vehicle log entries from vehicle_log.txt with pagination and filtering."""
    log_file = BLOCKCHAIN_DIR / "python" / "vehicle_log.txt"
    if not log_file.exists():
        return {"status": "no_logs", "entries": [], "message": "vehicle_log.txt not found. Run Web3Bridge first."}

    content = log_file.read_text().strip()
    if not content:
        return {"status": "available", "total_entries": 0, "offset": offset, "limit": limit, "entries": []}
        
    lines = content.split("\n")
    parsed_lines = []
    
    # Store tuples of (line_num, raw_string)
    for i, line in enumerate(lines):
        line = line.strip()
        if not line:
            continue
        parsed_lines.append((i + 1, line))
        
    # Reverse so newest logs are first
    parsed_lines.reverse()
    
    # Apply Filters
    filtered_lines = []
    for line_num, raw in parsed_lines:
        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            data = {}
            
        # Event Type Match
        if event_type and event_type != "ALL":
            if data.get("event_type") != event_type:
                continue
                
        # Search Match
        if search:
            if search.lower() not in raw.lower():
                continue
                
        filtered_lines.append((line_num, raw))

    total_filtered = len(filtered_lines)
    
    # Calculate slice
    start_idx = offset
    end_idx = min(offset + limit, total_filtered)
    sliced_lines = filtered_lines[start_idx:end_idx]
    
    entries = []
    for line_num, raw in sliced_lines:
        try:
            data = json.loads(raw)
            data["_line"] = line_num
            data["_raw"] = raw.strip()
            entries.append(data)
        except json.JSONDecodeError:
            entries.append({"_line": line_num, "_raw": raw})

    return {
        "status": "available",
        "total_entries": total_filtered,
        "offset": offset,
        "limit": limit,
        "entries": entries,
    }

class TamperRequest(BaseModel):
    line_index: int
    new_confidence: float

@app.post("/api/logs/tamper", tags=["Logs"])
async def tamper_log_entry(payload: TamperRequest):
    """
    Directly tamper with a log entry in vehicle_log.txt to simulate an attack.
    """
    log_file = BLOCKCHAIN_DIR / "python" / "vehicle_log.txt"
    if not log_file.exists():
        raise HTTPException(status_code=404, detail="vehicle_log.txt not found")
        
    lines = log_file.read_text().strip().split("\n")
    idx = payload.line_index - 1
    
    if idx < 0 or idx >= len(lines):
        raise HTTPException(status_code=400, detail="Invalid line index")
        
    try:
        data = json.loads(lines[idx].strip())
        old_val = data.get("confidence")
        data["confidence"] = payload.new_confidence
        # Use separators to match C++ compact JSON format without spaces
        lines[idx] = json.dumps(data, separators=(',', ':'))
        
        # Write back to file with specific newline to avoid platform-specific conversion
        log_file.write_text("\n".join(lines) + "\n", encoding="utf-8", newline="\n")
        
        # Notify clients about the tamper event
        await manager.broadcast({
            "type": "TAMPER_EVENT",
            "line_index": payload.line_index,
            "new_confidence": payload.new_confidence
        })
        
        return {
            "status": "success",
            "message": f"Tampered line {payload.line_index}: confidence {old_val} -> {payload.new_confidence}"
        }
    except json.JSONDecodeError:
        raise HTTPException(status_code=500, detail="Line is not valid JSON")

@app.post("/api/logs/audit", tags=["Logs"])
async def audit_log_entry(payload: HashRequest):
    """
    Verify a single log entry against the blockchain.
    Computes SHA-256 and checks if it exists on-chain via verifyHash().
    """
    sha256 = hashlib.sha256(payload.payload.encode("utf-8")).hexdigest()
    hash_bytes32 = "0x" + sha256

    # Check on-chain
    on_chain = False
    try:
        import urllib.request
        # verifyHash(bytes32) — selector = keccak256("verifyHash(bytes32)")[:4]
        # verifyHash selector = 0x97aea688 (first 4 bytes of keccak256)
        padded_hash = sha256  # already 64 hex chars
        call_data = "0x97aea688" + padded_hash

        address = CONTRACT_ADDRESS
        if not address:
            config_file = BLOCKCHAIN_DIR / "blockchain" / "frontend" / "public" / "config.json"
            if config_file.exists():
                address = json.loads(config_file.read_text()).get("contractAddress", "")

        if address:
            call_payload = json.dumps({
                "jsonrpc": "2.0",
                "method": "eth_call",
                "params": [{"to": address, "data": call_data}, "latest"],
                "id": 1
            }).encode()
            req = urllib.request.Request(
                BESU_RPC_URL, data=call_payload,
                headers={"Content-Type": "application/json"}
            )
            with urllib.request.urlopen(req, timeout=5) as resp:
                result = json.loads(resp.read())
            if "result" in result:
                on_chain = int(result["result"], 16) == 1

    except Exception as e:
        logger.warning(f"On-chain verification failed: {e}")

    return {
        "payload": payload.payload,
        "sha256": sha256,
        "on_chain": on_chain,
        "verdict": "VERIFIED" if on_chain else "NOT_FOUND",
    }


@app.get("/api/logs/audit-all", tags=["Logs"])
async def audit_all_logs():
    """
    Verify ALL log entries in vehicle_log.txt against the blockchain.
    Uses Web3.py for reliable contract interaction.
    """
    from web3 import Web3
    
    log_file = BLOCKCHAIN_DIR / "python" / "vehicle_log.txt"
    if not log_file.exists():
        raise HTTPException(status_code=404, detail="vehicle_log.txt not found")
        
    content = log_file.read_text(encoding="utf-8")
    if not content.strip():
        return {"status": "success", "total_checked": 0, "tampered_logs": []}
        
    lines = content.splitlines()

    # Setup Web3
    w3 = Web3(Web3.HTTPProvider(BESU_RPC_URL))
    address = CONTRACT_ADDRESS
    if not address:
        config_file = BLOCKCHAIN_DIR / "blockchain" / "frontend" / "public" / "config.json"
        if config_file.exists():
            address = json.loads(config_file.read_text()).get("contractAddress", "")
            
    if not address:
        raise HTTPException(status_code=500, detail="Contract address not found")

    # Minimal ABI for verifyHash
    abi = [{"inputs":[{"internalType":"bytes32","name":"forensicHash","type":"bytes32"}],"name":"verifyHash","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"}]
    contract = w3.eth.contract(address=Web3.to_checksum_address(address), abi=abi)

    tampered_logs = []
    total_checked = 0
    
    # We'll use eth_call for each hash. For 174 logs, this takes ~1-2 seconds.
    # This is much more reliable than manual batch JSON-RPC formatting.
    for i, line in enumerate(lines):
        line = line.strip()
        if not line:
            continue
        
        total_checked += 1
        sha256 = hashlib.sha256(line.encode("utf-8")).hexdigest()
        hash_bytes = bytes.fromhex(sha256)
        
        try:
            on_chain = contract.functions.verifyHash(hash_bytes).call()
            if not on_chain:
                event_type = "UNKNOWN"
                try:
                    data = json.loads(line)
                    event_type = data.get("event_type", "UNKNOWN")
                except:
                    pass
                
                tampered_logs.append({
                    "line": i + 1,
                    "hash": sha256,
                    "event_type": event_type,
                    "raw": line
                })
        except Exception as e:
            logger.warning(f"Failed to verify hash at line {i+1}: {e}")
            # Consider it tampered if we can't verify it (or add to error list)
            tampered_logs.append({
                "line": i + 1,
                "hash": sha256,
                "event_type": "RPC_ERROR",
                "raw": line
            })

    return {
        "status": "success",
        "total_checked": total_checked,
        "tampered_count": len(tampered_logs),
        "tampered_logs": tampered_logs
    }


@app.get("/api/logs/export-csv", tags=["Logs"])
async def export_csv():
    """
    Generate a downloadable CSV audit report of all local vehicle logs.
    """
    from fastapi.responses import PlainTextResponse
    log_file = BLOCKCHAIN_DIR / "python" / "vehicle_log.txt"
    if not log_file.exists():
        raise HTTPException(status_code=404, detail="vehicle_log.txt not found")
        
    content = log_file.read_text(encoding="utf-8")
    if not content.strip():
        return PlainTextResponse("Line,Timestamp,Event,Confidence,Hash,OnChainStatus\n", media_type="text/csv")
        
    lines = content.splitlines()

    address = CONTRACT_ADDRESS
    if not address:
        config_file = BLOCKCHAIN_DIR / "blockchain" / "frontend" / "public" / "config.json"
        if config_file.exists():
            address = json.loads(config_file.read_text()).get("contractAddress", "")
            
    if not address:
        raise HTTPException(status_code=500, detail="Contract address not found")

    batch_payload = []
    line_hashes = []
    
    for i, line in enumerate(lines):
        line = line.strip()
        if not line:
            continue
        sha256 = hashlib.sha256(line.encode("utf-8")).hexdigest()
        
        current_id = len(line_hashes)
        line_hashes.append({"line": i + 1, "hash": sha256, "raw": line, "id": current_id})
        
        call_data = "0x97aea688" + sha256
        batch_payload.append({
            "jsonrpc": "2.0",
            "method": "eth_call",
            "params": [{"to": address, "data": call_data}, "latest"],
            "id": current_id
        })

    import urllib.request
    try:
        req = urllib.request.Request(
            BESU_RPC_URL, data=json.dumps(batch_payload).encode(),
            headers={"Content-Type": "application/json"}
        )
        with urllib.request.urlopen(req, timeout=15) as resp:
            results = json.loads(resp.read())
            
        result_map = {res["id"]: res for res in results}
        
        csv_lines = ["Line,Timestamp,Event,Confidence,Hash,OnChainStatus"]
        
        for item in line_hashes:
            res = result_map.get(item["id"])
            on_chain = False
            if res and "result" in res and res["result"] != "0x":
                on_chain = int(res["result"], 16) == 1
                
            event_type = "UNKNOWN"
            timestamp = "UNKNOWN"
            confidence = "UNKNOWN"
            try:
                data = json.loads(item["raw"])
                event_type = data.get("event_type", "UNKNOWN")
                ts = data.get("timestamp", 0)
                timestamp = datetime.fromtimestamp(ts).isoformat() if ts else "UNKNOWN"
                confidence = str(data.get("confidence", "UNKNOWN"))
            except:
                pass
                
            csv_lines.append(f'{item["line"]},{timestamp},{event_type},{confidence},{item["hash"]},{"VERIFIED" if on_chain else "TAMPERED"}')
            
        csv_content = "\n".join(csv_lines)
        return PlainTextResponse(
            content=csv_content,
            media_type="text/csv",
            headers={"Content-Disposition": 'attachment; filename="forensic_audit_report.csv"'}
        )
    except Exception as e:
        logger.error(f"CSV export failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/analytics/confidence", tags=["Analytics"])
async def get_confidence_analytics(limit: int = Query(30, ge=1, le=100)):
    """Get the latest N confidence scores for live charting."""
    log_file = BLOCKCHAIN_DIR / "python" / "vehicle_log.txt"
    if not log_file.exists():
        return []
        
    lines = log_file.read_text().strip().split("\n")
    if not lines or lines == [""]:
        return []
        
    # Get last N lines
    tail = lines[-limit:]
    data_points = []
    
    for i, line in enumerate(tail):
        try:
            item = json.loads(line)
            ts = item.get("timestamp", 0)
            data_points.append({
                "time": datetime.fromtimestamp(ts).strftime("%H:%M:%S") if ts else f"Point {i}",
                "confidence": item.get("confidence", 0),
                "event": item.get("event_type", "Unknown")
            })
        except:
            continue
            
    return data_points


@app.websocket("/ws/logs")
async def websocket_logs(websocket: WebSocket):
    """
    WebSocket endpoint that streams any changes made to vehicle_log.txt
    back to the React dashboard instantly.
    """
    await manager.connect(websocket)
    try:
        while True:
            # We already have a background task doing file watching, 
            # so the socket just yields control back to fastAPI
            await asyncio.sleep(60) 
    except WebSocketDisconnect:
        manager.disconnect(websocket)


# =====================================================================
#  INTERNAL HEALTH CHECK HELPERS
# =====================================================================

async def _check_besu() -> ServiceStatus:
    """Check Besu JSON-RPC endpoint."""
    import urllib.request
    try:
        payload = json.dumps({"jsonrpc": "2.0", "method": "eth_blockNumber", "params": [], "id": 1}).encode()
        start = time.time()
        req = urllib.request.Request(BESU_RPC_URL, data=payload, headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=3) as resp:
            json.loads(resp.read())
        latency = (time.time() - start) * 1000
        return ServiceStatus(name="Hyperledger Besu", status="online", details=BESU_RPC_URL, latency_ms=round(latency, 1))
    except Exception as e:
        return ServiceStatus(name="Hyperledger Besu", status="offline", details=str(e))


async def _check_contract() -> ServiceStatus:
    """Check if ForensicLogger contract is deployed."""
    deploy_file = BLOCKCHAIN_DIR / "blockchain" / "deployments" / "localhost.json"
    config_file = BLOCKCHAIN_DIR / "blockchain" / "frontend" / "public" / "config.json"
    for f in [deploy_file, config_file]:
        if f.exists():
            try:
                data = json.loads(f.read_text())
                addr = data.get("contractAddress", "")
                if addr:
                    return ServiceStatus(name="ForensicLogger Contract", status="online", details=addr)
            except Exception:
                pass
    return ServiceStatus(name="ForensicLogger Contract", status="offline", details="Not deployed")


def _check_ai_model() -> ServiceStatus:
    """Check if AI model weights exist."""
    weights = AI_MODEL_DIR / "lanenet_today.pth"
    if weights.exists():
        size_mb = weights.stat().st_size / (1024 * 1024)
        return ServiceStatus(name="LaneNet AI Model", status="online", details=f"Weights: {size_mb:.1f} MB")
    return ServiceStatus(name="LaneNet AI Model", status="offline", details="lanenet_today.pth not found")


def _check_zmq() -> ServiceStatus:
    """Check ZMQ endpoint availability."""
    try:
        import zmq
        ctx = zmq.Context()
        sock = ctx.socket(zmq.REQ)
        sock.setsockopt(zmq.LINGER, 0)
        sock.setsockopt(zmq.RCVTIMEO, 500)
        sock.connect(ZMQ_ENDPOINT)
        sock.close()
        ctx.term()
        return ServiceStatus(name="ZeroMQ Bridge", status="online", details=ZMQ_ENDPOINT)
    except Exception:
        return ServiceStatus(name="ZeroMQ Bridge", status="unknown", details=f"Cannot probe {ZMQ_ENDPOINT}")


def _check_vehicle_log() -> ServiceStatus:
    """Check if vehicle log file exists and has entries."""
    log_file = BLOCKCHAIN_DIR / "python" / "vehicle_log.txt"
    if log_file.exists():
        lines = len(log_file.read_text().strip().split("\n"))
        return ServiceStatus(name="Vehicle Log", status="online", details=f"{lines} entries")
    return ServiceStatus(name="Vehicle Log", status="offline", details="vehicle_log.txt not found")


# ─────────────────────────────────────────────────────────────────────
#  Startup
# ─────────────────────────────────────────────────────────────────────
@app.on_event("startup")
async def startup():
    logger.info("=" * 60)
    logger.info("  ADAS Blockchain Forensics API — Starting")
    logger.info(f"  Besu RPC:  {BESU_RPC_URL}")
    logger.info(f"  AI Model:  {AI_MODEL_DIR}")
    logger.info(f"  Docs:      http://localhost:8000/docs")
    logger.info("=" * 60)
    
    # Start the background file watcher
    asyncio.create_task(_watch_vehicle_logs_for_websockets())


async def _watch_vehicle_logs_for_websockets():
    """Background task to poll vehicle_log.txt and broadcast changes to WebSockets."""
    log_file = BLOCKCHAIN_DIR / "python" / "vehicle_log.txt"
    last_mtime = 0
    last_size = 0
    
    while True:
        try:
            if log_file.exists():
                stat = log_file.stat()
                mtime = stat.st_mtime
                size = stat.st_size
                
                if last_mtime != 0 and (mtime > last_mtime or size != last_size):
                    # File was modified. If it GREW, it's likely a new log was appended.
                    # Send a generic 'FILE_UPDATED' event so frontend can refetch.
                    # Alternatively, if it just grew, we could read and send only new lines.
                    await manager.broadcast({"type": "LOGS_UPDATED"})
                
                last_mtime = mtime
                last_size = size
        except Exception as e:
            logger.error(f"Error watching log file: {e}")
            
        await asyncio.sleep(1.0)


# ─────────────────────────────────────────────────────────────────────
#  Run directly: python main.py
# ─────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    # Use reload_excludes to stop restarting every time a log is written
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True, reload_excludes=["*/blockchain/python/*", "*/vehicle_software/*"])
