// Hysteresis follows the rendered pose in either scroll direction. A lid must
// close before its opening click can rearm; tiny scroll reversals stay quiet.
export function createCueTracker() {
  let lidOpen = null;
  let burning = null;
  return ({ open, jet, soft, ready }) => {
    if (!ready) { lidOpen = burning = null; return []; }
    const flame = Math.max(jet, soft);
    if (lidOpen === null) {
      lidOpen = open > 0.04;
      burning = flame > 0.02;
      return [];
    }
    const cues = [];
    if (!lidOpen && open >= 0.9) { lidOpen = true; cues.push('open'); }
    if (lidOpen && open <= 0.04) { lidOpen = false; cues.push('close'); }
    if (!burning && flame >= 0.06 && open > 0.5) {
      burning = true;
      cues.push('ignite');
    }
    if (flame <= 0.015 || open <= 0.04) burning = false;
    return cues;
  };
}

export class LighterAudio {
  constructor(button) {
    this.button = button;
    this.track = createCueTracker();
    this.enabled = false;
    this.buffers = {};
    this.shots = new Set();
    button.addEventListener('click', () => this.toggle());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.mute();
    });
    window.addEventListener('pagehide', () => this.mute());
  }

  async toggle() {
    if (this.enabled) { this.mute(); return; }
    this.enabled = true;
    this.button.textContent = 'Loading sound';
    this.button.setAttribute('aria-pressed', 'true');
    try {
      if (!this.context) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        this.context = new AudioContext();
        this.master = this.context.createGain();
        this.master.gain.value = 0;
        this.master.connect(this.context.destination);
        this.burnGain = this.context.createGain();
        this.burnGain.gain.value = 0;
        this.burnGain.connect(this.master);
      }
      // Resume synchronously from the click, before network/decode awaits.
      await this.context.resume();
      if (!this.loading) {
        this.loading = Promise.all(['open', 'ignite', 'burn', 'close'].map(async (name) => {
          const response = await fetch(`/assets/audio/ed01/${name}.wav`);
          if (!response.ok) throw new Error(`Audio ${name}: ${response.status}`);
          this.buffers[name] = await this.context.decodeAudioData(await response.arrayBuffer());
        })).catch((error) => { this.loading = null; throw error; });
      }
      await this.loading;
      if (!this.enabled || document.hidden) return;
      if (!this.loop) {
        this.loop = this.context.createBufferSource();
        this.loop.buffer = this.buffers.burn;
        this.loop.loop = true;
        this.loop.connect(this.burnGain);
        const loop = this.loop;
        loop.onended = () => loop.disconnect();
        this.loop.start();
      }
      this.master.gain.setTargetAtTime(0.7, this.context.currentTime, 0.025);
      this.button.textContent = 'Sound on';
    } catch (error) {
      this.mute();
      this.button.textContent = 'Retry sound';
      console.warn('Lighter audio unavailable', error);
    }
  }

  mute() {
    this.enabled = false;
    this.button.textContent = 'Sound off';
    this.button.setAttribute('aria-pressed', 'false');
    if (!this.context) return;
    this.master.gain.cancelScheduledValues(this.context.currentTime);
    this.master.gain.setTargetAtTime(0, this.context.currentTime, 0.015);
    if (this.loop) { this.loop.stop(this.context.currentTime + 0.08); this.loop = null; }
    for (const shot of this.shots) shot.stop(this.context.currentTime + 0.08);
    this.shots.clear();
  }

  update(state) {
    // Always track while muted/loading, so enabling sound never replays old clicks.
    const cues = this.track(state);
    if (!this.enabled || !this.loop || document.hidden || this.context.state !== 'running') return;
    for (const cue of cues) {
      const shot = this.context.createBufferSource();
      shot.buffer = this.buffers[cue];
      shot.connect(this.master);
      shot.onended = () => { this.shots.delete(shot); shot.disconnect(); };
      this.shots.add(shot);
      shot.start();
    }
    // The source video changes to soft flame too; lower the same recorded bed
    // during that transition rather than leaving the full jet hiss running.
    const level = state.ready ? Math.min(1, state.jet + state.soft * 0.3) : 0;
    this.burnGain.gain.setTargetAtTime(level * 0.55, this.context.currentTime, 0.04);
  }
}
