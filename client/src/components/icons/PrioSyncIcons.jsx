/* eslint-disable react-refresh/only-export-components */
import PrioIcon from './PrioIcon.jsx';

/**
 * PrioSync semantic icon registry.
 *
 * Components reference THESE names (Task, Bottleneck, Risk...) instead of
 * icon-library identifiers. Backed by LOCAL vendored assets (Tabler outline
 * set + Simple Icons brands) rendered through PrioIcon - no icon library
 * in the bundle, no remote fetches.
 *
 * Discovery workflow (dev-time only, never bundled): search candidates with
 * the Better Icons CLI (`npx -y better-icons@1.0.4 search <term>`), verify
 * the collection license, vendor via `better-icons get`, regenerate
 * iconAssets.jsx.
 */
const make = (name) => (props) => <PrioIcon name={name} {...props} />;

export const PrioSyncIcons = {
  // Core planning vocabulary (required semantic categories)
  Task: make('task'),
  Goal: make('goal'),
  Project: make('project'),
  Dependency: make('dependency'),
  CriticalPath: make('criticalPath'),
  Bottleneck: make('bottleneck'),
  Deadline: make('deadlineRisk'),
  Risk: make('deadlineRisk'),
  Capacity: make('capacity'),
  Replan: make('replan'),
  Focus: make('focus'),
  Energy: make('energy'),
  Scope: make('scope'),
  Commitment: make('commitment'),
  Calendar: make('calendar'),
  Timer: make('timer'),
  Analytics: make('analytics'),
  Settings: make('settings'),

  // Navigation extras (same style, same local assets)
  Dashboard: make('dashboard'),
  Planner: make('planner'),
  Profile: make('profile'),
};

export default PrioSyncIcons;
