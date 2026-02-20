import {
    ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Area, AreaChart,
} from 'recharts';

const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
        <div className="glass px-3 py-2 rounded-lg text-xs">
            <p className="text-[#94a3b8] mb-1">{label}</p>
            <p className="text-white font-semibold">{payload[0]?.value} tasks</p>
        </div>
    );
};

/**
 * ProductivityChart — weekly task completion area chart
 */
const ProductivityChart = ({ data = [] }) => {
    if (!data.length) return null;
    return (
        <div className="card p-5">
            <h3 className="font-semibold text-sm text-white mb-4">Weekly Completions</h3>
            <div style={{ width: '100%', height: 180 }}>
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data} margin={{ top: 4, right: 8, left: -24, bottom: 0 }}>
                        <defs>
                            <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#604C39" stopOpacity={0.5} />
                                <stop offset="95%" stopColor="#604C39" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(98,120,144,0.15)" />
                        <XAxis dataKey="day" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                        <Tooltip content={<CustomTooltip />} />
                        <Area
                            type="monotone" dataKey="count" stroke="#604C39"
                            strokeWidth={2.5} fill="url(#areaGrad)" dot={{ fill: '#7a6248', r: 3 }}
                            activeDot={{ r: 5, fill: '#c4a882' }}
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

export default ProductivityChart;
