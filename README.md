# Timeless Objects

A dataset of 1,000 everyday objects whose basic design hasn't changed since they were invented, plus a static
website to explore them on a timeline.

## Run locally

Needs Node 18+. No dependencies to install.

```bash
node merge.mjs   # parts/*.json -> site/timeless-objects.json (validates and removes duplicates)
node serve.mjs   # http://localhost:4321
```

`node serve.mjs [port] [data.json]` points the site at another dataset.

## Deploy to GitHub Pages

1. Create a GitHub repository and push this folder to its `main` branch.
2. In the repository, open **Settings → Pages** and set **Source** to **GitHub Actions**.
3. Every push to `main` runs `.github/workflows/pages.yml`, which rebuilds the dataset and publishes `site/`
   to `https://<user>.github.io/<repo>/`.

`site/` is fully static, so it can also be uploaded as-is to Cloudflare Pages, Netlify or any other static host.

## Files

- `SCHEMA.md` — the entry format.
- `parts/` — source entries, one file per 25 objects (`NN` = category).
- `merge.mjs` — validates `parts/`, removes duplicates across categories, assigns ids.
- `site/` — the website (`index.html`, `styles.css`, `app.js`) and the merged `timeless-objects.json`.
- `serve.mjs` — local static server.

## Site features

- Detail panel with description, place of invention, inventor, materials, why it never changed, FAQs and tags.
- Timeline at the bottom, ordered by invention year and grouped into eras. Moving the mouse toward the left or
  right edge scrolls it (faster closer to the edge); the mouse wheel and touch drag also scroll it; hovering a
  marker shows its details. Era buttons jump to an era.
- Search box (`/` to focus) across names, categories, places, inventors, materials and tags. Arrow keys and Enter
  pick a result and the timeline slides to it; non-matching markers fade out.
- Category filters.
- Each object has a link: `#slug` in the address opens it.
- Images are loaded live from Wikipedia's page-summary API by object name and credited with a link; none are
  stored in the repository. Check each image's license before relying on it publicly.

## Data caveats

Entries were generated with AI assistance. Dates for ancient objects are approximate archaeological estimates
(`invention.approximate`), and each entry has a `confidence` rating. Review entries before treating them as
authoritative.
