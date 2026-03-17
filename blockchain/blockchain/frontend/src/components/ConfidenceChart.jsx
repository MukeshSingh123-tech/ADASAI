import { useState, useEffect, useCallback } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts'

export default function ConfidenceChart() {
    const [data, setData] = useState([])
    const [loading, setLoading] = useState(true)

    const fetchChartData = useCallback(async () => {
        try {
            const resp = await fetch('http://localhost:8000/api/analytics/confidence?limit=20')
            const result = await resp.json()
            setData(result)
        } catch (err) {
            console.error('Chart fetch failed', err)
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        fetchChartData()

        // Sync with the same websocket as logs for real-time updates
        const ws = new WebSocket('ws://localhost:8000/ws/logs')
        ws.onmessage = (event) => {
            const payload = JSON.parse(event.data)
            if (payload.type === 'LOGS_UPDATED' || payload.type === 'TAMPER_EVENT') {
                fetchChartData()
            }
        }

        return () => ws.close()
    }, [fetchChartData])

    if (loading && data.length === 0) {
        return (
            <div className="glass-card p-6 h-[300px] flex items-center justify-center">
                <div className="spinner" />
            </div>
        )
    }

    return (
        <div className="glass-card p-6 animate-slide-up" style={{ animationDelay: '0.4s' }}>
            <div className="flex items-center justify-between mb-6">
                <div className="section-title mb-0 flex items-center gap-2">
                    <span className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center text-sm">📈</span>
                    AI Perception Confidence (Live)
                </div>
                <div className="text-[10px] uppercase tracking-widest text-gray-500">
                    Real-time Trend Analysis
                </div>
            </div>

            <div className="h-[220px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data}>
                        <defs>
                            <linearGradient id="colorConf" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                                <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                        <XAxis 
                            dataKey="time" 
                            stroke="rgba(255,255,255,0.3)" 
                            fontSize={10}
                            tickLine={false}
                            axisLine={false}
                        />
                        <YAxis 
                            stroke="rgba(255,255,255,0.3)" 
                            fontSize={10} 
                            tickLine={false}
                            axisLine={false}
                            domain={[0, 100]}
                            tickFormatter={(val) => `${val}%`}
                        />
                        <Tooltip 
                            contentStyle={{ 
                                backgroundColor: '#1a1f2e', 
                                border: '1px solid rgba(255,255,255,0.1)',
                                borderRadius: '8px',
                                fontSize: '11px',
                                color: '#fff'
                            }}
                            itemStyle={{ color: '#10b981' }}
                        />
                        <Area 
                            type="monotone" 
                            dataKey="confidence" 
                            stroke="#10b981" 
                            strokeWidth={2}
                            fillOpacity={1} 
                            fill="url(#colorConf)" 
                            animationDuration={1000}
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
            
            <div className="mt-4 flex items-center gap-4">
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-[10px] text-gray-400">Stream Active</span>
                </div>
                <div className="text-[10px] text-gray-500 italic">
                    Visualizing confidence levels from ADAS perception engine
                </div>
            </div>
        </div>
    )
}
