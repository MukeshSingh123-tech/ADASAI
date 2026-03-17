export const CHAIN_NAMES = {
    '1': 'Ethereum Mainnet',
    '5': 'Goerli Testnet',
    '11155111': 'Sepolia Testnet',
    '31337': 'Hardhat Local',
    '1337': 'Besu IBFT 2.0',
}

export const getChainName = (chainId) => {
    return CHAIN_NAMES[String(chainId)] || `Chain ${chainId}`
}
