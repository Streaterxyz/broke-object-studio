# Lighter location sound

Extracted from the supplied `lighter-images/VIDEO-2026-03-25-19-11-42.mp4`.
Mono, 44.1 kHz, PCM WAV. Source transients located from waveform measurements;
timings refine the user's approximate marks. No synthetic replacement sounds.

| File | Source interval | Treatment |
| --- | --- | --- |
| open.wav | 3.26–3.66s | 160 Hz high-pass, short edge fades, ×1.15 gain |
| ignite.wav | 3.94–4.14s | 180 Hz high-pass, short edge fades, ×2 gain |
| close.wav | 8.99–9.28s | 160 Hz high-pass, short edge fades, ×0.85 gain |
| burn.wav | 4.20–6.00s | 900 Hz high-pass / 11 kHz low-pass, ×12 gain, 120 ms equal-power seam crossfade, resulting 1.68s loop |

Burn is a quiet recording containing room ambience; filtering reduces low handling
noise but is not complete source separation. Playback master gain is 0.7; burn
gain is 0.55 times visible flame strength, reduced to 30% for the soft-flame phase.
User opts in with Sound off/on. Hiding or leaving the page mutes playback.
Clicks follow rendered lid/flame state with hysteresis, including reverse scrolling;
they do not follow wall-clock timestamps or replay when sound is enabled midway.
