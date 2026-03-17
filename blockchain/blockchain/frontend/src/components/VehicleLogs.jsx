import { useState, useEffect, useCallback, useRef } from 'react'
import toast from 'react-hot-toast'

export default function VehicleLogs() {
    const [logs, setLogs] = useState([])
    const [loading, setLoading] = useState(false)
    const [tamperingId, setTamperingId] = useState(null)
    const [limit, setLimit] = useState(10)
    const [totalEntries, setTotalEntries] = useState(0)

    // Filters
    const [searchQuery, setSearchQuery] = useState('')
    const [eventTypeFilter, setEventTypeFilter] = useState('ALL')
    const [appliedSearch, setAppliedSearch] = useState('')
    const [appliedFilter, setAppliedFilter] = useState('ALL')
    
    // Audit state
    const [auditLoading, setAuditLoading] = useState(false)
    const [auditReport, setAuditReport] = useState(null)
    
    // Use a ref to store the latest fetch function so the websocket closure can call it
    // without triggering excessive re-renders
    const fetchRef = useRef()

    const fetchVehicleLogs = useCallback(async () => {
        setLoading(true)
        try {
            const params = new URLSearchParams()
            params.append('limit', limit)
            params.append('offset', 0)
            if (appliedSearch) params.append('search', appliedSearch)
            if (appliedFilter && appliedFilter !== 'ALL') params.append('event_type', appliedFilter)

            const resp = await fetch(`http://localhost:8000/api/logs/vehicle?${params.toString()}`)
            const data = await resp.json()
            if (data.status === 'available') {
                setLogs(data.entries)
                setTotalEntries(data.total_entries)
            } else {
                setLogs([])
                setTotalEntries(0)
            }
        } catch (err) {
            console.error('Failed to fetch vehicle logs', err)
            toast.error('Failed to fetch vehicle logs')
        } finally {
            setLoading(false)
        }
    }, [limit, appliedSearch, appliedFilter])

    useEffect(() => {
        fetchRef.current = fetchVehicleLogs
    }, [fetchVehicleLogs])

    useEffect(() => {
        fetchVehicleLogs()
        
        // Initialize WebSocket connection for live-updates
        let ws
        try {
            ws = new WebSocket('ws://localhost:8000/ws/logs')
            ws.onmessage = (event) => {
                const payload = JSON.parse(event.data)
                if (payload.type === 'LOGS_UPDATED' || payload.type === 'TAMPER_EVENT') {
                    if (fetchRef.current) fetchRef.current()
                }
            }
        } catch (e) {
            console.error('WebSocket connection failed', e)
        }

        return () => {
            if (ws) ws.close()
        }
    }, [fetchVehicleLogs])

    const handleTamper = async (lineIndex, currentConfidence) => {
        setTamperingId(lineIndex)
        // Set new confidence drastically different to simulate tampering
        const newConfidence = currentConfidence > 50 ? 30.0 : 99.0
        
        try {
            const resp = await fetch('http://localhost:8000/api/logs/tamper', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    line_index: lineIndex,
                    new_confidence: newConfidence
                })
            })
            
            const data = await resp.json()
            if (resp.ok && data.status === 'success') {
                toast.success(`Successfully tampered log line ${lineIndex}! Swapped confidence to ${newConfidence}`)
                // No need to fetchVehicleLogs manually because the WebSocket will trigger it
            } else {
                throw new Error(data.detail || 'Tamper failed')
            }
        } catch (err) {
            console.error('Tampering error:', err)
            toast.error(`Tampering failed: ${err.message}`)
        } finally {
            setTamperingId(null)
        }
    }

    const handleVerifyLocal = async (lineRaw) => {
        try {
            const payload = typeof lineRaw === 'string' ? lineRaw : JSON.stringify(lineRaw)
            
            const resp = await fetch('http://localhost:8000/api/logs/audit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ payload: payload })
            })
            
            const data = await resp.json()
            if (data.on_chain) {
                toast.success(`Log verified ON-CHAIN! Valid hash: ${data.sha256.substring(0, 16)}...`)
            } else {
                toast.error(`🚨 TAMPERING DETECTED! Hash does not exist on blockchain! 🚨\nGenerated Hash: ${data.sha256.substring(0, 16)}...`, { duration: 8000 })
            }
        } catch (err) {
            console.error('Audit failed', err)
            toast.error(`Verification check failed: ${err.message}`)
        }
    }

    const handleAuditAll = async () => {
        setAuditLoading(true)
        setAuditReport(null)
        try {
            const resp = await fetch('http://localhost:8000/api/logs/audit-all')
            const data = await resp.json()
            if (resp.ok) {
                setAuditReport(data)
                if (data.tampered_count === 0) {
                    toast.success(`Audit Complete: ${data.total_checked} logs verified. 100% Intact.`)
                } else {
                    toast.error(`Audit Complete: Found ${data.tampered_count} tampered logs!`, { duration: 6000 })
                }
            } else {
                toast.error(`Audit failed: ${data.detail}`)
            }
        } catch (err) {
            console.error('Audit All Error:', err)
            toast.error('Audit request failed')
        } finally {
            setAuditLoading(false)
        }
    }

    // Helper to format string representation of log
    const getLogPayload = (log) => {
        if (log._raw) return log._raw;
        // Strip out the internal UI fields
        const { _line, ...cleanLog } = log;
        // Important: Python json.dumps uses no space separators by default in the python script.
        // Doing standard stringify without spaces to match python's default string serialization
        return JSON.stringify(cleanLog).replace(/":"/g, '":"').replace(/","/g, '","')
    }

    const applyFilters = (e) => {
        if (e) e.preventDefault()
        setLimit(10) // Reset pagination when filtering
        setAppliedSearch(searchQuery)
        setAppliedFilter(eventTypeFilter)
    }

    return (
        <div className="glass-card p-5 animate-slide-up" style={{ animationDelay: '0.6s' }}>
            <div className="flex items-center justify-between mb-4">
                <div className="section-title mb-0 flex items-center gap-2">
                    <span className="w-8 h-8 rounded-lg bg-orange-500/20 flex items-center justify-center text-sm">🚗</span>
                    Off-Chain Vehicle Logs (Local)
                </div>
                <div className="flex gap-2">
                    <a
                        href="http://localhost:8000/api/logs/export-csv"
                        download
                        className="btn-secondary text-xs bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center gap-1"
                        title="Download full forensic report as CSV"
                    >
                        📥 Export CSV
                    </a>
                    <button
                        onClick={handleAuditAll}
                        disabled={auditLoading || loading}
                        className="btn-secondary text-xs bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 flex items-center gap-1"
                        title="Scan entire vehicle_log.txt for tampering"
                    >
                        {auditLoading ? <span className="spinner" /> : '🔍'} Full Audit
                    </button>
                    <button
                        onClick={fetchVehicleLogs}
                        disabled={loading}
                        className="btn-secondary text-xs flex items-center gap-1"
                    >
                        {loading ? <><span className="spinner" /> Refreshing…</> : 'Refresh'}
                    </button>
                </div>
            </div>
            
            <form onSubmit={applyFilters} className="flex flex-wrap gap-2 mb-4 bg-black/20 p-2 rounded-lg border border-white/[0.05]">
                <input 
                    type="text" 
                    placeholder="Search raw logs or hashes..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="flex-1 bg-white/[0.03] border border-white/[0.1] rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-brand-500 min-w-[150px]"
                />
                <select 
                    value={eventTypeFilter}
                    onChange={(e) => setEventTypeFilter(e.target.value)}
                    className="bg-white/[0.03] border border-white/[0.1] rounded px-3 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-brand-500 min-w-[150px] cursor-pointer"
                >
                    <option value="ALL">All Event Types</option>
                    <option value="LANE_DEPARTURE_LEFT">LANE_DEPARTURE_LEFT</option>
                    <option value="LANE_DEPARTURE_RIGHT">LANE_DEPARTURE_RIGHT</option>
                    <option value="LANE_KEEPING">LANE_KEEPING</option>
                </select>
                <button 
                    type="submit"
                    className="btn-primary text-xs w-full sm:w-auto"
                >
                    Apply Filters
                </button>
            </form>

            <p className="text-xs text-gray-400 mb-4">
                These are the local logs saved by the vehicle before being hashed to the blockchain. 
                You can maliciously tamper with them here to test the forensic audit. 
                Updates happen in real-time.
            </p>

            {auditReport && auditReport.tampered_count > 0 && (
                <div className="mb-4 p-4 border border-red-500/40 bg-red-500/10 rounded-lg animate-slide-up">
                    <h3 className="text-red-400 font-bold mb-2 flex items-center gap-2 text-sm">
                        <span>🚨</span> Forensic Audit Report Failed
                    </h3>
                    <p className="text-xs text-red-300 mb-3">
                        Checked {auditReport.total_checked} total logs. Found {auditReport.tampered_count} corrupted entries:
                    </p>
                    <div className="max-h-40 overflow-y-auto space-y-2">
                        {auditReport.tampered_logs.map(t => (
                            <div key={t.line} className="bg-black/40 p-2 rounded text-xs font-mono border border-red-500/20 flex flex-wrap gap-2 items-center">
                                <span className="text-red-400 font-bold">Line {t.line}</span>
                                <span className="text-gray-500">|</span>
                                <span className="text-gray-300">{t.event_type}</span>
                                <span className="text-gray-500">|</span>
                                <span className="text-orange-400 truncate max-w-[200px]">{t.hash}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {auditReport && auditReport.tampered_count === 0 && (
                <div className="mb-4 p-3 border border-green-500/40 bg-green-500/10 rounded-lg animate-slide-up">
                    <h3 className="text-green-400 font-bold flex items-center gap-2 text-sm">
                        <span>✅</span> Audit Passed: 100% Data Integrity
                    </h3>
                    <p className="text-xs text-green-300 mt-1">
                        Successfully verified {auditReport.total_checked} logs against the blockchain. No tampering detected.
                    </p>
                </div>
            )}

            {!loading && logs.length === 0 && (
                <div className="text-center py-10 text-gray-500">
                    <span className="text-3xl block mb-2">📭</span>
                    No vehicle logs found in vehicle_log.txt
                </div>
            )}

            {logs.length > 0 && (
                <div className="overflow-x-auto -mx-5 px-5">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-left text-[10px] uppercase tracking-widest text-gray-500 border-b border-white/[0.06]">
                                <th className="pb-2 pr-3">Line #</th>
                                <th className="pb-2 pr-3">Event Date</th>
                                <th className="pb-2 pr-3">Event Type</th>
                                <th className="pb-2 pr-3">Confidence</th>
                                <th className="pb-2 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {logs.map((log) => {
                                const isInvalid = !log.event_type
                                const timestampStr = log.timestamp ? new Date(log.timestamp * 1000).toLocaleString() : 'Unknown'
                                
                                return (
                                    <tr key={log._line} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                                        <td className="py-2.5 pr-3 text-gray-500 font-mono text-xs">{log._line}</td>
                                        <td className="py-2.5 pr-3 text-gray-300 text-xs">{timestampStr}</td>
                                        <td className="py-2.5 pr-3 font-mono text-xs max-w-[150px] truncate" title={isInvalid ? log._raw : log.event_type}>
                                            {isInvalid ? <span className="text-gray-500 italic">Invalid JSON</span> : log.event_type}
                                        </td>
                                        <td className={`py-2.5 pr-3 font-mono text-xs ${log.confidence < 40 ? 'text-orange-400' : 'text-green-400'}`}>
                                            {!isInvalid && `${log.confidence}%`}
                                        </td>
                                        <td className="py-2.5 flex justify-end gap-2">
                                            <button 
                                                onClick={() => handleVerifyLocal(getLogPayload(log))}
                                                className="px-2 py-1 text-[10px] bg-blue-500/20 text-blue-400 rounded hover:bg-blue-500/30 transition-colors"
                                                title="Rehash this log and check if hash exists on-chain"
                                            >
                                                Verify vs Chain
                                            </button>
                                            {!isInvalid && (
                                                <button 
                                                    onClick={() => handleTamper(log._line, log.confidence)}
                                                    disabled={tamperingId === log._line}
                                                    className="px-2 py-1 text-[10px] bg-red-500/20 text-red-400 rounded hover:bg-red-500/30 transition-colors disabled:opacity-50"
                                                >
                                                    {tamperingId === log._line ? '...' : '! Tamper Data'}
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                    {limit < totalEntries && (
                        <div className="text-center mt-5 mb-2">
                            <button 
                                onClick={() => setLimit(l => l + 20)}
                                className="btn-secondary text-xs px-6 border-brand-500/30 text-brand-400 hover:bg-brand-500/10 mx-auto block"
                            >
                                {loading ? <span className="spinner mr-2" /> : '🔽 '}
                                Load more vehicle logs (Showing {logs.length} of {totalEntries})
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
