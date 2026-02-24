import mongoose from 'mongoose';

/**
 * Task Model
 * Stores task data with priority factors and dependency tracking
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
        deadline: {
            type: Date,
            required: [true, 'Deadline is required'],
        },
        // Priority factors — all on scale 1–5
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
        // Task status lifecycle
        status: {
            type: String,
            enum: ['pending', 'in-progress', 'completed', 'cancelled'],
            default: 'pending',
        },
        // Dependencies: other task IDs that must be completed first
        dependencies: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Task',
            },
        ],
        // Computed priority score (0–100) — updated by DSA engine
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
        completedAt: {
            type: Date,
        },
    },
    {
        timestamps: true,
    }
);

// Index for priority-sorted task retrieval
taskSchema.index({ owner: 1, priorityScore: -1 });
taskSchema.index({ owner: 1, status: 1 });
taskSchema.index({ owner: 1, deadline: 1 });

const Task = mongoose.model('Task', taskSchema);
export default Task;
