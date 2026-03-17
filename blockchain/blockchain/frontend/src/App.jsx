import { WalletProvider } from './context/WalletContext'
import Navbar from './components/Navbar'
import NetworkBar from './components/NetworkBar'
import SystemStatus from './components/SystemStatus'
import ContractConfig from './components/ContractConfig'
import LogHash from './components/LogHash'
import LogCount from './components/LogCount'
import VerifyHash from './components/VerifyHash'
import QueryLog from './components/QueryLog'
import AllLogs from './components/AllLogs'
import LiveEvents from './components/LiveEvents'
import VehicleLogs from './components/VehicleLogs'
import ConfidenceChart from './components/ConfidenceChart'
import { Toaster } from 'react-hot-toast'

export default function App() {
    return (
        <WalletProvider>
            <div className="min-h-screen flex flex-col">
                {/* ── Header ──────────────────────────────────── */}
                <Navbar />

                {/* ── Main Content ────────────────────────────── */}
                <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 pb-12">

                    {/* Network Stats */}
                    <NetworkBar />

                    {/* System Health (FastAPI) */}
                    <SystemStatus />

                    {/* Contract Configuration */}
                    <ContractConfig />

                    {/* Dashboard Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mt-6">
                        <LogHash />
                        <LogCount />
                        <VerifyHash />
                    </div>

                    {/* Query Section */}
                    <div className="mt-6">
                        <QueryLog />
                    </div>

                    {/* Analytics Chart */}
                    <div className="mt-6">
                        <ConfidenceChart />
                    </div>

                    {/* Full-width Sections */}
                    <div className="mt-6 gap-6 grid grid-cols-1 xl:grid-cols-2">
                        <VehicleLogs />
                        <AllLogs />
                    </div>

                    <div className="mt-6">
                        <LiveEvents />
                    </div>
                </main>

                <footer className="text-center py-6 text-gray-600 text-xs border-t border-white/[0.04]">
                    <p>ForensicLogger Dashboard — Secure Adaptive AUTOSAR Architecture</p>
                    <p className="mt-1">© 2026 Mukesh Singh • Hyperledger Besu IBFT 2.0</p>
                </footer>
                
                {/* Global Toaster for notifications */}
                <Toaster 
                    position="bottom-right" 
                    toastOptions={{
                        style: {
                            background: '#1a1f2e',
                            color: '#e2e8f0',
                            border: '1px solid rgba(255,255,255,0.1)',
                            fontSize: '12px'
                        }
                    }} 
                />
            </div>
        </WalletProvider>
    )
}
