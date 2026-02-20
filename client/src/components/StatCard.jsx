/**
 * StatCard — dashboard metric card with icon, value, label
 */
const StatCard = ({ label, value, icon: Icon, color = '#627890', sublabel }) => (
    <div className="card p-5 flex items-start gap-4 animate-fade-up">
        <div
            className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: `${color}22`, border: `1px solid ${color}44` }}
        >
            {Icon && <Icon size={22} style={{ color }} />}
        </div>
        <div className="min-w-0">
            <p className="text-2xl font-bold font-heading text-white tracking-tight">{value}</p>
            <p className="text-sm font-medium" style={{ color }}>{label}</p>
            {sublabel && <p className="text-xs mt-0.5" style={{ color: '#64748b' }}>{sublabel}</p>}
        </div>
    </div>
);

export default StatCard;
