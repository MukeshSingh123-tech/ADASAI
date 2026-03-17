/**
 * ForensicLogger — MetaMask Dashboard App
 *
 * Connects to MetaMask, interacts with the ForensicLogger smart contract,
 * and provides a full CRUD-like interface for on-chain forensic hashes.
 */

// ---- ForensicLogger ABI (full) ----
const FORENSIC_LOGGER_ABI = [
    {
        inputs: [],
        stateMutability: "nonpayable",
        type: "constructor",
    },
    {
        anonymous: false,
        inputs: [
            { indexed: true, internalType: "uint256", name: "timestamp", type: "uint256" },
            { indexed: true, internalType: "bytes32", name: "forensicHash", type: "bytes32" },
            { indexed: true, internalType: "address", name: "reporter", type: "address" },
        ],
        name: "ForensicHashLogged",
        type: "event",
    },
    {
        inputs: [{ internalType: "bytes32", name: "forensicHash", type: "bytes32" }],
        name: "logEvent",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function",
    },
    {
        inputs: [],
        name: "getLogCount",
        outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [{ internalType: "uint256", name: "index", type: "uint256" }],
        name: "getLog",
        outputs: [
            { internalType: "uint256", name: "timestamp", type: "uint256" },
            { internalType: "bytes32", name: "forensicHash", type: "bytes32" },
            { internalType: "address", name: "reporter", type: "address" },
        ],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [{ internalType: "uint256", name: "ts", type: "uint256" }],
        name: "getHashByTimestamp",
        outputs: [{ internalType: "bytes32", name: "", type: "bytes32" }],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [],
        name: "owner",
        outputs: [{ internalType: "address", name: "", type: "address" }],
        stateMutability: "view",
        type: "function",
    },
];

// =========================================================================
//  App Class
// =========================================================================
class ForensicLoggerApp {
    constructor() {
        this.provider = null;
        this.signer = null;
        this.contract = null;
        this.contractAddress = null;
        this.walletAddress = null;
        this.isConnected = false;

        this._initMetaMaskListeners();
    }

    // ---- MetaMask Detection & Listeners ----

    _initMetaMaskListeners() {
        if (!window.ethereum) return;

        window.ethereum.on("accountsChanged", (accounts) => {
            if (accounts.length === 0) {
                this._onDisconnect();
            } else {
                this.walletAddress = accounts[0];
                this._updateUI();
            }
        });

        window.ethereum.on("chainChanged", () => {
            // Reload on chain switch for clean state
            window.location.reload();
        });
    }

    // ---- Connect / Disconnect ----

    async toggleConnect() {
        if (this.isConnected) {
            this._onDisconnect();
            return;
        }

        if (!window.ethereum) {
            alert("MetaMask is not installed!\n\nPlease install MetaMask from https://metamask.io and refresh this page.");
            return;
        }

        try {
            const btn = document.getElementById("btnConnect");
            btn.innerHTML = '<span class="spinner"></span> Connecting…';

            this.provider = new ethers.BrowserProvider(window.ethereum);
            const accounts = await this.provider.send("eth_requestAccounts", []);
            this.signer = await this.provider.getSigner();
            this.walletAddress = accounts[0];
            this.isConnected = true;

            // Re-attach contract if address exists
            if (this.contractAddress) {
                this._attachContract();
            }

            this._updateUI();
        } catch (err) {
            console.error("Connect failed:", err);
            this._showStatus("configStatus", `Connection failed: ${err.message}`, "error");
        }
    }

    _onDisconnect() {
        this.provider = null;
        this.signer = null;
        this.contract = null;
        this.walletAddress = null;
        this.isConnected = false;
        this._updateUI();
    }

    // ---- Contract Setup ----

    async setContract() {
        const input = document.getElementById("contractAddressInput").value.trim();
        if (!input) {
            this._showStatus("configStatus", "Please enter a contract address.", "warning");
            return;
        }

        try {
            this.contractAddress = ethers.getAddress(input); // checksums
        } catch {
            this._showStatus("configStatus", "Invalid Ethereum address.", "error");
            return;
        }

        if (this.isConnected) {
            this._attachContract();
        }

        this._showStatus("configStatus", `Contract set: ${this.contractAddress}`, "success");
        this._enableButtons();
    }

    async loadConfig() {
        try {
            const resp = await fetch("config.json");
            if (!resp.ok) throw new Error(`config.json not found (${resp.status}). Deploy the contract first.`);

            const config = await resp.json();
            this.contractAddress = ethers.getAddress(config.contractAddress);
            document.getElementById("contractAddressInput").value = this.contractAddress;

            if (this.isConnected) {
                this._attachContract();
            }

            this._showStatus(
                "configStatus",
                `Loaded from config.json — ${config.network} — deployed ${config.deployedAt}`,
                "success"
            );
            this._enableButtons();
        } catch (err) {
            this._showStatus("configStatus", err.message, "error");
        }
    }

    _attachContract() {
        if (!this.signer || !this.contractAddress) return;
        this.contract = new ethers.Contract(this.contractAddress, FORENSIC_LOGGER_ABI, this.signer);

        // Start listening for live events
        this._startEventListener();
    }

    // ---- Log Hash ----

    async logHash() {
        if (!this.contract) {
            this._showStatus("logHashStatus", "Connect wallet and set contract first.", "warning");
            return;
        }

        let hashInput = document.getElementById("hashInput").value.trim();
        if (!hashInput) {
            this._showStatus("logHashStatus", "Enter a SHA-256 hash.", "warning");
            return;
        }

        // Normalize: add 0x prefix if missing
        if (!hashInput.startsWith("0x")) {
            hashInput = "0x" + hashInput;
        }

        // Validate: must be 66 chars (0x + 64 hex)
        if (!/^0x[0-9a-fA-F]{64}$/.test(hashInput)) {
            this._showStatus("logHashStatus", "Invalid hash. Must be 64 hex characters (32 bytes).", "error");
            return;
        }

        try {
            this._showStatus("logHashStatus", "Sending transaction… Please confirm in MetaMask.", "info");
            const tx = await this.contract.logEvent(hashInput);
            this._showStatus("logHashStatus", `Transaction sent: ${tx.hash}  — Waiting for confirmation…`, "info");

            const receipt = await tx.wait();
            this._showStatus(
                "logHashStatus",
                `✅ Hash logged on-chain! Block #${receipt.blockNumber}  TX: ${receipt.hash}`,
                "success"
            );

            // Refresh count
            this.getLogCount();
        } catch (err) {
            console.error("logHash error:", err);
            const msg = err.reason || err.message || "Transaction failed";
            this._showStatus("logHashStatus", `❌ ${msg}`, "error");
        }
    }

    // ---- Get Log Count ----

    async getLogCount() {
        if (!this.contract) {
            this._showStatus("logCountStatus", "Set contract first.", "warning");
            return;
        }

        try {
            const readContract = new ethers.Contract(
                this.contractAddress,
                FORENSIC_LOGGER_ABI,
                this.provider
            );
            const count = await readContract.getLogCount();
            document.getElementById("logCountDisplay").textContent = count.toString();
            this._showStatus("logCountStatus", `Fetched at ${new Date().toLocaleTimeString()}`, "success");
        } catch (err) {
            this._showStatus("logCountStatus", err.message, "error");
        }
    }

    // ---- Query by Timestamp ----

    async queryByTimestamp() {
        if (!this.contract) {
            this._showStatus("queryTsStatus", "Set contract first.", "warning");
            return;
        }

        const ts = document.getElementById("timestampInput").value.trim();
        if (!ts) {
            this._showStatus("queryTsStatus", "Enter a Unix timestamp.", "warning");
            return;
        }

        try {
            const readContract = new ethers.Contract(
                this.contractAddress,
                FORENSIC_LOGGER_ABI,
                this.provider
            );
            const hash = await readContract.getHashByTimestamp(ts);

            if (hash === "0x" + "0".repeat(64)) {
                this._showStatus("queryTsStatus", `No hash found for timestamp ${ts}`, "warning");
            } else {
                this._showStatus("queryTsStatus", `Hash: ${hash}`, "success");
            }
        } catch (err) {
            this._showStatus("queryTsStatus", err.message, "error");
        }
    }

    // ---- Query by Index ----

    async queryByIndex() {
        if (!this.contract) {
            this._showStatus("queryIdxStatus", "Set contract first.", "warning");
            return;
        }

        const idx = document.getElementById("indexInput").value.trim();
        if (idx === "") {
            this._showStatus("queryIdxStatus", "Enter an index.", "warning");
            return;
        }

        try {
            const readContract = new ethers.Contract(
                this.contractAddress,
                FORENSIC_LOGGER_ABI,
                this.provider
            );
            const [timestamp, forensicHash, reporter] = await readContract.getLog(idx);

            const date = new Date(Number(timestamp) * 1000).toLocaleString();
            this._showStatus(
                "queryIdxStatus",
                `Timestamp: ${timestamp} (${date})\nHash: ${forensicHash}\nReporter: ${reporter}`,
                "success"
            );
        } catch (err) {
            const msg = err.reason || err.message;
            this._showStatus("queryIdxStatus", msg, "error");
        }
    }

    // ---- Load All Logs ----

    async loadAllLogs() {
        if (!this.contract) return;

        const wrap = document.getElementById("logsTableWrap");
        wrap.innerHTML = '<div class="empty-state"><span class="spinner"></span> Loading logs…</div>';

        try {
            const readContract = new ethers.Contract(
                this.contractAddress,
                FORENSIC_LOGGER_ABI,
                this.provider
            );
            const count = await readContract.getLogCount();
            const total = Number(count);

            if (total === 0) {
                wrap.innerHTML = '<div class="empty-state"><span class="emoji">📭</span>No logs on-chain yet.</div>';
                return;
            }

            let html = `<table class="events-table">
        <thead><tr>
          <th>#</th><th>Timestamp</th><th>Forensic Hash</th><th>Reporter</th>
        </tr></thead><tbody>`;

            // Load in reverse order (newest first), max 100
            const limit = Math.min(total, 100);
            for (let i = total - 1; i >= total - limit; i--) {
                const [timestamp, forensicHash, reporter] = await readContract.getLog(i);
                const date = new Date(Number(timestamp) * 1000).toLocaleString();

                html += `<tr>
          <td>${i}</td>
          <td title="${timestamp}">${date}</td>
          <td class="hash-cell" title="${forensicHash}">${forensicHash}</td>
          <td class="addr-cell" title="${reporter}">${reporter}</td>
        </tr>`;
            }

            html += "</tbody></table>";
            wrap.innerHTML = html;
        } catch (err) {
            wrap.innerHTML = `<div class="empty-state" style="color:var(--danger)">Error: ${err.message}</div>`;
        }
    }

    // ---- Live Event Listener ----

    _startEventListener() {
        if (!this.contract) return;

        document.getElementById("liveIndicator").style.display = "inline";

        try {
            this.contract.on("ForensicHashLogged", (timestamp, forensicHash, reporter) => {
                const container = document.getElementById("liveEvents");

                // Remove empty state if present
                const empty = container.querySelector(".empty-state");
                if (empty) empty.remove();

                const date = new Date(Number(timestamp) * 1000).toLocaleTimeString();
                const item = document.createElement("div");
                item.className = "live-event-item";
                item.innerHTML = `
          <span class="live-dot"></span>
          <strong>${date}</strong> —
          Hash: <span title="${forensicHash}">${forensicHash.substring(0, 18)}…</span>
          | Reporter: ${reporter.substring(0, 10)}…
        `;

                container.insertBefore(item, container.firstChild);

                // Keep max 50 items
                while (container.children.length > 50) {
                    container.removeChild(container.lastChild);
                }
            });
        } catch (err) {
            console.warn("Event listener setup failed (expected if not using WebSocket):", err.message);
        }
    }

    // ---- UI Helpers ----

    async _updateUI() {
        const btn = document.getElementById("btnConnect");
        const btnText = document.getElementById("btnConnectText");
        const bar = document.getElementById("networkBar");

        if (this.isConnected && this.walletAddress) {
            const short = this.walletAddress.substring(0, 6) + "…" + this.walletAddress.substring(38);
            btnText.textContent = short;
            btn.classList.add("connected");
            bar.classList.add("visible");

            document.getElementById("walletAddress").textContent = this.walletAddress;

            try {
                const network = await this.provider.getNetwork();
                document.getElementById("chainId").textContent = network.chainId.toString();

                // Friendly network name
                const names = {
                    "1": "Ethereum Mainnet",
                    "11155111": "Sepolia Testnet",
                    "31337": "Hardhat Local",
                    "1337": "Besu IBFT 2.0 / Ganache",
                };
                document.getElementById("networkName").textContent =
                    names[network.chainId.toString()] || `Chain ${network.chainId}`;

                const balance = await this.provider.getBalance(this.walletAddress);
                document.getElementById("walletBalance").textContent =
                    parseFloat(ethers.formatEther(balance)).toFixed(4) + " ETH";
            } catch (err) {
                console.warn("Network info error:", err);
            }

            this._enableButtons();
        } else {
            btnText.textContent = "Connect MetaMask";
            btn.classList.remove("connected");
            btn.innerHTML = '<span class="dot"></span><span id="btnConnectText">Connect MetaMask</span>';
            bar.classList.remove("visible");
            this._disableButtons();
        }
    }

    _enableButtons() {
        const hasContract = !!this.contractAddress;
        const hasWallet = this.isConnected;

        document.getElementById("btnLogHash").disabled = !(hasContract && hasWallet);
        document.getElementById("btnGetCount").disabled = !hasContract;
        document.getElementById("btnQueryTs").disabled = !hasContract;
        document.getElementById("btnQueryIdx").disabled = !hasContract;
        document.getElementById("btnLoadLogs").disabled = !hasContract;
    }

    _disableButtons() {
        document.getElementById("btnLogHash").disabled = true;
        document.getElementById("btnGetCount").disabled = true;
        document.getElementById("btnQueryTs").disabled = true;
        document.getElementById("btnQueryIdx").disabled = true;
        document.getElementById("btnLoadLogs").disabled = true;
    }

    _showStatus(id, message, type) {
        const el = document.getElementById(id);
        el.textContent = message;
        el.className = `status visible ${type}`;
    }
}

// ---- Init ----
const app = new ForensicLoggerApp();
