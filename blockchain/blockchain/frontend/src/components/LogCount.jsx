import { useState, useEffect } from 'react'
import { useWallet } from '../context/WalletContext'
import { ethers } from 'ethers'
import { FORENSIC_LOGGER_ABI } from '../lib/contract'

export default function LogCount() {
    const { contractAddress, provider } = useWallet()
    const [count, setCount] = useState(null)
    const [loading, setLoading] = useState(false)

    const fetchCount = async () => {
        if (!contractAddress || !provider) return
        setLoading(true)
        try {
            const readContract = new ethers.Contract(contractAddress, FORENSIC_LOGGER_ABI, provider)
            const c = await readContract.getLogCount()
            setCount(Number(c))
        } catch (err) {
            console.error('getLogCount error:', err)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchCount()
    }, [contractAddress, provider])

    return (
        <div className="glass-card p-5 animate-slide-up flex flex-col items-center justify-center"
            style={{ animationDelay: '0.2s' }}>
            <div className="section-title justify-center">
                <span className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center text-sm">📊</span>
                On-Chain Logs
            </div>

            <div className="text-5xl font-extrabold bg-gradient-to-r from-emerald-400 to-brand-400 bg-clip-text text-transparent my-4">
                {loading ? (
                    <span className="shimmer inline-block w-16 h-12 rounded-lg" />
                ) : (
                    count ?? '—'
                )}
            </div>

            <button onClick={fetchCount} disabled={!contractAddress} className="btn-secondary text-xs">
                Refresh Count
            </button>
        </div>
    )
}
