import { useState, useEffect } from 'react'
import { useWallet } from '../context/WalletContext'

export default function ContractConfig() {
    const { setContractAddr, contractAddress, isConnected } = useWallet()
    const [input, setInput] = useState('')
    const [status, setStatus] = useState(null)
    const [logCount, setLogCount] = useState(null)

    // Auto-load on mount — try FastAPI first, then config.json
    useEffect(() => {
        (async () => {
            try {
                // Try FastAPI backend first
                const apiResp = await fetch('/api/blockchain/contract')
                if (apiResp.ok) {
                    const data = await apiResp.json()
                    if (data.status === 'deployed' && data.address) {
                        setInput(data.address)
                        setContractAddr(data.address)
                        setLogCount(data.log_count)
                        setStatus({ type: 'success', msg: `Auto-loaded from FastAPI — ${data.address.slice(0, 14)}…` })
                        return
                    }
                }
            } catch {
                // FastAPI not available, fall through
            }

            try {
                // Fallback to config.json
                const resp = await fetch('/config.json')
                if (resp.ok) {
                    const config = await resp.json()
                    if (config.contractAddress) {
                        setInput(config.contractAddress)
                        setContractAddr(config.contractAddress)
                        setStatus({ type: 'info', msg: `Auto-loaded from config.json` })
                    }
                }
            } catch {
                // No auto-load available
            }
        })()
    }, [])

    const handleSet = () => {
        if (!input.trim()) {
            setStatus({ type: 'warning', msg: 'Enter a contract address.' })
            return
        }
        try {
            setContractAddr(input.trim())
            setStatus({ type: 'success', msg: `Contract set: ${input.trim().slice(0, 10)}…` })
        } catch {
            setStatus({ type: 'error', msg: 'Invalid Ethereum address.' })
        }
    }

    const handleAutoLoad = async () => {
        try {
            // Try FastAPI first
            const apiResp = await fetch('/api/blockchain/contract')
            if (apiResp.ok) {
                const data = await apiResp.json()
                if (data.status === 'deployed' && data.address) {
                    setInput(data.address)
                    setContractAddr(data.address)
                    setLogCount(data.log_count)
                    setStatus({ type: 'success', msg: `Loaded via FastAPI — ${data.log_count ?? '?'} logs on-chain` })
                    return
                }
            }
        } catch {
            // fall through
        }

        try {
            const resp = await fetch('/config.json')
            if (!resp.ok) throw new Error('config.json not found. Deploy the contract first.')
            const config = await resp.json()
            setInput(config.contractAddress)
            setContractAddr(config.contractAddress)
            setStatus({ type: 'success', msg: `Loaded from config.json — ${config.network} — ${config.deployedAt}` })
        } catch (err) {
            setStatus({ type: 'error', msg: err.message })
        }
    }

    return (
        <div className="glass-card p-5 mt-6 animate-slide-up">
            <div className="section-title">
                <span className="text-xl">⚙️</span>
                Contract Configuration
                {logCount != null && (
                    <span className="ml-auto text-xs font-normal text-gray-500">
                        {logCount} logs on-chain
                    </span>
                )}
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
                <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="0x... ForensicLogger contract address"
                    className="input-field flex-1"
                />
                <div className="flex gap-2">
                    <button onClick={handleSet} className="btn-primary whitespace-nowrap">
                        Set Contract
                    </button>
                    <button onClick={handleAutoLoad} className="btn-secondary whitespace-nowrap">
                        Auto-Load
                    </button>
                </div>
            </div>

            <p className="text-xs text-gray-500 mt-2">
                Auto-loads from <strong className="text-gray-400">FastAPI</strong> → <code className="text-brand-400">config.json</code> fallback.
                Or paste the address manually.
            </p>

            {status && (
                <div className={`status-${status.type} animate-fade-in`}>
                    {status.msg}
                </div>
            )}

            {contractAddress && (
                <div className="mt-3 flex items-center gap-2 text-xs text-emerald-400">
                    <span className="live-dot" />
                    Connected to {contractAddress.slice(0, 10)}…{contractAddress.slice(-4)}
                </div>
            )}
        </div>
    )
}
