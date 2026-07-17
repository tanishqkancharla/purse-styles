# AGENTS.md

## Cursor Cloud specific instructions

`purse-styles` is a client-side TypeScript CSS-in-JS library (React peer dependency). There is **no application server, database, or background service** to run — it is consumed as an npm package.

Dependencies are installed by the startup update script (`npm install`), so you normally don't need to install anything manually.

Commands (defined in `package.json`):

- Type-check ("lint"): `npm run check` (`tsc --noEmit`; there is no ESLint).
- Test: `npm test` runs Vitest in **watch mode**. For a single non-interactive run use `npx vitest run`. Setting `CI=1` disables `test.only`.
- Build: `npm run build` (esbuild via `tsx scripts/build.ts`) emits `dist/index.js` plus `.d.ts` files. `dist/` is gitignored.
- Bundle size: `npm run bundlesize` requires `dist/` to exist first (run `npm run build` beforehand).

To manually verify the built library end-to-end, import from `./dist/index.js` in a Node ESM script and use `style()`, `defineVars()`, and `createInMemoryStyleApi()` to inspect generated CSS via `api.styleRulesRef.current` (the tests in `src/*.test.ts` show the expected output format).
