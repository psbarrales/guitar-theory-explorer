import Soundfont from "soundfont-player";
import { GM_INSTRUMENTS, INSTRUMENTS } from "./sound.js";

export class Synth {
  constructor() {
    this.context = null;
    this.soundfontCache = new Map();
    this.soundfontLoading = new Map();
    this.soundfontName = "MusyngKite";
  }

  ensureContext() {
    if (!this.context) {
      this.context = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (this.context.state === "suspended") {
      this.context.resume();
    }
  }

  _getSoundfontInstrument(program) {
    const entry = GM_INSTRUMENTS.find((item) => item.program === program);
    const rawName = entry?.rawName || null;
    if (!rawName) return null;
    if (this.soundfontCache.has(rawName)) {
      return this.soundfontCache.get(rawName);
    }
    if (this.soundfontLoading.has(rawName)) {
      return null;
    }
    const loadPromise = Soundfont.instrument(this.context, rawName, {
      soundfont: this.soundfontName,
      format: "mp3"
    })
      .then((instrument) => {
        this.soundfontCache.set(rawName, instrument);
        this.soundfontLoading.delete(rawName);
        return instrument;
      })
      .catch(() => {
        this.soundfontLoading.delete(rawName);
        return null;
      });
    this.soundfontLoading.set(rawName, loadPromise);
    return null;
  }

  play(midiNote, duration, velocity, instrumentId, volume) {
    this.ensureContext();
    const instrument = INSTRUMENTS.find((item) => item.id === instrumentId) || INSTRUMENTS[0];
    const now = this.context.currentTime;
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    const filter = this.context.createBiquadFilter();

    osc.type = instrument.wave;
    osc.frequency.value = 440 * Math.pow(2, (midiNote - 69) / 12);

    filter.type = "lowpass";
    filter.frequency.value = instrument.filter;

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(volume * velocity, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.context.destination);

    osc.start(now);
    osc.stop(now + duration + 0.05);

    this._addPickAttack(now, volume);
  }

  _addPickAttack(now, volume) {
    const noise = this.context.createBuffer(1, this.context.sampleRate * 0.03, this.context.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) {
      data[i] = (Math.random() * 2 - 1) * 0.3;
    }

    const noiseSource = this.context.createBufferSource();
    const noiseGain = this.context.createGain();
    const filter = this.context.createBiquadFilter();

    noiseSource.buffer = noise;
    filter.type = "lowpass";
    filter.frequency.value = 1200;

    noiseGain.gain.setValueAtTime(0.18 * volume, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);

    noiseSource.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(this.context.destination);

    noiseSource.start(now);
    noiseSource.stop(now + 0.06);
  }

  click(kind = "primary", volume = 0.8) {
    this.ensureContext();
    const now = this.context.currentTime;
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    const filter = this.context.createBiquadFilter();

    const presets = {
      accent: { freq: 1200, wave: "square", filter: 2200, level: 0.9 },
      primary: { freq: 900, wave: "triangle", filter: 1800, level: 0.7 },
      secondary: { freq: 620, wave: "sine", filter: 1500, level: 0.6 }
    };
    const preset = presets[kind] || presets.primary;

    osc.type = preset.wave;
    osc.frequency.value = preset.freq;

    filter.type = "highpass";
    filter.frequency.value = preset.filter;

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(volume * preset.level, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.context.destination);

    osc.start(now);
    osc.stop(now + 0.1);
  }

  playProgramNote(midiNote, duration, velocity, program, volume) {
    this.ensureContext();
    const gainValue = Math.min(1, volume * velocity * 1.3);
    if (program >= 128) {
      this._playDrumSample(midiNote, gainValue);
      return;
    }
    const instrument = this._getSoundfontInstrument(program);
    if (instrument) {
      instrument.play(midiNote, this.context.currentTime, duration, {
        gain: gainValue
      });
      return;
    }

    const now = this.context.currentTime;
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    const filter = this.context.createBiquadFilter();

    const family = Math.floor(program / 8);
    const presets = [
      { wave: "triangle", filter: 1800 }, // piano
      { wave: "sine", filter: 2200 }, // chromatic
      { wave: "square", filter: 1400 }, // organ
      { wave: "triangle", filter: 1600 }, // guitar
      { wave: "sine", filter: 1000 }, // bass
      { wave: "sawtooth", filter: 2400 }, // strings
      { wave: "square", filter: 2000 }, // brass
      { wave: "triangle", filter: 1600 }, // reed
      { wave: "sine", filter: 2400 }, // pipe
      { wave: "square", filter: 1800 }, // lead
      { wave: "sawtooth", filter: 1400 }, // pad
      { wave: "square", filter: 1800 }, // fx
      { wave: "triangle", filter: 1600 }, // ethnic
      { wave: "square", filter: 1500 }, // percussive
      { wave: "sawtooth", filter: 1200 }, // sfx
      { wave: "sine", filter: 1800 } // fallback
    ];
    const preset = presets[family] || presets[presets.length - 1];

    osc.type = preset.wave;
    osc.frequency.value = 440 * Math.pow(2, (midiNote - 69) / 12);

    filter.type = "lowpass";
    filter.frequency.value = preset.filter;

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(gainValue, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.context.destination);

    osc.start(now);
    osc.stop(now + duration + 0.05);
  }

  _playDrumSample(midiNote, gainValue) {
    const now = this.context.currentTime;
    if (midiNote <= 36) {
      this.playDrum("kick", gainValue);
      return;
    }
    if (midiNote <= 41) {
      this.playDrum("snare", gainValue);
      return;
    }
    if (midiNote <= 46) {
      this.playDrum("hat", gainValue);
      return;
    }
    if (midiNote <= 50) {
      this.playDrum("tomHigh", gainValue);
      return;
    }
    if (midiNote <= 55) {
      this.playDrum("crash", gainValue);
      return;
    }
    this.playDrum("tomLow", gainValue);
  }

  playDrum(kind = "kick", volume = 0.9) {
    this.ensureContext();
    const now = this.context.currentTime;

    if (kind === "kick") {
      const osc = this.context.createOscillator();
      const gain = this.context.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(160, now);
      osc.frequency.exponentialRampToValueAtTime(55, now + 0.12);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(0.9 * volume, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);
      osc.connect(gain);
      gain.connect(this.context.destination);
      osc.start(now);
      osc.stop(now + 0.22);
      return;
    }

    if (kind === "snare") {
      const noise = this.context.createBuffer(1, this.context.sampleRate * 0.12, this.context.sampleRate);
      const data = noise.getChannelData(0);
      for (let i = 0; i < data.length; i += 1) {
        data[i] = (Math.random() * 2 - 1) * 0.5;
      }
      const noiseSource = this.context.createBufferSource();
      const noiseFilter = this.context.createBiquadFilter();
      const noiseGain = this.context.createGain();
      noiseSource.buffer = noise;
      noiseFilter.type = "highpass";
      noiseFilter.frequency.value = 1200;
      noiseGain.gain.setValueAtTime(0.0001, now);
      noiseGain.gain.linearRampToValueAtTime(0.7 * volume, now + 0.01);
      noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
      noiseSource.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(this.context.destination);
      noiseSource.start(now);
      noiseSource.stop(now + 0.13);

      const osc = this.context.createOscillator();
      const oscGain = this.context.createGain();
      osc.type = "triangle";
      osc.frequency.value = 180;
      oscGain.gain.setValueAtTime(0.0001, now);
      oscGain.gain.linearRampToValueAtTime(0.4 * volume, now + 0.01);
      oscGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
      osc.connect(oscGain);
      oscGain.connect(this.context.destination);
      osc.start(now);
      osc.stop(now + 0.13);
      return;
    }

    if (kind === "hat") {
      const noise = this.context.createBuffer(1, this.context.sampleRate * 0.08, this.context.sampleRate);
      const data = noise.getChannelData(0);
      for (let i = 0; i < data.length; i += 1) {
        data[i] = (Math.random() * 2 - 1) * 0.35;
      }
      const noiseSource = this.context.createBufferSource();
      const filter = this.context.createBiquadFilter();
      const gain = this.context.createGain();
      noiseSource.buffer = noise;
      filter.type = "highpass";
      filter.frequency.value = 5000;
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(0.5 * volume, now + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.07);
      noiseSource.connect(filter);
      filter.connect(gain);
      gain.connect(this.context.destination);
      noiseSource.start(now);
      noiseSource.stop(now + 0.08);
      return;
    }

    if (kind === "crash") {
      const noise = this.context.createBuffer(1, this.context.sampleRate * 0.3, this.context.sampleRate);
      const data = noise.getChannelData(0);
      for (let i = 0; i < data.length; i += 1) {
        data[i] = (Math.random() * 2 - 1) * 0.35;
      }
      const noiseSource = this.context.createBufferSource();
      const filter = this.context.createBiquadFilter();
      const gain = this.context.createGain();
      noiseSource.buffer = noise;
      filter.type = "highpass";
      filter.frequency.value = 4000;
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(0.5 * volume, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);
      noiseSource.connect(filter);
      filter.connect(gain);
      gain.connect(this.context.destination);
      noiseSource.start(now);
      noiseSource.stop(now + 0.6);
      return;
    }

    if (kind === "tomLow" || kind === "tomHigh") {
      const osc = this.context.createOscillator();
      const gain = this.context.createGain();
      const freq = kind === "tomLow" ? 110 : 180;
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.7, now + 0.12);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(0.7 * volume, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);
      osc.connect(gain);
      gain.connect(this.context.destination);
      osc.start(now);
      osc.stop(now + 0.22);
      return;
    }

    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    const freq = kind === "perc2" ? 380 : 520;
    osc.type = "sine";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.6 * volume, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.15);
    osc.connect(gain);
    gain.connect(this.context.destination);
    osc.start(now);
    osc.stop(now + 0.16);
  }
}
