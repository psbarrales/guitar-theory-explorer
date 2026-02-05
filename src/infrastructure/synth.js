import { INSTRUMENTS } from "./sound.js";

export class Synth {
  constructor() {
    this.context = null;
  }

  ensureContext() {
    if (!this.context) {
      this.context = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (this.context.state === "suspended") {
      this.context.resume();
    }
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
}
