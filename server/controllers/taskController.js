import Task from '../models/Task.js';
import User from '../models/User.js';
import mongoose from 'mongoose';
import { calculatePriorityScore, batchCalculatePriorities } from '../dsa-engine/priorityEngine.js';
import { scheduleTasksGreedy, buildTaskDAG } from '../dsa-engine/scheduler.js';

/**
 * Helper: Re-compute and persist priority score for a single task
 */
const recomputeScore = async (task, allUserTasks) => {
    const completedIds = new Set(
        allUserTasks.filter((t) => t.status === 'completed').map((t) => t._id.toString())
    );
    const deps = (task.dependencies || []).map((d) =>
        d._id ? d._id.toString() : d.toString()
    );
    const hasBlockedDependencies = deps.some(
        (depId) => !completedIds.has(depId)
    );

    const { score, tier } = calculatePriorityScore(task, { hasBlockedDependencies });
    task.priorityScore = score;
    task.priorityTier = tier;
    await task.save();
    return task;
};

const toDayKey = (value) => {
    const date = new Date(value);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

/**
 * GET /api/tasks
 * Get all tasks for the authenticated user, sorted by priority score
 */
export const getTasks = async (req, res, next) => {
    try {
        const { status, sort = 'priority', page = 1, limit = 50 } = req.query;

        const filter = { owner: req.user._id };
        if (status) filter.status = status;

        const sortMap = {
            priority: { priorityScore: -1 },
            deadline: { deadline: 1 },
            created: { createdAt: -1 },
            title: { title: 1 },
        };

        const tasks = await Task.find(filter)
            .populate('dependencies', 'title status priorityScore priorityTier')
            .sort(sortMap[sort] || sortMap.priority)
            .skip((page - 1) * limit)
            .limit(Number(limit));

        const total = await Task.countDocuments(filter);

        res.json({
            success: true,
            count: tasks.length,
            total,
            tasks,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * GET /api/tasks/top
 * Returns top 5 highest priority pending tasks using Max Heap
 */
export const getTopTasks = async (req, res, next) => {
    try {
        const tasks = await Task.find({
            owner: req.user._id,
            status: { $in: ['pending', 'in-progress'] },
        }).populate('dependencies', 'title status');

        // Use greedy scheduler to order by priority
        const scheduled = scheduleTasksGreedy(tasks);

        res.json({
            success: true,
            tasks: scheduled.slice(0, 5),
        });
    } catch (error) {
        next(error);
    }
};

/**
 * GET /api/tasks/stats
 * Get dashboard statistics for the authenticated user
 */
export const getStats = async (req, res, next) => {
    try {
        const week = new Date();
        week.setDate(week.getDate() - 7);
        const streakWindow = new Date();
        streakWindow.setDate(streakWindow.getDate() - 45);

        const [total, completed, inProgress, pending, cancelled, recentCompletions, streakCompletions, user] = await Promise.all([
            Task.countDocuments({ owner: req.user._id }),
            Task.countDocuments({ owner: req.user._id, status: 'completed' }),
            Task.countDocuments({ owner: req.user._id, status: 'in-progress' }),
            Task.countDocuments({ owner: req.user._id, status: 'pending' }),
            Task.countDocuments({ owner: req.user._id, status: 'cancelled' }),
            Task.find({
                owner: req.user._id,
                status: 'completed',
                completedAt: { $gte: week },
            }).select('completedAt title'),
            Task.find({
                owner: req.user._id,
                status: 'completed',
                completedAt: { $gte: streakWindow },
            }).select('completedAt'),
            User.findById(req.user._id).select('focusSessions'),
        ]);

        // Completion rate
        const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

        // Overdue tasks (deadline past, not completed)
        const overdue = await Task.countDocuments({
            owner: req.user._id,
            status: { $in: ['pending', 'in-progress'] },
            deadline: { $lt: new Date() },
        });

        // Tasks by priority tier
        const byTier = await Task.aggregate([
            { $match: { owner: req.user._id } },
            { $group: { _id: '$priorityTier', count: { $sum: 1 } } },
        ]);

        // Group by day
        const dailyMap = {};
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            dailyMap[d.toLocaleDateString('en-US', { weekday: 'short' })] = 0;
        }
        for (const task of recentCompletions) {
            if (task.completedAt) {
                const day = new Date(task.completedAt).toLocaleDateString('en-US', {
                    weekday: 'short',
                });
                if (dailyMap[day] !== undefined) dailyMap[day]++;
            }
        }
        const weeklyActivity = Object.entries(dailyMap).map(([day, count]) => ({
            day,
            count,
        }));

        const velocity = recentCompletions.length;
        const completionSpeedScore = Math.min(100, Math.round((velocity / 7) * 100));
        const focusScore = Math.round(completionRate * 0.6 + completionSpeedScore * 0.4);

        const completionDays = new Set(
            streakCompletions
                .filter((task) => task.completedAt)
                .map((task) => toDayKey(task.completedAt))
        );
        let streak = 0;
        let streakCursor = new Date();
        streakCursor.setHours(0, 0, 0, 0);

        if (!completionDays.has(toDayKey(streakCursor))) {
            const yesterday = new Date(streakCursor);
            yesterday.setDate(yesterday.getDate() - 1);
            if (completionDays.has(toDayKey(yesterday))) {
                streakCursor = yesterday;
            } else {
                streakCursor = null;
            }
        }

        while (streakCursor && completionDays.has(toDayKey(streakCursor))) {
            streak += 1;
            streakCursor.setDate(streakCursor.getDate() - 1);
        }

        const weeklyFocusMinutes = (user?.focusSessions || [])
            .filter((session) => session?.endedAt && new Date(session.endedAt) >= week)
            .reduce((sum, session) => sum + Math.round((session.durationSeconds || 0) / 60), 0);

        const productivityScoreRaw = Math.round(
            completionRate * 0.6
            + (total > 0 ? Math.min(total * 1.5, 20) : 0)
            + Math.min(Math.round(weeklyFocusMinutes / 30), 20)
        );
        const productivityScore = Math.max(0, Math.min(100, productivityScoreRaw));

        await User.findByIdAndUpdate(req.user._id, {
            productivityScore,
            tasksCompleted: completed,
            tasksCreated: total,
        });

        res.json({
            success: true,
            stats: {
                total,
                completed,
                inProgress,
                pending,
                cancelled,
                overdue,
                completionRate,
                productivityScore,
                focusScore,
                streak,
                velocity,
                weeklyFocusMinutes,
                byTier: Object.fromEntries(byTier.map((t) => [t._id, t.count])),
                weeklyActivity,
            },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * POST /api/tasks/focus-session
 * Persist a completed focus session for analytics
 */
export const logFocusSession = async (req, res, next) => {
    try {
        const { taskId, startedAt, endedAt, durationSeconds } = req.body;
        const parsedDuration = Number(durationSeconds);
        const parsedStart = new Date(startedAt);
        const parsedEnd = new Date(endedAt);

        if (!startedAt || !endedAt || !Number.isFinite(parsedDuration)) {
            return res.status(400).json({
                success: false,
                message: 'startedAt, endedAt, and durationSeconds are required.',
            });
        }

        if (Number.isNaN(parsedStart.getTime()) || Number.isNaN(parsedEnd.getTime())) {
            return res.status(400).json({ success: false, message: 'Invalid session timestamps.' });
        }

        if (parsedDuration <= 0) {
            return res.status(400).json({ success: false, message: 'durationSeconds must be greater than zero.' });
        }

        if (taskId) {
            const ownedTask = await Task.exists({ _id: taskId, owner: req.user._id });
            if (!ownedTask) {
                return res.status(404).json({ success: false, message: 'Task not found.' });
            }
        }

        const focusSession = {
            task: taskId || null,
            startedAt: parsedStart,
            endedAt: parsedEnd,
            durationSeconds: Math.round(parsedDuration),
            completed: false,
        };

        await User.findByIdAndUpdate(req.user._id, {
            $set: { lastFocusAt: parsedEnd },
            $push: {
                focusSessions: {
                    $each: [focusSession],
                    $slice: -200,
                },
            },
        });

        res.status(201).json({
            success: true,
            session: focusSession,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * GET /api/tasks/dag
 * Returns serialized DAG for the frontend dependency graph visualizer
 */
export const getDAG = async (req, res, next) => {
    try {
        const tasks = await Task.find({ owner: req.user._id }).select(
            'title dependencies status priorityScore priorityTier'
        );
        const dagData = buildTaskDAG(tasks);

        // Enrich nodes with task metadata
        const taskMap = new Map(tasks.map((t) => [t._id.toString(), t]));
        const enrichedNodes = dagData.nodes.map(({ id }) => {
            const task = taskMap.get(id);
            return {
                id,
                title: task?.title || id,
                status: task?.status || 'pending',
                priorityScore: task?.priorityScore || 0,
                priorityTier: task?.priorityTier || 'medium',
            };
        });

        res.json({
            success: true,
            graph: { nodes: enrichedNodes, edges: dagData.edges },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * GET /api/tasks/:id
 * Get a single task by ID
 */
export const getTask = async (req, res, next) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ success: false, message: 'Invalid task id.' });
        }

        const task = await Task.findOne({
            _id: req.params.id,
            owner: req.user._id,
        }).populate('dependencies', 'title status priorityScore priorityTier deadline');

        if (!task) {
            return res.status(404).json({ success: false, message: 'Task not found.' });
        }

        res.json({ success: true, task });
    } catch (error) {
        next(error);
    }
};

/**
 * POST /api/tasks
 * Create a new task with priority scoring
 */
export const createTask = async (req, res, next) => {
    try {
        const {
            title,
            description,
            deadline,
            importance,
            urgency,
            difficulty,
            dependencies,
            status,
            category,
        } = req.body;

        const task = new Task({
            owner: req.user._id,
            title,
            description,
            deadline,
            importance: importance || 3,
            urgency: urgency || 3,
            difficulty: difficulty || 3,
            dependencies: dependencies || [],
            status: status || 'pending',
            category: category || 'General',
        });

        // Calculate initial priority score
        const allTasks = await Task.find({ owner: req.user._id });
        const completedIds = new Set(
            allTasks.filter((t) => t.status === 'completed').map((t) => t._id.toString())
        );
        const deps = (dependencies || []).map((d) => d.toString());
        const hasBlockedDependencies = deps.some((depId) => !completedIds.has(depId));
        const { score, tier } = calculatePriorityScore(task, { hasBlockedDependencies });
        task.priorityScore = score;
        task.priorityTier = tier;

        await task.save();

        // Update user task count
        await User.findByIdAndUpdate(req.user._id, { $inc: { tasksCreated: 1 } });

        await task.populate('dependencies', 'title status');

        res.status(201).json({ success: true, task });
    } catch (error) {
        next(error);
    }
};

/**
 * PUT /api/tasks/:id
 * Update a task and recalculate priority score
 */
export const updateTask = async (req, res, next) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ success: false, message: 'Invalid task id.' });
        }

        const task = await Task.findOne({
            _id: req.params.id,
            owner: req.user._id,
        });

        if (!task) {
            return res.status(404).json({ success: false, message: 'Task not found.' });
        }

        const wasCompleted = task.status === 'completed';

        // Apply updates
        const allowedFields = [
            'title', 'description', 'deadline', 'importance',
            'urgency', 'difficulty', 'dependencies', 'status', 'category',
        ];
        for (const field of allowedFields) {
            if (req.body[field] !== undefined) task[field] = req.body[field];
        }

        // Mark completion timestamp
        if (!wasCompleted && task.status === 'completed') {
            task.completedAt = new Date();
            await User.findByIdAndUpdate(req.user._id, { $inc: { tasksCompleted: 1 } });
        }
        if (wasCompleted && task.status !== 'completed') {
            task.completedAt = undefined;
            await User.findByIdAndUpdate(req.user._id, { $inc: { tasksCompleted: -1 } });
        }

        // Recalculate priority score using current task set
        let allTasks = await Task.find({ owner: req.user._id });
        await recomputeScore(task, allTasks);

        // Cascade: recalculate dependents' scores when this task status changes
        if (wasCompleted !== (task.status === 'completed')) {
            // Refresh after saving so completion status is reflected in dependency checks
            allTasks = await Task.find({ owner: req.user._id });
            const dependents = await Task.find({
                owner: req.user._id,
                dependencies: task._id,
            });
            for (const dep of dependents) {
                await recomputeScore(dep, allTasks);
            }
        }

        await task.populate('dependencies', 'title status priorityScore priorityTier');
        res.json({ success: true, task });
    } catch (error) {
        next(error);
    }
};

/**
 * DELETE /api/tasks/:id
 * Delete a task
 */
export const deleteTask = async (req, res, next) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ success: false, message: 'Invalid task id.' });
        }

        const task = await Task.findOneAndDelete({
            _id: req.params.id,
            owner: req.user._id,
        });

        if (!task) {
            return res.status(404).json({ success: false, message: 'Task not found.' });
        }

        const dependentTasks = await Task.find({
            owner: req.user._id,
            dependencies: task._id,
        });

        // Remove this task from all dependency lists
        await Task.updateMany(
            { owner: req.user._id, dependencies: task._id },
            { $pull: { dependencies: task._id } }
        );

        // Keep user aggregate counters aligned with task data
        await User.findByIdAndUpdate(req.user._id, { $inc: { tasksCreated: -1 } });

        // Recompute impacted dependent scores after unblocking dependencies
        if (dependentTasks.length > 0) {
            const dependentIds = dependentTasks.map((dep) => dep._id);
            const [refreshedTasks, updatedDependents] = await Promise.all([
                Task.find({ owner: req.user._id }),
                Task.find({ owner: req.user._id, _id: { $in: dependentIds } }),
            ]);

            for (const dep of updatedDependents) {
                await recomputeScore(dep, refreshedTasks);
            }
        }

        res.json({ success: true, message: 'Task deleted.' });
    } catch (error) {
        next(error);
    }
};
