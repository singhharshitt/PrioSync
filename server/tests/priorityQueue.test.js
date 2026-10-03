import { describe, it, expect } from 'vitest';
import MaxHeap from '../dsa-engine/priorityQueue.js';

describe('MaxHeap', () => {
    it('peeks max in O(1) without removing', () => {
        const h = new MaxHeap();
        h.insert({ id: 'a', score: 10 });
        h.insert({ id: 'b', score: 90 });
        h.insert({ id: 'c', score: 50 });
        expect(h.peek().id).toBe('b');
        expect(h.size).toBe(3);
    });

    it('extracts in descending order', () => {
        const h = new MaxHeap();
        const scores = [42, 90, 7, 68, 90, 15];
        scores.forEach((s, i) => h.insert({ id: `t${i}`, score: s }));
        const got = h.extractAll().map((t) => t.score);
        expect(got).toEqual([90, 90, 68, 42, 15, 7]);
    });

    it('handles empty heap gracefully', () => {
        const h = new MaxHeap();
        expect(h.peek()).toBeNull();
        expect(h.extractMax()).toBeNull();
    });

    it('heapifies an array in O(n)', () => {
        const h = new MaxHeap();
        h.buildFromArray([{ score: 3 }, { score: 99 }, { score: 40 }]);
        expect(h.extractMax().score).toBe(99);
    });
});
