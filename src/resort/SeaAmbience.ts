/** Quiet, entirely synthesized ocean wash. Construction is silent.
 * First play() must be called from the user's audio-toggle gesture. */
export default class SeaAmbience {
  private context: AudioContext | null = null;
  private source: AudioBufferSourceNode | null = null;
  private lowpass: BiquadFilterNode | null = null;
  private highpass: BiquadFilterNode | null = null;
  private master: GainNode | null = null;
  private suspendTimer: ReturnType<typeof setTimeout> | undefined;
  private suspending: Promise<void> | null = null;
  private wanted = false;
  private disposed = false;
  private revision = 0;

  private createGraph(): boolean {
    if (this.context) return true;
    if (typeof window === 'undefined') return false;
    const Audio =
      window.AudioContext ??
      (
        window as Window & {
          webkitAudioContext?: typeof AudioContext;
        }
      ).webkitAudioContext;
    if (!Audio) return false;
    const context = new Audio();
    const frames = Math.floor(context.sampleRate * 12);
    const blend = Math.floor(context.sampleRate * 0.7);
    const buffer = context.createBuffer(2, frames, context.sampleRate);
    for (let channel = 0; channel < 2; channel++) {
      let seed = 173 + channel * 619;
      let warm = 0;
      let low = 0;
      const noise = new Float32Array(frames + blend);
      for (let i = 0; i < noise.length; i++) {
        seed = (seed * 16807) % 2147483647;
        const white = seed / 1073741823.5 - 1;
        warm = warm * 0.91 + white * 0.09;
        low = low * 0.985 + white * 0.015;
        noise[i] = warm * 0.7 + low * 0.3;
      }
      const samples = buffer.getChannelData(channel);
      let peak = 0.001;
      for (let i = 0; i < frames; i++) {
        // Join to the naturally consecutive tail sample at the loop boundary,
        // then gradually return to the beginning. Both ends share the same wash level.
        const t = Math.min(1, i / blend);
        const smooth = t * t * (3 - 2 * t);
        const joined = i < blend ? noise[frames + i] * (1 - smooth) + noise[i] * smooth : noise[i];
        const wave = 0.25 + 0.75 * Math.pow(0.5 - 0.5 * Math.cos((i / frames) * Math.PI * 2), 1.7);
        samples[i] = joined * wave;
        peak = Math.max(peak, Math.abs(samples[i]));
      }
      for (let i = 0; i < frames; i++) samples[i] *= 0.85 / peak;
    }
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const lowpass = context.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 950;
    lowpass.Q.value = 0.45;
    const highpass = context.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.value = 90;
    highpass.Q.value = 0.5;
    const master = context.createGain();
    master.gain.value = 0;
    source.connect(lowpass).connect(highpass).connect(master).connect(context.destination);
    source.start();
    this.context = context;
    this.source = source;
    this.lowpass = lowpass;
    this.highpass = highpass;
    this.master = master;
    return true;
  }

  private clearTimer() {
    if (this.suspendTimer !== undefined) clearTimeout(this.suspendTimer);
    this.suspendTimer = undefined;
  }

  private fadeTo(value: number, seconds: number) {
    if (!this.context || !this.master) return;
    const now = this.context.currentTime;
    const gain = this.master.gain;
    if (typeof gain.cancelAndHoldAtTime === 'function') gain.cancelAndHoldAtTime(now);
    else {
      const current = gain.value;
      gain.cancelScheduledValues(now);
      gain.setValueAtTime(current, now);
    }
    gain.linearRampToValueAtTime(value, now + seconds);
  }

  async play(): Promise<void> {
    if (this.disposed) return;
    const revision = ++this.revision;
    this.wanted = true;
    this.clearTimer();
    if (!this.createGraph()) {
      this.wanted = false;
      return;
    }
    const context = this.context!;
    // A previous pause may already be awaiting the browser's suspend operation.
    // Complete it before resuming; otherwise rapid off/on can end up suspended.
    if (this.suspending) await this.suspending;
    if (this.disposed || !this.wanted || revision !== this.revision) return;
    try {
      // For the first play this is invoked synchronously in the gesture call,
      // before yielding to a promise. Later resumes reuse the unlocked context.
      await context.resume();
    } catch (error) {
      if (revision === this.revision) this.wanted = false;
      throw error;
    }
    if (this.disposed || !this.wanted || revision !== this.revision) return;
    this.fadeTo(0.02, 0.25);
  }

  pause(): void {
    if (this.disposed) return;
    this.wanted = false;
    ++this.revision;
    this.clearTimer();
    const context = this.context;
    if (!context || context.state === 'closed') return;
    this.fadeTo(0, 0.12);
    this.suspendTimer = setTimeout(() => {
      this.suspendTimer = undefined;
      if (this.wanted || this.disposed || context.state === 'closed') return;
      const pending = context.suspend().catch(() => undefined);
      this.suspending = pending;
      void pending.then(() => {
        if (this.suspending === pending) this.suspending = null;
      });
    }, 150);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.wanted = false;
    ++this.revision;
    this.clearTimer();
    try {
      this.source?.stop();
    } catch {
      /* A closed context may have stopped it. */
    }
    this.source?.disconnect();
    this.lowpass?.disconnect();
    this.highpass?.disconnect();
    this.master?.disconnect();
    if (this.context && this.context.state !== 'closed') void this.context.close().catch(() => undefined);
    this.context = null;
    this.source = null;
    this.lowpass = null;
    this.highpass = null;
    this.master = null;
    this.suspending = null;
  }
}
