# BROKE — Object Studio

Marrickville, Australia. Authenticity in Objects · Romance in Craftsmanship.

A static, dependency-free, headless-Shopify storefront for the BROKE Vitamins issue.

## Stack

- Pure static HTML / CSS / JS — no build step
- Headless Shopify (Storefront GraphQL API, public token)
- Hosted on Cloudflare Pages

## Local development

```bash
python3 -m http.server 4173
# http://localhost:4173
```

The repo is also wired for [Claude Code's preview server](https://claude.com/claude-code) — `.claude/launch.json` will start the same Python server when previewing changes.

## Project layout

```
.
├── index.html              Hero — canvas lens reveal + scroll-to-shop
├── shop/index.html         Catalogue — 4 chapter spreads
├── product/index.html      PDP — variant chips, sticky rail, add-to-bag
├── assets/
│   ├── brand.css           Palette, fonts, drawer/chrome, marquee
│   ├── shopify.js          Storefront client (cart + product queries)
│   ├── cart.js             Top chrome, drawer, toast (shared)
│   ├── emblem.svg          Cracked-vase brand emblem
│   └── fonts/              Gilda Display, Ortica Linear, Figtree
├── _headers                Cloudflare cache + security headers
├── .claude/                Local dev tooling (Claude Code launch config)
└── README.md
```

## Shopify

- Domain: `broke-studios-xyz.myshopify.com`
- API version: `2025-01`
- Storefront token is in `assets/shopify.js`. This is the **public** Storefront token by design — Shopify ships it to the browser; never paste an Admin API token here.
- Cart ID is persisted in `localStorage` under `broke:cartId`.
- Checkout redirects to `cart.checkoutUrl` (Shopify-hosted).

## ED 01 lighter model

The scroll experience at `/release/ed-01/` loads `assets/models/ed01-lighter.glb`.
Editable Blender source, reference assessment, and studio renders are in
`design/lighter/`. The reconstruction uses the supplied 70 mm height and 10 mm
thickness; the approximately 41.4 mm width is inferred from the photograph.

Rebuild with Blender 4.5 or later:

```bash
blender --background --factory-startup --python design/lighter/build_lighter.py
```

Append `-- --skip-renders` to regenerate only the source and GLB. The GLB includes
brushed finish textures and a separate `LidPivot` for the scroll-driven opening.
See `design/lighter/REFERENCE-ASSESSMENT.md` for observed details and assumptions.

## Brand assets

Brand source files (logo masters, the full brand book PDF, etc.) live in a separate folder that's gitignored. The fonts, emblem, palette tokens, and a digest of the guidelines are included here.

Concepts © Bedrock Media Group.

## Deployment

Pushes to `main` deploy automatically to Cloudflare Pages. Branch pushes get preview URLs.
