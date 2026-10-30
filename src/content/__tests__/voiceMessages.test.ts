/* eslint-disable @typescript-eslint/no-require-imports */
import { MESSAGES } from '../messages';

jest.mock('../../audio/assets.generated', () => {
  // Metro requires of .m4a files cannot run under Jest: read the generated index as text instead.
  const fs = require('fs');
  // Jest runs from the repository root.
  const text: string = fs.readFileSync('src/audio/assets.generated.ts', 'utf8');
  const clips: Record<string, Record<string, number>> = {};
  let voice = '';
  for (const line of text.split('\n')) {
    const v = line.match(/^ {2}"(\w+)": \{$/);
    if (v) voice = v[1];
    const c = line.match(/^ {4}"(m\d+)": require\('\.\.\/\.\.\/assets\/voice\/(\w+)\/(m\d+)\.m4a'\),$/);
    if (c && voice) {
      clips[voice] = clips[voice] ?? {};
      clips[voice][c[1]] = c[2] === voice && c[3] === c[1] ? 1 : 0;
    }
  }
  return { VOICE_CLIPS: clips, BUNDLED_TRACKS: [] };
});

describe('the whispered clips', () => {
  it('are rendered from exactly the messages the screen shows', () => {
    const voiceMessages: { id: string; text: string }[] = require('../../../pipeline/voice/messages.json');
    expect(voiceMessages).toEqual(MESSAGES.map((m) => ({ id: m.id, text: m.text })));
  });

  it('exist for every message in both voices', () => {
    const { VOICE_CLIPS } = require('../../audio/assets.generated');
    for (const voice of ['mujer', 'hombre']) {
      for (const m of MESSAGES) expect(VOICE_CLIPS[voice][m.id]).toBe(1);
    }
  });
});
