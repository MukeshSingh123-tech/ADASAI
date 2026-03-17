// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title  ForensicLogger
 * @notice Immutably logs ADAS lane-departure forensic hashes on-chain.
 * @dev    Deployed on a Hyperledger Besu IBFT 2.0 private network with
 *         zero gas fees (min-gas-price=0 in genesis.json).
 *
 * ┌──────────────────────────────────────────────────────────────────────┐
 * │  GAS OPTIMISATION STRATEGIES                                        │
 * │                                                                     │
 * │  1. Custom Errors (Solidity 0.8.4+)                                 │
 * │     - `error Unauthorized()` instead of `require(... , "string")`   │
 * │     - Saves ~200 gas per revert (no ABI-encoded string storage)     │
 * │                                                                     │
 * │  2. O(1) Hash Verification via `hashExists` mapping                 │
 * │     - `mapping(bytes32 => bool)` provides constant-time lookup      │
 * │     - The Auditor script calls `verifyHash()` instead of            │
 * │       iterating through the entire `logs[]` array                   │
 * │                                                                     │
 * │  3. Minimal Storage Per Entry                                       │
 * │     - `LogEntry` uses tightly packed struct members                  │
 * │     - `vehicleId` stored as bytes12 (12 bytes) not string           │
 * │     - `timestamp` uses uint64 (8 bytes) not uint256 (32 bytes)      │
 * │     - `reporter` is address (20 bytes)                              │
 * │     - Total: 32 + 8 + 12 + 20 = 72 bytes → 3 storage slots         │
 * │                                                                     │
 * │  4. Immutable Owner (set once in constructor)                       │
 * │     - `immutable` keyword eliminates SLOAD for owner checks         │
 * │     - Saves ~2,100 gas (cold SLOAD) per logEvent() call             │
 * └──────────────────────────────────────────────────────────────────────┘
 *
 * @author  Mukesh Singh
 * @custom:research-project Secure Adaptive AUTOSAR Architecture for
 *          AI-Based ADAS Perception with Blockchain Forensics
 */
contract ForensicLogger {

    // ══════════════════════════════════════════════════════════════════
    //  Custom Errors — gas-efficient reverts (no ABI string encoding)
    // ══════════════════════════════════════════════════════════════════

    /// @dev Reverts when a non-owner address calls a restricted function.
    error Unauthorized();

    /// @dev Reverts when querying a log index that does not exist.
    error IndexOutOfBounds();

    /// @dev Reverts when attempting to log a duplicate hash.
    error DuplicateHash();

    // ══════════════════════════════════════════════════════════════════
    //  State Variables
    // ══════════════════════════════════════════════════════════════════

    /// @notice Deployer address — the only account authorised to log events.
    ///         Declared `immutable` to save ~2,100 gas per access (no SLOAD).
    address public immutable owner;

    /// @notice Packed struct for each forensic log entry.
    ///         Members are ordered for optimal EVM slot packing:
    ///           Slot 0: forensicHash (bytes32, 32 bytes — fills entire slot)
    ///           Slot 1: timestamp (uint64, 8 bytes) + vehicleId (bytes12, 12 bytes)
    ///                   + reporter (address, 20 bytes) = 40 bytes → 2 slots
    struct LogEntry {
        bytes32 forensicHash;   // SHA-256 digest of the ADAS JSON payload
        uint64  timestamp;      // Block timestamp when the hash was recorded
        bytes12 vehicleId;      // Vehicle identifier (e.g., "ELC23027")
        address reporter;       // EOA that submitted the transaction
    }

    /// @notice Append-only array of all forensic log entries.
    LogEntry[] public logs;

    /// @notice O(1) lookup: has this hash been recorded before?
    ///         Used by the Auditor script (Phase 6) for fast verification.
    mapping(bytes32 => bool) public hashExists;

    // ══════════════════════════════════════════════════════════════════
    //  Events
    // ══════════════════════════════════════════════════════════════════

    /// @notice Emitted every time a forensic hash is permanently recorded.
    ///         Indexed parameters enable efficient off-chain log filtering.
    event ForensicHashLogged(
        uint256 indexed timestamp,
        bytes32 indexed forensicHash,
        address indexed reporter,
        bytes12         vehicleId
    );

    // ══════════════════════════════════════════════════════════════════
    //  Modifiers
    // ══════════════════════════════════════════════════════════════════

    /// @dev Restricts function access to the contract deployer.
    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    // ══════════════════════════════════════════════════════════════════
    //  Constructor
    // ══════════════════════════════════════════════════════════════════

    /// @notice Sets the deployer as the immutable owner.
    constructor() {
        owner = msg.sender;
    }

    // ══════════════════════════════════════════════════════════════════
    //  Core Functions — Write (State-Changing)
    // ══════════════════════════════════════════════════════════════════

    /**
     * @notice Store a forensic hash on-chain with vehicle identification.
     * @param  forensicHash  The SHA-256 hash of the ADAS JSON payload,
     *                       passed as a bytes32 value.
     * @param  vehicleId     The vehicle identifier (e.g., "ELC23027"),
     *                       encoded as bytes12.
     *
     * @dev    Gas cost breakdown (approximate):
     *           - SSTORE (new slot):  22,100 gas × 3 slots = 66,300
     *           - hashExists SSTORE:  22,100 gas × 1 slot  = 22,100
     *           - LOG3 (event):       ~1,875 gas
     *           - Base + calldata:    ~2,500 gas
     *           - Total:              ~92,775 gas per call
     *
     *         On the Besu IBFT 2.0 network with min-gas-price=0, this
     *         costs zero ETH — ideal for high-frequency ADAS logging.
     */
    function logEvent(bytes32 forensicHash, bytes12 vehicleId)
        external
        onlyOwner
    {
        // Prevent duplicate hash entries (belt-and-suspenders integrity)
        if (hashExists[forensicHash]) revert DuplicateHash();

        // Record the hash in the O(1) lookup mapping
        hashExists[forensicHash] = true;

        // Append to the sequential log array
        logs.push(LogEntry({
            forensicHash: forensicHash,
            timestamp:    uint64(block.timestamp),
            vehicleId:    vehicleId,
            reporter:     msg.sender
        }));

        emit ForensicHashLogged(
            block.timestamp,
            forensicHash,
            msg.sender,
            vehicleId
        );
    }

    /**
     * @notice Overloaded logEvent for backward compatibility (no vehicleId).
     * @param  forensicHash  The SHA-256 hash of the ADAS JSON payload.
     */
    function logEvent(bytes32 forensicHash) external onlyOwner {
        if (hashExists[forensicHash]) revert DuplicateHash();

        hashExists[forensicHash] = true;

        logs.push(LogEntry({
            forensicHash: forensicHash,
            timestamp:    uint64(block.timestamp),
            vehicleId:    bytes12(0),
            reporter:     msg.sender
        }));

        emit ForensicHashLogged(
            block.timestamp,
            forensicHash,
            msg.sender,
            bytes12(0)
        );
    }

    // ══════════════════════════════════════════════════════════════════
    //  View Functions — Read-Only (No Gas Cost When Called Off-Chain)
    // ══════════════════════════════════════════════════════════════════

    /**
     * @notice Return the total number of logged events.
     * @return The length of the `logs` array.
     */
    function getLogCount() external view returns (uint256) {
        return logs.length;
    }

    /**
     * @notice Retrieve a specific log entry by zero-based index.
     * @param  index  Zero-based index into the `logs` array.
     * @return timestamp     Block timestamp when the hash was recorded.
     * @return forensicHash  The SHA-256 digest (bytes32).
     * @return reporter      The EOA that submitted the hash.
     * @return vehicleId     The vehicle identifier (bytes12).
     */
    function getLog(uint256 index)
        external
        view
        returns (
            uint64  timestamp,
            bytes32 forensicHash,
            address reporter,
            bytes12 vehicleId
        )
    {
        if (index >= logs.length) revert IndexOutOfBounds();
        LogEntry storage entry = logs[index];
        return (
            entry.timestamp,
            entry.forensicHash,
            entry.reporter,
            entry.vehicleId
        );
    }

    /**
     * @notice Verify whether a specific hash exists on-chain.
     * @dev    O(1) lookup via the `hashExists` mapping.
     *         Called by the Python Auditor script (Phase 6) to validate
     *         each line in vehicle_log.txt without iterating the array.
     * @param  forensicHash  The hash to verify.
     * @return True if the hash has been recorded, false otherwise.
     */
    function verifyHash(bytes32 forensicHash)
        external
        view
        returns (bool)
    {
        return hashExists[forensicHash];
    }
}
