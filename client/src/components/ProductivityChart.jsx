import {
    ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Area, AreaChart,
} from 'recharts';

const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
        <div className="glass px-3 py-2 rounded-lg text-xs">
            <p className="text-[#4A3A36] mb-1">{label}</p>
            <p className="text-[#2B1B17] font-semibold">{payload[0]?.value} tasks</p>
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
            <h3 className="font-semibold text-sm text-[#2B1B17] mb-4">Weekly Completions</h3>
            <div style={{ width: '100%' }}>
                <ResponsiveContainer width="100%" height={180}>
                    <AreaChart data={data} margin={{ top: 4, right: 8, left: -24, bottom: 0 }}>
                        <defs>
                            <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#FC703C" stopOpacity={0.5} />
                                <stop offset="95%" stopColor="#FC703C" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(93,7,3,0.08)" />
                        <XAxis dataKey="day" tick={{ fill: '#6B5B56', fontSize: 11 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fill: '#6B5B56', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                        <Tooltip content={<CustomTooltip />} />
                        <Area
                            type="monotone" dataKey="count" stroke="#FC703C"
                            strokeWidth={2.5} fill="url(#areaGrad)" dot={{ fill: '#FC703C', r: 3 }}
                            activeDot={{ r: 5, fill: '#5D0703' }}
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

export default ProductivityChart;
