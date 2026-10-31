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
| Arrive | 11.2 | 12.4 | A warm bloom from the frame, which grows from the corner to the stage on the right |
| Farewell | 12.4 | 15.4 | The visitor live in the frame on the stage, the same person's silhouette beside it, the pet at their side |
| Message | 15.4 | 25.4 | An indigo veil and one message; at 15.5 a soft voice says it while the music softens a little |
| Return | 25.4 | 26.8 | Everything fades back to the idle screen |

The camera is never analysed: since 0.01.001 the farewell needs no person mask (`docs/reveal.md`).

## The clock

`src/experience/useExperience.ts` keeps two Reanimated shared values advanced by a frame callback on the UI thread:
`clock` (seconds since the touch, -1 while idle) and `time` (seconds since start, for idle animations). Every visual
is a derived value of these two, so the animation never waits for JavaScript.

The next visit is planned while the altar waits (`src/experience/plan.ts`: the companion, the gathering, the message
and the seed of the petal path), and its layers are mounted then, gated off. The touch is a tap gesture handled on
the UI thread (`App.tsx`, `react-native-gesture-handler`): it starts the clock in the same frame, so nothing the
visitor sees waits for a React render at that moment. A touch counts when a finger is pressed, held or slid; touches
in the staff corner never start a visit; touches are ignored while a visit runs.

The effects that are not visual follow the clock: a reaction on the UI thread reports each mark of the timeline as
the clock passes it (`MARKS`: mask on, reveal, message, whisper, return), and the JavaScript thread runs the effect:
the mask on and off, the still-frame decision, the music duck and release, and the whisper. When the clock returns
to idle the mask and the music are always released, and the next visit is planned.

Each touch, each mark and each failing layer writes one line tagged `[Sendero]` to the system log
(`src/diagnostics/log.ts`; read it with `adb logcat -s ReactNativeJS`). The lines hold no image and no data about the
visitor.

## The family and who walks the path

`src/figures/catalog.ts`, `src/figures/looks.ts`, `src/experience/plan.ts`. The owner's rule: "you always show at the
left upper area, the 4 main silhouettes, and the 2 pets, but always random choosing variants", and "always one of the
4 main characters must be selected to walk, and at some occasions a pet is companion".

- The family that waits in the upper left is always six: a grandmother, a grandfather, a woman and a man, a dog and a
  cat. They appear as the petal path starts drawing and stay until the arrival; their places among six spots are
  shuffled at every visit.
- Each of the six is a new random variant at every visit, generated from parts (`looks.ts`): for people, age (62 to
  92 for grandparents, 22 to 58 for adults), height, body type (slim, average, heavy, with belly and shoulders), the
  stoop that comes with age, hair (bald, short, long, bun, braids, ponytail, curly, bob, shoulder length, pompadour),
  headwear only on some (sombrero, palma, texana, fedora, boina, gorra, rebozo, panuelo, a flower), the top (plain,
  jacket, coat, poncho, shawl, rebozo, apron), the bottom (trousers or one of five skirts) and what they carry (a cane,
  more likely with age; marigolds, a guitar, a bag, a basket, a candle). Pets vary in size (from a small dog to a large
  one), body length, legs (some short-legged), build, ears (upright, large bat ears, floppy, small), tail (curled,
  straight, low, stub, plume), muzzle and long fur, standing or sitting. A test draws 60 random variants of each person
  and counts at least 30 visibly different silhouettes, from the side and from the front.
- One of the four people walks the path, chosen at random, never the same kind of person twice in a row; in about 35
  percent of visits one of the two pets walks beside them. A pet never walks alone. No children: the owner considers it
  too sensitive, and November 1 is popularly associated with deceased children (research: Mexican press citing INAH).
- The walker steps out of the family and onto the path; at the farewell the same variant stands beside the frame,
  turned toward it, and the pet, when there is one, stands at their other side
  (`docs/reveal.md`).
- The voice matches the person: a woman's voice for the grandmother and the woman, a man's for the
  grandfather and the man.

## The messages

`src/content/messages.ts`: 62 messages, the words a loved one says to someone they have not seen in a long time, to
support them and warm them (the owner's brief: "at least some 50", about remembering, company and support). The first
seven are the owner's own, exactly as written (accents corrected only): "siempre te recordaré", "siempre en mis
pensamientos", "gracias", "sigue así", "lo estás haciendo bien", "descansa, lo estás haciendo bien", "también te
extraño". The rest are grouped as reunion ("hoy vine a verte"), memory ("te llevo en el corazón"), company ("camino a
tu lado") and support ("eres más fuerte de lo que crees"). Every message works for any visitor and either voice (no
gendered words about the visitor or the speaker), and none of the forms the culture research flagged is used ("nos
vemos pronto", "aquí te espero", "perdóname si no estuve más"); a test checks both. Messages come from a shuffle bag:
all 62 appear once before any repeats, never the same twice in a row. The screen capitalizes only the first letter.

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
