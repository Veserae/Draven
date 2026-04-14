import type { WorldTheme, WeatherCondition } from '../types/world';

export class AmbientAudio {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private nodes: AudioNode[] = [];
  private playing = false;

  private getCtx(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.masterGain = this.ctx.createGain();
      this.masterGain.connect(this.ctx.destination);
    }
    return this.ctx;
  }

  async start(theme: WorldTheme, weather: WeatherCondition, volume: number) {
    if (this.playing) return;
    const ctx = this.getCtx();
    if (ctx.state === 'suspended') await ctx.resume();

    this.masterGain!.gain.setValueAtTime(volume, ctx.currentTime);
    this.playing = true;

    if (theme === 'island') this.buildIslandSoundscape(ctx, weather);
    else if (theme === 'nebula') this.buildNebulaSoundscape(ctx);
    else this.buildUnderwaterSoundscape(ctx);
  }

  stop() {
    this.nodes.forEach(n => { try { n.disconnect(); } catch {} });
    this.nodes = [];
    this.playing = false;
  }

  setVolume(v: number) {
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.linearRampToValueAtTime(v, this.ctx.currentTime + 0.5);
    }
  }

  private makeNoise(ctx: AudioContext, color: 'white' | 'pink' = 'white'): AudioBufferSourceNode {
    const bufLen = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
    const data = buf.getChannelData(0);
    if (color === 'white') {
      for (let i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1;
    } else {
      // Simple pink noise approximation
      let b0 = 0, b1 = 0, b2 = 0;
      for (let i = 0; i < bufLen; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        data[i] = (b0 + b1 + b2 + white * 0.5362) / 3.5;
      }
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    return src;
  }

  private makeTone(ctx: AudioContext, freq: number, type: OscillatorType = 'sine', gain = 0.03): { osc: OscillatorNode; gain: GainNode } {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.value = gain;
    osc.connect(g);
    return { osc, gain: g };
  }

  private buildIslandSoundscape(ctx: AudioContext, weather: WeatherCondition) {
    // Wind layer
    const wind = this.makeNoise(ctx, 'pink');
    const windFilter = ctx.createBiquadFilter();
    windFilter.type = 'bandpass';
    windFilter.frequency.value = 400;
    windFilter.Q.value = 0.3;
    const windGain = ctx.createGain();
    windGain.gain.value = weather === 'storm' ? 0.06 : 0.025;
    wind.connect(windFilter);
    windFilter.connect(windGain);
    windGain.connect(this.masterGain!);
    wind.start();
    this.nodes.push(wind, windFilter, windGain);

    // Rain layer (if applicable)
    if (weather === 'rain' || weather === 'storm') {
      const rain = this.makeNoise(ctx, 'white');
      const rainFilter = ctx.createBiquadFilter();
      rainFilter.type = 'highpass';
      rainFilter.frequency.value = 3000;
      const rainGain = ctx.createGain();
      rainGain.gain.value = 0.04;
      rain.connect(rainFilter);
      rainFilter.connect(rainGain);
      rainGain.connect(this.masterGain!);
      rain.start();
      this.nodes.push(rain, rainFilter, rainGain);
    }

    // Distant wave tones
    [55, 110, 165].forEach((freq, i) => {
      const { osc, gain } = this.makeTone(ctx, freq, 'sine', 0.012);
      // Slow LFO on each wave tone
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      lfo.frequency.value = 0.08 + i * 0.03;
      lfoGain.gain.value = 0.008;
      lfo.connect(lfoGain);
      lfoGain.connect(gain.gain);
      gain.connect(this.masterGain!);
      osc.start();
      lfo.start();
      this.nodes.push(osc, gain, lfo, lfoGain);
    });
  }

  private buildNebulaSoundscape(ctx: AudioContext) {
    // Deep space drones
    [40, 60, 80, 120].forEach((freq, i) => {
      const { osc, gain } = this.makeTone(ctx, freq, 'sine', 0.018);
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      lfo.frequency.value = 0.05 + i * 0.02;
      lfoGain.gain.value = 0.01;
      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);
      gain.connect(this.masterGain!);
      osc.start(); lfo.start();
      this.nodes.push(osc, gain, lfo, lfoGain);
    });

    // Shimmer high pad
    const shimmer = this.makeNoise(ctx, 'pink');
    const f = ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 6000;
    const g = ctx.createGain();
    g.gain.value = 0.008;
    shimmer.connect(f); f.connect(g); g.connect(this.masterGain!);
    shimmer.start();
    this.nodes.push(shimmer, f, g);
  }

  private buildUnderwaterSoundscape(ctx: AudioContext) {
    // Resonant underwater rumble
    const noise = this.makeNoise(ctx, 'pink');
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 300;
    filter.Q.value = 8;
    const g = ctx.createGain();
    g.gain.value = 0.04;
    noise.connect(filter); filter.connect(g); g.connect(this.masterGain!);
    noise.start();
    this.nodes.push(noise, filter, g);

    // Bubble-like random pings
    const schedBubble = () => {
      if (!this.playing) return;
      const osc = ctx.createOscillator();
      const env = ctx.createGain();
      osc.frequency.value = 400 + Math.random() * 600;
      osc.type = 'sine';
      env.gain.setValueAtTime(0, ctx.currentTime);
      env.gain.linearRampToValueAtTime(0.03, ctx.currentTime + 0.01);
      env.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.3);
      osc.connect(env); env.connect(this.masterGain!);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.35);
      this.nodes.push(osc, env);
      setTimeout(schedBubble, 800 + Math.random() * 3000);
    };
    setTimeout(schedBubble, 500);

    // Low whale-like tones
    [60, 90].forEach(freq => {
      const { osc, gain } = this.makeTone(ctx, freq, 'sine', 0.02);
      const lfo = ctx.createOscillator();
      const lg = ctx.createGain();
      lfo.frequency.value = 0.12;
      lg.gain.value = 15;
      lfo.connect(lg); lg.connect(osc.frequency);
      gain.connect(this.masterGain!);
      osc.start(); lfo.start();
      this.nodes.push(osc, gain, lfo, lg);
    });
  }
}
