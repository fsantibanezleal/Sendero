# The experience

What a visitor lives in front of the altar, and where each part of it lives in the code.

## Why it looks like this

In the Mexican Dia de Muertos tradition the departed return for a short while, and the living welcome them: UNESCO's
description of the festivity (inscribed in 2008 on the Representative List of the Intangible Cultural Heritage) says
it "commemorates the transitory return to Earth of deceased relatives and loved ones", and that families lay "flower
petals, candles and offerings along the path leading from the cemetery to their homes"
(https://ich.unesco.org/en/RL/indigenous-festivity-dedicated-to-the-dead-00054). The cempasuchil (Tagetes erecta,
from the Nahuatl for "twenty flower") is the flower of that path, its colour and scent the guide of the souls. Sendero
turns that path into a short moment for one visitor at a time: the path draws itself, one loved one walks it, and
stands behind the visitor.

## The timeline

Every time is in `src/experience/timeline.ts` (seconds from the visitor's touch); the layers read them, never their
own constants. Phases overlap on purpose.

| Phase | From | To | What happens |
|---|---|---|---|
| Idle | | | The visitor sees themselves, mirrored, inside the cempasuchil garland; papel picado sways along the top; two candles flicker in the lower corners; "Toca la pantalla" breathes at the bottom; music plays |
| Shrink | 0.0 | 1.4 | The framed camera, garland and all, moves to the lower right corner (34 percent of the width); behind it, the night between the worlds |
| Path | 0.8 | 3.6 | The petal path draws itself from the upper left corner to the frame |
| Gather | 2.8 | 4.2 | Three to five soft silhouettes dissolve in at the far end of the path |
| Walk | 4.2 | 11.2 | One of them (and their pet, if they have one) walks the path toward the frame, growing as it comes closer; the others fade by 6.0 |
| Arrive | 11.2 | 12.4 | A warm bloom from the frame, which returns to full screen |
| Reveal | 12.4 | 15.4 | The visitor, smaller, with the same person's silhouette standing behind them, inside the same garland |
| Message | 15.4 | 25.4 | An indigo veil and one message; at 16.0 a distant whisper says it while the music softens a little |
| Return | 25.4 | 26.8 | Everything fades back to the idle screen |

The person mask is computed only from 4.2 to 25.4 (`TIMELINE.mask`): the camera is never segmented while nobody has
asked for the experience.

## The clock

`src/experience/useExperience.ts` keeps two Reanimated shared values advanced by a frame callback on the UI thread:
`clock` (seconds since the touch, -1 while idle) and `time` (seconds since start, for idle animations). Every visual
is a derived value of these two, so the animation never waits for JavaScript. The effects that are not visual run on
the JavaScript thread from timers set at the touch: the mask on and off, the still-frame decision, the music duck and
release, the whisper, and the end of the visit. Touches are ignored while a visit runs.

## Who walks the path

`src/figures/catalog.ts`:

- People only as grandparents and adults: abuela, abuelo, mujer, hombre. No children: the owner considers it too
  sensitive, and November 1 is popularly associated with deceased children (research: Mexican press citing INAH).
- A dog or a cat walks with the chosen person in about 35 percent of visits; a pet never walks alone.
- The person kind never repeats twice in a row, and neither does the message.
- The whispered voice matches the person: a woman's voice for abuela and mujer, a man's for abuelo and hombre.

## The messages

`src/content/messages.ts` holds the seven messages exactly as the owner wrote them (accents corrected only):
"siempre te recordaré", "siempre en mis pensamientos", "gracias", "sigue así", "lo estás haciendo bien",
"descansa, lo estás haciendo bien", "también te extraño". The screen capitalizes only the first letter. The research
proposed more candidates and flagged three to avoid ("nos vemos pronto", "sigue adelante, aquí te espero",
"perdóname si no estuve más"); none is added without the owner's decision.

## Design rules for a grieving audience

From the research on thanatosensitive design (Massimi and Charise 2009; Massimi and Baecker 2011; Hakkila et al. 2022,
https://doi.org/10.1007/s00779-019-01359-1), applied as rules:

1. Dignity first: calm motion and sound, no skulls, no grotesque imagery.
2. Unobtrusive technology: no prompts, logos or error dialogs; failures return silently to the idle screen.
3. Camera frames stay in memory, never stored, never sent; the app has no internet permission.
4. The experience starts only on the visitor's own touch.
5. Generic, faceless silhouettes; no imitation of a real person's face or voice; no children.
6. Short and bounded (under 27 seconds), with a return to the idle screen by itself; the visitor can walk away at any
   moment.
7. Traditional elements as documented; messages reviewed by a Mexican reader before additions.
8. No message assigns guilt, duty or belief.
