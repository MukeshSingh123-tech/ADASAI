"""
Auditor.py
──────────
Phase 6 — Forensic Validation & Tamper Detection

┌─────────────────────────────────────────────────────────────────────┐
│  POST-ACCIDENT INVESTIGATION WORKFLOW                               │
│                                                                     │
│  This script simulates a forensic auditor (e.g., law enforcement,   │
│  insurance investigator, or OEM quality engineer) who needs to      │
│  verify the authenticity of ADAS event logs after an incident.      │
│                                                                     │
│  Algorithm:                                                         │
│    1. Read each JSON line from vehicle_log.txt                      │
│    2. Re-compute the SHA-256 hash of the raw JSON string            │
│    3. Query ForensicLogger.verifyHash(bytes32) on the Besu chain    │
│    4. If the hash exists on-chain → data is authentic               │
│       If the hash does NOT exist → data has been tampered with      │
│                                                                     │
│  Tamper Demonstration:                                              │
│    1. Open vehicle_log.txt in a text editor                         │
│    2. Change any field (e.g., confidence: 98.5 → 50.0)             │
│    3. Run: python Auditor.py --contract 0x...                       │
│    4. The tampered line will show:                                   │
│       [ALERT] Tampering Detected                                    │
│                                                                     │
│  The integrity guarantee derives from the one-way property of       │
│  SHA-256: any modification to the input (even a single bit) will    │
│  produce a completely different hash, which will not match the       │
│  on-chain record stored by ForensicLogger.logEvent().               │
└─────────────────────────────────────────────────────────────────────┘

Usage:
    python Auditor.py [--log-file vehicle_log.txt]
                      [--rpc-url http://127.0.0.1:8545]
                      [--contract 0x...]

@author  Mukesh Singh
@date    2026-03-10
"""

import argparse
import hashlib
import json
import os
import sys
from typing import Optional

from web3 import Web3


# ─────────────────────────────────────────────────────────────────────
#  ForensicLogger ABI — only the view functions needed for auditing
# ─────────────────────────────────────────────────────────────────────

FORENSIC_LOGGER_ABI = json.loads("""
[
    {
        "inputs": [
            {
                "internalType": "bytes32",
                "name": "forensicHash",
                "type": "bytes32"
            }
        ],
        "name": "verifyHash",
        "outputs": [
            {
                "internalType": "bool",
                "name": "",
                "type": "bool"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "getLogCount",
        "outputs": [
            {
                "internalType": "uint256",
                "name": "",
                "type": "uint256"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "uint256",
                "name": "index",
                "type": "uint256"
            }
        ],
        "name": "getLog",
        "outputs": [
            {
                "internalType": "uint64",
                "name": "timestamp",
                "type": "uint64"
            },
            {
                "internalType": "bytes32",
                "name": "forensicHash",
                "type": "bytes32"
            },
            {
                "internalType": "address",
                "name": "reporter",
                "type": "address"
            },
            {
                "internalType": "bytes12",
                "name": "vehicleId",
                "type": "bytes12"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    }
]
""")


# ─────────────────────────────────────────────────────────────────────
#  SHA-256 Helper — Must Mirror the C++ CryptoModule Exactly
# ─────────────────────────────────────────────────────────────────────

def sha256_hex(data: str) -> str:
    """
    Return the lowercase hex SHA-256 digest of a UTF-8 string.

    This function MUST produce identical output to the C++ CryptoModule
    for the same input string.  Both use:
      - UTF-8 encoding of the input
      - Standard SHA-256 (FIPS 180-4)
      - Lowercase hexadecimal representation of the 32-byte digest
    """
    return hashlib.sha256(data.encode("utf-8")).hexdigest()


# ─────────────────────────────────────────────────────────────────────
#  Main Audit Logic
# ─────────────────────────────────────────────────────────────────────

def run_audit(log_file: str, rpc_url: str, contract_address: str) -> bool:
    """
    Read local log, re-hash each line, and verify against the blockchain.

    Returns True if all records pass verification, False if any fail.
    """

    # ── Validate inputs ─────────────────────────────────────────────
    if not os.path.isfile(log_file):
        print(f"[ERROR] Log file not found: {log_file}")
        print("        Run the Web3 bridge first to generate it.")
        sys.exit(1)

    if not contract_address:
        print("[ERROR] No contract address provided.")
        print("        Use --contract 0x... or set ADAS_CONTRACT_ADDRESS env var.")
        sys.exit(1)

    # ── Connect to blockchain ────────────────────────────────────────
    w3 = Web3(Web3.HTTPProvider(rpc_url))
    if not w3.is_connected():
        print(f"[ERROR] Cannot connect to {rpc_url}")
        print("        Is the Besu network running?  docker-compose up -d")
        sys.exit(1)

    print(f"[CHAIN] Connected to {rpc_url}  (chain_id={w3.eth.chain_id})")

    contract = w3.eth.contract(
        address=Web3.to_checksum_address(contract_address),
        abi=FORENSIC_LOGGER_ABI,
    )
    print(f"[CHAIN] ForensicLogger at {contract_address}")

    # ── Get on-chain log count for reference ─────────────────────────
    on_chain_count = contract.functions.getLogCount().call()
    print(f"[CHAIN] ForensicLogger has {on_chain_count} entries on-chain.\n")

    # ── Read and audit the local log file ────────────────────────────
    print("=" * 72)
    print("  FORENSIC AUDIT REPORT")
    print("  Vehicle: ELC23027  |  Driver: Mukesh Singh")
    print("=" * 72)

    passed = 0
    failed = 0
    total  = 0

    with open(log_file, "r", encoding="utf-8") as f:
        for line_num, raw_line in enumerate(f, start=1):
            line = raw_line.strip()
            if not line:
                continue  # skip blank lines

            total += 1

            # ── Step 1: Re-hash the raw JSON line ────────────────────
            local_hash = sha256_hex(line)
            hash_bytes = bytes.fromhex(local_hash)

            # ── Step 2: Query the blockchain via verifyHash() ────────
            #  This uses the O(1) hashExists mapping instead of
            #  iterating through all log entries.
            exists_on_chain = contract.functions.verifyHash(
                hash_bytes).call()

            # ── Step 3: Print verdict ────────────────────────────────
            if exists_on_chain:
                passed += 1
                print(f"  Line {line_num:>4}  [SUCCESS] Log Verified")
                print(f"             hash={local_hash[:16]}...")
                print(f"             data={line[:80]}")
            else:
                failed += 1
                print(f"  Line {line_num:>4}  [ALERT] Tampering Detected")
                print(f"             local_hash={local_hash[:16]}...")
                print(f"             data      ={line[:80]}")
                print(f"             This hash does NOT exist on the blockchain!")

            print()

    # ── Summary ──────────────────────────────────────────────────────
    print("=" * 72)
    print(f"  AUDIT SUMMARY")
    print(f"  Total records : {total}")
    print(f"  Verified  (OK): {passed}")
    print(f"  Tampered (BAD): {failed}")
    print()

    if failed == 0 and total > 0:
        print("  ✅ VERDICT: ALL RECORDS VERIFIED — data integrity intact.")
    elif failed > 0:
        print(f"  ❌ VERDICT: {failed} RECORD(S) TAMPERED — investigation required!")
    else:
        print("  ⚠  VERDICT: No records to audit.")

    print("=" * 72)

    return failed == 0


# ─────────────────────────────────────────────────────────────────────
#  Entry Point
# ─────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Forensic Auditor — verify ADAS logs against the blockchain")
    parser.add_argument(
        "--log-file", default="vehicle_log.txt",
        help="Path to the local ADAS log (default: vehicle_log.txt)")
    parser.add_argument(
        "--rpc-url", default="http://127.0.0.1:8545",
        help="Ethereum JSON-RPC URL (default: http://127.0.0.1:8545)")
    parser.add_argument(
        "--contract",
        default=os.getenv("ADAS_CONTRACT_ADDRESS"),
        help="ForensicLogger contract address (or set ADAS_CONTRACT_ADDRESS)")
    args = parser.parse_args()

    ok = run_audit(
        log_file=args.log_file,
        rpc_url=args.rpc_url,
        contract_address=args.contract,
    )

    sys.exit(0 if ok else 1)
