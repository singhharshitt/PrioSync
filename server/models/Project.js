import mongoose from 'mongoose';

/**
 * Project Model — a grouping of tasks, optionally under a goal.
 * Created by the planner confirm flow; scoped to one user.
 */
const projectSchema = new mongoose.Schema(
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
        status: {
            type: String,
            enum: ['active', 'completed', 'cancelled'],
            default: 'active',
        },
    },
    { timestamps: true }
);

const Project = mongoose.model('Project', projectSchema);
export default Project;
