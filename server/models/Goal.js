import mongoose from 'mongoose';

/**
 * Goal Model — a high-level outcome that groups projects and tasks.
 * Created by the planner confirm flow; scoped to one user.
 */
const goalSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        title: {
            type: String,
            required: true,
            trim: true,
            maxlength: 150,
        },
        description: {
            type: String,
            trim: true,
            default: '',
        },
        deadline: {
            type: Date,
            default: null,
        },
        status: {
            type: String,
            enum: ['active', 'completed', 'cancelled'],
            default: 'active',
        },
    },
    { timestamps: true }
);

const Goal = mongoose.model('Goal', goalSchema);
export default Goal;
