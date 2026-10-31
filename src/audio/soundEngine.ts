/**
 * The sound of the altar: continuous music with crossfades, softened under a whispered message
 * (docs/sound.md).
 *
 * - Two music players alternate: 6 s before a track ends the next one starts silent on the other
 *   player and both ramp with equal-power gains over CROSSFADE_S (research-android D4: expo-audio
 *   has no fade API, so ramps are driven by a timer at 20 Hz).
 * - Ducking: the music drops by DUCK_DB (the owner asked for the music to be "a little soft") over
 *   DUCK_ATTACK_MS while the voice plays, and comes back over DUCK_RELEASE_MS.
 * - Both players mix with each other (interruptionMode mixWithOthers); playback stays in the
 *   foreground (the kiosk never leaves the app).
 * - A track that fails to load within LOAD_TIMEOUT_MS is skipped, so one bad file never silences
 *   the altar.
 */
import { type AudioPlayer, createAudioPlayer, setAudioModeAsync } from 'expo-audio';

import { log } from '../diagnostics/log';

import { dbToGain, equalPower, type Track } from './playlist';

export const CROSSFADE_S = 4;
export const LEAD_S = 6;
export const DUCK_DB = -6;
export const DUCK_ATTACK_MS = 400;
export const DUCK_RELEASE_MS = 1500;
const TICK_MS = 100;
/**
 * How often the playing track's position is read. Every read and every volume set waits for the app's main thread;
 * on the TCL Tab A1 Plus, whose main thread is busy drawing the scene, doing them 20 times a second starved the
 * JavaScript thread (its timers ran 2 to 3 times late, events arrived 20 s late, touches and the voice with them).
 */
const POSITION_CHECK_MS = 1000;
const LOAD_TIMEOUT_MS = 8000;

type Slot = { player: AudioPlayer; track: Track | null; gain: number; startedAt: number; applied: number };

export class SoundEngine {
  private slots: [Slot, Slot];
  private active = 0;
  private voice: AudioPlayer;
  private round: Track[] = [];
  private index = -1;
  private nextRound: () => Track[] = () => [];
  private timer: ReturnType<typeof setInterval> | null = null;
  private checkedAt = 0;
  private fade: { from: number; to: number; start: number } | null = null;
  private duck = 1;
  private duckTarget = 1;
  private duckRate = 0;
  private musicVolume = 0.8;
  private voiceVolume = 0.6;
  private voicePrepared = false;
  private running = false;

  constructor() {
    this.slots = [
      { player: createAudioPlayer(null), track: null, gain: 0, startedAt: 0, applied: -1 },
      { player: createAudioPlayer(null), track: null, gain: 0, startedAt: 0, applied: -1 },
    ];
    this.voice = createAudioPlayer(null);
  }

  /** Starts the music; `roundFactory` builds each new round of the playlist. */
  async start(roundFactory: () => Track[]): Promise<void> {
    this.nextRound = roundFactory;
    await setAudioModeAsync({ playsInSilentMode: true, interruptionMode: 'mixWithOthers', shouldPlayInBackground: false });
    this.running = true;
    this.round = roundFactory();
    this.index = -1;
    log(`music: starting, ${this.round.length} tracks in the round, volume ${this.musicVolume.toFixed(2)}`);
    this.startNext(true);
    if (this.timer == null) {
      this.timer = setInterval(() => this.tick(), TICK_MS);
    }
  }

  /** Rebuilds the playlist (after an import) without interrupting the current track. */
  refresh(): void {
    this.round = this.nextRound();
    this.index = -1;
  }

  stop(): void {
    this.running = false;
    if (this.timer != null) {
      clearInterval(this.timer);
      this.timer = null;
    }
    for (const s of this.slots) s.player.pause();
    this.voice.pause();
  }

  dispose(): void {
    this.stop();
    for (const s of this.slots) s.player.remove();
    this.voice.remove();
  }

  setMusicVolume(v: number): void {
    this.musicVolume = Math.max(0, Math.min(1, v));
    this.apply();
  }

  setVoiceVolume(v: number): void {
    this.voiceVolume = Math.max(0, Math.min(1, v));
  }

  /** Softens the music under the voice. */
  duckMusic(): void {
    this.duckTarget = dbToGain(DUCK_DB);
    this.duckRate = (1 - this.duckTarget) / (DUCK_ATTACK_MS / TICK_MS);
  }

  /** Brings the music back to its level. */
  releaseMusic(): void {
    this.duckTarget = 1;
    this.duckRate = (1 - dbToGain(DUCK_DB)) / (DUCK_RELEASE_MS / TICK_MS);
  }

  /** Loads a message clip ahead of time, so it starts on the instant it is played. */
  prepareVoice(source: number | string): void {
    this.voice.replace(typeof source === 'string' ? { uri: source } : source);
    this.voice.volume = this.voiceVolume;
    this.voicePrepared = true;
  }

  /** Plays the message clip loaded by prepareVoice, or loads and plays this one. */
  playVoice(source: number | string): void {
    log(`voice: at volume ${this.voiceVolume.toFixed(2)}, music ducked to ${this.duckTarget.toFixed(2)}${this.voicePrepared ? '' : ', not preloaded'}`);
    if (!this.voicePrepared) this.prepareVoice(source);
    this.voicePrepared = false;
    this.voice.volume = this.voiceVolume;
    this.voice.play();
  }

  /** The title of what is playing (staff panel). */
  nowPlaying(): string {
    return this.slots[this.active].track?.title ?? '';
  }

  private pickNext(): Track | null {
    if (this.round.length === 0) {
      this.round = this.nextRound();
      this.index = -1;
      if (this.round.length === 0) return null;
    }
    this.index += 1;
    if (this.index >= this.round.length) {
      this.round = this.nextRound();
      this.index = 0;
      if (this.round.length === 0) return null;
    }
    return this.round[this.index];
  }

  private startNext(first: boolean): void {
    const track = this.pickNext();
    if (track == null) {
      log('music: no track to play');
      return;
    }
    log(`music: playing ${track.title}`);
    const target = first ? this.active : 1 - this.active;
    const slot = this.slots[target];
    slot.track = track;
    slot.startedAt = Date.now();
    slot.player.replace(typeof track.source === 'string' ? { uri: track.source } : track.source);
    slot.gain = first ? 1 : 0;
    this.apply();
    slot.player.play();
    if (!first) {
      this.fade = { from: this.active, to: target, start: Date.now() };
    }
  }

  /** Sets a player's volume only when it changes (each set waits for the main thread). */
  private apply(): void {
    for (const s of this.slots) {
      const v = Math.round(s.gain * this.musicVolume * this.duck * 1000) / 1000;
      if (v !== s.applied) {
        s.player.volume = v;
        s.applied = v;
      }
    }
  }

  private tick(): void {
    if (!this.running) return;
    // Ducking ramp.
    if (this.duck !== this.duckTarget) {
      this.duck = this.duck > this.duckTarget ? Math.max(this.duckTarget, this.duck - this.duckRate) : Math.min(this.duckTarget, this.duck + this.duckRate);
    }
    // Crossfade ramp.
    if (this.fade != null) {
      const u = (Date.now() - this.fade.start) / (CROSSFADE_S * 1000);
      const [out, inc] = equalPower(u);
      this.slots[this.fade.from].gain = out;
      this.slots[this.fade.to].gain = inc;
      if (u >= 1) {
        this.slots[this.fade.from].player.pause();
        this.slots[this.fade.from].track = null;
        this.active = this.fade.to;
        this.fade = null;
      }
    } else {
      if (Date.now() - this.checkedAt < POSITION_CHECK_MS) {
        this.apply();
        return;
      }
      this.checkedAt = Date.now();
      const current = this.slots[this.active];
      const p = current.player;
      const loadedLate = !p.isLoaded && Date.now() - current.startedAt > LOAD_TIMEOUT_MS;
      const nearEnd = p.isLoaded && p.duration > LEAD_S * 2 && p.currentTime >= p.duration - LEAD_S;
      const ended = p.isLoaded && p.duration > 0 && !p.playing && p.currentTime >= p.duration - 0.5;
      if (loadedLate || ended) {
        this.startNext(true);
      } else if (nearEnd) {
        this.startNext(false);
      }
    }
    this.apply();
  }
}
