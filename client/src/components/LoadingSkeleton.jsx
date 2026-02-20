/**
 * LoadingSkeleton — shimmer placeholder cards
 */
export const TaskSkeleton = () => (
    <div className="card p-4 space-y-3">
        <div className="skeleton h-4 w-3/4" />
        <div className="skeleton h-3 w-full" />
        <div className="skeleton h-3 w-1/2" />
        <div className="flex gap-2 mt-2">
            <div className="skeleton h-6 w-20 rounded-full" />
            <div className="skeleton h-6 w-16 rounded-full" />
        </div>
    </div>
);

export const StatSkeleton = () => (
    <div className="card p-5 flex items-start gap-4">
        <div className="skeleton w-12 h-12 rounded-xl" />
        <div className="space-y-2 flex-1">
            <div className="skeleton h-6 w-16" />
            <div className="skeleton h-3 w-24" />
        </div>
    </div>
);

export const ChartSkeleton = () => (
    <div className="card p-6">
        <div className="skeleton h-4 w-40 mb-4" />
        <div className="skeleton h-48 w-full rounded-lg" />
    </div>
);

const LoadingSkeleton = ({ type = 'task', count = 3 }) => {
    const Comp = type === 'stat' ? StatSkeleton : type === 'chart' ? ChartSkeleton : TaskSkeleton;
    return (
        <>
            {Array.from({ length: count }).map((_, i) => (
                <Comp key={i} />
            ))}
        </>
    );
};

export default LoadingSkeleton;
