import { describe, it, expect } from 'vitest';
import { parseBrainDump, heuristicParse } from '../ai/plannerParser.js';

const DUMP = [
    'I need to prepare for my placement.',
    'I have SQL, DSA and frontend left.',
    'I also have college work.',
    'My assessment is next week.',
    "I haven't started SQL properly.",
    'I want to do DSA every day.',
].join('\n');

describe('heuristic planner parser', () => {
    it('extracts goal, tasks, deadline, and asks only for availability', async () => {
        const { plan, source } = await parseBrainDump(DUMP, {}, 'heuristic');
        expect(source).toBe('heuristic');
        expect(plan.goal.title.length).toBeGreaterThan(2);
        expect(plan.goal.deadline).not.toBeNull();
        const titles = plan.tasks.map((t) => t.title);
        expect(titles).toContain('SQL');
        expect(titles).toContain('DSA');
        expect(plan.tasks.every((t) => t.priorityScore === undefined)).toBe(true); // AI never scores
        expect(plan.clarificationsNeeded.map((c) => c.field)).toEqual(['availableMinutesPerDay']);
    });

    it('drops context/state sentences and dedupes', () => {
        const { tasks } = heuristicParse('My assessment is next week.\nSQL\nSQL', {});
        expect(tasks.map((t) => t.title)).toEqual(['SQL']);
    });

    it('keeps every line of a multi-line list (fallback goal does not swallow line 1)', () => {
        const { goal, tasks } = heuristicParse('Prepare demo\nFix login bug', {});
        expect(tasks.map((t) => t.title)).toEqual(['Prepare demo', 'Fix login bug']);
        expect(goal.title).toBe('Prepare demo');
    });

    it('still folds a phrase that restates a structured goal into the goal', () => {
        const { goal, tasks } = heuristicParse('I want to update the blog.\nupdate the blog\nSend newsletter', {});
        expect(goal.title.toLowerCase()).toBe('update the blog');
        expect(tasks.map((t) => t.title)).toEqual(['Send newsletter']);
    });

    it('keeps a single-liner as an editable task and still asks for specifics', () => {
        const { tasks, clarificationsNeeded } = heuristicParse('Prepare demo', {});
        expect(tasks).toHaveLength(1);
        expect(tasks[0].title).toBe('Prepare demo');
        expect(clarificationsNeeded.some((c) => c.field === 'tasks')).toBe(true);
    });

    it('parses a one-liner end-to-end with explicit duration and weekday deadline', async () => {
        const { plan, source } = await parseBrainDump('finish report by friday for 2 hours', {}, 'heuristic');
        expect(source).toBe('heuristic');
        expect(plan.tasks).toHaveLength(1);
        expect(plan.tasks[0].estimatedMinutes).toBe(120);
        expect(plan.goal.deadline).not.toBeNull();
    });

    it('rejects pure-context input with an actionable 400 (not a schema 502)', async () => {
        await expect(
            parseBrainDump('My assessment is next week. I feel stuck.', {}, 'heuristic')
        ).rejects.toMatchObject({ status: 400, message: expect.stringContaining('tasks') });
    });

    it('rejects near-empty input', async () => {
        await expect(parseBrainDump('hi', {}, 'heuristic')).rejects.toMatchObject({ status: 400 });
    });

    it('rejects AI mode without a configured key', async () => {
        await expect(parseBrainDump('prepare slides for Friday', {}, 'ai')).rejects.toMatchObject({ status: 503 });
    });

    it('sniffs explicit ISO deadlines', () => {
        const future = new Date(Date.now() + 20 * 86400000);
        const iso = `${future.getFullYear()}-${String(future.getMonth() + 1).padStart(2, '0')}-${String(future.getDate()).padStart(2, '0')}`;
        const { goal } = heuristicParse(`Finish thesis by ${iso}`, {});
        expect(goal.deadline).not.toBeNull();
    });
});
