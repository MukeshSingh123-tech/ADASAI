import { useState, useEffect } from 'react'
import { useWallet } from '../context/WalletContext'
import { ethers } from 'ethers'
import { FORENSIC_LOGGER_ABI, truncateHash } from '../lib/contract'
import toast from 'react-hot-toast'

export default function AllLogs() {
    const { contractAddress, provider } = useWallet()
    const [logs, setLogs] = useState([])
    const [loading, setLoading] = useState(false)
    const [loaded, setLoaded] = useState(false)
    const [limit, setLimit] = useState(10)
    const [totalOnChain, setTotalOnChain] = useState(0)

    const fetchLogs = async () => {
        if (!contractAddress || !provider) return
        setLoading(true)

        try {
            const readContract = new ethers.Contract(contractAddress, FORENSIC_LOGGER_ABI, provider)
            const count = Number(await readContract.getLogCount())

            if (count === 0) {
                setLogs([])
                setLoaded(true)
                setLoading(false)
                return
            }

            setTotalOnChain(count)
            const currentLimit = Math.min(count, limit)
            const entries = []

            for (let i = count - 1; i >= count - currentLimit; i--) {
                const [timestamp, forensicHash, reporter, vehicleId] = await readContract.getLog(i)
                entries.push({
                    index: i,
                    timestamp: Number(timestamp),
                    date: new Date(Number(timestamp) * 1000).toLocaleString(),
                    forensicHash,
                    reporter,
                    vehicleId,
                })
            }

            setLogs(entries)
            setLoaded(true)
        } catch (err) {
            console.error('loadAllLogs error:', err)
            toast.error('Failed to load on-chain logs')
        } finally {
            setLoading(false)
        }
    }

    // Automatically re-fetch when limit changes if we've already loaded once
    useEffect(() => {
        if (loaded) {
            fetchLogs()
        }
    }, [limit])

    return (
        <div className="glass-card p-5 animate-slide-up" style={{ animationDelay: '0.5s' }}>
            <div className="flex items-center justify-between mb-4">
                <div className="section-title mb-0">
                    <span className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center text-sm">📜</span>
                    All Forensic Logs
                </div>
                <button
                    onClick={fetchLogs}
                    disabled={!contractAddress || loading}
                    className="btn-secondary text-xs"
                >
                    {loading ? <><span className="spinner mr-1" /> Loading…</> : 'Load Logs'}
                </button>
            </div>

            {!loaded && !loading && (
                <div className="text-center py-10 text-gray-500">
                    <span className="text-3xl block mb-2">📭</span>
                    Connect wallet & set contract, then click Load Logs
                </div>
            )}

            {loaded && logs.length === 0 && (
                <div className="text-center py-10 text-gray-500">
                    <span className="text-3xl block mb-2">📭</span>
                    No logs on-chain yet.
                </div>
            )}

            {logs.length > 0 && (
                <div className="overflow-x-auto -mx-5 px-5">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-left text-[10px] uppercase tracking-widest text-gray-500 border-b border-white/[0.06]">
                                <th className="pb-2 pr-3">#</th>
                                <th className="pb-2 pr-3">Timestamp</th>
                                <th className="pb-2 pr-3">Forensic Hash</th>
                                <th className="pb-2 pr-3">Reporter</th>
                                <th className="pb-2">Vehicle</th>
                            </tr>
                        </thead>
                        <tbody>
                            {logs.map((log) => (
                                <tr key={log.index}
                                    className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                                    <td className="py-2.5 pr-3 text-gray-500 font-mono text-xs">{log.index}</td>
                                    <td className="py-2.5 pr-3 text-gray-300 text-xs" title={String(log.timestamp)}>
                                        {log.date}
                                    </td>
                                    <td className="py-2.5 pr-3 text-brand-400 font-mono text-xs" title={log.forensicHash}>
                                        {truncateHash(log.forensicHash, 8, 6)}
                                    </td>
                                    <td className="py-2.5 pr-3 text-gray-400 font-mono text-xs" title={log.reporter}>
                                        {truncateHash(log.reporter, 6, 4)}
                                    </td>
                                    <td className="py-2.5 text-gray-400 font-mono text-xs">
                                        {log.vehicleId}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {loaded && limit < totalOnChain && (
                <div className="text-center mt-5 mb-2">
                    <button 
                        onClick={() => setLimit(prev => prev + 20)}
                        className="btn-secondary text-xs px-6 border-brand-500/30 text-brand-400 hover:bg-brand-500/10 mx-auto block"
                    >
                        {loading ? <span className="spinner mr-2" /> : '🔽 '}
                        Load more on-chain logs (Showing {logs.length} of {totalOnChain})
                    </button>
                </div>
            )}
        </div>
    )
}
