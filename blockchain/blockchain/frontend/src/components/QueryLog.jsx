import { useState } from 'react'
import { useWallet } from '../context/WalletContext'
import { ethers } from 'ethers'
import { FORENSIC_LOGGER_ABI, truncateHash } from '../lib/contract'

export default function QueryLog() {
    const { contractAddress, provider } = useWallet()
    const [index, setIndex] = useState('')
    const [result, setResult] = useState(null)
    const [status, setStatus] = useState(null)
    const [loading, setLoading] = useState(false)

    const handleQuery = async () => {
        if (!contractAddress || !provider) return
        if (index === '') {
            setStatus({ type: 'warning', msg: 'Enter a log index.' })
            return
        }

        setLoading(true)
        setStatus(null)
        try {
            const readContract = new ethers.Contract(contractAddress, FORENSIC_LOGGER_ABI, provider)
            const [timestamp, forensicHash, reporter, vehicleId] = await readContract.getLog(index)
            const date = new Date(Number(timestamp) * 1000).toLocaleString()
            setResult({ timestamp: Number(timestamp), date, forensicHash, reporter, vehicleId })
            setStatus(null)
        } catch (err) {
            setResult(null)
            setStatus({ type: 'error', msg: err.reason || err.message })
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="glass-card p-5 animate-slide-up" style={{ animationDelay: '0.4s' }}>
            <div className="section-title">
                <span className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center text-sm">📋</span>
                Query Log by Index
            </div>

            <div className="flex gap-3">
                <input
                    type="number"
                    value={index}
                    onChange={(e) => setIndex(e.target.value)}
                    placeholder="Index (0-based)"
                    min="0"
                    className="input-field flex-1"
                />
                <button
                    onClick={handleQuery}
                    disabled={!contractAddress || loading}
                    className="btn-secondary whitespace-nowrap"
                >
                    {loading ? <span className="spinner" /> : 'Fetch Log'}
                </button>
            </div>

            {result && (
                <div className="mt-4 space-y-2 animate-fade-in">
                    <div className="grid grid-cols-[100px_1fr] gap-y-2 text-sm">
                        <span className="text-gray-500">Timestamp</span>
                        <span className="text-gray-200">{result.date} ({result.timestamp})</span>

                        <span className="text-gray-500">Hash</span>
                        <span className="text-brand-400 font-mono text-xs break-all">{result.forensicHash}</span>

                        <span className="text-gray-500">Reporter</span>
                        <span className="text-gray-300 font-mono text-xs">{result.reporter}</span>

                        <span className="text-gray-500">Vehicle ID</span>
                        <span className="text-gray-300 font-mono text-xs">{result.vehicleId}</span>
                    </div>
                </div>
            )}

            {status && <div className={`status-${status.type} animate-fade-in`}>{status.msg}</div>}
        </div>
    )
}
