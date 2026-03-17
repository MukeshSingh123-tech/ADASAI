import { useState, useEffect } from 'react'

export default function SystemStatus() {
    const [health, setHealth] = useState(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)

    const fetchHealth = async () => {
        setLoading(true)
        setError(null)
        try {
            const resp = await fetch('/api/health')
            if (!resp.ok) throw new Error(`API returned ${resp.status}`)
            const data = await resp.json()
            setHealth(data)
        } catch (err) {
            setError(`FastAPI unreachable: ${err.message}. Run: python main.py`)
            setHealth(null)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchHealth()
        const interval = setInterval(fetchHealth, 15000)
        return () => clearInterval(interval)
    }, [])

    const statusColor = (s) =>
        s === 'online' ? 'text-emerald-400' : s === 'offline' ? 'text-red-400' : 'text-amber-400'
    const statusDot = (s) =>
        s === 'online' ? 'bg-emerald-400' : s === 'offline' ? 'bg-red-400' : 'bg-amber-400'

    return (
        <div className="glass-card p-5 mt-6 animate-slide-up">
            <div className="flex items-center justify-between mb-4">
                <div className="section-title mb-0">
                    <span className="w-8 h-8 rounded-lg bg-violet-500/20 flex items-center justify-center text-sm">🖥️</span>
                    System Status
                    {health && (
                        <span className={`ml-2 text-xs font-normal px-2 py-0.5 rounded-full ${health.overall === 'healthy'
                                ? 'bg-emerald-500/10 text-emerald-400'
                                : 'bg-amber-500/10 text-amber-400'
                            }`}>
                            {health.overall}
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <a href="http://localhost:8000/docs" target="_blank" rel="noopener noreferrer"
                        className="btn-secondary text-xs">
                        API Docs ↗
                    </a>
                    <button onClick={fetchHealth} disabled={loading} className="btn-secondary text-xs">
                        {loading ? <><span className="spinner mr-1" /> Checking…</> : 'Refresh'}
                    </button>
                </div>
            </div>

            {error && (
                <div className="status-warning animate-fade-in text-xs">
                    ⚠️ {error}
                </div>
            )}

            {health && health.services && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2 mt-3">
                    {health.services.map((svc, i) => (
                        <div key={i}
                            className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.04] transition-colors">
                            <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${statusDot(svc.status)} ${svc.status === 'online' ? 'animate-pulse' : ''
                                }`} />
                            <div className="min-w-0 flex-1">
                                <div className={`text-xs font-medium ${statusColor(svc.status)}`}>
                                    {svc.name}
                                </div>
                                <div className="text-[10px] text-gray-500 truncate">
                                    {svc.details || svc.status}
                                    {svc.latency_ms != null && ` • ${svc.latency_ms}ms`}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {!health && !error && !loading && (
                <div className="text-center py-6 text-gray-500 text-sm">
                    <span className="text-2xl block mb-2">🔌</span>
                    Start FastAPI: <code className="text-brand-400">python main.py</code>
                </div>
            )}
        </div>
    )
}
