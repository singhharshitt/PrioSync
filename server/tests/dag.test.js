import { describe, it, expect } from 'vitest';
import DAG from '../dsa-engine/dag.js';

describe('DAG', () => {
    it('topologically sorts dependencies first (A→B, C→A gives B,A,C)', () => {
        const g = new DAG();
        g.addEdge('A', 'B');
        g.addEdge('C', 'A');
        expect(g.topologicalSort()).toEqual(['B', 'A', 'C']);
        expect(g.hasCycle()).toBe(false);
    });

    it('rejects cycle-creating edges', () => {
        const g = new DAG();
        expect(g.addEdge('A', 'B')).toBe(true);
        expect(g.addEdge('B', 'C')).toBe(true);
        expect(g.addEdge('C', 'A')).toBe(false); // would close the loop
        expect(g.hasCycle()).toBe(false);
    });

    it('detects an existing cycle', () => {
        const g = new DAG();
        g.addNode('A');
        g.addNode('B');
        g.adjacencyList.get('A').add('B');
        g.adjacencyList.get('B').add('A');
        expect(g.hasCycle()).toBe(true);
    });

    it('tracks dependents for impact analysis', () => {
        const g = new DAG();
        g.addEdge('B', 'A');
        g.addEdge('C', 'A');
        expect(g.getDependents('A').sort()).toEqual(['B', 'C']);
        expect(g.getDependencies('B')).toEqual(['A']);
    });

    it('removes nodes and their edges', () => {
        const g = new DAG();
        g.addEdge('B', 'A');
        g.removeNode('A');
        expect(g.getDependencies('B')).toEqual([]);
        expect(g.topologicalSort()).toEqual(['B']);
    });
});
