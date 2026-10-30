- Offline voice pipeline (`pipeline/voice`): whispered, distant clips of all 62 messages in a woman's voice (Piper
  `es_MX-claude-high`) and a man's voice (Kokoro-82M `em_alex`), chosen by measured F0; 124 `.m4a` clips at -20 LUFS
  with `assets/voice/catalog.json`; the whisper by LPC resynthesis with noise excitation; a distance chain whose wet
  share was chosen by a speech-recognizer sweep (word error rate 0.81 at wet 0.55, about 0.2 at 0.25); spoken forms
  that keep the words; an intelligibility step (Whisper small) and the doc tables written from the outputs
  (`docs/voice.md`).
