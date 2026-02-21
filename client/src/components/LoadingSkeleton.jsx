/**
 * LoadingSkeleton — shimmer placeholder cards with GSAP-inspired design
 */

export const TaskSkeleton = () => (
    <div className="bg-white rounded-2xl p-5 border border-[#2B1B17]/5 shadow-[4px_4px_0_#452215] space-y-4">
        {/* Header row */}
        <div className="flex items-center justify-between">
            <div className="skeleton h-5 w-16 rounded-full bg-[#f8f7f2]" />
            <div className="skeleton h-4 w-4 rounded-full bg-[#f8f7f2]" />
        </div>
        
        {/* Title */}
        <div className="skeleton h-6 w-3/4 rounded-lg bg-[#f8f7f2]" />
        
        {/* Description lines */}
        <div className="space-y-2">
            <div className="skeleton h-4 w-full rounded-lg bg-[#f8f7f2]" />
            <div className="skeleton h-4 w-2/3 rounded-lg bg-[#f8f7f2]" />
        </div>
        
        {/* Footer tags */}
        <div className="flex gap-2 pt-2">
            <div className="skeleton h-7 w-20 rounded-full bg-[#f8f7f2]" />
            <div className="skeleton h-7 w-16 rounded-full bg-[#f8f7f2]" />
            <div className="skeleton h-7 w-14 rounded-full bg-[#f8f7f2] ml-auto" />
        </div>
    </div>
);

export const StatSkeleton = () => (
    <div className="bg-white rounded-2xl p-5 border border-[#2B1B17]/5 shadow-[4px_4px_0_#452215]">
        <div className="flex items-start justify-between">
            <div className="space-y-3 flex-1">
                <div className="skeleton h-3 w-20 rounded-full bg-[#f8f7f2]" />
                <div className="skeleton h-8 w-16 rounded-lg bg-[#f8f7f2]" />
                <div className="skeleton h-3 w-24 rounded-full bg-[#f8f7f2]" />
            </div>
            <div className="skeleton w-12 h-12 rounded-xl bg-[#f8f7f2]" />
        </div>
    </div>
);

export const ChartSkeleton = () => (
    <div className="bg-white rounded-2xl p-6 border border-[#2B1B17]/5 shadow-[4px_4px_0_#452215]">
        <div className="flex items-center gap-3 mb-6">
            <div className="skeleton w-10 h-10 rounded-xl bg-[#f8f7f2]" />
            <div className="space-y-2">
                <div className="skeleton h-5 w-32 rounded-lg bg-[#f8f7f2]" />
                <div className="skeleton h-3 w-24 rounded-full bg-[#f8f7f2]" />
            </div>
        </div>
        <div className="skeleton h-48 w-full rounded-xl bg-[#f8f7f2]" />
    </div>
);

export const ProfileSkeleton = () => (
    <div className="bg-white rounded-3xl p-8 border border-[#2B1B17]/5 shadow-[4px_4px_0_#452215] space-y-6">
        {/* Avatar and name row */}
        <div className="flex items-center gap-4">
            <div className="skeleton w-20 h-20 rounded-2xl bg-[#f8f7f2]" />
            <div className="space-y-2 flex-1">
                <div className="skeleton h-6 w-48 rounded-lg bg-[#f8f7f2]" />
                <div className="skeleton h-4 w-32 rounded-full bg-[#f8f7f2]" />
            </div>
        </div>
        
        {/* Form fields */}
        <div className="space-y-4">
            <div className="skeleton h-14 w-full rounded-xl bg-[#f8f7f2]" />
            <div className="skeleton h-14 w-full rounded-xl bg-[#f8f7f2]" />
        </div>
        
        {/* Button */}
        <div className="skeleton h-12 w-32 rounded-full bg-[#f8f7f2]" />
    </div>
);

export const GraphSkeleton = () => (
    <div className="bg-[#2B1B17] rounded-2xl p-4 shadow-[4px_4px_0_#452215]">
        <div className="skeleton h-80 w-full rounded-xl bg-white/5" />
        <div className="flex gap-2 mt-4">
            <div className="skeleton h-8 w-24 rounded-full bg-white/10" />
            <div className="skeleton h-8 w-24 rounded-full bg-white/10" />
            <div className="skeleton h-8 w-24 rounded-full bg-white/10 ml-auto" />
        </div>
    </div>
);

const LoadingSkeleton = ({ type = 'task', count = 3 }) => {
    const Comp = 
        type === 'stat' ? StatSkeleton : 
        type === 'chart' ? ChartSkeleton : 
        type === 'profile' ? ProfileSkeleton :
        type === 'graph' ? GraphSkeleton :
        TaskSkeleton;
    
    return (
        <>
            {Array.from({ length: count }).map((_, i) => (
                <div 
                    key={i} 
                    className="animate-pulse"
                    style={{ animationDelay: `${i * 100}ms` }}
                >
                    <Comp />
                </div>
            ))}
        </>
    );
};

export default LoadingSkeleton;