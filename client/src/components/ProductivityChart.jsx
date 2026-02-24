import {
    ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts';
import { TrendingUp, Calendar } from 'lucide-react';

const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
        <div className="bg-[#2B1B17] px-4 py-2 rounded-xl border border-white/10 shadow-[4px_4px_0_#452215]">
            <p className="text-white/60 text-xs mb-1">{label}</p>
            <p className="text-[#FC703C] font-bold text-sm">{payload[0]?.value} tasks completed</p>
        </div>
    );
};

/**
 * ProductivityChart — weekly task completion area chart with GSAP-inspired design
 */
const ProductivityChart = ({ data = [] }) => {
    if (!data.length) {
        return (
            <div className="bg-white rounded-2xl p-5 border border-[#2B1B17]/5 shadow-[2px_2px_0_#452215]/30">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-[#FC703C]/10 flex items-center justify-center">
                        <TrendingUp className="w-5 h-5 text-[#FC703C]" />
                    </div>
                    <div>
                        <h3 className="font-bold text-[#2B1B17]">Weekly Completions</h3>
                        <p className="text-xs text-[#2B1B17]/40">Track your productivity</p>
                    </div>
                </div>
                <div className="h-40 flex items-center justify-center bg-[#f8f7f2] rounded-xl">
                    <p className="text-sm text-[#2B1B17]/40">No data available</p>
                </div>
            </div>
        );
    }

    const totalCompleted = data.reduce((sum, item) => sum + (item.count || 0), 0);
    const avgPerDay = (totalCompleted / data.length).toFixed(1);

    return (
        <div className="bg-white rounded-2xl p-5 border border-[#2B1B17]/5 shadow-[2px_2px_0_#452215]/30 hover:shadow-[4px_4px_0_#452215]/40 hover:-translate-y-0.5 transition-all duration-200">
            {/* Header */}
            <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#FC703C]/10 flex items-center justify-center">
                        <TrendingUp className="w-5 h-5 text-[#FC703C]" />
                    </div>
                    <div>
                        <h3 className="font-bold text-[#2B1B17]">Weekly Completions</h3>
                        <p className="text-xs text-[#2B1B17]/40 flex items-center gap-1">
                            <Calendar size={10} />
                            Last 7 days
                        </p>
                    </div>
                </div>

                {/* Stats */}
                <div className="text-right">
                    <p className="text-2xl font-bold text-[#FC703C]">{totalCompleted}</p>
                    <p className="text-xs text-[#2B1B17]/40">{avgPerDay}/day avg</p>
                </div>
            </div>

            {/* Chart */}
            <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart 
                        data={data} 
                        margin={{ top: 10, right: 8, left: -20, bottom: 0 }}
                    >
                        <defs>
                            <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#FC703C" stopOpacity={0.4} />
                                <stop offset="50%" stopColor="#FC703C" stopOpacity={0.1} />
                                <stop offset="95%" stopColor="#FC703C" stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
                                <stop offset="0%" stopColor="#FC703C" />
                                <stop offset="100%" stopColor="#EEA175" />
                            </linearGradient>
                        </defs>
                        
                        <CartesianGrid 
                            strokeDasharray="4 4" 
                            stroke="#2B1B17" 
                            strokeOpacity={0.05}
                            vertical={false}
                        />
                        
                        <XAxis 
                            dataKey="day" 
                            tick={{ fill: '#2B1B17', fontSize: 11, opacity: 0.5 }} 
                            axisLine={false} 
                            tickLine={false}
                            dy={10}
                        />
                        
                        <YAxis 
                            tick={{ fill: '#2B1B17', fontSize: 11, opacity: 0.5 }} 
                            axisLine={false} 
                            tickLine={false} 
                            allowDecimals={false}
                        />
                        
                        <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#FC703C', strokeWidth: 1, strokeDasharray: '4 4' }} />
                        
                        <Area
                            type="monotone" 
                            dataKey="count" 
                            stroke="url(#lineGrad)"
                            strokeWidth={3}
                            fill="url(#areaGrad)" 
                            dot={{ 
                                fill: '#FC703C', 
                                stroke: '#fff',
                                strokeWidth: 2,
                                r: 4 
                            }}
                            activeDot={{ 
                                r: 6, 
                                fill: '#FC703C',
                                stroke: '#fff',
                                strokeWidth: 3
                            }}
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

export default ProductivityChart;