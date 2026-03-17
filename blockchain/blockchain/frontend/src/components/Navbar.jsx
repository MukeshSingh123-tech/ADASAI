import { useWallet } from '../context/WalletContext'

export default function Navbar() {
    const { account, isConnected, isConnecting, connect, disconnect, chainName } = useWallet()

    const shortAddr = account
        ? `${account.slice(0, 6)}…${account.slice(-4)}`
        : ''

    return (
        <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-surface-900/80 backdrop-blur-xl">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">

                {/* Logo */}
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center text-lg shadow-lg shadow-brand-500/30">
                        ⛓️
                    </div>
                    <div>
                        <h1 className="text-lg font-bold bg-gradient-to-r from-brand-300 to-brand-500 bg-clip-text text-transparent">
                            ForensicLogger
                        </h1>
                        <p className="text-[10px] text-gray-500 -mt-0.5 tracking-wider uppercase">
                            ADAS Blockchain Dashboard
                        </p>
                    </div>
                </div>

                {/* Connect Button */}
                <button
                    onClick={isConnected ? disconnect : connect}
                    disabled={isConnecting}
                    className={`
            flex items-center gap-2 px-4 py-2 rounded-xl font-medium text-sm
            transition-all duration-300
            ${isConnected
                            ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20'
                            : 'bg-gradient-to-r from-brand-500 to-brand-600 text-white shadow-lg shadow-brand-500/25 hover:shadow-brand-500/40 hover:from-brand-400'
                        }
          `}
                >
                    {isConnecting ? (
                        <>
                            <span className="spinner" />
                            Connecting…
                        </>
                    ) : isConnected ? (
                        <>
                            <span className="live-dot" />
                            {shortAddr}
                        </>
                    ) : (
                        <>
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                    d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                            Connect MetaMask
                        </>
                    )}
                </button>
            </div>
        </header>
    )
}
