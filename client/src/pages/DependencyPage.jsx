import { useEffect } from 'react';
import { GitBranch, RefreshCw } from 'lucide-react';
import Sidebar from '../components/Sidebar.jsx';
import Navbar from '../components/Navbar.jsx';
import DependencyGraph from '../components/DependencyGraph.jsx';
import useTasks from '../hooks/useTasks.js';

const DependencyPage = () => {
  const { dagData, fetchDAG, fetchTasks, loading } = useTasks();

  useEffect(() => {
    fetchDAG();
    fetchTasks({ limit: 200 });
  }, [fetchDAG, fetchTasks]);

  return (
    <div className="flex h-screen overflow-hidden bg-bg-light">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Navbar title="Task Dependencies" />
        <main className="flex-1 overflow-y-auto p-6 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-[#64748b]">
                Visualizing {dagData?.nodes?.length || 0} tasks and {dagData?.edges?.length || 0} dependency relationships
              </p>
            </div>
            <button
              onClick={fetchDAG}
              className="btn-secondary flex items-center gap-2 text-sm py-2 px-4"
            >
              <RefreshCw size={13} /> Refresh
            </button>
          </div>

          <div className="card p-5">
            <div className="flex items-center gap-2 mb-4">
              <GitBranch size={16} className="text-[#627890]" />
              <h2 className="font-semibold text-white text-sm">Dependency Graph (DAG)</h2>
            </div>
            {loading ? (
              <div className="h-64 flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <DependencyGraph graph={dagData} />
            )}
          </div>

          <div className="card p-5">
            <h3 className="font-semibold text-white text-sm mb-3">How the DSA Engine Works</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                {
                  step: '1',
                  title: 'DAG Construction',
                  desc: 'Tasks and their dependencies form a Directed Acyclic Graph. Cycle detection (DFS) prevents circular dependencies.',
                  color: 'var(--primary)',
                },
                {
                  step: '2',
                  title: 'Max Heap Ranking',
                  desc: 'All tasks are loaded into a Max Heap priority queue. O(log n) insert and extract-max operations keep ranking fast.',
                  color: 'var(--accent)',
                },
                {
                  step: '3',
                  title: 'Greedy Scheduling',
                  desc: 'The algorithm selects the highest-scored available task while respecting topological dependency order.',
                  color: '#627890',
                },
              ].map(({ step, title, desc, color }) => (
                <div key={step} className="p-4 rounded-xl bg-[#1e2d42] border border-white/5">
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold text-white mb-3"
                    style={{ background: color }}
                  >
                    {step}
                  </div>
                  <h4 className="text-sm font-semibold text-white mb-1">{title}</h4>
                  <p className="text-xs text-[#64748b] leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="card p-5">
            <h3 className="font-semibold text-white text-sm mb-3">Priority Score Formula</h3>
            <div className="p-4 rounded-xl bg-[#1e2d42] font-mono text-sm text-accent overflow-x-auto">
              Score = (Urgency x 0.30 + Importance x 0.25 + DeadlineProximity x 0.25 + Ease x 0.20) x 20
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
              {[
                { label: 'Urgency', weight: '30%', color: '#ef4444' },
                { label: 'Importance', weight: '25%', color: '#f97316' },
                { label: 'Deadline', weight: '25%', color: '#eab308' },
                { label: 'Ease', weight: '20%', color: '#22c55e' },
              ].map(({ label, weight, color }) => (
                <div key={label} className="p-3 rounded-lg bg-[#273751] border border-white/5">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-[#94a3b8]">{label}</span>
                    <span className="text-xs font-bold" style={{ color }}>{weight}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-[#1e2d42] overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: weight, background: color }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default DependencyPage;
