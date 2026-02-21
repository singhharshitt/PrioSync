import {
    ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend,
} from 'recharts';

const TIER_COLORS = {
    critical: '#ef4444',
    high: '#f97316',
    medium: '#eab308',
    low: '#22c55e',
};

const STATUS_COLORS = {
    pending: '#CCC4BE',
    'in-progress': '#FC703C',
    completed: '#22c55e',
    cancelled: '#6B5B56',
};

const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    return (
        <div className="glass px-3 py-2 rounded-lg text-xs">
            <p className="text-white font-semibold">{payload[0]?.name}: {payload[0]?.value}</p>
        </div>
    );
};

/**
 * CompletionChart — pie charts for tier and status distribution
 */
const CompletionChart = ({ byTier = {}, byStatus = {} }) => {
    const tierData = Object.entries(byTier)
        .filter(([, v]) => v > 0)
        .map(([name, value]) => ({ name, value }));

    const statusData = Object.entries(byStatus)
        .filter(([, v]) => v > 0)
        .map(([name, value]) => ({ name, value }));

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* By tier */}
            <div className="card p-5">
                <h3 className="font-semibold text-sm text-[#2B1B17] mb-3">By Priority Tier</h3>
                {tierData.length > 0 ? (
                    <div style={{ width: '100%' }}>
                        <ResponsiveContainer width="100%" height={160}>
                            <PieChart>
                                <Pie data={tierData} cx="50%" cy="50%" innerRadius={40} outerRadius={65}
                                    dataKey="value" paddingAngle={3}>
                                    {tierData.map((entry) => (
                                        <Cell key={entry.name} fill={TIER_COLORS[entry.name] || '#CCC4BE'} />
                                    ))}
                                </Pie>
                                <Tooltip content={<CustomTooltip />} />
                                <Legend
                                    iconType="circle" iconSize={8}
                                    formatter={(v) => <span style={{ color: '#4A3A36', fontSize: 11 }}>{v}</span>}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                ) : (
                    <p className="text-xs text-[#6B5B56] text-center py-10">No data yet</p>
                )}
            </div>

            {/* By status */}
            <div className="card p-5">
                <h3 className="font-semibold text-sm text-[#2B1B17] mb-3">By Status</h3>
                {statusData.length > 0 ? (
                    <div style={{ width: '100%' }}>
                        <ResponsiveContainer width="100%" height={160}>
                            <PieChart>
                                <Pie data={statusData} cx="50%" cy="50%" innerRadius={40} outerRadius={65}
                                    dataKey="value" paddingAngle={3}>
                                    {statusData.map((entry) => (
                                        <Cell key={entry.name} fill={STATUS_COLORS[entry.name] || '#CCC4BE'} />
                                    ))}
                                </Pie>
                                <Tooltip content={<CustomTooltip />} />
                                <Legend
                                    iconType="circle" iconSize={8}
                                    formatter={(v) => <span style={{ color: '#4A3A36', fontSize: 11 }}>{v}</span>}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                ) : (
                    <p className="text-xs text-[#6B5B56] text-center py-10">No data yet</p>
                )}
            </div>
        </div>
    );
};

export default CompletionChart;
