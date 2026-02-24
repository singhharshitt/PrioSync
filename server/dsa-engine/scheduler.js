import MaxHeap from './priorityQueue.js';
import DAG from './dag.js';
import { batchCalculatePriorities } from './priorityEngine.js';

/**
 * Greedy Task Scheduler
 *
 * Combines DAG dependency ordering with Max Heap priority retrieval to
 * produce an optimal task execution sequence:
 *
 * 1. Build DAG from task dependencies
 * 2. Run topological sort to find valid execution order
 * 3. Calculate priority scores (penalizing blocked tasks)
 * 4. Load scored tasks into Max Heap
 * 5. Greedy extraction: always pick the available highest-priority task
 *
 * Returns tasks in recommended completion order.
 */
export const scheduleTasksGreedy = (tasks) => {
    if (!tasks || tasks.length === 0) return [];

    // --- Step 1: Build DAG ---
    const dag = new DAG();
    for (const task of tasks) {
        dag.addNode(task._id.toString());
        for (const dep of task.dependencies || []) {
            const depId = dep._id ? dep._id.toString() : dep.toString();
            // Edge: task → dep (task depends on dep)
            dag.addEdge(task._id.toString(), depId);
        }
    }

    // --- Step 2: Compute priority scores ---
    const completedIds = new Set(
        tasks.filter((t) => t.status === 'completed').map((t) => t._id.toString())
    );
    const scoredTasks = batchCalculatePriorities(tasks, completedIds);

    // --- Step 3: Load into Max Heap ---
    const heap = new MaxHeap();
    for (const task of scoredTasks) {
        heap.insert({ ...task, score: task.priorityScore });
    }

    // --- Step 4: Greedy extraction by priority ---
    const scheduled = heap.extractAll();

    return scheduled;
};

/**
 * Build and return the serialized DAG for a user's tasks
 * (used by the frontend dependency graph visualizer)
 */
export const buildTaskDAG = (tasks) => {
    const dag = new DAG();
    for (const task of tasks) {
        dag.addNode(task._id.toString());
        for (const dep of task.dependencies || []) {
            const depId = dep._id ? dep._id.toString() : dep.toString();
            dag.addEdge(task._id.toString(), depId);
        }
    }
    return dag.serialize();
};
