import * as Users from '../repositories/pgUsers.js';

const present = (row) => ({
    availableMinutesPerDay: row.available_minutes_per_day,
    workStart: row.work_start,
    workEnd: row.work_end,
    defaultEnergy: row.default_energy,
    energyMorning: row.energy_morning,
    energyAfternoon: row.energy_afternoon,
    energyEvening: row.energy_evening,
});

export const getPreferences = async (req, res, next) => {
    try {
        res.json({ success: true, preferences: present(await Users.getPreferences(req.user.id)) });
    } catch (e) {
        next(e);
    }
};

export const updatePreferences = async (req, res, next) => {
    try {
        const row = await Users.updatePreferences(req.user.id, req.body);
        if (!row) return res.status(404).json({ success: false, message: 'Preferences not found.' });
        res.json({ success: true, preferences: present(row) });
    } catch (e) {
        next(e);
    }
};
