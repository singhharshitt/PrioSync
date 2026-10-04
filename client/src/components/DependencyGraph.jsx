import { useMemo, useState } from 'react';
import PrioIcon from './icons/PrioIcon.jsx';

/**
 * DependencyGraph - SVG-based task dependency visualizer with GSAP-inspired design
 * Renders nodes (tasks) and directed edges (dependencies) from the DAG API response
 */

const TIER_COLORS = {
  critical: '#ef4444',
  high: '#f97316',
  medium: '#eab308',
  low: '#22c55e',
};

const STATUS_COLORS = {
  completed: '#22c55e',
  'in-progress': '#FC703C',
  pending: '#EEA175',
  cancelled: '#2B1B17',
};

const NODE_R = 32;
const WIDTH = 900;
const HEIGHT = 500;

/**
 * Simple layered layout using dependency levels (topological sort)
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

  // Fallback for any unpositioned nodes
  nodes.forEach((node, index) => {
    if (!coords[node.id]) {
      coords[node.id] = { x: WIDTH / 2, y: (HEIGHT / (nodes.length + 1)) * (index + 1) };
    }
  });

  return coords;
};

const DependencyGraph = ({ graph, criticalIds = [], bottleneckId = null }) => {
  const { nodes = [], edges = [] } = graph || {};
  const criticalSet = useMemo(() => new Set(criticalIds), [criticalIds]);
  const coords = useMemo(() => computeLayout(nodes, edges), [nodes, edges]);
  const [hoveredNode, setHoveredNode] = useState(null);

  if (nodes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-80 bg-[#f8f7f2] rounded-2xl border-2 border-dashed border-[#2B1B17]/10">
        <div className="w-16 h-16 rounded-2xl bg-[#2B1B17]/5 flex items-center justify-center mb-4">
          <PrioIcon name="dependency" className="w-8 h-8 text-[#2B1B17]/20" />
        </div>
        <p className="text-[#2B1B17]/60 font-medium">No tasks with dependencies yet</p>
        <p className="text-[#2B1B17]/40 text-sm mt-1">Create tasks and link them to see the graph</p>
      </div>
    );
  }

  return (
    <div className="w-full">
      <p className="sm:hidden text-xs font-bold text-[#2B1B17]/40 mb-2">Swipe sideways to explore →</p>
      {/* Graph Container with Retro Shadow - horizontal rail on small screens */}
      <div className="overflow-x-auto scroll-rail rounded-2xl">
      <div className="relative bg-[#2B1B17] rounded-2xl p-4 shadow-[4px_4px_0_#452215] overflow-hidden min-w-[600px] sm:min-w-0">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-5" style={{
          backgroundImage: `radial-gradient(circle at 2px 2px, rgba(255,255,255,0.3) 1px, transparent 0)`,
          backgroundSize: '24px 24px'
        }} />
        
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="w-full relative z-10"
          style={{ minHeight: 320 }}
        >
          <defs>
            {/* Arrow Marker */}
            <marker 
              id="arrowhead" 
              markerWidth="10" 
              markerHeight="7" 
              refX="9" 
              refY="3.5" 
              orient="auto"
            >
              <polygon points="0 0, 10 3.5, 0 7" fill="#EEA175" />
            </marker>
            
            {/* Glow Filter */}
            <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>

          {/* Connection Lines */}
          {edges.map((edge, index) => {
            const from = coords[edge.from];
            const to = coords[edge.to];
            if (!from || !to) return null;

            const dx = to.x - from.x;
            const dy = to.y - from.y;
            const len = Math.sqrt(dx * dx + dy * dy) || 1;

            // Calculate start and end points on circle edge
            const sx = from.x + (dx / len) * (NODE_R + 4);
            const sy = from.y + (dy / len) * (NODE_R + 4);
            const ex = to.x - (dx / len) * (NODE_R + 4);
            const ey = to.y - (dy / len) * (NODE_R + 4);

            const isHighlighted = hoveredNode === edge.from || hoveredNode === edge.to;

            return (
              <g key={`${edge.from}-${edge.to}-${index}`}>
                {/* Glow line for highlighted edges */}
                {isHighlighted && (
                  <line
                    x1={sx}
                    y1={sy}
                    x2={ex}
                    y2={ey}
                    stroke="#FC703C"
                    strokeWidth={6}
                    strokeOpacity={0.3}
                    strokeLinecap="round"
                  />
                )}
                {/* Main line */}
                <line
                  x1={sx}
                  y1={sy}
                  x2={ex}
                  y2={ey}
                  stroke={isHighlighted ? "#FC703C" : "#EEA175"}
                  strokeWidth={isHighlighted ? 2.5 : 1.5}
                  strokeOpacity={isHighlighted ? 1 : 0.6}
                  markerEnd="url(#arrowhead)"
                  strokeLinecap="round"
                />
              </g>
            );
          })}

          {/* Nodes */}
          {nodes.map((node) => {
            const position = coords[node.id];
            if (!position) return null;

            const color = TIER_COLORS[node.priorityTier] || '#627890';
            const statusColor = STATUS_COLORS[node.status] || '#CCC4BE';
            const isHovered = hoveredNode === node.id;
            const onCriticalPath = criticalSet.has(node.id);
            const isBottleneck = bottleneckId === node.id;
            const isDimmed = hoveredNode && hoveredNode !== node.id && !edges.some(
              e => (e.from === hoveredNode && e.to === node.id) || 
                   (e.to === hoveredNode && e.from === node.id)
            );

            const label = node.title?.length > 12 ? `${node.title.slice(0, 11)}...` : node.title;

            return (
              <g
                key={node.id}
                onMouseEnter={() => setHoveredNode(node.id)}
                onMouseLeave={() => setHoveredNode(null)}
                onClick={() => setHoveredNode((h) => (h === node.id ? null : node.id))}
                style={{ cursor: 'pointer' }}
                opacity={isDimmed ? 0.4 : 1}
              >
                {/* Outer Glow Ring */}
                {(isHovered || node.priorityScore >= 80) && (
                  <circle 
                    cx={position.x} 
                    cy={position.y} 
                    r={NODE_R + 10} 
                    fill={color} 
                    fillOpacity={0.1}
                    filter="url(#glow)"
                  />
                )}

                {/* Critical-path ring */}
                {onCriticalPath && !isBottleneck && (
                  <circle
                    cx={position.x}
                    cy={position.y}
                    r={NODE_R + 8}
                    fill="none"
                    stroke="#FC703C"
                    strokeWidth={2.5}
                    strokeDasharray="6 4"
                    strokeOpacity={0.9}
                  />
                )}

                {/* Bottleneck ring + tag */}
                {isBottleneck && (
                  <circle
                    cx={position.x}
                    cy={position.y}
                    r={NODE_R + 8}
                    fill="none"
                    stroke="#ef4444"
                    strokeWidth={3}
                    strokeOpacity={0.95}
                  />
                )}
                
                {/* Outer Ring */}
                <circle 
                  cx={position.x} 
                  cy={position.y} 
                  r={NODE_R + 4} 
                  fill={color} 
                  fillOpacity={isHovered ? 0.2 : 0.1}
                  stroke={color}
                  strokeWidth={2}
                  strokeOpacity={0.5}
                />
                
                {/* Main Node Circle */}
                <circle
                  cx={position.x}
                  cy={position.y}
                  r={NODE_R}
                  fill={isHovered ? `${color}40` : `${color}25`}
                  stroke={color}
                  strokeWidth={isHovered ? 3 : 2}
                />

                {/* Priority Score */}
                <text
                  x={position.x}
                  y={position.y - 2}
                  textAnchor="middle"
                  fill={color}
                  fontSize={13}
                  fontWeight="600"
                  className="font-mono"
                >
                  {node.priorityScore}
                </text>
                
                {/* Task Title */}
                <text 
                  x={position.x} 
                  y={position.y + 12} 
                  textAnchor="middle" 
                  fill="#FFFFFF" 
                  fontSize={9}
                  fontWeight="500"
                >
                  {label}
                </text>

                {/* Bottleneck tag */}
                {isBottleneck && (
                  <text
                    x={position.x}
                    y={position.y + 24}
                    textAnchor="middle"
                    fill="#ef4444"
                    fontSize={8}
                    fontWeight="800"
                  >
                    BOTTLENECK
                  </text>
                )}

                {/* Status Indicator */}
                <g transform={`translate(${position.x + NODE_R - 6}, ${position.y - NODE_R + 6})`}>
                  <circle r={7} fill="#2B1B17" />
                  <circle r={5} fill={statusColor} />
                  {node.status === 'completed' && (
                    <path 
                      d="M-2.5 0 L-1 1.5 L2.5 -2" 
                      stroke="white" 
                      strokeWidth="1.5" 
                      fill="none"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  )}
                  {node.status === 'in-progress' && (
                    <circle r={2} fill="white" />
                  )}
                </g>
              </g>
            );
          })}
        </svg>
      </div>
      </div>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap gap-3">
        {/* Priority Legend */}
        <div className="flex items-center gap-2 bg-white rounded-full px-4 py-2 shadow-[2px_2px_0_#452215]">
          <PrioIcon name="target" className="w-4 h-4 text-[#2B1B17]/40" />
          <div className="flex items-center gap-2">
            {[
              { color: '#ef4444', label: 'Critical' },
              { color: '#f97316', label: 'High' },
              { color: '#eab308', label: 'Medium' },
              { color: '#22c55e', label: 'Low' },
            ].map(({ color, label }) => (
              <span key={label} className="flex items-center gap-1.5 text-xs text-[#2B1B17]/70">
                <span style={{ background: color }} className="w-2.5 h-2.5 rounded-full" />
                {label}
              </span>
            ))}
          </div>
        </div>

        {/* Status Legend */}
        <div className="flex items-center gap-2 bg-white rounded-full px-4 py-2 shadow-[2px_2px_0_#452215]">
          <PrioIcon name="energy" className="w-4 h-4 text-[#2B1B17]/40" />
          <div className="flex items-center gap-2">
            {[
              { color: '#22c55e', label: 'Done', icon: 'circle-check' },
              { color: '#FC703C', label: 'Active', icon: null },
              { color: '#EEA175', label: 'Pending', icon: null },
            ].map(({ color, label, icon: Icon }) => (
              <span key={label} className="flex items-center gap-1.5 text-xs text-[#2B1B17]/70">
                <span 
                  style={{ background: color }} 
                  className="w-2.5 h-2.5 rounded-full flex items-center justify-center"
                >
                  {Icon ? <PrioIcon name={Icon} size={10} className="text-white" /> : <div className="w-1 h-1 bg-white rounded-full" />}
                </span>
                {label}
              </span>
            ))}
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-2 bg-[#2B1B17] text-white rounded-full px-4 py-2 ml-auto">
          <PrioIcon name="dependency" className="w-4 h-4 text-[#FC703C]" />
          <span className="text-xs font-medium">
            {nodes.length} nodes · {edges.length} edges
          </span>
        </div>

        {/* Planning overlays */}
        {(criticalSet.size > 0 || bottleneckId) && (
          <div className="flex items-center gap-2 bg-white rounded-full px-4 py-2 shadow-[2px_2px_0_#452215]">
            <span className="flex items-center gap-1.5 text-xs text-[#2B1B17]/70">
              <span className="w-2.5 h-2.5 rounded-full border-2 border-dashed border-[#FC703C]" />
              Critical path
            </span>
            {bottleneckId && (
              <span className="flex items-center gap-1.5 text-xs text-[#2B1B17]/70">
                <span className="w-2.5 h-2.5 rounded-full border-[3px] border-[#ef4444]" />
                Bottleneck
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default DependencyGraph;
