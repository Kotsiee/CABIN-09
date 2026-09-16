# CABIN-09 Design System

Storefront design system and bespoke product-page components for the CABIN-09 Shopify store (Trade theme, Online Store 2.0).

```
theme/
  assets/
    cabin-design-tokens.css      tokens + utility classes (load globally)
    scent-modal.js               note easter-egg modal, focus trap, PDP fan reveal
    cabin-waitlist.js            notify-me form enhancement
  snippets/
    product-scent-fan.liquid     note fan (grid hover + PDP fanned) incl. scoped CSS
    cabin-notify-form.liquid     native customer-form capture module incl. scoped CSS
  sections/
    product-scent-hero.liquid    PDP wrapper for the fan (theme-editor addable)
    product-metrics-panel.liquid seasonality, prominence, longevity, sillage, mood, gender
    cabin-release-backlog.liquid expandable upcoming-release list with waitlist per item
    cabin-notify-me.liquid       PDP out-of-stock / unreleased capture
```

---

## 1. Foundations

### 1.1 Colour

| Token | Value | Use |
|---|---|---|
| `--cabin-canvas` | `#0B0B0C` | Page background. Never pure black; it crushes product shadows. |
| `--cabin-elevation` | `#141416` | Cards, panels, modal, inputs on canvas. |
| `--cabin-elevation-2` | `#1B1B1E` | Second lift: tooltips, note-card gradient top. |
| `--cabin-border` | `#242428` | All hairlines, 1px. |
| `--cabin-border-strong` | `#34343A` | Ghost buttons, dividers that need presence. |
| `--cabin-text` | `rgba(214,214,214,.85)` | Body text. |
| `--cabin-text-muted` | `rgba(214,214,214,.55)` | Labels, captions, secondary. |
| `--cabin-display` | `#F5F5F7` | Headings, values, anything that must be read first. |
| `--cabin-brass` | `#B08D57` | The only accent. Active states, eyebrows, key hairlines. |
| `--cabin-brass-light` | `#EBDDBE` | Top-note ramp step. |
| `--cabin-brass-deep` | `#5E4A2C` | Base-note ramp step. |
| `--cabin-brass-glow` | `rgba(176,141,87,.18)` | Focus rings, active pill fill, meter track. |
| `--cabin-state-ok` / `--cabin-state-error` | `#8FB08A` / `#C76B6B` | Form states only. Never decorative. |

Rules
- One accent. Brass carries "active", "important", "interactive". Do not introduce a second hue.
- Data marks use the brass ramp (`--cabin-ramp-top/heart/base`). Top→Base is ordinal (lifespan order), so a single-hue lightness ramp is correct; adjacent steps validated at ΔE ≥ 23 with 2px surface gaps between segments.
- Text always wears text tokens, never a series colour.

### 1.2 Typography

| Role | Family | Weight | Tracking | Case | Class |
|---|---|---|---|---|---|
| Display / headings | Syne | 600 | `+0.2em` | UPPER | `.cabin-display` (`--xl --lg --md --sm`) |
| Editorial accent | Cormorant Garamond | 400 | `+0.08em` | Sentence | `.cabin-serif` (`--lg --md --italic`) |
| UI / body | Inter | 400 / 500 | 0 | Sentence | `.cabin-body`, `.cabin-body--medium` |
| Micro labels | Inter | 500 | `+0.14em` | UPPER | `.cabin-label` (`--brass`) |

Scale: `--cabin-fs-2xs` 10px · `xs` 11 · `sm` 13 · `md` 15 · `lg` 20 · `xl` 28 · `2xl` clamp(32–52).

Voice pairing: Syne for the product code ("OUD 01"), Cormorant for the note name and any line that should feel authored, Inter for everything a customer must parse quickly (prices, specs, forms).

Font loading (in `layout/theme.liquid`, `<head>`; Syne is not in Shopify's font library):

```liquid
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Syne:wght@600;700&family=Cormorant+Garamond:ital,wght@0,400;0,500;1,400&family=Inter:wght@400;500&display=swap">
{{ 'cabin-design-tokens.css' | asset_url | stylesheet_tag }}
```

### 1.3 Space, radius, elevation

- Spacing scale `--cabin-space-1…8`: 4 · 8 · 12 · 16 · 24 · 32 · 48 · 72 px.
- Radius: `sm` 2px (buttons, inputs), `md` 4px (cards), `pill` 999px (tags).
- Shadows: `--cabin-shadow-card` (surface), `--cabin-shadow-float` (modal), `--cabin-shadow-note` / `--cabin-shadow-note-raised` (note cards). Shadows are deep and soft; brass appears only as a 1px ring on the raised state.
- Z-index tokens: note 1 · vessel 3 · raised note 4 · modal 1000.

### 1.4 Motion

- Curve: `--cabin-ease-out: cubic-bezier(0.16, 1, 0.3, 1)` for every transition.
- Durations: `fast` 180ms (colour/border), `base` 350ms (transform: fan, modal), `slow` 600ms (reveals, bar growth).
- `prefers-reduced-motion: reduce` zeroes all durations via the tokens and disables keyframe animations.
- Nothing bounces. Nothing loops.

### 1.5 Utilities

`.cabin-surface` · `.cabin-pill` (`--active --brass`) · `.cabin-btn` (`--ghost --icon`) · `.cabin-input` · `.cabin-rule` (`--brass`) · `.cabin-container` · `.cabin-grid` · `.cabin-visually-hidden` · `.cabin-fade-up.is-visible`.

Add `class="cabin-theme"` on `<body>` (or a section wrapper) to apply canvas, text colour and Inter.

---

## 2. Components

### 2.1 Scent fan — `snippets/product-scent-fan.liquid`

Three note cards (Top / Heart / Base) sit behind the vessel image.

| Mode | Default | Hover |
|---|---|---|
| `grid` | Collapsed, concealed behind the vessel (`scale .92`, 0°) | Radial fan: `-14°` / `0° raised` / `+14°`, 350ms `ease-out`. Triggers on the card (`.card-wrapper:hover`), the fan itself, or `:focus-within`. Touch devices show a permanent slight fan. |
| `pdp` | Fanned. Reveals from collapsed on first viewport intersection (JS), stays fanned without JS. | Hovered/focused note: `scale 1.06`, lifted a further 4%, z-index above siblings, brass 1px ring. Click opens the note modal. |

Geometry is driven by three tokens so it can be tuned globally: `--cabin-fan-angle` (14deg), `--cabin-fan-lift` (-12%), `--cabin-fan-spread` (26%). Note cards use container-query units so type scales with the card.

Grid cards are decorative (`aria-hidden`); PDP notes are `<button aria-haspopup="dialog">` with a full accessible name.

Usage

```liquid
{%- comment -%} collection grid: once above the grid, then per card {%- endcomment -%}
{% render 'product-scent-fan', styles_only: true %}
{% render 'product-scent-fan', product: card_product, mode: 'grid', skip_styles: true %}

{%- comment -%} PDP {%- endcomment -%}
{% render 'product-scent-fan', product: product, mode: 'pdp' %}
```

Trade integration: in `snippets/card-product.liquid`, replace the `<img>` inside `.card__media .media` with the grid render above (keep the surrounding `<a>` so the whole card remains the link). The vessel image should be a transparent PNG/WebP cut-out; the fan reads best on the canvas colour rather than a photographed background.

### 2.2 Note modal — `assets/scent-modal.js`

Singleton, built lazily on first open, appended to `<body>`. Delegated click on `[data-scent-note]`.

Content: tier + evaporation window eyebrow → note name (Cormorant) → alias → "What it smells like" → "Why it works in a cabin" → molecular-weight spec line. Empty fields collapse.

Accessibility: `role="dialog" aria-modal="true" aria-labelledby`; focus moves to the panel, Tab/Shift-Tab cycle inside, Escape / backdrop / [X] close, focus returns to the note. Body scroll locks via `.cabin-modal-open`. Events: `scent-modal:open`, `scent-modal:close`.

Labels are overridable before the script loads:

```html
<script>window.CabinConfig = { modalLabels: { profile: 'What it smells like', chemistry: 'Why it works in a cabin' } };</script>
```

### 2.3 Metrics panel — `sections/product-metrics-panel.liquid`

Blocks (reorderable in the editor): Seasonality · Longevity · Sillage · Mood · Note prominence · Gender spectrum. Each block renders only when its metafield is populated.

| Metric | Form | Encoding |
|---|---|---|
| Seasonality | 3-segment pill (Summer / Winter / All-season) | Active segment brass fill; `aria-current`. |
| Note prominence | Stacked bar, 3 segments, 2px gaps, animated growth; itemised legend with % and evaporation window | Brass ramp light→deep = Top→Base. Percentages are normalised to 100 in Liquid. `role="img"` label + per-segment tooltip on hover/focus. |
| Longevity | Hero figure `4–6` + serif unit | Or a free-text override (`longevity_label`). |
| Sillage / throw | 5-segment discrete meter, Subtle → Commanding | Filled brass; track is brass at 18% (same ramp). `role="meter"` with `aria-valuetext`. |
| Mood / tone | Pill tags | From `mood_tags` list. |
| Gender spectrum | Linear spectrum with three labelled zones and a marker | `gender_position` 0–100 → readout "60% Masculine / 40% Unisex". |

### 2.4 Release backlog — `sections/cabin-release-backlog.liquid`

Native `<details>` list. Each block: index, title (Syne), format line (Cormorant), ETA, status pill (`development` / `testing` / `coming-soon` / `waitlist`), rich description, optional image, and a notify module keyed to the release. Presets ship with Fine-mist spray, Wax candle, Reed diffuser.

### 2.5 Notify me — `snippets/cabin-notify-form.liquid` + `sections/cabin-notify-me.liquid`

Ultra-minimal capture posting to Shopify's native `{% form 'customer' %}`:

- `contact[email]` required. Creates or updates the customer with `accepts_marketing = true`.
- `contact[tags]` = `waitlist, notify:<key>, channel:<email|sms>` — the key is the product handle (+ variant id when the product has variants) or the backlog block key.
- Shopify Email: build a segment `customer_tags CONTAINS 'notify:oud-01'` and send the release note to it. Shopify Flow can trigger on "Customer tags added → contains notify:" for automated sequences.
- States: idle → submitting (button label swap, dimmed) → success (brass tick + serif line, focus moved to it) / error (inline `role="alert"`, field marked `aria-invalid`). Works without JS via Shopify's redirect (`form.posted_successfully?`).
- The PDP section renders only when the product or selected variant is unavailable, or the product is tagged `unreleased`.

SMS: the storefront customer form only documents email consent. The SMS channel here captures the phone as `contact[phone]` and tags `channel:sms`; verify that the phone lands on the customer record in your store, and grant SMS marketing consent through a Shopify Forms block or the Admin API (`customerSmsMarketingConsentUpdate`) rather than assuming the form did it. If you do not want that dependency, set the section's "Offer SMS channel" to off.

---

## 3. Data model (metafields)

Create under **Settings → Custom data**. Namespace `cabin`.

### 3.1 Metaobject `scent_note`

| Field key | Type | Example |
|---|---|---|
| `name` | Single line text | Cashmeran |
| `alias` | Single line text | DPMI |
| `profile` | Multi-line text | Warm, dry, woody-musky with a powdered-suede softness. Reads as clean skin over sanded cedar. |
| `chemistry` | Multi-line text | MW 206, log P ~4.9: mid-volatility, high substantivity. Re-supplies vapour steadily under 3–4 HVAC air changes per minute rather than flashing off. Colourless, non-crystallising, no vanillin so it will not brown untreated beech or stain trim. |
| `molecular_weight` | Single line text | 206 g/mol |

### 3.2 Product metafields

| Key | Type | Used by |
|---|---|---|
| `cabin.top_note` / `heart_note` / `base_note` | Metaobject reference → `scent_note` | Fan, modal |
| `cabin.season` | Single line text: `summer` \| `winter` \| `all-season` | Metrics |
| `cabin.prominence_top` / `_heart` / `_base` | Integer 0–100 | Metrics |
| `cabin.longevity_min_weeks` / `_max_weeks` | Integer | Metrics |
| `cabin.longevity_label` | Single line text (optional override) | Metrics |
| `cabin.sillage` | Integer 1–5 | Metrics |
| `cabin.mood_tags` | List of single line text | Metrics |
| `cabin.gender_position` | Integer 0–100 (0 masc · 50 unisex · 100 fem) | Metrics |
| `cabin.scent_family` | Single line text | Metrics badge / collection filter |

Sillage scale: 1 Subtle · 2 Close · 3 Present · 4 Bold · 5 Commanding. Fill from the week-1 static throw score.

### 3.3 Sample note entries

| Tier | name | alias | profile | chemistry |
|---|---|---|---|---|
| Top | Bitter Almond | Benzaldehyde accord | Marzipan without the sugar; a cool, slightly metallic snap. | Low MW (106) so it leads the headspace hit on entry, then hands off within the first 20 minutes. Kept below 2% to stay under the CRC/allergen thresholds; no staining risk at this load. |
| Heart | Cashmeran | DPMI | Warm, dry, woody-musky; powdered suede over sanded cedar. | MW 206, mid-volatility, high substantivity: steady emission under HVAC airflow. Colourless, non-crystallising, will not brown beech. |
| Base | Labdanum | Cistus resinoid | Ambered resin, leather, a sun-warmed sweetness. | Resinous sesquiterpenes and high-MW acids sit in the wood grain and release for weeks. Anchors the heart so week-five projection is still legible. Mild colour watch: pale amber tint, non-staining on trim at 25% load. |

---

## 4. Catalogue architecture

Launch: 6 scents × 3 vessels.

| SKU | Product | Variant axis |
|---|---|---|
| A | Hanging Beechwood Diffuser 8ml ("The Vessel") | Scent |
| B | Flat 10ml Reserve Refill | Scent · pack (1 / 3) |
| C | Matte Black Vent Clip ("The Insert") | Scent |

Recommended structure: one product per vessel with scent as the variant option, plus a collection per scent (so scent pages can host the fan hero, metrics and all three vessels). Scent-level metafields live on the vessel product; if a variant needs its own values (e.g. vent-clip longevity), use variant metafields with the same keys and read `variant.metafields.cabin.*` first.

Backlog (not yet products): Interior fine-mist spray · Heavyweight wax candle · Reed diffuser — managed as blocks in the Release backlog section until they become products, at which point the block's notify key should match the future product handle so the tag lineage carries over.

---

## 5. Theme wiring checklist

1. Upload `assets/*`, `snippets/*`, `sections/*`.
2. `layout/theme.liquid`: fonts + tokens stylesheet in `<head>`; ensure the Trade `no-js → js` class swap is present; add `cabin-theme` to `<body>`.
3. Product template (customise → Products → Default product): add **Scent fan hero**, **Scent metrics panel**, **Notify me on release** sections in that order beneath the main product block.
4. Collection cards: render the grid fan in `card-product.liquid`.
5. Home or a dedicated page: add **Release backlog**.
6. Custom data: create the `scent_note` metaobject and product metafield definitions from §3.
7. Shopify Email: create segments per `notify:<key>` tag.
