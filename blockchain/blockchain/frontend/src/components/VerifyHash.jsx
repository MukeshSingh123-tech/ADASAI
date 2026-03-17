import { useState } from 'react'
import { useWallet } from '../context/WalletContext'
import { ethers } from 'ethers'
import { FORENSIC_LOGGER_ABI } from '../lib/contract'

export default function VerifyHash() {
    const { contractAddress, provider } = useWallet()
    const [hash, setHash] = useState('')
    const [result, setResult] = useState(null)
    const [loading, setLoading] = useState(false)

    const handleVerify = async () => {
        if (!contractAddress || !provider) return

        let normalised = hash.trim()
        if (!normalised.startsWith('0x')) normalised = '0x' + normalised

        if (!/^0x[0-9a-fA-F]{64}$/.test(normalised)) {
            setResult({ exists: false, error: 'Invalid hash format.' })
            return
        }

        setLoading(true)
        try {
            const readContract = new ethers.Contract(contractAddress, FORENSIC_LOGGER_ABI, provider)
            const exists = await readContract.verifyHash(normalised)
            setResult({ exists, error: null })
        } catch (err) {
            setResult({ exists: false, error: err.message })
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="glass-card p-5 animate-slide-up" style={{ animationDelay: '0.3s' }}>
            <div className="section-title">
                <span className="w-8 h-8 rounded-lg bg-brand-500/20 flex items-center justify-center text-sm">🔍</span>
                Verify Hash
            </div>

            <input
                type="text"
                value={hash}
                onChange={(e) => setHash(e.target.value)}
                placeholder="Enter SHA-256 hash to verify"
                className="input-field mt-1"
            />

            <button
                onClick={handleVerify}
                disabled={!contractAddress || loading}
                className="btn-secondary w-full mt-3"
            >
                {loading ? <><span className="spinner mr-2" /> Checking…</> : 'Verify on Blockchain'}
            </button>

            {result && !result.error && (
                <div className={`mt-3 p-3 rounded-xl text-center text-sm font-semibold animate-fade-in ${result.exists
                        ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                        : 'bg-red-500/10 border border-red-500/20 text-red-400'
                    }`}>
                    {result.exists ? (
                        <><span className="text-lg mr-1">✅</span> Hash EXISTS on-chain — Verified!</>
                    ) : (
                        <><span className="text-lg mr-1">❌</span> Hash NOT found — Possible tampering!</>
                    )}
                </div>
            )}

            {result?.error && (
                <div className="status-error animate-fade-in">{result.error}</div>
            )}
        </div>
    )
}
