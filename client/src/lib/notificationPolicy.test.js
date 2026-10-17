import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('react-hot-toast', () => {
    const calls = [];
    const record = (kind) => (...args) => {
        calls.push([kind, ...args]);
        return `${kind}-id`;
    };
    const toast = Object.assign(record('toast'), {
        success: record('success'),
        error: record('error'),
        loading: record('loading'),
        dismiss: record('dismiss'),
        promise: record('promise'),
        __calls: calls,
    });
    return { toast };
});

import { toast } from 'react-hot-toast';
import notify, { NOTIFY_DURATIONS, setMuted, isMuted } from './notificationPolicy.js';

beforeEach(() => {
    toast.__calls.length = 0;
    setMuted(false);
});

describe('notification policy', () => {
    it('applies severity durations and stringifies messages', () => {
        notify.success('Done');
        notify.error('Failed');
        notify('Heads up', { icon: 'x' });
        expect(toast.__calls).toEqual([
            ['success', 'Done', { duration: NOTIFY_DURATIONS.success }],
            ['error', 'Failed', { duration: NOTIFY_DURATIONS.error }],
            ['toast', 'Heads up', { duration: NOTIFY_DURATIONS.info, icon: 'x' }],
        ]);
    });

    it('lets callers override the duration and forwards helpers', () => {
        notify.success('Long', { duration: 9000, id: 'k' });
        expect(toast.__calls[0]).toEqual(['success', 'Long', { duration: 9000, id: 'k' }]);
        notify.dismiss('k');
        notify.loading('Working');
        expect(toast.__calls[1][0]).toBe('dismiss');
        expect(toast.__calls[2]).toEqual(['loading', 'Working', { duration: Infinity }]);
    });

    it('mutes info and success during focus but lets errors through', () => {
        setMuted(true);
        expect(isMuted()).toBe(true);
        expect(notify('quiet')).toBeNull();
        expect(notify.success('quiet')).toBeNull();
        notify.error('loud');
        expect(toast.__calls).toEqual([['error', 'loud', { duration: NOTIFY_DURATIONS.error }]]);
        setMuted(false);
        notify.success('back');
        expect(toast.__calls).toHaveLength(2);
    });
});
