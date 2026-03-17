/**
 * ForensicLogger ABI — Updated for gas-optimized contract v2.0
 * Includes: logEvent (both overloads), verifyHash, getLogCount, getLog
 */
export const FORENSIC_LOGGER_ABI = [
    // Constructor
    { inputs: [], stateMutability: "nonpayable", type: "constructor" },
    // Custom errors
    { inputs: [], name: "Unauthorized", type: "error" },
    { inputs: [], name: "IndexOutOfBounds", type: "error" },
    { inputs: [], name: "DuplicateHash", type: "error" },
    // Events
    {
        anonymous: false,
        inputs: [
            { indexed: true, internalType: "uint256", name: "timestamp", type: "uint256" },
            { indexed: true, internalType: "bytes32", name: "forensicHash", type: "bytes32" },
            { indexed: true, internalType: "address", name: "reporter", type: "address" },
            { indexed: false, internalType: "bytes12", name: "vehicleId", type: "bytes12" },
        ],
        name: "ForensicHashLogged",
        type: "event",
    },
    // logEvent(bytes32) — backward compatible
    {
        inputs: [{ internalType: "bytes32", name: "forensicHash", type: "bytes32" }],
        name: "logEvent",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function",
    },
    // logEvent(bytes32, bytes12) — with vehicleId
    {
        inputs: [
            { internalType: "bytes32", name: "forensicHash", type: "bytes32" },
            { internalType: "bytes12", name: "vehicleId", type: "bytes12" },
        ],
        name: "logEvent",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function",
    },
    // getLogCount
    {
        inputs: [],
        name: "getLogCount",
        outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
        stateMutability: "view",
        type: "function",
    },
    // getLog
    {
        inputs: [{ internalType: "uint256", name: "index", type: "uint256" }],
        name: "getLog",
        outputs: [
            { internalType: "uint64", name: "timestamp", type: "uint64" },
            { internalType: "bytes32", name: "forensicHash", type: "bytes32" },
            { internalType: "address", name: "reporter", type: "address" },
            { internalType: "bytes12", name: "vehicleId", type: "bytes12" },
        ],
        stateMutability: "view",
        type: "function",
    },
    // verifyHash
    {
        inputs: [{ internalType: "bytes32", name: "forensicHash", type: "bytes32" }],
        name: "verifyHash",
        outputs: [{ internalType: "bool", name: "", type: "bool" }],
        stateMutability: "view",
        type: "function",
    },
    // owner
    {
        inputs: [],
        name: "owner",
        outputs: [{ internalType: "address", name: "", type: "address" }],
        stateMutability: "view",
        type: "function",
    },
    // hashExists
    {
        inputs: [{ internalType: "bytes32", name: "", type: "bytes32" }],
        name: "hashExists",
        outputs: [{ internalType: "bool", name: "", type: "bool" }],
        stateMutability: "view",
        type: "function",
    },
]

/**
 * Truncate an address or hash for display: 0x1234...abcd
 */
export function truncateHash(hash, startLen = 6, endLen = 4) {
    if (!hash || hash.length < startLen + endLen + 2) return hash
    return `${hash.slice(0, startLen + 2)}…${hash.slice(-endLen)}`
}
