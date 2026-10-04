# External Tools - Audit, Decisions, and Usage

Evaluated 2026-10-04 against live upstream READMEs, package manifests, and
license files. Nothing below is installed in this repo or bundled into the
app; integrations are native implementations informed by these sources.

## Decision matrix

| Project | Category | Purpose | Maintenance | License | Runtime dep? | Build dep? | Dev-only? | Network needed? | Telemetry? | User data exposure? | Security risks | Commercial concerns | Action |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| better-auth/better-icons 1.0.4 | DEV TOOL (CLI + MCP) | Search 200k+ icons (Iconify index) | Active (30 commits, 1.3k stars) | MIT (verified full text, (c) 2026 Better Auth Inc) | No | No | Yes | Yes - queries remote icon index | None in manifest (commander/chalk/MCP SDK only, no postinstall) | None if used for discovery; pasted SVGs are static | npx executes remote code - pin version, inspect before upgrade | Retrieved icons carry their own collection licenses (Tabler MIT, Simple Icons CC0...) - verify per icon | USE ONLY AS DEV TOOL, pinned `npx -y better-icons@1.0.4` (1.0.5 does not exist on npm); source of the vendored runtime assets |
| petergyang/no-ai-slop | AI AGENT SKILL | 20+ AI-slop writing patterns | Active (11.8k stars, eval harness) | MIT (verified full text, (c) 2026 Peter Yang) | No | No | Agent env only | No (markdown rules) | No | None | None (no code executed) | None | USE ONLY AS AGENT SKILL (external) + distill into docs/PRODUCT_WRITING_GUIDELINES.md |
| humanize-ai-text (topic, 43 repos) | RESEARCH SOURCE | Surveyed only | Mixed; top blader/humanizer 53.8k stars, lynote-ai/humanize-text 3.2k | Varies | No | No | N/A | N/A | N/A | N/A | Topic dominated by detector-evasion/bypass tooling and LLM-rewrite pipelines | Evasion purpose conflicts with product goals | DO NOT USE any repo; principle (concrete > generic) already covered by writing skills |
| jalaalrd/anti-ai-slop-writing | AI AGENT SKILL | Banned vocab + patterns | Young (496 stars, 6 commits) | CLAIMED MIT in README but **no LICENSE file in repo (404 verified)** - treat as unlicensed | No | No | Agent env only | No | No | None | None (no code executed) | Cannot copy text - no grant proven | BORROW PRINCIPLES ONLY (no verbatim copying); no-ai-slop is the primary reference |
| superdesigndev/superdesign | NOT SUITABLE | Historical IDE extension | **Unmaintained (README says so)** | **AGPLv3 + commercial Enterprise carve-out** - copyleft, forbidden to copy into this product | No | No | No | N/A | N/A | N/A | AGPL infection risk | Commercial files require paid subscription | DO NOT USE, do not copy |
| superdesigndev/superdesign-skill | DESIGN TOOL (agent skill) | Maintained design skill + CLI driving superdesign.dev | Active (621 stars, 140 commits) | MIT (per upstream footer) | No | No | Agent env only | Yes - CLI requires `superdesign login` + account, sends design context to their service | Per their terms, not audited here | Design context only, and only what the developer pastes/sends | Account-bound external service | None for workflow use | USE ONLY AS DESIGN WORKFLOW (external, opt-in per developer); never in build |

## Developer setup (all optional, none required to build)

```bash
# Icon discovery (pinned - never bare `npx better-icons`)
npx -y better-icons@1.0.4 search "bottleneck" --prefix tabler
npx -y better-icons@1.0.4 get tabler:bottleneck   # stdout SVG
# Vendor into client/src/components/icons/iconAssets.jsx (dev-time generator,
# kept outside the repo), register the key in PrioIcon.jsx REGISTRY, and record
# the collection license in docs/OPEN_SOURCE_NOTICES.md.

# Writing quality (agent environment of your choice, not this repo)
# npx skills add petergyang/no-ai-slop --skill no-ai-slop --global --yes
# House rules live in docs/PRODUCT_WRITING_GUIDELINES.md regardless.

# Design workflow (requires superdesign.dev account + login)
# npx skills add superdesigndev/superdesign-skill
# npm install -g @superdesign/cli@latest
```

## Boundaries enforced

- Production bundle contains zero code, skills, CLIs, or MCP servers from any project above.
- Retrieved SVGs, if ever added, must be Tabler-collection (MIT) or another
  pre-approved collection recorded in `docs/OPEN_SOURCE_NOTICES.md`, vendored
  into `iconAssets.jsx`, and registered in `PrioIcon.jsx`.
- No user data (tasks, goals, sessions, credentials) is sent to any external tool by PrioSync code.
- The deterministic engine boundary (AI parses -> Zod validates -> engine decides -> Postgres persists) is untouched by all of the above.
