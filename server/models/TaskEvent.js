import mongoose from 'mongoose';

/**
 * TaskEvent Model — append-only audit trail powering analytics, the decision
 * log, recommendation adherence, and drift/scope analysis. `task` is nullable
 * (SET NULL semantics) so history survives task deletion. eventType is kept
 * as a plain String (no enum) so the engine can record any typed event
 * without a 5xx on a newly-introduced type; values are validated by callers.
 */
const taskEventSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        task: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Task',
            default: null,
            index: true,
        },
        eventType: {
            type: String,
            required: true,
        },
        payload: {
            type: mongoose.Schema.Types.Mixed,
            default: {},
        },
    },
    { timestamps: true }
);

// Hot read path: list a user's recent events newest-first.
taskEventSchema.index({ user: 1, createdAt: -1 });

const TaskEvent = mongoose.model('TaskEvent', taskEventSchema);
export default TaskEvent;
