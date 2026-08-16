# MailHush website

The public MailHush website is a static Astro project. It is separate from the browser extension and uses Vercel Analytics; see the repository's [privacy and trust boundary](../../README.md#trust-and-privacy-boundary).

Requires Node.js 22.12 or newer.

```bash
npm ci
npm run dev
npm run build
```

The production output is `dist/`. Deployment credentials and generated host links belong in the hosting platform or CI secret store, not in this directory. See [BUILD_INSTRUCTIONS.md](../../BUILD_INSTRUCTIONS.md) for the release and deployment process.
