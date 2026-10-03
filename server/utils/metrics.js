/**
 * Minimal Prometheus-compatible metrics (no client lib — hand-rolled exposition).
 * Counters + latency sums/counts per route; DB latency; cache hits/misses;
 * job outcomes; AI calls. GET /api/metrics exposes text format for scraping.
 * NOTE: /api/metrics is unauthenticated by design (scraper convention) —
 * restrict it at the network layer in production.
 */
export const httpStats = new Map(); // "METHOD route" -> { count, errors, sumMs, slow }
export const dbStats = { count: 0, sumMs: 0, slow: 0 };
export const jobStats = { completed: 0, failed: 0 };
export const aiStats = { calls: 0, failures: 0 };

const SLOW_MS = Number(process.env.SLOW_REQUEST_MS) || 1000;

export const recordHttp = (method, route, status, ms) => {
    const k = `${method} ${route}`;
    let s = httpStats.get(k);
    if (!s) {
        s = { count: 0, errors: 0, sumMs: 0, slow: 0 };
        httpStats.set(k, s);
    }
    s.count++;
    s.sumMs += ms;
    if (status >= 500) s.errors++;
    if (ms > SLOW_MS) s.slow++;
};

export const recordDb = (ms) => {
    dbStats.count++;
    dbStats.sumMs += ms;
    if (ms > 200) dbStats.slow++;
};

const esc = (s) => String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"');

export const renderMetrics = (cacheMeta) => {
    const lines = [];
    lines.push('# HELP priosync_http_requests Total HTTP requests by route and status class.');
    lines.push('# TYPE priosync_http_requests counter');
    for (const [route, s] of [...httpStats.entries()].sort()) {
        const [method, ...rest] = route.split(' ');
        lines.push(`priosync_http_requests{method="${esc(method)}",route="${esc(rest.join(' '))}"} ${s.count}`);
    }
    lines.push('# HELP priosync_http_errors Total HTTP 5xx by route.');
    lines.push('# TYPE priosync_http_errors counter');
    for (const [route, s] of [...httpStats.entries()].sort()) {
        const [method, ...rest] = route.split(' ');
        lines.push(`priosync_http_errors{method="${esc(method)}",route="${esc(rest.join(' '))}"} ${s.errors}`);
    }
    lines.push('# HELP priosync_http_latency_ms_sum Request latency sum by route.');
    lines.push('# TYPE priosync_http_latency_ms_sum counter');
    for (const [route, s] of [...httpStats.entries()].sort()) {
        const [method, ...rest] = route.split(' ');
        lines.push(`priosync_http_latency_ms_sum{method="${esc(method)}",route="${esc(rest.join(' '))}"} ${Math.round(s.sumMs)}`);
    }
    lines.push('# HELP priosync_http_slow Requests slower than threshold.');
    lines.push('# TYPE priosync_http_slow counter');
    for (const [route, s] of [...httpStats.entries()].sort()) {
        const [method, ...rest] = route.split(' ');
        lines.push(`priosync_http_slow{method="${esc(method)}",route="${esc(rest.join(' '))}"} ${s.slow}`);
    }
    lines.push('# HELP priosync_db_queries Total Postgres queries.');
    lines.push('# TYPE priosync_db_queries counter');
    lines.push(`priosync_db_queries ${dbStats.count}`);
    lines.push('# HELP priosync_db_latency_ms_sum Postgres latency sum.');
    lines.push('# TYPE priosync_db_latency_ms_sum counter');
    lines.push(`priosync_db_latency_ms_sum ${Math.round(dbStats.sumMs)}`);
    lines.push('# HELP priosync_db_slow Queries slower than 200ms.');
    lines.push('# TYPE priosync_db_slow counter');
    lines.push(`priosync_db_slow ${dbStats.slow}`);
    lines.push('# HELP priosync_cache Cache hits/misses for hot reads.');
    lines.push('# TYPE priosync_cache counter');
    lines.push(`priosync_cache{result="hit"} ${cacheMeta.hits}`);
    lines.push(`priosync_cache{result="miss"} ${cacheMeta.misses}`);
    lines.push('# HELP priosync_jobs Background job outcomes.');
    lines.push('# TYPE priosync_jobs counter');
    lines.push(`priosync_jobs{result="completed"} ${jobStats.completed}`);
    lines.push(`priosync_jobs{result="failed"} ${jobStats.failed}`);
    lines.push('# HELP priosync_ai_calls LLM calls and failures.');
    lines.push('# TYPE priosync_ai_calls counter');
    lines.push(`priosync_ai_calls{result="ok"} ${aiStats.calls - aiStats.failures}`);
    lines.push(`priosync_ai_calls{result="failed"} ${aiStats.failures}`);
    return `${lines.join('\n')}\n`;
};
