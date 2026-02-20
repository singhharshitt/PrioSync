import { useEffect, useRef } from 'react';

/**
 * DependencyGraph — SVG-based task dependency visualizer
 * Renders nodes (tasks) and directed edges (dependencies) from the DAG API response
 */
const TIER_COLORS = {
    critical: '#ef4444',
    high: '#f97316',
    medium: '#eab308',
    low: '#22c55e',
};

const NODE_R = 28;
const WIDTH = 900;
const HEIGHT = 500;

/**
 * Simple force-directed-like layout: arrange nodes in rows
 */
const computeLayout = (nodes, edges) => {
    if (!nodes.length) return {};

    // Build adjacency to determine dependency levels
    const inDegree = {};
    const adj = {};
    for (const n of nodes) { inDegree[n.id] = 0; adj[n.id] = []; }
    for (const e of edges) {
        adj[e.to]?.push(e.from); // 'from' depends on 'to'
        inDegree[e.from] = (inDegree[e.from] || 0) + 1;
    }

    // BFS layering
    const layers = [];
    const layerOf = {};
    const queue = nodes.filter((n) => inDegree[n.id] === 0).map((n) => n.id);
    let layer = 0;
    while (queue.length) {
        layers[layer] = queue.slice();
        const nextQ = [];
        for (const id of queue) {
            layerOf[id] = layer;
            for (const dep of (adj[id] || [])) {
                inDegree[dep]--;
                if (inDegree[dep] === 0) nextQ.push(dep);
            }
        }
        queue.splice(0, queue.length, ...nextQ);
        layer++;
    }

    // Assign coordinates
    const coords = {};
    const layerCount = layers.length || 1;
    const xStep = WIDTH / (layerCount + 1);

    for (let l = 0; l < layers.length; l++) {
        const row = layers[l] || [];
        const yStep = HEIGHT / (row.length + 1);
        row.forEach((id, i) => {
            coords[id] = { x: xStep * (l + 1), y: yStep * (i + 1) };
        });
    }

    // Handle any unplaced nodes (if cycle prevented layering)
    nodes.forEach((n, i) => {
        if (!coords[n.id]) {
            coords[n.id] = { x: WIDTH / 2, y: (HEIGHT / (nodes.length + 1)) * (i + 1) };
        }
    });

    return coords;
};

const DependencyGraph = ({ graph }) => {
    const { nodes = [], edges = [] } = graph || {};

    if (nodes.length === 0) {
        return (
            <div className="flex items-center justify-center h-64 text-[#64748b] text-sm">
                No tasks with dependencies yet.
            </div>
        );
    }

    const coords = computeLayout(nodes, edges);

    return (
        <div className="w-full overflow-x-auto rounded-xl">
            <svg
                viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
                className="w-full min-w-[500px]"
                style={{ background: 'rgba(27,40,64,0.5)', borderRadius: '0.75rem', minHeight: 320 }}
            >
                {/* Arrow marker */}
                <defs>
                    <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="6" refY="3" orient="auto">
                        <polygon points="0 0, 8 3, 0 6" fill="#627890" />
                    </marker>
                </defs>

                {/* Edges */}
                {edges.map((e, i) => {
                    const from = coords[e.from];
                    const to = coords[e.to];
                    if (!from || !to) return null;
                    const dx = to.x - from.x;
                    const dy = to.y - from.y;
                    const len = Math.sqrt(dx * dx + dy * dy) || 1;
                    // Shorten line to not overlap node circles
                    const sx = from.x + (dx / len) * NODE_R;
                    const sy = from.y + (dy / len) * NODE_R;
                    const ex = to.x - (dx / len) * NODE_R;
                    const ey = to.y - (dy / len) * NODE_R;
                    return (
                        <line
                            key={i}
                            x1={sx} y1={sy} x2={ex} y2={ey}
                            stroke="#627890" strokeWidth={1.5} strokeOpacity={0.6}
                            markerEnd="url(#arrowhead)"
                        />
                    );
                })}

                {/* Nodes */}
                {nodes.map((node) => {
                    const pos = coords[node.id];
                    if (!pos) return null;
                    const color = TIER_COLORS[node.priorityTier] || '#627890';
                    const label = node.title?.length > 14 ? node.title.slice(0, 13) + '…' : node.title;
                    return (
                        <g key={node.id}>
                            {/* Glow ring */}
                            <circle cx={pos.x} cy={pos.y} r={NODE_R + 6} fill={color} fillOpacity={0.08} />
                            {/* Node circle */}
                            <circle
                                cx={pos.x} cy={pos.y} r={NODE_R}
                                fill={`${color}22`}
                                stroke={color}
                                strokeWidth={2}
                            />
                            {/* Score */}
                            <text x={pos.x} y={pos.y - 4} textAnchor="middle" fill={color}
                                fontSize={11} fontWeight="700">{node.priorityScore}</text>
                            {/* Title */}
                            <text x={pos.x} y={pos.y + 9} textAnchor="middle" fill="#f1f5f9"
                                fontSize={9}>{label}</text>
                            {/* Status dot */}
                            <circle
                                cx={pos.x + NODE_R - 4} cy={pos.y - NODE_R + 4} r={5}
                                fill={node.status === 'completed' ? '#22c55e' : node.status === 'in-progress' ? '#604C39' : '#627890'}
                            />
                        </g>
                    );
                })}
            </svg>

            {/* Legend */}
            <div className="flex flex-wrap gap-4 mt-3 text-xs text-[#64748b]">
                {[
                    { color: '#ef4444', label: 'Critical' },
                    { color: '#f97316', label: 'High' },
                    { color: '#eab308', label: 'Medium' },
                    { color: '#22c55e', label: 'Low' },
                    { color: '#22c55e', label: '● Completed' },
                    { color: '#604C39', label: '● In Progress' },
                    { color: '#627890', label: '● Pending' },
                ].map(({ color, label }) => (
                    <span key={label} className="flex items-center gap-1.5">
                        <span style={{ background: color }} className="w-2 h-2 rounded-full inline-block" />
                        {label}
                    </span>
                ))}
            </div>
        </div>
    );
};

export default DependencyGraph;
