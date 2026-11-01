# GitHub artwork

The README uses one responsive vector composition, not a stack of raster logos.

- `assets/noodle-neon.svg` is the supplied neon skull mark, copied unchanged.
- `assets/noodle-neon-wordmark.svg` contains the six letter paths from the supplied
  `neon-sign.html`. The letters use uniform illumination in the static header.
- `npm run render:hero` composes those vectors into `noodle-hero.svg` and
  `noodle-hero-compact.svg`. The compact version is selected below 600 px.
- Both heroes are self-contained SVGs: no raster embeds, external fonts, scripts,
  animation or network dependencies. The terminal ASCII intro is separate.

The duplicate PNG header images were removed from the README, not deleted from
history. The supplied logo attribution remains at the bottom of the page.

Validation used a disposable Chromium profile and a local GitHub-like Markdown
preview, with all HTTP requests blocked. Desktop/dark and mobile/light layouts
loaded the correct SVG, showed one image, and had no horizontal overflow. A planted
oversized image was rejected. The install command and privacy/default notice stayed
visible. These previews are not captures of the live GitHub site.

Logo adapted from 'Death Ramen Skull Bowl Logo' by gagavastard (Envato Elements).
