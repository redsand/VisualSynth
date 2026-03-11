# Release Checklist

Run `npm run release:check` before cutting a production build.
Run `npm run release:check:index` when validating fallback entrypoint behavior.

Current release gate:
- `npm run verify:packaging`
- `npm run build`
- `npm test`

Required manual checks before release:
- Review known unsupported behavior for imported Milkwave custom `warp` / `comp` shaders.
- Review the latest `v1.0` visual regression report (`docs/visual-regression-curated-bootstrap-cutover/report.md`) before signing off on render parity.
- For unstable presets (repeat spread flagged), review repeat diagnostics before sign-off.
- Confirm no new renderer entrypoint drift has been introduced outside the shared runtime helpers.
