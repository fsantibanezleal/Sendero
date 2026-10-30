# The reveal

The moment the frame returns: "showing the real person, but now smaller, and behind a soft silhouette of the random
person". The visitor must be drawn in front of the silhouette, and the silhouette in front of the background, so the
visitor is cut out of the live camera by a person mask.

## The person mask

`src/camera/useCameraFeed.ts`.

- Model: MediaPipe Selfie Segmentation, landscape variant (`assets/models/selfie_segmenter_landscape.tflite`, 250 KB,
  Apache License 2.0). Its model card gives the input as a 144 x 256 x 3 tensor of RGB values in [0, 1] and the output
  as a 144 x 256 x 1 person probability in [0, 1]; it is meant for one prominent person within about 4 metres and is
  run on the phone GPU or CPU in real time
  (https://storage.googleapis.com/mediapipe-assets/Model%20Card%20MediaPipe%20Selfie%20Segmentation.pdf). The landscape
  variant matches a landscape tablet (research-android D2). The code reads the input and output shapes at load and
  accepts one or two output channels.
- Runtime: `react-native-fast-tflite` 3.0.1, GPU delegate first, CPU if the GPU delegate fails to load.
- Pipeline, on the camera thread: each frame is drawn upright and mirrored (the same image the screen shows); while the
  mask is on, every second frame that image is drawn into a 256 x 144 surface, read back, converted to RGB floats,
  segmented, smoothed over time with an exponential moving average (weight 0.6 for the newest mask), and turned into an
  alpha image with a soft edge (a smoothstep from probability 0.3 to 0.7).
- Alignment: because the mask is computed from the upright, mirrored image itself, drawing the camera image and the
  mask into the same rectangle lines them up exactly. The rectangle is the camera image's cover rectangle, shrunk by
  0.82 about the bottom centre of the screen (`coverRect`, `personRect`).
- Compositing: the camera image is drawn into a layer and the mask over it with the `dstIn` blend mode, which keeps the
  camera pixels only where the mask is opaque.
- A failing mask computation is caught on the camera thread and reported once in the system log
  (`[Sendero] camera: person mask failed: ...`); the reveal then uses the portrait below.
- The mask runs only from the start of the walk to the end of the message.

## Live or still

The reveal can show the visitor live (they can move, the silhouette stays behind them) or as a still cut-out frozen at
the start of the reveal. The staff panel sets the mode: Automatic (default), Live, or Still. In Automatic the app
measures the masks it actually produced per second during the walk (an exponential average) and freezes the image and
the mask at the start of the reveal when the rate is below 6 per second, so a slow tablet never shows a lagging cut-out.
The live camera resumes at the return.

## Without a mask

If the model cannot load, or no mask arrives, the reveal shows the visitor as a soft-edged portrait left of centre
(`PORTRAIT` in `src/scene/revealGeometry.ts`: 40 percent of the width and 58 percent of the height, its right edge at
54 percent of the width), with the camera image cropped to fill it, so the silhouette (centred at 56.5 percent) stands
visibly behind and beside the visitor and the moment still reads as "behind". Only the variant on screen is drawn
(`Gate`).

## The scene of the reveal

`src/scene/RevealLayer.tsx`: the night between the worlds with slow, warm bokeh lights; the front-view silhouette of
the same person (0.82 of the screen's height, standing on the bottom edge so the head stays below the papel picado
and the top garland, its centre slightly to the right, breathing slowly) with their pet sitting
to the left; small lights rising around it; the visitor in front. The garland, the papel picado and the candles stay
around it.

## Privacy

Frames and masks exist only in memory. Nothing is written to storage or sent; the app has no internet permission. The
model card notes the model is not for surveillance or identity recognition; Sendero only separates a person from the
background for the length of one message.
