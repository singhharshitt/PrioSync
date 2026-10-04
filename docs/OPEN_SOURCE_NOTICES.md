# Open-Source Notices

PrioSync adds **zero new runtime npm dependencies** through its external-tool
program; icons are vendored SVG source (no icon package is installed).
Everything below was already in the build, is vendored source, or is loaded
as a font; listed here because icon and font licensing was explicitly
reviewed.

| Dependency / Asset | Version | Source | License | Usage in PrioSync | Attribution required? | Notes |
|---|---|---|---|---|---|---|
| Tabler Icons (outline set) | vendored 2026-10-04 (63 glyphs in `client/src/components/icons/iconAssets.jsx`) | https://github.com/tabler/tabler-icons | MIT (verified; (c) 2020-2026 Pawel Kuna) | Sole runtime stroke-icon collection, rendered through `client/src/components/icons/PrioIcon.jsx` | No (MIT; keep this attribution) | Retrieved via Better Icons CLI (`npx -y better-icons@1.0.4 get tabler:<id>`), vendored as JSX - no CDN/CLI at runtime. |
| Simple Icons (brand marks) | vendored 2026-10-04 (github, x, linkedin in `iconAssets.jsx`) | https://github.com/simple-icons/simple-icons | CC0 1.0 Universal (verified) | Footer/social brand glyphs via PrioIcon | No (CC0); do not imply endorsement | Logos remain trademarks of their owners; use only for nominative references. |
| lucide-react | REMOVED (was ^0.575.0, ISC) | https://github.com/lucide-icons/lucide | ISC | None - fully migrated to vendored Tabler assets behind PrioIcon | No | Not present in package.json/lockfile/node_modules. |
| Inter, Plus Jakarta Sans, IBM Plex Mono | Google Fonts (remote stylesheet link) | https://fonts.google.com | SIL Open Font License 1.1 | UI, headings, and technical-data typefaces via `index.html` link | No (OFL allows web use; do not redistribute renamed files) | Self-hosting later = keep OFL text with the files. |
| better-auth/better-icons | 1.0.4 (dev-time only, never installed) | https://github.com/better-auth/better-icons | MIT (verified, (c) 2026 Better Auth Inc) | Icon discovery CLI only (`search`/`get`); produced the vendored Tabler/Simple Icons assets | Only if code were copied (it is not) | Pinned invocation: `npx -y better-icons@1.0.4` (1.0.5 does not exist on npm). Retrieved icons inherit their collection license - recorded above. |
| petergyang/no-ai-slop | upstream main (never copied) | https://github.com/petergyang/no-ai-slop | MIT (verified, (c) 2026 Peter Yang) | Agent writing guidance (external); house rules distilled originally into `docs/PRODUCT_WRITING_GUIDELINES.md` | No verbatim text taken | - |
| jalaalrd/anti-ai-slop-writing | upstream main (never copied) | https://github.com/jalaalrd/anti-ai-slop-writing | **Unverified - README claims MIT but repo contains no LICENSE file (404)** | Ideas only; nothing copied | N/A - nothing taken | Do not copy text from this repo until a license file exists. |
| superdesigndev/superdesign (historical) | not used | https://github.com/superdesigndev/superdesign | AGPLv3 + commercial Enterprise carve-out | None - explicitly rejected | N/A | Copying would infect this codebase (AGPL) or breach the commercial terms. The maintained skill is a separate MIT project used externally only. |

Verified from upstream LICENSE/README/package.json on 2026-10-04. Re-verify before upgrading any pinned tool or adding any new asset.
