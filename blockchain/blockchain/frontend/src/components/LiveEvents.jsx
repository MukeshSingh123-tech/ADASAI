import { useState, useEffect, useRef } from 'react'
import { useWallet } from '../context/WalletContext'
import { truncateHash } from '../lib/contract'

export default function LiveEvents() {
    const { contract, contractAddress } = useWallet()
    const [events, setEvents] = useState([])
    const [listening, setListening] = useState(false)
    const containerRef = useRef(null)

    useEffect(() => {
        if (!contract) return

        setListening(true)

        const handler = (timestamp, forensicHash, reporter, event) => {
            const newEvent = {
                id: Date.now() + Math.random(),
                timestamp: Number(timestamp),
                date: new Date(Number(timestamp) * 1000).toLocaleTimeString(),
                forensicHash,
                reporter,
            }

            setEvents((prev) => [newEvent, ...prev.slice(0, 49)])
        }

        try {
            contract.on('ForensicHashLogged', handler)
        } catch (err) {
            console.warn('Live event listener setup failed:', err.message)
        }

        return () => {
            try {
                contract.off('ForensicHashLogged', handler)
            } catch { }
            setListening(false)
        }
    }, [contract])

    return (
        <div className="glass-card p-5 animate-slide-up" style={{ animationDelay: '0.6s' }}>
            <div className="flex items-center justify-between mb-4">
                <div className="section-title mb-0">
                    <span className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center text-sm">📡</span>
                    Live Events
                    {listening && (
                        <span className="ml-2 flex items-center gap-1.5 text-xs text-emerald-400 font-normal">
                            <span className="live-dot" />
                            Listening
                        </span>
                    )}
                </div>
            </div>

            <div ref={containerRef} className="max-h-64 overflow-y-auto space-y-2">
                {events.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                        <span className="text-3xl block mb-2">📡</span>
                        Waiting for ForensicHashLogged events…
                    </div>
                )}

                {events.map((evt) => (
                    <div
                        key={evt.id}
                        className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/[0.04] animate-fade-in"
                    >
                        <span className="live-dot mt-1.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 text-xs">
                                <span className="text-gray-400 font-medium">{evt.date}</span>
                                <span className="text-gray-600">•</span>
                                <span className="text-gray-500 font-mono">{truncateHash(evt.reporter, 6, 4)}</span>
                            </div>
                            <div className="text-brand-400 font-mono text-xs mt-0.5 truncate" title={evt.forensicHash}>
                                {evt.forensicHash}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}
