import { useState } from 'react'
import { useWallet } from '../context/WalletContext'

export default function LogHash() {
    const { contract, isConnected } = useWallet()
    const [hash, setHash] = useState('')
    const [status, setStatus] = useState(null)
    const [loading, setLoading] = useState(false)

    const handleSubmit = async () => {
        if (!contract) {
            setStatus({ type: 'warning', msg: 'Connect wallet and set contract first.' })
            return
        }

        let normalised = hash.trim()
        if (!normalised.startsWith('0x')) normalised = '0x' + normalised

        if (!/^0x[0-9a-fA-F]{64}$/.test(normalised)) {
            setStatus({ type: 'error', msg: 'Invalid hash. Must be 64 hex chars (32 bytes).' })
            return
        }

        setLoading(true)
        setStatus({ type: 'info', msg: 'Confirm transaction in MetaMask…' })

        try {
            // ---> THE FIX IS ON THIS LINE BELOW <---
            // Added the overrides object to force gasPrice to 1 Gwei (1000000000 wei)
            const tx = await contract['logEvent(bytes32)'](normalised, { 
                gasPrice: 1000000000 
            })
            
            setStatus({ type: 'info', msg: `TX sent: ${tx.hash.slice(0, 16)}… Waiting…` })
            const receipt = await tx.wait()
            setStatus({
                type: 'success',
                msg: `✅ Hash logged! Block #${receipt.blockNumber}`
            })
            setHash('')
        } catch (err) {
            setStatus({ type: 'error', msg: `❌ ${err.reason || err.message}` })
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="glass-card p-5 animate-slide-up" style={{ animationDelay: '0.1s' }}>
            <div className="section-title">
                <span className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center text-sm">📝</span>
                Log Forensic Hash
            </div>

            <input
                type="text"
                value={hash}
                onChange={(e) => setHash(e.target.value)}
                placeholder="Enter SHA-256 hash (64 hex chars)"
                maxLength={66}
                className="input-field mt-1"
            />

            <button
                onClick={handleSubmit}
                disabled={!isConnected || !contract || loading}
                className="btn-primary w-full mt-3"
            >
                {loading ? (
                    <><span className="spinner mr-2" /> Submitting…</>
                ) : (
                    'Submit to Blockchain'
                )}
            </button>

            {status && (
                <div className={`status-${status.type} animate-fade-in`}>
                    {status.msg}
                </div>
            )}
        </div>
    )
}