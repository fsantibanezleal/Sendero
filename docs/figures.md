# The figures

The family is drawn from 69 licensed silhouette drawings, at least ten per archetype (grandmother, grandfather, woman,
man, dog, cat); the source and licence of each are in `ASSETS.md`. Each visit picks a new drawing per figure, never the one
it showed last, and dresses it with its own random colors and embroidery.

## How people are represented on the day

The dress follows how people appear on Día de Muertos in Mexico: calavera face paint (white base, flowers around dark
eyes, a small nose, a stitched smile, a flower on the forehead), cempasúchil and roses in the hair and marigold garlands,
the elegance of La Catrina and El Catrín, the textiles rebozo, serape and huipil, and for the animals the colors of the
alebrijes, the spirit guides of the festivities. Designs are traditionally adapted to the person remembered, so each
archetype has its own familiar style, and a figure keeps one style rather than mixing them:

| Figure | Dress |
|---|---|
| Grandmother | A rebozo over the shoulders, roses in the crown, a flowered skirt |
| Grandfather | A dark suit with open lapels, buttons, a small flower at the hat |
| Woman | An embroidered huipil yoke and waist band, a full marigold crown |
| Man | A serape across the chest, a band at the cuffs |
| Dog, cat | An alebrije: a strong color, waves, dots, flowers, the eye ringed like a calavera |

Sources: https://hiplatina.com/dia-de-los-muertos-6-things-you-should-know-before-painting-your-face/,
https://rancholapuerta.com/2016/10/28/how-to-apply-la-catrina-makeup-a-day-of-the-dead-tutorial/,
https://www.wikiwand.com/en/articles/La_Calavera_Catrina,
https://www.ksat.com/news/local/2020/10/15/the-colorful-history-of-alebrijes-and-connection-to-day-of-the-dead/.

## How it is made

`pipeline/silhouettes/build.py` measures each drawing on a raster and stores its anchors: head, neck, shoulders, waist and
hem for a person, head and body for a pet. The manifest can correct an anchor by hand where a parasol or a raised arm
fools the measurement. `src/figures/decor.ts` paints in figure units (height 1, feet at y = 0, facing right): what lies on
the body is clipped to the silhouette, what rests on it (flowers) appears only where the head or the body is. Each figure
is rendered once on the CPU into an image, so that drawing it costs one image per frame however rich the dress is
(`dressedFigure`); the glow of `Ghost.tsx` stays behind it.

A drawing is one pose: the walker glides with a soft rise and fall and a gentle sway, it does not move its legs.

## Preview

```powershell
$env:SENDERO_DECOR_PREVIEW = "<temp root>/sendero/decor.png"
$env:SENDERO_DECOR_KINDS = "abuela,mujer"
npx jest src/figures/__tests__/decorPreview.test.ts
```
