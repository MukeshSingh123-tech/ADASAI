import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { ethers } from 'ethers'
import { FORENSIC_LOGGER_ABI } from '../lib/contract'
import { getChainName } from '../lib/constants'

const WalletContext = createContext(null)

export function WalletProvider({ children }) {
    const [account, setAccount] = useState(null)
    const [provider, setProvider] = useState(null)
    const [signer, setSigner] = useState(null)
    const [chainId, setChainId] = useState(null)
    const [balance, setBalance] = useState(null)
    const [contractAddress, setContractAddress] = useState(null)
    const [contract, setContract] = useState(null)
    const [isConnecting, setIsConnecting] = useState(false)

    // ── Connect to MetaMask ───────────────────────────────
    const connect = useCallback(async () => {
        if (!window.ethereum) {
            alert('MetaMask is not installed!\n\nPlease install MetaMask from https://metamask.io')
            return
        }

        setIsConnecting(true)
        try {
            const browserProvider = new ethers.BrowserProvider(window.ethereum)
            const accounts = await browserProvider.send('eth_requestAccounts', [])
            const walletSigner = await browserProvider.getSigner()
            const network = await browserProvider.getNetwork()
            const bal = await browserProvider.getBalance(accounts[0])

            setProvider(browserProvider)
            setSigner(walletSigner)
            setAccount(accounts[0])
            setChainId(Number(network.chainId))
            setBalance(ethers.formatEther(bal))
        } catch (err) {
            console.error('Connect failed:', err)
        } finally {
            setIsConnecting(false)
        }
    }, [])

    // ── Disconnect ────────────────────────────────────────
    const disconnect = useCallback(() => {
        setAccount(null)
        setProvider(null)
        setSigner(null)
        setChainId(null)
        setBalance(null)
        setContract(null)
    }, [])

    // ── Set contract address & create instance ────────────
    const setContractAddr = useCallback((addr) => {
        try {
            const checksummed = ethers.getAddress(addr)
            setContractAddress(checksummed)
            if (signer) {
                setContract(new ethers.Contract(checksummed, FORENSIC_LOGGER_ABI, signer))
            }
        } catch {
            console.error('Invalid contract address:', addr)
        }
    }, [signer])

    // Re-attach contract when signer changes
    useEffect(() => {
        if (signer && contractAddress) {
            setContract(new ethers.Contract(contractAddress, FORENSIC_LOGGER_ABI, signer))
        }
    }, [signer, contractAddress])

    // ── Listen for MetaMask events ────────────────────────
    useEffect(() => {
        if (!window.ethereum) return

        const handleAccountsChanged = (accounts) => {
            if (accounts.length === 0) disconnect()
            else {
                setAccount(accounts[0])
                if (provider) {
                    provider.getBalance(accounts[0]).then(b => setBalance(ethers.formatEther(b)))
                }
            }
        }
        const handleChainChanged = () => window.location.reload()

        window.ethereum.on('accountsChanged', handleAccountsChanged)
        window.ethereum.on('chainChanged', handleChainChanged)

        return () => {
            window.ethereum.removeListener('accountsChanged', handleAccountsChanged)
            window.ethereum.removeListener('chainChanged', handleChainChanged)
        }
    }, [provider, disconnect])

    const value = {
        account,
        provider,
        signer,
        chainId,
        balance,
        contract,
        contractAddress,
        isConnecting,
        isConnected: !!account,
        chainName: getChainName(chainId),
        connect,
        disconnect,
        setContractAddr,
    }

    return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>
}

export function useWallet() {
    const ctx = useContext(WalletContext)
    if (!ctx) throw new Error('useWallet must be used within WalletProvider')
    return ctx
}
