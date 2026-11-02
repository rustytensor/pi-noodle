# Editable logo and page graphics

The visual reference is the supplied `noodle-neon-skull.png`: the neon-outline
skull bowl, rose chopsticks, gold noodles, voice wave and neon lettering—not the
white-filled icon variant.

## Edit the logo

Open [`assets/noodle-logo-editable.svg`](assets/noodle-logo-editable.svg) in an SVG
editor. It has **14 named Inkscape-compatible layers**, including nested skull
layers: wall, grid/rain, reflected light, skull, chopsticks, noodles, bowl, face,
voice wave, letter paths, tagline, badge, signature and reference image.

- Visible artwork is vector geometry from the matching supplied `neon-skull.html`.
  The lettering is editable paths; the tagline and badge are editable text.
- The supplied PNG is a hidden comparison layer, not the visible artwork. Keep
  `noodle-neon-skull.png` beside the master if you want to toggle that reference.
- The decorative “OPEN 24/7” badge becomes “LOCAL MEMORY”: the extension is not an
  always-running daemon. Nothing animates or flashes.
- Regenerate web exports with `npm run render:hero`. The desktop and compact
  exports remove the PNG reference layer and use no raster embeds, external fonts,
  scripts or network dependencies. Preserve layer IDs when editing.

## Explain the product

`npm run render:overview` creates desktop and compact diagrams for **memory,
archive encryption and side chat**, in that order. They share the logo palette,
use real text and descriptive alt text, and are explicitly conceptual—not live UI.
The complete command/operating reference lives in [user-guide.md](user-guide.md).

The encryption diagram keeps shared memory, original Pi transcripts and retained
plaintext copies outside the encrypted boundary. Memory stays plaintext; archive,
encryption and model access are separate opt-ins. Closing side chat is not stopping
it. Keep these facts visible when changing copy or artwork.

Web previews use local content in a disposable browser profile with external
requests blocked. Check the whole page on desktop and narrow screens, not just the
banner. The old PNG assets remain available as references, not competing headers.

Logo adapted from 'Death Ramen Skull Bowl Logo' by gagavastard (Envato Elements).
