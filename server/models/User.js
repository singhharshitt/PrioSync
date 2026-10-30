import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

/**
 * User Model
 * Stores authentication credentials, profile data, and planner preferences.
 *
 * `focusSessions[]` is the v1 embedded log (kept for the v1 routes); the v2
 * Focus flow writes normalized `WorkSession` docs instead. `preferences`
 * holds planner constraints (capacity, work window, daily energy rhythm).
 */
const preferencesSchema = new mongoose.Schema(
    {
        availableMinutesPerDay: {
            type: Number,
            min: 15,
            max: 960,
            default: 240,
        },
        workStart: { type: String, default: null }, // "HH:MM"
        workEnd: { type: String, default: null },
        defaultEnergy: {
            type: String,
            enum: ['low', 'normal', 'high'],
            default: 'normal',
        },
        energyMorning: {
            type: String,
            enum: ['low', 'normal', 'high'],
            default: 'high',
        },
        energyAfternoon: {
            type: String,
            enum: ['low', 'normal', 'high'],
            default: 'normal',
        },
        energyEvening: {
            type: String,
            enum: ['low', 'normal', 'high'],
            default: 'low',
        },
        aiNarration: {
            type: Boolean,
            default: true,
        },
    },
    { _id: false }
);

const userSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, 'Name is required'],
            trim: true,
            maxlength: [80, 'Name cannot exceed 80 characters'],
        },
        email: {
            type: String,
            required: [true, 'Email is required'],
            unique: true,
            lowercase: true,
            trim: true,
            match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email'],
        },
        password: {
            type: String,
            required: [true, 'Password is required'],
            minlength: [6, 'Password must be at least 6 characters'],
            select: false, // Never return password in queries
        },
        avatar: {
            type: String,
            default: '',
        },
        productivityScore: {
            type: Number,
            default: 0,
        },
        tasksCompleted: {
            type: Number,
            default: 0,
        },
        tasksCreated: {
            type: Number,
            default: 0,
        },
        // Planner constraints + energy rhythm (created alongside the user).
        preferences: {
            type: preferencesSchema,
            default: () => ({}),
        },
        focusSessions: [
            {
                task: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: 'Task',
                    default: null,
                },
                startedAt: {
                    type: Date,
                    required: true,
                },
                endedAt: {
                    type: Date,
                    required: true,
                },
                durationSeconds: {
                    type: Number,
                    required: true,
                    min: 1,
                },
                completed: {
                    type: Boolean,
                    default: false,
                },
            },
        ],
        lastFocusAt: {
            type: Date,
        },
    },
    {
        timestamps: true,
    }
);

// Hash password before saving
userSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
});

// Compare entered password with stored hash
userSchema.methods.comparePassword = async function (enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

const User = mongoose.model('User', userSchema);
export default User;
