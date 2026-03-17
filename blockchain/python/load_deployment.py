"""
load_deployment.py
------------------
Utility to auto-load the ForensicLogger contract address from the
Hardhat deployment JSON file.

Usage (standalone):
    python load_deployment.py [--network besu]

Usage (from web3_bridge.py):
    from load_deployment import get_contract_address
    addr = get_contract_address("besu")
"""

import json
import os
import sys

# Path to the Hardhat deployments folder (relative to this script)
DEPLOYMENTS_DIR = os.path.join(
    os.path.dirname(os.path.abspath(__file__)),
    "..", "contracts", "deployments"
)


def get_contract_address(network: str = "besu") -> str | None:
    """
    Read the deployed contract address from the Hardhat deployment JSON.

    Returns the checksum address string, or None if not found.
    """
    deployment_file = os.path.join(DEPLOYMENTS_DIR, f"{network}.json")

    if not os.path.exists(deployment_file):
        print(f"[DEPLOY] No deployment file found: {deployment_file}")
        print(f"[DEPLOY] Deploy first: cd contracts && npx hardhat run scripts/deploy.js --network {network}")
        return None

    with open(deployment_file, "r") as f:
        info = json.load(f)

    address = info.get("contractAddress")
    if address:
        print(f"[DEPLOY] Loaded ForensicLogger address from {network}: {address}")
    return address


if __name__ == "__main__":
    network = sys.argv[1] if len(sys.argv) > 1 else "besu"
    addr = get_contract_address(network.lstrip("--network="))
    if addr:
        print(f"\nexport ADAS_CONTRACT_ADDRESS={addr}")
    else:
        sys.exit(1)
