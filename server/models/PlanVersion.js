import mongoose from 'mongoose';

/**
 * PlanVersion Model — versioned planner/replan snapshots.
 * `healthDetails` is freeform JSON (computed health object, proposal state).
 * `items` is an ordered array of task references (the greedy schedule).
 */
const planVersionSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        goal: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Goal',
            default: null,
        },
        healthScore: { type: Number, min: 0, max: 100, default: null },
        healthDetails: { type: mongoose.Schema.Types.Mixed, default: {} },
        reason: { type: String, default: '' },
        items: [
            {
                task: { type: mongoose.Schema.Types.ObjectId, ref: 'Task' },
                position: { type: Number, required: true },
            },
        ],
    },
    { timestamps: true, versionKey: false }
);

const PlanVersion = mongoose.model('PlanVersion', planVersionSchema);
export default PlanVersion;
