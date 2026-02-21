import { ClipboardList } from 'lucide-react';

/**
 * EmptyState - shown when a list/section has no data
 */
const EmptyState = ({
  title = 'Nothing here yet',
  description = 'Create your first item to get started.',
  action,
  icon,
}) => {
  const RenderIcon = icon || ClipboardList;

  return (
    <div className="flex flex-col items-center justify-center py-16 text-center animate-fade-in">
      <div className="w-16 h-16 rounded-2xl glass flex items-center justify-center mb-4">
        <RenderIcon size={28} className="text-[#9E7C73]" />
      </div>
      <h3 className="text-lg font-semibold text-white mb-1">{title}</h3>
      <p className="text-sm text-[#64748b] max-w-xs mb-5">{description}</p>
      {action && action}
    </div>
  );
};

export default EmptyState;
