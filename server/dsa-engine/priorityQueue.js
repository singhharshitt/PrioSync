/**
 * Max Heap Priority Queue
 * 
 * Provides O(log n) insert and O(log n) extract-max operations.
 * Used to efficiently retrieve the highest-priority task at any time.
 * 
 * Each item in the heap is an object: { id, score, ...taskData }
 * Heap is ordered by `score` (max at root).
 */
class MaxHeap {
    constructor() {
        this.heap = [];
    }

    get size() {
        return this.heap.length;
    }

    /**
     * Returns the maximum element without removing it
     */
    peek() {
        return this.heap[0] || null;
    }

    /**
     * Insert a new item into the heap — O(log n)
     */
    insert(item) {
        this.heap.push(item);
        this._bubbleUp(this.heap.length - 1);
    }

    /**
     * Remove and return the maximum element — O(log n)
     */
    extractMax() {
        if (this.heap.length === 0) return null;
        if (this.heap.length === 1) return this.heap.pop();

        const max = this.heap[0];
        this.heap[0] = this.heap.pop(); // Move last to root
        this._sinkDown(0);
        return max;
    }

    /**
     * Build heap from an array — O(n)
     */
    buildFromArray(items) {
        this.heap = [...items];
        // Heapify from last internal node upward
        for (let i = Math.floor(this.heap.length / 2) - 1; i >= 0; i--) {
            this._sinkDown(i);
        }
    }

    /**
     * Extract all elements in descending order — O(n log n)
     */
    extractAll() {
        const sorted = [];
        while (this.size > 0) {
            sorted.push(this.extractMax());
        }
        return sorted;
    }

    /**
     * Bubble up: restore heap after insert
     */
    _bubbleUp(index) {
        while (index > 0) {
            const parentIndex = Math.floor((index - 1) / 2);
            if (this.heap[parentIndex].score >= this.heap[index].score) break;
            [this.heap[parentIndex], this.heap[index]] = [
                this.heap[index],
                this.heap[parentIndex],
            ];
            index = parentIndex;
        }
    }

    /**
     * Sink down: restore heap after extract
     */
    _sinkDown(index) {
        const length = this.heap.length;
        while (true) {
            const left = 2 * index + 1;
            const right = 2 * index + 2;
            let largest = index;

            if (left < length && this.heap[left].score > this.heap[largest].score) {
                largest = left;
            }
            if (right < length && this.heap[right].score > this.heap[largest].score) {
                largest = right;
            }
            if (largest === index) break;

            [this.heap[largest], this.heap[index]] = [
                this.heap[index],
                this.heap[largest],
            ];
            index = largest;
        }
    }
}

export default MaxHeap;
