import { useWallet } from '../context/WalletContext'
import { truncateHash } from '../lib/contract'

export default function NetworkBar() {
    const { isConnected, account, chainId, chainName, balance } = useWallet()

    if (!isConnected) return null

    const stats = [
        { label: 'Wallet', value: truncateHash(account, 6, 4), icon: '👛' },
        { label: 'Network', value: chainName, icon: '🌐' },
        { label: 'Chain ID', value: chainId, icon: '🔗' },
        { label: 'Balance', value: `${parseFloat(balance || 0).toFixed(4)} ETH`, icon: '💎' },
    ]

    return (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 animate-fade-in">
            {stats.map((s, i) => (
                <div key={i} className="stat-card group">
                    <div className="text-xl mb-1">{s.icon}</div>
                    <div className="text-[10px] uppercase tracking-widest text-gray-500 font-medium">
                        {s.label}
                    </div>
                    <div className="text-sm font-semibold text-gray-200 mt-0.5 font-mono truncate">
                        {s.value}
                    </div>
                </div>
            ))}
        </div>
    )
}
