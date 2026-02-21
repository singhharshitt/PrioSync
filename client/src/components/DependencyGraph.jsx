import { useMemo } from 'react';

/**
 * DependencyGraph - SVG-based task dependency visualizer
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
 * Simple layered layout using dependency levels
 */
const computeLayout = (nodes, edges) => {
  if (!nodes.length) return {};

  const inDegree = {};
  const adjacency = {};

  for (const node of nodes) {
    inDegree[node.id] = 0;
    adjacency[node.id] = [];
  }

  for (const edge of edges) {
    adjacency[edge.to]?.push(edge.from);
    inDegree[edge.from] = (inDegree[edge.from] || 0) + 1;
  }

  const layers = [];
  const queue = nodes.filter((node) => inDegree[node.id] === 0).map((node) => node.id);
  let layerIndex = 0;

  while (queue.length) {
    layers[layerIndex] = queue.slice();
    const nextQueue = [];

    for (const id of queue) {
      for (const dependentId of adjacency[id] || []) {
        inDegree[dependentId] -= 1;
        if (inDegree[dependentId] === 0) {
          nextQueue.push(dependentId);
        }
      }
    }

    queue.splice(0, queue.length, ...nextQueue);
    layerIndex += 1;
  }

  const coords = {};
  const layerCount = layers.length || 1;
  const xStep = WIDTH / (layerCount + 1);

  for (let layer = 0; layer < layers.length; layer += 1) {
    const row = layers[layer] || [];
    const yStep = HEIGHT / (row.length + 1);
    row.forEach((id, index) => {
      coords[id] = { x: xStep * (layer + 1), y: yStep * (index + 1) };
    });
  }

  nodes.forEach((node, index) => {
    if (!coords[node.id]) {
      coords[node.id] = { x: WIDTH / 2, y: (HEIGHT / (nodes.length + 1)) * (index + 1) };
    }
  });

  return coords;
};

const DependencyGraph = ({ graph }) => {
  const { nodes = [], edges = [] } = graph || {};
  const coords = useMemo(() => computeLayout(nodes, edges), [nodes, edges]);

  if (nodes.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-[#6B5B56] text-sm">
        No tasks with dependencies yet.
      </div>
    );
  }

  return (
    <div className="w-full overflow-x-auto rounded-xl">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="w-full min-w-225"
        style={{ background: 'rgba(43,27,23,0.3)', borderRadius: '0.75rem', minHeight: 320 }}
      >
        <defs>
          <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="6" refY="3" orient="auto">
            <polygon points="0 0, 8 3, 0 6" fill="#CCC4BE" />
          </marker>
        </defs>

        {edges.map((edge, index) => {
          const from = coords[edge.from];
          const to = coords[edge.to];
          if (!from || !to) return null;

          const dx = to.x - from.x;
          const dy = to.y - from.y;
          const len = Math.sqrt(dx * dx + dy * dy) || 1;

          const sx = from.x + (dx / len) * NODE_R;
          const sy = from.y + (dy / len) * NODE_R;
          const ex = to.x - (dx / len) * NODE_R;
          const ey = to.y - (dy / len) * NODE_R;

          return (
            <line
              key={`${edge.from}-${edge.to}-${index}`}
              x1={sx}
              y1={sy}
              x2={ex}
              y2={ey}
              stroke="#CCC4BE"
              strokeWidth={1.5}
              strokeOpacity={0.6}
              markerEnd="url(#arrowhead)"
            />
          );
        })}

        {nodes.map((node) => {
          const position = coords[node.id];
          if (!position) return null;

          const color = TIER_COLORS[node.priorityTier] || '#627890';
          const label = node.title?.length > 14 ? `${node.title.slice(0, 13)}...` : node.title;

          return (
            <g key={node.id}>
              <circle cx={position.x} cy={position.y} r={NODE_R + 6} fill={color} fillOpacity={0.08} />
              <circle
                cx={position.x}
                cy={position.y}
                r={NODE_R}
                fill={`${color}22`}
                stroke={color}
                strokeWidth={2}
              />
              <text
                x={position.x}
                y={position.y - 4}
                textAnchor="middle"
                fill={color}
                fontSize={11}
                fontWeight="700"
              >
                {node.priorityScore}
              </text>
              <text x={position.x} y={position.y + 9} textAnchor="middle" fill="#FFFFFF" fontSize={9}>
                {label}
              </text>
              <circle
                cx={position.x + NODE_R - 4}
                cy={position.y - NODE_R + 4}
                r={5}
                fill={
                  node.status === 'completed'
                    ? '#22c55e'
                    : node.status === 'in-progress'
                      ? '#FC703C'
                      : '#CCC4BE'
                }
              />
            </g>
          );
        })}
      </svg>

      <div className="flex flex-wrap gap-4 mt-3 text-xs text-[#4A3A36]">
        {[
          { color: '#ef4444', label: 'Critical' },
          { color: '#f97316', label: 'High' },
          { color: '#eab308', label: 'Medium' },
          { color: '#22c55e', label: 'Low' },
          { color: '#22c55e', label: 'Completed' },
          { color: '#FC703C', label: 'In Progress' },
          { color: '#CCC4BE', label: 'Pending' },
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
