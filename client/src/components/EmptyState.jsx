import { ClipboardList, Sparkles } from 'lucide-react';

/**
 * EmptyState - shown when a list/section has no data with GSAP-inspired design
 */
const EmptyState = ({
  title = 'Nothing here yet',
  description = 'Create your first item to get started.',
  action,
  icon,
}) => {
  const RenderIcon = icon || ClipboardList;

  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      {/* Icon Container with Retro Shadow */}
      <div className="relative mb-6">
        {/* Decorative sparkles */}
        <div className="absolute -top-2 -right-2 text-[#FC703C]/40 animate-pulse">
          <Sparkles size={16} />
        </div>
        <div className="absolute -bottom-1 -left-3 text-[#EEA175]/40 animate-pulse" style={{ animationDelay: '0.5s' }}>
          <Sparkles size={12} />
        </div>
        
        {/* Main Icon Box */}
        <div className="w-20 h-20 rounded-2xl bg-[#f8f7f2] border-2 border-dashed border-[#2B1B17]/20 flex items-center justify-center shadow-[4px_4px_0_#452215]">
          <RenderIcon size={32} className="text-[#2B1B17]/30" />
        </div>
      </div>

      {/* Text Content */}
      <div className="space-y-2 mb-6">
        <h3 className="text-xl font-bold text-[#2B1B17]">{title}</h3>
        <p className="text-sm text-[#2B1B17]/50 max-w-xs mx-auto leading-relaxed">
          {description}
        </p>
      </div>

      {/* Action Button */}
      {action && (
        <div className="transform hover:scale-105 transition-transform">
          {action}
        </div>
      )}
    </div>
  );
};

export default EmptyState;