/**
 * Directed Acyclic Graph (DAG) for Task Dependencies
 * 
 * Represents tasks as nodes and their dependencies as directed edges.
 * Edge A → B means "Task A depends on Task B" (B must be done before A).
 * 
 * Supports:
 * - Cycle detection via DFS (prevents circular dependencies)
 * - Topological sort (correct execution order)
 * - Reachability queries
 */
class DAG {
    constructor() {
        this.adjacencyList = new Map(); // taskId → Set of dependency taskIds
        this.reverseList = new Map();   // taskId → Set of dependents (tasks that need this)
    }

    /**
     * Add a node to the graph
     */
    addNode(id) {
        if (!this.adjacencyList.has(id)) {
            this.adjacencyList.set(id, new Set());
        }
        if (!this.reverseList.has(id)) {
            this.reverseList.set(id, new Set());
        }
    }

    /**
     * Add a directed edge: `from` depends on `to`
     * Returns false if adding this edge would create a cycle
     */
    addEdge(from, to) {
        this.addNode(from);
        this.addNode(to);

        // Check if adding this edge creates a cycle
        if (this._wouldCreateCycle(from, to)) {
            return false; // Reject: circular dependency
        }

        this.adjacencyList.get(from).add(to);
        this.reverseList.get(to).add(from);
        return true;
    }

    /**
     * Remove a node and all its edges from the graph
     */
    removeNode(id) {
        if (!this.adjacencyList.has(id)) return;

        // Remove all edges from this node
        for (const dep of this.adjacencyList.get(id)) {
            this.reverseList.get(dep)?.delete(id);
        }
        // Remove all reverse edges to this node
        for (const dep of this.reverseList.get(id)) {
            this.adjacencyList.get(dep)?.delete(id);
        }

        this.adjacencyList.delete(id);
        this.reverseList.delete(id);
    }

    /**
     * Get immediate dependencies of a task
     */
    getDependencies(id) {
        return [...(this.adjacencyList.get(id) || [])];
    }

    /**
     * Get tasks that depend on this task
     */
    getDependents(id) {
        return [...(this.reverseList.get(id) || [])];
    }

    /**
     * Topological sort — returns tasks in completion order
     * Tasks with no dependencies come first (Kahn's algorithm)
     */
    topologicalSort() {
        const inDegree = new Map();
        for (const [node] of this.adjacencyList) {
            inDegree.set(node, 0);
        }
        for (const [, deps] of this.adjacencyList) {
            for (const dep of deps) {
                inDegree.set(dep, (inDegree.get(dep) || 0) + 1);
            }
        }

        const queue = [];
        for (const [node, degree] of inDegree) {
            if (degree === 0) queue.push(node);
        }

        const sorted = [];
        while (queue.length > 0) {
            const node = queue.shift();
            sorted.push(node);
            for (const dependent of this.reverseList.get(node) || []) {
                const newDeg = (inDegree.get(dependent) || 0) - 1;
                inDegree.set(dependent, newDeg);
                if (newDeg === 0) queue.push(dependent);
            }
        }

        return sorted;
    }

    /**
     * Check if `from` can reach `to` via DFS
     */
    _canReach(from, to) {
        if (from === to) return true;
        const visited = new Set();
        const stack = [from];
        while (stack.length > 0) {
            const node = stack.pop();
            if (node === to) return true;
            if (visited.has(node)) continue;
            visited.add(node);
            for (const dep of this.adjacencyList.get(node) || []) {
                stack.push(dep);
            }
        }
        return false;
    }

    /**
     * Would adding edge from→to create a cycle?
     * A cycle exists if `to` can already reach `from`.
     */
    _wouldCreateCycle(from, to) {
        return this._canReach(to, from);
    }

    /**
     * Get all nodes and edges as serializable arrays for frontend graph rendering
     */
    serialize() {
        const nodes = [...this.adjacencyList.keys()].map((id) => ({ id }));
        const edges = [];
        for (const [from, deps] of this.adjacencyList) {
            for (const to of deps) {
                edges.push({ from, to });
            }
        }
        return { nodes, edges };
    }
}

export default DAG;
