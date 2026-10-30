/**
 * One line per event of the altar's life (a touch, a visit's stages, a failing layer), tagged
 * `[Sendero]`, so `adb logcat -s ReactNativeJS` tells what the app did at the event. Nothing is
 * written to storage or sent anywhere; the text never holds an image or a person's data.
 */
export function log(message: string): void {
  console.log(`[Sendero] ${message}`);
}
