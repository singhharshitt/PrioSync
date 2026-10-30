import mongoose from 'mongoose';

/**
 * WorkSession Model — normalized focus sessions.
 * Replaces the embedded `focusSessions[]` array in User for v2 paths.
 * `task` is nullable so orphan sessions still count toward calibration.
 */
const workSessionSchema = new mongoose.Schema(
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
        },
        startedAt: { type: Date, required: true },
        endedAt: { type: Date, required: true },
        durationSeconds: { type: Number, required: true, min: 1 },
        completed: { type: Boolean, default: false },
        plannedSeconds: { type: Number, default: null },
        pausedSeconds: { type: Number, default: 0, min: 0 },
        note: { type: String, default: '' },
    },
    { timestamps: true, versionKey: false }
);

workSessionSchema.index({ user: 1, endedAt: -1 });

const WorkSession = mongoose.model('WorkSession', workSessionSchema);
export default WorkSession;
