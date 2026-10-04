import { TABLER_ASSETS, BRAND_ASSETS } from './iconAssets.jsx';

/**
 * PrioIcon - the only sanctioned way to render an icon in PrioSync UI.
 *
 *   <PrioIcon name="bottleneck" />
 *   <PrioIcon name="alert-triangle" size="sm" className="..." />
 *
 * `name` accepts a semantic alias (task, bottleneck, risk...) or a vendored
 * asset key (alert-triangle, bolt, github...). Assets are LOCAL vendored SVG
 * paths (see iconAssets.jsx) - no CDN, no CLI, no MCP at runtime.
 *
 * Accessibility: decorative by default (aria-hidden). Pass `label` for the
 * rare icon-only control without visible text - the accessible name then
 * comes from label, not from surrounding markup.
 */
const SIZES = { xs: 12, sm: 16, md: 20, lg: 24, xl: 32 };

const tabler = (key) => ({ set: 'tabler', key: `tabler_${key}` });
const brand = (key) => ({ set: 'brand', key: `simple-icons_${key}` });

const REGISTRY = {
  // Semantic planning vocabulary (preferred in product code)
  task: tabler('list-check'),
  goal: tabler('target'),
  project: tabler('layout-kanban'),
  dependency: tabler('git-branch'),
  criticalPath: tabler('route'),
  bottleneck: tabler('hourglass'),
  deadlineRisk: tabler('calendar-clock'),
  capacity: tabler('gauge'),
  replan: tabler('repeat'),
  focus: tabler('crosshair'),
  energy: tabler('bolt'),
  scope: tabler('scan'),
  commitment: tabler('shield-check'),
  calendar: tabler('calendar'),
  timer: tabler('stopwatch'),
  analytics: tabler('chart-bar'),
  settings: tabler('settings'),
  dashboard: tabler('layout-dashboard'),
  planner: tabler('calendar-cog'),
  profile: tabler('user'),

  // Direct asset keys (mechanical 1:1 migration; prefer semantic names)
  'activity': tabler('activity'),
  'alert-circle': tabler('alert-circle'),
  'alert-triangle': tabler('alert-triangle'),
  'arrow-right': tabler('arrow-right'),
  'arrows-up-down': tabler('arrows-up-down'),
  'award': tabler('award'),
  'bolt': tabler('bolt'),
  'brain': tabler('brain'),
  'calculator': tabler('calculator'),
  'calendar-clock': tabler('calendar-clock'),
  'calendar-cog': tabler('calendar-cog'),
  'chart-bar': tabler('chart-bar'),
  'check': tabler('check'),
  'checkbox': tabler('checkbox'),
  'chevron-down': tabler('chevron-down'),
  'chevron-right': tabler('chevron-right'),
  'chevron-up': tabler('chevron-up'),
  'circle': tabler('circle'),
  'circle-check': tabler('circle-check'),
  'clipboard-list': tabler('clipboard-list'),
  'clock': tabler('clock'),
  'crosshair': tabler('crosshair'),
  'device-floppy': tabler('device-floppy'),
  'edit': tabler('edit'),
  'eye': tabler('eye'),
  'eye-off': tabler('eye-off'),
  'flame': tabler('flame'),
  'gauge': tabler('gauge'),
  'git-branch': tabler('git-branch'),
  'hourglass': tabler('hourglass'),
  'layout-dashboard': tabler('layout-dashboard'),
  'layout-grid': tabler('layout-grid'),
  'link': tabler('link'),
  'list': tabler('list'),
  'list-check': tabler('list-check'),
  'lock': tabler('lock'),
  'logout': tabler('logout'),
  'mail': tabler('mail'),
  'menu': tabler('menu'),
  'player-pause': tabler('player-pause'),
  'player-play': tabler('player-play'),
  'player-skip-forward': tabler('player-skip-forward'),
  'plus': tabler('plus'),
  'refresh': tabler('refresh'),
  'repeat': tabler('repeat'),
  'rotate-clockwise': tabler('rotate-clockwise'),
  'route': tabler('route'),
  'scan': tabler('scan'),
  'search': tabler('search'),
  'shield': tabler('shield'),
  'shield-check': tabler('shield-check'),
  'sparkles': tabler('sparkles'),
  'stack': tabler('stack'),
  'stopwatch': tabler('stopwatch'),
  'target': tabler('target'),
  'trash': tabler('trash'),
  'trending-up': tabler('trending-up'),
  'trophy': tabler('trophy'),
  'user': tabler('user'),
  'x': tabler('x'),
  'github': brand('github'),
  'twitter': brand('x'),
  'linkedin': brand('linkedin'),
};

const resolveSize = (size) => {
  if (typeof size === 'number' && Number.isFinite(size)) return size;
  return SIZES[size] ?? SIZES.md;
};

export const PrioIcon = ({
  name,
  size = 'md',
  className,
  strokeWidth = 2,
  label,
  ...rest
}) => {
  const entry = REGISTRY[name];
  if (!entry) return null;
  const px = resolveSize(size);
  const a11y = label
    ? { role: 'img', 'aria-label': label }
    : { 'aria-hidden': true };
  const art =
    entry.set === 'brand' ? BRAND_ASSETS[entry.key] : TABLER_ASSETS[entry.key];
  if (!art) return null;
  if (entry.set === 'brand') {
    return (
      <svg
        viewBox="0 0 24 24"
        width={px}
        height={px}
        fill="currentColor"
        className={className}
        {...a11y}
        {...rest}
      >
        {art}
      </svg>
    );
  }
  return (
    <svg
      viewBox="0 0 24 24"
      width={px}
      height={px}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...a11y}
      {...rest}
    >
      {art}
    </svg>
  );
};

export default PrioIcon;
