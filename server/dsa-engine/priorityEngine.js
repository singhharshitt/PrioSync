/**
 * Priority Engine — Core DSA Score Calculator
 *
 * Computes a priority score (0–100) for each task using a weighted formula:
 *
 *   score = (
 *     urgency       × 0.30  +
 *     importance    × 0.25  +
 *     deadlineBonus × 0.25  +
 *     easeBonus     × 0.20
 *   ) × 20
 *
 * Where:
 *   - urgency / importance are 1–5 (user input)
 *   - deadlineBonus: higher when deadline is closer (1–5 scale)
 *   - easeBonus: lower difficulty = higher bonus (inverted, 1–5 scale)
 *
 * Dependency adjustment: if any blocking dependency is incomplete,
 * the score is penalized by 20 points (task is still "blocked").
 */

/**
 * Calculate deadline proximity score (1–5)
 * Returns 5 for overdue/very-soon, ~1 for far future
 * @param {Date} deadline
 * @returns {number} 1–5
 */
const calcDeadlineScore = (deadline) => {
    const now = Date.now();
    const then = new Date(deadline).getTime();
    const hoursRemaining = (then - now) / (1000 * 60 * 60);

    if (hoursRemaining <= 0) return 5;        // Overdue
    if (hoursRemaining <= 6) return 5;        // < 6 hours
    if (hoursRemaining <= 24) return 4.5;     // < 1 day
    if (hoursRemaining <= 72) return 4;       // < 3 days
    if (hoursRemaining <= 168) return 3;      // < 1 week
    if (hoursRemaining <= 336) return 2;      // < 2 weeks
    if (hoursRemaining <= 720) return 1.5;    // < 1 month
    return 1;                                  // > 1 month
};

/**
 * Get difficulty ease bonus — easier tasks rank slightly higher
 * @param {number} difficulty 1–5 (5 = hardest)
 * @returns {number} 1–5 (inverted)
 */
const calcEaseBonus = (difficulty) => {
    return 6 - difficulty; // difficulty 5 → ease 1; difficulty 1 → ease 5
};

/**
 * Determine priority tier label from numeric score
 * @param {number} score 0–100
 * @returns {string} 'critical' | 'high' | 'medium' | 'low'
 */
export const getPriorityTier = (score) => {
    if (score >= 80) return 'critical';
    if (score >= 60) return 'high';
    if (score >= 35) return 'medium';
    return 'low';
};

/**
 * Calculate total priority score for a task
 * @param {Object} task - task data (urgency, importance, difficulty, deadline)
 * @param {Object} options
 * @param {boolean} options.hasBlockedDependencies - true if any dep is unfinished
 * @returns {{ score: number, tier: string, breakdown: Object }}
 */
export const calculatePriorityScore = (task, options = {}) => {
    const { urgency = 3, importance = 3, difficulty = 3, deadline } = task;
    const { hasBlockedDependencies = false } = options;

    const deadlineScore = calcDeadlineScore(deadline);
    const easeScore = calcEaseBonus(difficulty);

    // Weighted sum on 1–5 scale
    const weightedSum =
        urgency * 0.30 +
        importance * 0.25 +
        deadlineScore * 0.25 +
        easeScore * 0.20;

    // Convert to 0–100 (max weighted sum = 5, so × 20)
    let score = Math.round(weightedSum * 20);

    // Penalty for blocked tasks — deprioritize until deps are cleared
    if (hasBlockedDependencies) {
        score = Math.max(0, score - 20);
    }

    // Clamp to [0, 100]
    score = Math.min(100, Math.max(0, score));

    return {
        score,
        tier: getPriorityTier(score),
        breakdown: {
            urgencyContrib: Math.round(urgency * 0.30 * 20),
            importanceContrib: Math.round(importance * 0.25 * 20),
            deadlineContrib: Math.round(deadlineScore * 0.25 * 20),
            easeContrib: Math.round(easeScore * 0.20 * 20),
            blockedPenalty: hasBlockedDependencies ? -20 : 0,
        },
    };
};

/**
 * Batch-calculate priority scores for a list of tasks
 * @param {Array} tasks - mongoose documents or plain objects
 * @param {Set<string>} completedIds - set of completed task IDs
 * @returns {Array} tasks with updated score/tier
 */
export const batchCalculatePriorities = (tasks, completedIds = new Set()) => {
    const normalizeTask = (task) => {
        if (task && typeof task.toObject === 'function') {
            return task.toObject();
        }
        return { ...task };
    };

    const normalizedTasks = tasks.map(normalizeTask);

    // Build quick lookup of all tasks by ID
    const taskMap = new Map(
        normalizedTasks
            .filter((t) => t?._id)
            .map((t) => [t._id.toString(), t])
    );

    return normalizedTasks.map((task) => {
        const taskId = task._id.toString();
        const deps = (task.dependencies || []).map((d) =>
            d._id ? d._id.toString() : d.toString()
        );

        // A task is blocked if ANY dependency is not completed
        const hasBlockedDependencies = deps.some((depId) => {
            if (completedIds.has(depId)) return false;
            const depTask = taskMap.get(depId);
            return !depTask || depTask.status !== 'completed';
        });

        const { score, tier } = calculatePriorityScore(task, {
            hasBlockedDependencies,
        });

        return { ...task, priorityScore: score, priorityTier: tier };
    });
};
