Copies of `src/lib/engine.ts` and `src/lib/detectors.ts` from the extension.
Vercel builds only `website/why`, so the site cannot import them from the repo
root. `tests/website-engine.test.js` fails when a copy drifts; refresh with:

    cp src/lib/engine.ts src/lib/detectors.ts website/why/src/lib/engine/
