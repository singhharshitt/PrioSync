import {
    ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend,
} from 'recharts';
import { Target, CheckCircle2, Sparkles } from 'lucide-react';

const TIER_COLORS = {
    critical: '#ef4444',
    high: '#f97316',
    medium: '#eab308',
    low: '#22c55e',
};

const STATUS_COLORS = {
    pending: '#EEA175',
    'in-progress': '#FC703C',
    completed: '#22c55e',
    cancelled: '#2B1B17',
};

const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    return (
        <div className="bg-[#2B1B17] px-4 py-2 rounded-xl border border-white/10 shadow-[4px_4px_0_#452215]">
            <p className="text-white font-semibold text-sm">
                {payload[0]?.name}: <span className="text-[#FC703C]">{payload[0]?.value}</span>
            </p>
        </div>
    );
};

/**
 * CompletionChart — pie charts for tier and status distribution with GSAP-inspired design
 */
const CompletionChart = ({ byTier = {}, byStatus = {} }) => {
    const tierData = Object.entries(byTier)
        .filter(([, v]) => v > 0)
        .map(([name, value]) => ({ name, value }));

    const statusData = Object.entries(byStatus)
        .filter(([, v]) => v > 0)
        .map(([name, value]) => ({ name, value }));

    const totalTasks = tierData.reduce((sum, item) => sum + item.value, 0);

    return (
        <div
            className="grid gap-5"
            style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}
        >
            {/* By Priority Tier */}
            <div className="bg-white rounded-2xl p-5 border border-[#2B1B17]/5 shadow-[2px_2px_0_#452215]/30 hover:shadow-[4px_4px_0_#452215]/40 hover:-translate-y-0.5 transition-all duration-200">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-[#FC703C]/10 flex items-center justify-center">
                        <Target className="w-5 h-5 text-[#FC703C]" />
                    </div>
                    <div>
                        <h3 className="font-bold text-[#2B1B17]">By Priority Tier</h3>
                        <p className="text-xs text-[#2B1B17]/40">{totalTasks} total tasks</p>
                    </div>
                </div>
                
                {tierData.length > 0 ? (
                    <div className="relative">
                        <ResponsiveContainer width="100%" height={180}>
                            <PieChart>
                                <Pie 
                                    data={tierData} 
                                    cx="50%" 
                                    cy="50%" 
                                    innerRadius={50} 
                                    outerRadius={75}
                                    dataKey="value" 
                                    paddingAngle={4}
                                    stroke="none"
                                >
                                    {tierData.map((entry) => (
                                        <Cell 
                                            key={entry.name} 
                                            fill={TIER_COLORS[entry.name] || '#CCC4BE'} 
                                        />
                                    ))}
                                </Pie>
                                <Tooltip content={<CustomTooltip />} />
                                <Legend
                                    verticalAlign="bottom"
                                    height={36}
                                    iconType="circle" 
                                    iconSize={10}
                                    formatter={(v) => (
                                        <span className="text-[#2B1B17]/70 text-xs font-medium capitalize ml-1">
                                            {v}
                                        </span>
                                    )}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                        
                        {/* Center Text */}
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ top: '-18px' }}>
                            <div className="text-center">
                                <span className="text-2xl font-bold text-[#2B1B17]">{totalTasks}</span>
                                <p className="text-[10px] text-[#2B1B17]/40 uppercase tracking-wider">Tasks</p>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                        <div className="w-16 h-16 rounded-full bg-[#f8f7f2] flex items-center justify-center mb-3">
                            <Target className="w-8 h-8 text-[#2B1B17]/20" />
                        </div>
                        <p className="text-sm text-[#2B1B17]/40">No data yet</p>
                        <p className="text-xs text-[#2B1B17]/30 mt-1">Create tasks to see distribution</p>
                    </div>
                )}
            </div>

            {/* By Status */}
            <div className="bg-white rounded-2xl p-5 border border-[#2B1B17]/5 shadow-[2px_2px_0_#452215]/30 hover:shadow-[4px_4px_0_#452215]/40 hover:-translate-y-0.5 transition-all duration-200">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-[#EEA175]/10 flex items-center justify-center">
                        <CheckCircle2 className="w-5 h-5 text-[#EEA175]" />
                    </div>
                    <div>
                        <h3 className="font-bold text-[#2B1B17]">By Status</h3>
                        <p className="text-xs text-[#2B1B17]/40">Task completion flow</p>
                    </div>
                </div>
                
                {statusData.length > 0 ? (
                    <div className="relative">
                        <ResponsiveContainer width="100%" height={180}>
                            <PieChart>
                                <Pie 
                                    data={statusData} 
                                    cx="50%" 
                                    cy="50%" 
                                    innerRadius={50} 
                                    outerRadius={75}
                                    dataKey="value" 
                                    paddingAngle={4}
                                    stroke="none"
                                >
                                    {statusData.map((entry) => (
                                        <Cell 
                                            key={entry.name} 
                                            fill={STATUS_COLORS[entry.name] || '#CCC4BE'} 
                                        />
                                    ))}
                                </Pie>
                                <Tooltip content={<CustomTooltip />} />
                                <Legend
                                    verticalAlign="bottom"
                                    height={36}
                                    iconType="circle" 
                                    iconSize={10}
                                    formatter={(v) => (
                                        <span className="text-[#2B1B17]/70 text-xs font-medium capitalize ml-1">
                                            {v.replace('-', ' ')}
                                        </span>
                                    )}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                        
                        {/* Center Icon */}
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ top: '-18px' }}>
                            <div className="w-12 h-12 rounded-full bg-[#f8f7f2] flex items-center justify-center">
                                <Sparkles className="w-6 h-6 text-[#FC703C]" />
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                        <div className="w-16 h-16 rounded-full bg-[#f8f7f2] flex items-center justify-center mb-3">
                            <CheckCircle2 className="w-8 h-8 text-[#2B1B17]/20" />
                        </div>
                        <p className="text-sm text-[#2B1B17]/40">No data yet</p>
                        <p className="text-xs text-[#2B1B17]/30 mt-1">Start completing tasks</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default CompletionChart;
