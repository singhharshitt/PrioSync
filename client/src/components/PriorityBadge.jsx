/**
 * PriorityBadge - displays score (0-100) with color-coded tier label
 */
const tierConfig = {
  critical: { label: 'Critical', dot: 'bg-red-500' },
  high: { label: 'High', dot: 'bg-[#FC703C]' },
  medium: { label: 'Medium', dot: 'bg-yellow-500' },
  low: { label: 'Low', dot: 'bg-green-500' },
};

const PriorityBadge = ({ score = 0, tier = 'medium', showScore = true }) => {
  const config = tierConfig[tier] || tierConfig.medium;

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold badge-${tier}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot} animate-pulse`} />
      {config.label}
      {showScore && <span className="opacity-70">. {score}</span>}
    </span>
  );
};

export default PriorityBadge;
