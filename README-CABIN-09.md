# CABIN-09 theme — implementation notes

Base theme: **Shopify Horizon 4.1.5** (Online Store 2.0, theme-blocks architecture).
Everything CABIN-09-specific is prefixed `cabin-` / `scent-` / `metric-` and lives in the files listed below. Stock Horizon files are untouched except for the integration points marked *edited* (listed below the table).

## Files

| Area | File | Purpose |
|---|---|---|
| Tokens | `assets/cabin-design-tokens.css` | Design tokens (`--cabin-*`), utility classes (`.cabin-display`, `.cabin-serif`, `.cabin-label`, `.cabin-surface`, `.cabin-pill`, `.cabin-btn`, `.cabin-input` …) and the Horizon font bridge (`html:root`) that points Horizon's heading / subheading / body / accent families at Syne / Inter / Inter / Cormorant. |
| Layout | `layout/theme.liquid` *(edited)* | Google Fonts preconnect + stylesheet (Syne, Cormorant Garamond, Inter), tokens stylesheet after `base.css`, `cabin-theme` on `<body>`. |
| Settings | `config/settings_data.json` *(edited)* | Colour palette → canvas `#0B0B0C` / display `#F5F5F7` / text `#D6D6D6` / hairline `#242428`; 2px button + input radii, 4px cards; h1–h3 uppercase, loose tracking. |
| Scent fan | `snippets/product-scent-fan.liquid` | 3-card radial fan (Top / Heart / Base) behind the vessel cut-out. `mode: 'grid'` (collapsed → −14°/0°/+14° on card hover/focus) or `mode: 'pdp'` (fanned, notes are buttons). Also carries the modal CSS. |
| | `assets/scent-modal.js` | Note detail dialog (profile, cabin airflow chemistry, molecular weight), focus trap, PDP reveal on intersection. |
| | `sections/product-scent-hero.liquid` | PDP wrapper for the fan with editor fallback notes. |
| Metrics | `sections/product-metrics-panel.liquid` | 5-segment intensity gauge (`role="meter"`), longevity in weeks, 3-segment seasonality pill, animated note-prominence stacked bar; optional mood + gender blocks. |
| Waitlist | `snippets/cabin-notify-form.liquid`, `sections/cabin-notify-me.liquid`, `assets/cabin-waitlist.js` | Native `{% form 'customer' %}` posting `contact[tags] = waitlist, notify:<product-handle>` (+ `-<variant id>` on multi-variant products); works without JS, enhanced with fetch; re-renders itself on Horizon's `shopify:product:select` so it follows the variant picker. |
| Upsell | `sections/cabin-refill-upsell.liquid` | Refill product + native `{% form 'product' %}` with Shopify Subscriptions selling-plan radios. |
| FAQ | `sections/cabin-faq.liquid` | Native `<details>` accordion; preset ships Leak integrity / Heat durability / Augeo surface warning. |
| Cards | `snippets/card-gallery.liquid`, `blocks/_product-card-gallery.liquid`, `blocks/_featured-product-gallery.liquid` *(edited)* | Product cards render the grid fan instead of the static image when the product has scent notes (block setting **Show scent fan on hover** — default on for product cards, off for the Featured product section). Editorial grids are handled. |
| Template | `templates/product.json` *(edited)* | Order: main product → scent fan hero → metrics panel → refill upsell → FAQ → waitlist → recommendations. |

Stock files touched: `layout/theme.liquid`, `config/settings_data.json`, `snippets/card-gallery.liquid`, `blocks/_product-card-gallery.liquid`, `blocks/_featured-product-gallery.liquid`, `templates/product.json`. The font bridge lives on `html:root` so Horizon's Typography / Buttons / Cart role settings keep working.

Horizon has no `snippets/card-product.liquid` (that is a Dawn/Trade file); its equivalent is `snippets/card-gallery.liquid`, rendered by the `_product-card-gallery` block on every product grid (collections, search, featured collections, recommendations).

## Custom data (Settings → Custom data)

Metaobject **`scent_note`**: `name`, `alias`, `profile` (what it smells like), `chemistry` (why it works in a cabin), `molecular_weight`.

Product metafields, namespace **`cabin`**:

| Key | Type | Used by |
|---|---|---|
| `top_note`, `heart_note`, `base_note` | Metaobject reference → `scent_note` (a plain single-line text name also works) | Fan, modal, card fan |
| `season` | Single line text: `summer` / `winter` / `all-season` | Metrics |
| `prominence_top`, `prominence_heart`, `prominence_base` | Integer 0–100 (normalised to 100) | Metrics |
| `longevity_min_weeks`, `longevity_max_weeks` | Integer | Metrics |
| `longevity_label` | Single line text (optional override) | Metrics |
| `intensity` (fallback `sillage`) | Integer 1–5 (1 Subtle · 2 Close · 3 Present · 4 Bold · 5 Commanding) | Metrics |
| `mood_tags` | List of single line text | Metrics (optional block) |
| `gender_position` | Integer 0–100 | Metrics (optional block) |
| `scent_family` | Single line text | Metrics header badge |

Every section has editor fallback values used only while a metafield is empty, so the product page previews completely on a store with no custom data. A metafield always wins over its fallback. Collection-card fans only appear once at least one note metafield is set.

## Editor wiring

1. Products → Default product template already carries all sections in the required order. Pick the refill SKU in **Refill subscription upsell → Product**; until one is picked the section renders nothing on the storefront (the editor shows a placeholder).
2. Waitlist tags: build Shopify Email segments on `customer_tags CONTAINS 'notify:<handle>'`. Set **Customer waitlist → Visibility** to *Only when unavailable* once the catalogue is live.
3. Vessel imagery: the fan reads best with a transparent PNG/WebP cut-out as the featured image.
4. Waitlist states without JavaScript: errors are scoped to the form that posted (`contact[id]` → `form.id`); success relies on Shopify redirecting to `?customer_posted=true#notify-<key>` (the form is shown as posted only when it is the URL target). Confirm both once on a dev store with JavaScript disabled — every other customer form on the page (the footer newsletter) shares Shopify's page-global `form` state, which is why the scoping exists.

## Preview / validation

- `shopify theme check` runs clean (only Horizon's six pre-existing warnings). `.theme-check.yml` ignores `docs/`; `.shopifyignore` keeps `docs/` and `.claude/` out of uploads.
- A local liquidjs harness (session scratchpad, not part of the theme) rendered every section and the card grid at 375 / 768 / 1440 px with no horizontal overflow; fan geometry, modal focus management and the waitlist form were exercised in a real browser. Final verification should still be done on a Shopify preview theme — the harness stubs Shopify-specific semantics (integer division, form objects, image CDN).
