/**
 * Mongo task repository — mirrors the pgTasks.js contract so the services
 * can call the same function names. Returns plain JS objects (lean()).
 *
 * `version` is managed here: every mutating helper bumps it.
 * Optimistic concurrency: callers pass `expectedVersion`; a stale write
 * returns `{ conflict: true, current }` instead of throwing.
 */
import mongoose from 'mongoose';
import Task from '../models/Task.js';

// ── Field helpers ────────────────────────────────────────────────────────────

const POPULATE_DEPS = {
    path: 'dependencies',
    select: 'title status priorityScore priorityTier deadline',
};

/** Convert a Mongoose lean task doc to the camelCase API shape. */
export const toApiShape = (doc) => {
    if (!doc) return doc;
    const id = doc._id?.toString() ?? doc.id;
    const deps = (doc.dependencies || []).map((d) =>
        d && typeof d === 'object' && d._id
            ? {
                  id: d._id.toString(),
                  _id: d._id.toString(),
                  title: d.title,
                  status: d.status,
                  priorityScore: d.priorityScore,
                  priorityTier: d.priorityTier,
                  deadline: d.deadline,
              }
            : (d?.toString ? d.toString() : d)
    );
    return {
        ...doc,
        id,
        _id: id,
        // normalise ObjectId refs to strings
        userId: doc.owner?.toString() ?? doc.owner,
        projectId: doc.projectId?.toString() ?? null,
        goalId: doc.goalId?.toString() ?? null,
        parentTaskId: doc.parentTaskId?.toString() ?? null,
        dependencies: deps,
        dependencyDetails: deps.filter((d) => d && typeof d === 'object' && d.title),
    };
};

// ── Reads ────────────────────────────────────────────────────────────────────

const SORT_MAP = {
    priority: { priorityScore: -1, createdAt: -1 },
    deadline: { deadline: 1, priorityScore: -1 },
    created: { createdAt: -1 },
    title: { title: 1 },
};

export const listByUser = async (userId, { status, sort = 'priority', limit = 50, offset = 0 } = {}) => {
    const filter = { owner: userId };
    if (status) filter.status = status;
    const docs = await Task.find(filter)
        .populate(POPULATE_DEPS)
        .sort(SORT_MAP[sort] || SORT_MAP.priority)
        .skip(offset)
        .limit(Math.min(Math.max(Number(limit) || 50, 1), 100))
        .lean();
    return docs.map(toApiShape);
};

export const countByUser = async (userId, { status } = {}) => {
    const filter = { owner: userId };
    if (status) filter.status = status;
    return Task.countDocuments(filter);
};

/** All tasks for scoring/scheduling — single query + dependency ids. */
export const allForScoring = async (userId) => {
    const docs = await Task.find({ owner: userId }).lean();
    // Inline normalisation: engine wants `dependencies: [id_string]`.
    return docs.map((d) => ({
        ...d,
        id: d._id.toString(),
        _id: d._id.toString(),
        dependencies: (d.dependencies || []).map((x) => x.toString()),
        // snake_case aliases the planner engines may check.
        estimated_minutes: d.estimatedMinutes ?? 30,
        energy_fit: d.energyFit ?? 'normal',
        commitment_type: d.commitmentType ?? 'personal',
        priority_score: d.priorityScore ?? 0,
        priority_tier: d.priorityTier ?? 'medium',
        user_id: d.owner?.toString(),
        project_id: d.projectId?.toString() ?? null,
        goal_id: d.goalId?.toString() ?? null,
        parent_task_id: d.parentTaskId?.toString() ?? null,
    }));
};

export const getById = async (userId, taskId) => {
    if (!mongoose.Types.ObjectId.isValid(taskId)) return null;
    const doc = await Task.findOne({ _id: taskId, owner: userId })
        .populate(POPULATE_DEPS)
        .lean();
    return doc ? toApiShape(doc) : null;
};

/** Set of completed task id strings — for blocked-dependency scoring. */
export const completedIds = async (userId) => {
    const docs = await Task.find({ owner: userId, status: 'completed' }).select('_id').lean();
    return new Set(docs.map((d) => d._id.toString()));
};

/** Tasks that depend on `taskId` (for cascade rescore). */
export const dependentsOf = async (userId, taskId) => {
    const docs = await Task.find({ owner: userId, dependencies: taskId }).lean();
    return docs.map((d) => ({
        ...d,
        id: d._id.toString(),
        dependencies: (d.dependencies || []).map((x) => x.toString()),
        estimated_minutes: d.estimatedMinutes ?? 30,
        priority_score: d.priorityScore ?? 0,
        priority_tier: d.priorityTier ?? 'medium',
    }));
};

// ── Writes ───────────────────────────────────────────────────────────────────

export const create = async (
    userId,
    {
        title,
        description = '',
        status = 'pending',
        importance = 3,
        urgency = 3,
        difficulty = 3,
        friction = 3,
        estimatedMinutes = 30,
        deadline = null,
        category = 'General',
        commitmentType = 'personal',
        stakeholder = '',
        energyFit = 'normal',
        projectId = null,
        goalId = null,
        parentTaskId = null,
        dependencies = [],
    }
) => {
    const clean = [...new Set(dependencies.map((d) => d.toString()))];
    const doc = await Task.create({
        owner: userId,
        title,
        description,
        status,
        importance,
        urgency,
        difficulty,
        friction,
        estimatedMinutes,
        deadline,
        category,
        commitmentType,
        stakeholder,
        energyFit,
        projectId: projectId || null,
        goalId: goalId || null,
        parentTaskId: parentTaskId || null,
        dependencies: clean,
        version: 1,
    });
    return getById(userId, doc._id);
};

export const setScore = async (taskId, score, tier) => {
    await Task.findByIdAndUpdate(taskId, { priorityScore: score, priorityTier: tier });
};

/**
 * Partial update with optional optimistic concurrency check.
 * Returns: `{ row }` | `{ conflict: true, current }` | `{ notFound: true }`.
 */
const ALLOWED_FIELDS = [
    'title', 'description', 'deadline', 'importance', 'urgency', 'difficulty',
    'friction', 'estimatedMinutes', 'status', 'category', 'commitmentType',
    'stakeholder', 'energyFit', 'projectId', 'goalId', 'parentTaskId',
    'scheduledStart', 'scheduledEnd',
];

export const update = async (userId, taskId, fields, { expectedVersion = null } = {}) => {
    if (!mongoose.Types.ObjectId.isValid(taskId)) return { notFound: true };

    const existing = await Task.findOne({ _id: taskId, owner: userId });
    if (!existing) return { notFound: true };

    // Optimistic concurrency check.
    if (expectedVersion !== null && existing.version !== Number(expectedVersion)) {
        return { conflict: true, current: toApiShape(await Task.findById(taskId).populate(POPULATE_DEPS).lean()) };
    }

    const patch = {};
    for (const k of ALLOWED_FIELDS) {
        if (fields[k] !== undefined) patch[k] = fields[k];
    }
    // Handle completion timestamp.
    if (fields.status === 'completed' && existing.status !== 'completed') {
        patch.completedAt = new Date();
    } else if (fields.status !== undefined && fields.status !== 'completed') {
        patch.completedAt = null;
    }
    patch.version = existing.version + 1;

    const updated = await Task.findByIdAndUpdate(taskId, patch, { new: true })
        .populate(POPULATE_DEPS)
        .lean();
    return { row: toApiShape(updated) };
};

export const replaceDependencies = async (userId, taskId, depIds) => {
    const clean = [...new Set(depIds.map((d) => d.toString()))].filter((d) => d !== taskId.toString());
    await Task.findOneAndUpdate({ _id: taskId, owner: userId }, { dependencies: clean });
};

/**
 * Delete task. Returns `{ deleted, dependentIds }` for cascade rescore.
 * Also removes this task from all dependency arrays (Mongo has no FK cascade).
 */
export const remove = async (userId, taskId) => {
    const existing = await Task.findOne({ _id: taskId, owner: userId }).lean();
    if (!existing) return { deleted: 0, dependentIds: [] };

    const dependents = await Task.find({ owner: userId, dependencies: taskId }).select('_id').lean();
    const dependentIds = dependents.map((d) => d._id.toString());

    await Task.findOneAndDelete({ _id: taskId, owner: userId });
    // Remove from all dependency arrays across user's tasks.
    await Task.updateMany({ owner: userId, dependencies: taskId }, { $pull: { dependencies: taskId } });

    return { deleted: 1, dependentIds };
};
