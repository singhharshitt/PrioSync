import mongoose from 'mongoose';

/**
 * Task Model (Mongoose / MongoDB)
 *
 * Owns the full v2 task shape: priority factors + friction + estimate +
 * energy fit + commitment metadata + goal/project/parent linkage + the
 * `version` field used for optimistic concurrency (PUT requires `version`,
 * stale writes return 409). Dependencies are an embedded array of ObjectId
 * refs (the MERN equivalent of the v2 `task_dependencies` edge table).
 */
const taskSchema = new mongoose.Schema(
    {
        owner: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        title: {
            type: String,
            required: [true, 'Task title is required'],
            trim: true,
            maxlength: [150, 'Title cannot exceed 150 characters'],
        },
        description: {
            type: String,
            trim: true,
            maxlength: [2000, 'Description cannot exceed 2000 characters'],
            default: '',
        },
        // Optional: undated tasks are valid (planner may inherit the goal deadline).
        deadline: {
            type: Date,
            default: null,
        },
        // Priority factors - all on scale 1–5
        importance: {
            type: Number,
            required: true,
            min: 1,
            max: 5,
            default: 3,
        },
        urgency: {
            type: Number,
            required: true,
            min: 1,
            max: 5,
            default: 3,
        },
        difficulty: {
            type: Number,
            required: true,
            min: 1,
            max: 5,
            default: 3,
        },
        friction: {
            type: Number,
            min: 1,
            max: 5,
            default: 3,
        },
        estimatedMinutes: {
            type: Number,
            min: 1,
            max: 10080,
            default: 30,
        },
        // Task status lifecycle
        status: {
            type: String,
            enum: ['pending', 'in-progress', 'completed', 'cancelled'],
            default: 'pending',
        },
        // Dependencies: other task IDs that must be completed first (DAG edges).
        dependencies: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Task',
            },
        ],
        // Computed priority score (0–100) - updated by DSA engine
        priorityScore: {
            type: Number,
            default: 0,
            min: 0,
            max: 100,
        },
        // Human-readable priority tier derived from score
        priorityTier: {
            type: String,
            enum: ['critical', 'high', 'medium', 'low'],
            default: 'medium',
        },
        // Category / tag for filtering
        category: {
            type: String,
            trim: true,
            maxlength: 50,
            default: 'General',
        },
        energyFit: {
            type: String,
            enum: ['low', 'normal', 'high'],
            default: 'normal',
        },
        commitmentType: {
            type: String,
            enum: ['personal', 'team', 'client', 'academic', 'deadline'],
            default: 'personal',
        },
        stakeholder: {
            type: String,
            default: '',
        },
        // Goal / project / subtask linkage (nullable; SET NULL semantics on delete).
        projectId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Project',
            default: null,
        },
        goalId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Goal',
            default: null,
        },
        parentTaskId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Task',
            default: null,
        },
        scheduledStart: {
            type: Date,
            default: null,
        },
        scheduledEnd: {
            type: Date,
            default: null,
        },
        completedAt: {
            type: Date,
            default: null,
        },
        // Optimistic concurrency: PUT compares version, mismatch → 409.
        version: {
            type: Number,
            min: 1,
            default: 1,
        },
    },
    {
        timestamps: true,
        // Mongoose's own __v is separate from our domain `version` field;
        // disable it so docs carry one unambiguous version number.
        versionKey: false,
    }
);

// Indexes for the hot read paths (mirror the v2 partial-index intent).
taskSchema.index({ owner: 1, priorityScore: -1 });
taskSchema.index({ owner: 1, status: 1 });
taskSchema.index({ owner: 1, deadline: 1 });
taskSchema.index({ owner: 1, goalId: 1 });
taskSchema.index({ owner: 1, projectId: 1 });

const Task = mongoose.model('Task', taskSchema);
export default Task;
