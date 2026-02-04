const NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const MAJOR_INTERVALS = [0, 2, 4, 5, 7, 9, 11];

const TUNING = [
  { label: "E", midi: 64 },
  { label: "B", midi: 59 },
  { label: "G", midi: 55 },
  { label: "D", midi: 50 },
  { label: "A", midi: 45 },
  { label: "E", midi: 40 }
];

const RAW_SCALES = [
  { id: "major", name: "Mayor (Ionico)", formula: "1 2 3 4 5 6 7" },
  { id: "dorian", name: "Dorico", formula: "1 2 b3 4 5 6 b7" },
  { id: "phrygian", name: "Frigio", formula: "1 b2 b3 4 5 b6 b7" },
  { id: "lydian", name: "Lidio", formula: "1 2 3 #4 5 6 7" },
  { id: "mixolydian", name: "Mixolidio", formula: "1 2 3 4 5 6 b7" },
  { id: "aeolian", name: "Menor natural", formula: "1 2 b3 4 5 b6 b7" },
  { id: "locrian", name: "Locrio", formula: "1 b2 b3 4 b5 b6 b7" },
  { id: "harmonic_minor", name: "Menor armonica", formula: "1 2 b3 4 5 b6 7" },
  { id: "melodic_minor", name: "Menor melodica", formula: "1 2 b3 4 5 6 7" },
  { id: "harmonic_major", name: "Mayor armonica", formula: "1 2 3 4 5 b6 7" },
  { id: "double_harmonic", name: "Doble armonica (Bizantina)", formula: "1 b2 3 4 5 b6 7" },
  { id: "hungarian_minor", name: "Hungara menor", formula: "1 2 b3 #4 5 b6 7" },
  { id: "neapolitan_minor", name: "Napolitana menor", formula: "1 b2 b3 4 5 b6 7" },
  { id: "neapolitan_major", name: "Napolitana mayor", formula: "1 b2 3 4 5 6 7" },
  { id: "phrygian_dominant", name: "Frigio dominante", formula: "1 b2 3 4 5 b6 b7" },
  { id: "lydian_dominant", name: "Lidio dominante", formula: "1 2 3 #4 5 6 b7" },
  { id: "mixolydian_b6", name: "Mixolidio b6", formula: "1 2 3 4 5 b6 b7" },
  { id: "lydian_augmented", name: "Lidio aumentado", formula: "1 2 3 #4 #5 6 7" },
  { id: "ionian_sharp5", name: "Ionico #5", formula: "1 2 3 4 #5 6 7" },
  { id: "dorian_b2", name: "Dorico b2", formula: "1 b2 b3 4 5 6 b7" },
  { id: "locrian_sharp2", name: "Locrio #2", formula: "1 2 b3 4 b5 b6 b7" },
  { id: "pentatonic_major", name: "Pentatonica mayor", formula: "1 2 3 5 6" },
  { id: "pentatonic_minor", name: "Pentatonica menor", formula: "1 b3 4 5 b7" }
];

function parseFormula(formula) {
  const mask = new Array(7).fill(false);
  const adjustments = new Array(7).fill(0);
  const tokens = formula.trim().split(/\s+/).filter(Boolean);

  tokens.forEach((token) => {
    const match = token.match(/^([b#x]*)([1-7])$/i);
    if (!match) return;
    const accidental = match[1].toLowerCase();
    const degree = Number(match[2]) - 1;
    let shift = 0;
    for (const char of accidental.replace(/x/g, "##")) {
      if (char === "b") shift -= 1;
      if (char === "#") shift += 1;
    }
    mask[degree] = true;
    adjustments[degree] = shift;
  });

  return { mask, adjustments };
}

const SCALES = RAW_SCALES.map((scale) => ({
  ...scale,
  ...parseFormula(scale.formula)
}));

const INSTRUMENTS = [
  { id: "nylon", name: "Guitarra nylon", program: 24, wave: "triangle", filter: 1200 },
  { id: "steel", name: "Guitarra acero", program: 25, wave: "triangle", filter: 1800 },
  { id: "jazz", name: "Electrica jazz", program: 26, wave: "sine", filter: 900 },
  { id: "clean", name: "Electrica clean", program: 27, wave: "sawtooth", filter: 1400 },
  { id: "dist", name: "Electrica distorsion", program: 30, wave: "square", filter: 2000 }
];

const state = {
  rootIndex: 0,
  presetId: SCALES[0].id,
  degreeMask: [...SCALES[0].mask],
  degreeAdjustments: [...SCALES[0].adjustments],
  fretCount: 17,
  positionStart: 1,
  positionWindowSize: 5,
  activePosition: 0,
  volume: 0.7,
  instrumentId: INSTRUMENTS[0].id,
  midiOutputId: "internal",
  midiAccess: null,
  midiOutput: null,
  chordMode: false,
  chordNotes: new Array(6).fill(null),
  showInversion: true
};

const rootSelect = document.getElementById("rootSelect");
const presetSelect = document.getElementById("presetSelect");
const degreeToggles = document.getElementById("degreeToggles");
const fretCountInput = document.getElementById("fretCount");
const fretCountValue = document.getElementById("fretCountValue");
const positionStartInput = document.getElementById("positionStart");
const positionStartValue = document.getElementById("positionStartValue");
const positionWindowSelect = document.getElementById("positionWindow");
const presetFormula = document.getElementById("presetFormula");
const fretNumbers = document.getElementById("fretNumbers");
const fretMarkers = document.getElementById("fretMarkers");
const fretboard = document.getElementById("fretboard");
const scaleName = document.getElementById("scaleName");
const scaleFormula = document.getElementById("scaleFormula");
const scaleNotes = document.getElementById("scaleNotes");
const positionButtons = document.getElementById("positionButtons");
const playAllBtn = document.getElementById("playAll");
const midiOutputSelect = document.getElementById("midiOutput");
const instrumentSelect = document.getElementById("instrumentSelect");
const volumeInput = document.getElementById("volume");
const volumeValue = document.getElementById("volumeValue");
const chordModeToggle = document.getElementById("chordMode");
const clearChordBtn = document.getElementById("clearChord");
const chordName = document.getElementById("chordName");
const chordInversion = document.getElementById("chordInversion");
const chordNotesEl = document.getElementById("chordNotes");
const chordSpanEl = document.getElementById("chordSpan");
const chordHint = document.getElementById("chordHint");
const showInversionToggle = document.getElementById("showInversion");

class Synth {
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

  play(midiNote, duration = 0.6, velocity = 0.8) {
    this.ensureContext();
    const instrument = INSTRUMENTS.find((item) => item.id === state.instrumentId) || INSTRUMENTS[0];
    const now = this.context.currentTime;
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    const filter = this.context.createBiquadFilter();

    osc.type = instrument.wave;
    osc.frequency.value = 440 * Math.pow(2, (midiNote - 69) / 12);

    filter.type = "lowpass";
    filter.frequency.value = instrument.filter;

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(state.volume * velocity, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.context.destination);

    osc.start(now);
    osc.stop(now + duration + 0.05);

    this._addPickAttack(now);
  }

  _addPickAttack(now) {
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

    noiseGain.gain.setValueAtTime(0.18 * state.volume, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);

    noiseSource.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(this.context.destination);

    noiseSource.start(now);
    noiseSource.stop(now + 0.06);
  }
}

const synth = new Synth();

function noteNameFromIndex(index) {
  return NOTES[(index + 12) % 12];
}

function scaleById(id) {
  return SCALES.find((scale) => scale.id === id) || SCALES[0];
}

function getActiveIntervals() {
  const intervals = [];
  for (let i = 0; i < 7; i += 1) {
    if (!state.degreeMask[i]) continue;
    const interval = (MAJOR_INTERVALS[i] + state.degreeAdjustments[i] + 120) % 12;
    intervals.push(interval);
  }
  return intervals;
}

function getScaleNoteIndices() {
  return new Set(getActiveIntervals().map((interval) => (state.rootIndex + interval) % 12));
}

function getScaleNoteNames() {
  const intervals = getActiveIntervals();
  return intervals.map((interval) => noteNameFromIndex(state.rootIndex + interval));
}

function getActiveDegreeIndices() {
  const indices = [];
  for (let i = 0; i < 7; i += 1) {
    if (state.degreeMask[i]) indices.push(i);
  }
  return indices;
}

function getPitchClassForDegree(degreeIndex) {
  const interval = (MAJOR_INTERVALS[degreeIndex] + state.degreeAdjustments[degreeIndex] + 120) % 12;
  return (state.rootIndex + interval) % 12;
}

function getScaleCandidatesForString(stringMidi, start, end, scaleSet) {
  const candidates = [];
  for (let fret = start; fret <= end; fret += 1) {
    const pitchClass = (stringMidi + fret) % 12;
    if (scaleSet.has(pitchClass)) {
      candidates.push({ fret, pitchClass });
    }
  }
  return candidates;
}

function findTripletWithinSpan(candidates, spanLimit, avoidPitchClasses, center) {
  const valid = [];
  for (let i = 0; i < candidates.length - 2; i += 1) {
    for (let j = i + 1; j < candidates.length - 1; j += 1) {
      for (let k = j + 1; k < candidates.length; k += 1) {
        const a = candidates[i];
        const b = candidates[j];
        const c = candidates[k];
        if (c.fret - a.fret > spanLimit) continue;
        if (avoidPitchClasses) {
          if (avoidPitchClasses.has(a.pitchClass)) continue;
          if (avoidPitchClasses.has(b.pitchClass)) continue;
          if (avoidPitchClasses.has(c.pitchClass)) continue;
        }
        const mid = (a.fret + b.fret + c.fret) / 3;
        valid.push({ notes: [a, b, c], score: Math.abs(mid - center), mid });
      }
    }
  }
  if (!valid.length) return null;
  valid.sort((x, y) => x.score - y.score || y.mid - x.mid);
  return valid[0].notes;
}

function findPairWithinSpan(candidates, spanLimit, avoidPitchClasses, center) {
  const valid = [];
  for (let i = 0; i < candidates.length - 1; i += 1) {
    for (let j = i + 1; j < candidates.length; j += 1) {
      const a = candidates[i];
      const b = candidates[j];
      if (b.fret - a.fret > spanLimit) continue;
      if (avoidPitchClasses) {
        if (avoidPitchClasses.has(a.pitchClass)) continue;
        if (avoidPitchClasses.has(b.pitchClass)) continue;
      }
      const mid = (a.fret + b.fret) / 2;
      valid.push({ notes: [a, b], score: Math.abs(mid - center), mid });
    }
  }
  if (!valid.length) return null;
  valid.sort((x, y) => x.score - y.score || y.mid - x.mid);
  return valid[0].notes;
}

function selectNotesForString(stringMidi, start, end, scaleSet, maxNotes, avoidPitchClasses) {
  const candidates = getScaleCandidatesForString(stringMidi, start, end, scaleSet);
  if (!candidates.length) return [];

  candidates.sort((a, b) => a.fret - b.fret);
  const center = (start + end) / 2;

  if (maxNotes === 3) {
    const triplet = findTripletWithinSpan(candidates, 3, avoidPitchClasses, center);
    if (triplet) return triplet;
    const pair = findPairWithinSpan(candidates, 3, avoidPitchClasses, center);
    if (pair) return pair;
    const fallback = candidates.find(
      (item) => !avoidPitchClasses || !avoidPitchClasses.has(item.pitchClass)
    );
    return fallback ? [fallback] : [candidates[0]];
  }

  const mid = center;
  candidates.sort((a, b) => Math.abs(a.fret - mid) - Math.abs(b.fret - mid));

  const selected = [];
  for (const candidate of candidates) {
    if (avoidPitchClasses && avoidPitchClasses.has(candidate.pitchClass)) continue;
    selected.push(candidate);
    if (selected.length >= maxNotes) break;
  }

  return selected.slice(0, maxNotes);
}

function formatDegreeToken(degreeIndex) {
  const adj = state.degreeAdjustments[degreeIndex];
  let accidental = "";
  if (adj === -2) accidental = "bb";
  if (adj === -1) accidental = "b";
  if (adj === 1) accidental = "#";
  if (adj === 2) accidental = "x";
  return `${accidental}${degreeIndex + 1}`;
}

function getFormulaTokens() {
  const tokens = [];
  for (let i = 0; i < 7; i += 1) {
    if (!state.degreeMask[i]) continue;
    tokens.push(formatDegreeToken(i));
  }
  return tokens;
}

function scaleMatchesState(scale) {
  for (let i = 0; i < 7; i += 1) {
    if (state.degreeMask[i] !== scale.mask[i]) return false;
    if (state.degreeMask[i] && state.degreeAdjustments[i] !== scale.adjustments[i]) return false;
  }
  return true;
}

function findMatchingScale() {
  return SCALES.find((scale) => scaleMatchesState(scale)) || null;
}

function getChordSelection() {
  return state.chordNotes.filter(Boolean);
}

function getChordSpan() {
  const frets = getChordSelection().map((note) => note.fret);
  if (!frets.length) return null;
  return Math.max(...frets) - Math.min(...frets);
}

function pitchClassName(pc) {
  return NOTES[(pc + 12) % 12];
}

const CHORD_DEFS = [
  { name: "", intervals: [0, 4, 7] },
  { name: "m", intervals: [0, 3, 7] },
  { name: "dim", intervals: [0, 3, 6] },
  { name: "aug", intervals: [0, 4, 8] },
  { name: "sus2", intervals: [0, 2, 7] },
  { name: "sus4", intervals: [0, 5, 7] },
  { name: "5", intervals: [0, 7] },
  { name: "add9", intervals: [0, 4, 7, 2] },
  { name: "madd9", intervals: [0, 3, 7, 2] },
  { name: "add11", intervals: [0, 4, 7, 5] },
  { name: "madd11", intervals: [0, 3, 7, 5] },
  { name: "6", intervals: [0, 4, 7, 9] },
  { name: "m6", intervals: [0, 3, 7, 9] },
  { name: "6/9", intervals: [0, 4, 7, 9, 2] },
  { name: "7", intervals: [0, 4, 7, 10] },
  { name: "maj7", intervals: [0, 4, 7, 11] },
  { name: "m7", intervals: [0, 3, 7, 10] },
  { name: "m7b5", intervals: [0, 3, 6, 10] },
  { name: "dim7", intervals: [0, 3, 6, 9] },
  { name: "mMaj7", intervals: [0, 3, 7, 11] },
  { name: "7b5", intervals: [0, 4, 6, 10] },
  { name: "7#5", intervals: [0, 4, 8, 10] },
  { name: "maj7#5", intervals: [0, 4, 8, 11] },
  { name: "9", intervals: [0, 4, 7, 10, 2] },
  { name: "maj9", intervals: [0, 4, 7, 11, 2] },
  { name: "m9", intervals: [0, 3, 7, 10, 2] },
  { name: "11", intervals: [0, 4, 7, 10, 2, 5] },
  { name: "maj11", intervals: [0, 4, 7, 11, 2, 5] },
  { name: "m11", intervals: [0, 3, 7, 10, 2, 5] },
  { name: "7sus4", intervals: [0, 5, 7, 10] },
  { name: "13", intervals: [0, 4, 7, 10, 2, 5, 9] },
  { name: "maj13", intervals: [0, 4, 7, 11, 2, 5, 9] },
  { name: "m13", intervals: [0, 3, 7, 10, 2, 5, 9] }
];

const INTERVAL_LABELS = {
  0: "1",
  1: "b2",
  2: "2",
  3: "b3",
  4: "3",
  5: "4",
  6: "b5",
  7: "5",
  8: "#5",
  9: "6",
  10: "b7",
  11: "7"
};

function detectChordData() {
  const selection = getChordSelection();
  if (!selection.length) return null;
  const pitchClasses = Array.from(new Set(selection.map((note) => note.pitchClass)));
  if (!pitchClasses.length) return null;

  let best = null;
  pitchClasses.forEach((rootPc) => {
    const intervals = pitchClasses
      .map((pc) => (pc - rootPc + 12) % 12)
      .sort((a, b) => a - b);

    CHORD_DEFS.forEach((def) => {
      const required = def.intervals.map((interval) => interval % 12);
      const hasAll = required.every((interval) => intervals.includes(interval));
      if (!hasAll) return;
      const extras = intervals.filter((interval) => !required.includes(interval));
      const score = required.length * 10 - extras.length;
      const candidate = {
        root: rootPc,
        def,
        score,
        required: required.length,
        extras: extras.length,
        intervals
      };
      if (
        !best ||
        candidate.score > best.score ||
        (candidate.score === best.score && candidate.required > best.required)
      ) {
        best = candidate;
      }
    });
  });

  if (!best) return null;
  const bass = [...selection].sort((a, b) => a.midi - b.midi)[0];
  const bassPc = bass ? bass.pitchClass : best.root;
  const chordName = `${pitchClassName(best.root)}${best.def.name}`;
  return {
    rootPc: best.root,
    bassPc,
    def: best.def,
    name: chordName,
    intervals: best.intervals
  };
}

function getInversionLabel(chordData) {
  if (!chordData) return "-";
  const bassInterval = (chordData.bassPc - chordData.rootPc + 12) % 12;
  if (bassInterval === 0) return "Posicion raiz";
  const ordered = chordData.def.intervals.map((i) => i % 12);
  const index = ordered.indexOf(bassInterval);
  if (index === -1) return "Inversion";
  const inversionNumber = index;
  if (inversionNumber === 1) return "1ra inversion";
  if (inversionNumber === 2) return "2da inversion";
  if (inversionNumber === 3) return "3ra inversion";
  return "Inversion";
}

function updateChordInfo() {
  const selection = getChordSelection();
  if (!selection.length) {
    chordName.textContent = "-";
    chordInversion.textContent = "-";
    chordNotesEl.textContent = "-";
    chordSpanEl.textContent = "-";
    chordHint.textContent = "Click en el mastil para armar el acorde.";
    return;
  }

  const inversionLabel = getInversionLabel(chordData);
  let displayName = chordData ? chordData.name : "Acorde sin nombre";
  if (chordData && state.showInversion && chordData.bassPc !== chordData.rootPc) {
    displayName = `${chordData.name}/${pitchClassName(chordData.bassPc)}`;
  }
  chordName.textContent = chordData ? displayName : "Acorde sin nombre";
  chordInversion.textContent = chordData ? inversionLabel : "-";
  const ordered = [...selection].sort((a, b) => a.midi - b.midi);
  chordNotesEl.textContent = ordered.map((note) => pitchClassName(note.pitchClass)).join(" ");
  const span = getChordSpan();
  chordSpanEl.textContent = span !== null ? `${span} trastes` : "-";
  chordHint.textContent = "Max 5 trastes de distancia.";
}

function clearChord() {
  state.chordNotes = new Array(6).fill(null);
  updateChordInfo();
}

function buildRootOptions() {
  NOTES.forEach((note, index) => {
    const option = document.createElement("option");
    option.value = index;
    option.textContent = note;
    rootSelect.appendChild(option);
  });
  rootSelect.value = state.rootIndex;
}

function buildPresetOptions() {
  presetSelect.innerHTML = "";
  SCALES.forEach((scale) => {
    const option = document.createElement("option");
    option.value = scale.id;
    option.textContent = scale.name;
    presetSelect.appendChild(option);
  });
  presetSelect.value = state.presetId;
}

function buildInstrumentOptions() {
  INSTRUMENTS.forEach((instrument) => {
    const option = document.createElement("option");
    option.value = instrument.id;
    option.textContent = instrument.name;
    instrumentSelect.appendChild(option);
  });
  instrumentSelect.value = state.instrumentId;
}

function buildDegreeToggles() {
  degreeToggles.innerHTML = "";
  for (let i = 0; i < 7; i += 1) {
    const card = document.createElement("div");
    card.className = "degree-card";

    const label = document.createElement("span");
    label.className = "degree-label";
    label.textContent = `Grado ${i + 1}`;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "degree-toggle";
    button.dataset.index = i;
    button.textContent = `${i + 1}`;

    const select = document.createElement("select");
    select.className = "degree-adjust";
    select.dataset.index = i;
    [
      { value: -2, label: "bb" },
      { value: -1, label: "b" },
      { value: 0, label: "nat" },
      { value: 1, label: "#" },
      { value: 2, label: "x" }
    ].forEach((optionData) => {
      const option = document.createElement("option");
      option.value = optionData.value;
      option.textContent = optionData.label;
      select.appendChild(option);
    });

    card.appendChild(label);
    card.appendChild(button);
    card.appendChild(select);
    degreeToggles.appendChild(card);
  }
  updateDegreeToggles();
}

function updateDegreeToggles() {
  degreeToggles.querySelectorAll(".degree-toggle").forEach((button) => {
    const idx = Number(button.dataset.index);
    button.classList.toggle("active", state.degreeMask[idx]);
  });
  degreeToggles.querySelectorAll(".degree-adjust").forEach((select) => {
    const idx = Number(select.dataset.index);
    select.value = String(state.degreeAdjustments[idx]);
    select.disabled = !state.degreeMask[idx];
  });
}

function updateScaleSummary() {
  const match = findMatchingScale();
  if (match) {
    scaleName.textContent = match.name;
    if (state.presetId !== match.id) {
      state.presetId = match.id;
      presetSelect.value = match.id;
    }
  } else {
    scaleName.textContent = "Escala personalizada";
  }
  const formula = getFormulaTokens();
  scaleFormula.textContent = formula.length ? formula.join(" ") : "-";
  presetFormula.textContent = formula.length ? formula.join(" ") : "-";
  const names = getScaleNoteNames();
  scaleNotes.textContent = names.length ? names.join(" ") : "-";
}

function updatePositionControls() {
  const maxStart = Math.max(1, state.fretCount - (state.positionWindowSize - 1));
  if (state.positionStart > maxStart) {
    state.positionStart = maxStart;
  }
  positionStartInput.max = String(maxStart);
  positionStartInput.value = String(state.positionStart);
  positionStartValue.textContent = String(state.positionStart);
  positionWindowSelect.value = String(state.positionWindowSize);
}

function buildFretNumbers() {
  fretNumbers.innerHTML = "";
  for (let fret = 0; fret <= state.fretCount; fret += 1) {
    const cell = document.createElement("div");
    cell.textContent = fret;
    fretNumbers.appendChild(cell);
  }
}

function buildFretMarkers() {
  const markerFrets = new Set([3, 5, 7, 9, 12, 15, 17, 19]);
  fretMarkers.innerHTML = "";
  for (let fret = 0; fret <= state.fretCount; fret += 1) {
    const cell = document.createElement("div");
    if (markerFrets.has(fret)) {
      const marker = document.createElement("div");
      marker.className = fret === 12 ? "marker double" : "marker";
      cell.appendChild(marker);
    }
    fretMarkers.appendChild(cell);
  }
}

function hasThreeNotesPerString(start, end, scaleSet) {
  return TUNING.every((string) => {
    const candidates = getScaleCandidatesForString(string.midi, start, end, scaleSet);
    if (candidates.length < 3) return false;
    candidates.sort((a, b) => a.fret - b.fret);
    return !!findTripletWithinSpan(candidates, 3, null, (start + end) / 2);
  });
}

function buildCagedPositions() {
  const scaleSet = getScaleNoteIndices();
  const windowSize = state.positionWindowSize;
  const step = 3;
  const maxStart = Math.max(1, state.fretCount - (windowSize - 1));
  const startBase = Math.min(Math.max(1, state.positionStart), maxStart);
  const starts = Array.from({ length: 5 }, (_, idx) =>
    Math.min(startBase + idx * step, maxStart)
  );
  const labels = ["C", "A", "G", "E", "D"];
  const buildPositionForStart = (start, index) => {
    const end = Math.min(start + windowSize - 1, state.fretCount);
    const notes = [];
    let prevPitchClasses = null;
    let totalNotes = 0;
    let stringsWithThree = 0;
    const pitchClasses = new Set();

    for (let stringIndex = 0; stringIndex < TUNING.length; stringIndex += 1) {
      const string = TUNING[stringIndex];
      const selected = selectNotesForString(
        string.midi,
        start,
        end,
        scaleSet,
        3,
        prevPitchClasses
      );
      const finalSelection = selected.length
        ? selected
        : selectNotesForString(string.midi, start, end, scaleSet, 3, null);
      if (finalSelection.length === 3) stringsWithThree += 1;
      totalNotes += finalSelection.length;
      finalSelection.forEach((note) => {
        notes.push({ stringIndex, fret: note.fret });
        pitchClasses.add(note.pitchClass);
      });
      prevPitchClasses = new Set(finalSelection.map((note) => note.pitchClass));
    }

    return {
      id: index,
      name: `Posicion ${labels[index]}`,
      start,
      end,
      notes,
      totalNotes,
      stringsWithThree,
      uniquePitchClasses: pitchClasses.size
    };
  };

  const chooseBetter = (baseStart, a, b) => {
    if (!a) return b;
    if (!b) return a;
    if (b.uniquePitchClasses !== a.uniquePitchClasses) {
      return b.uniquePitchClasses > a.uniquePitchClasses ? b : a;
    }
    if (b.stringsWithThree !== a.stringsWithThree) {
      return b.stringsWithThree > a.stringsWithThree ? b : a;
    }
    if (b.totalNotes !== a.totalNotes) {
      return b.totalNotes > a.totalNotes ? b : a;
    }
    const aDistance = Math.abs(a.start - baseStart);
    const bDistance = Math.abs(b.start - baseStart);
    return bDistance < aDistance ? b : a;
  };

  return starts.map((start, index) => {
    const base = buildPositionForStart(start, index);
    const shifted = start > 1 ? buildPositionForStart(start - 1, index) : null;
    const best = chooseBetter(start, base, shifted);
    return {
      id: index,
      name: best.name,
      start: best.start,
      end: best.end,
      notes: best.notes
    };
  });
}

function getPositions() {
  return buildCagedPositions();
}

function buildPositionButtons() {
  positionButtons.innerHTML = "";
  const positions = getPositions();
  positions.forEach((pos) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "position-btn";
    button.dataset.id = pos.id;
    button.innerHTML = `
      <strong>${pos.name}</strong>
      <span>Frets ${pos.start} - ${pos.end}</span>
      <span>Click para reproducir</span>
    `;
    positionButtons.appendChild(button);
  });
  updatePositionButtons();
}

function updatePositionButtons() {
  positionButtons.querySelectorAll(".position-btn").forEach((button) => {
    button.classList.toggle("active", Number(button.dataset.id) === state.activePosition);
  });
}

function buildFretboard() {
  fretboard.innerHTML = "";
  const scaleSet = getScaleNoteIndices();
  const positions = getPositions();
  const active = positions[state.activePosition];
  const activeNoteSet = active && active.notes && active.notes.length > 0
    ? new Set(active.notes.map((note) => `${note.stringIndex}-${note.fret}`))
    : null;
  const windowStart = active ? active.start : null;
  const windowEnd = active ? active.end : null;
  const chordData = detectChordData();

  TUNING.forEach((string, stringIndex) => {
    const row = document.createElement("div");
    row.className = "string-row";
    row.style.gridTemplateColumns = `60px repeat(${state.fretCount + 1}, minmax(46px, 1fr))`;

    const label = document.createElement("div");
    label.className = "string-label";
    label.textContent = string.label;
    row.appendChild(label);

    for (let fret = 0; fret <= state.fretCount; fret += 1) {
      const midi = string.midi + fret;
      const noteIndex = midi % 12;
      const noteName = noteNameFromIndex(noteIndex);
      const inScale = scaleSet.has(noteIndex);
      const isRoot = inScale && noteIndex === state.rootIndex;
      const inWindow = active ? fret >= windowStart && fret <= windowEnd : true;
      const inRange = activeNoteSet
        ? activeNoteSet.has(`${stringIndex}-${fret}`)
        : inWindow;

      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = "note";
      const showScale = !activeNoteSet || inRange;
      if (inScale && showScale) cell.classList.add("in-scale");
      if (isRoot && showScale) cell.classList.add("root");
      if (!inScale || !showScale) cell.classList.add("muted");
      if (inWindow) cell.classList.add("in-window");
      if (activeNoteSet && inRange) cell.classList.add("in-position");
      if (activeNoteSet && inWindow && !inRange) cell.classList.add("suppressed");
      if (active && !inWindow) cell.classList.add("out-range");
      if (
        state.chordNotes[stringIndex] &&
        state.chordNotes[stringIndex].fret === fret
      ) {
        cell.classList.add("chord");
      }

      cell.dataset.midi = midi;
      cell.dataset.note = noteName;
      cell.dataset.string = stringIndex;
      cell.dataset.fret = fret;

      const text = document.createElement("span");
      text.textContent = noteName;
      if (
        state.chordNotes[stringIndex] &&
        state.chordNotes[stringIndex].fret === fret
      ) {
        const interval = (noteIndex - state.rootIndex + 12) % 12;
        text.dataset.interval = INTERVAL_LABELS[interval] || "";
      }
      cell.appendChild(text);

      cell.addEventListener("click", () => {
        playNote(midi, 0.6, 0.85);
        flashNote(cell);
        if (state.chordMode) {
          handleChordSelection({
            stringIndex,
            fret,
            midi,
            pitchClass: noteIndex
          });
        }
      });

      row.appendChild(cell);
    }

    fretboard.appendChild(row);
  });
}

function flashNote(cell) {
  cell.classList.add("playing");
  setTimeout(() => cell.classList.remove("playing"), 180);
}

function updateFretboard() {
  buildFretNumbers();
  buildFretMarkers();
  buildPositionButtons();
  buildFretboard();
  updateScaleSummary();
  updateChordInfo();
}

function playNote(midi, duration = 0.6, velocity = 0.8) {
  if (state.midiOutputId !== "internal" && state.midiOutput) {
    const velocityValue = Math.floor(velocity * 127);
    state.midiOutput.send([0x90, midi, velocityValue]);
    state.midiOutput.send([0x80, midi, 0], window.performance.now() + duration * 1000);
  } else {
    synth.play(midi, duration, velocity);
  }
}

function handleChordSelection(note) {
  const current = state.chordNotes[note.stringIndex];
  if (current && current.fret === note.fret) {
    state.chordNotes[note.stringIndex] = null;
    updateChordInfo();
    updateFretboard();
    return;
  }

  const next = [...state.chordNotes];
  next[note.stringIndex] = note;
  const frets = next.filter(Boolean).map((item) => item.fret);
  if (frets.length) {
    const span = Math.max(...frets) - Math.min(...frets);
    if (span > 5) {
      chordHint.textContent = "El acorde supera 5 trastes. Elige otra nota.";
      return;
    }
  }

  state.chordNotes = next;
  updateChordInfo();
  updateFretboard();
}

function playScaleForRange(position) {
  const scaleSet = getScaleNoteIndices();
  const notes = [];
  const allowedSet = position && position.notes && position.notes.length > 0
    ? new Set(position.notes.map((note) => `${note.stringIndex}-${note.fret}`))
    : null;

  TUNING.forEach((string, stringIndex) => {
    for (let fret = 0; fret <= state.fretCount; fret += 1) {
      if (allowedSet && !allowedSet.has(`${stringIndex}-${fret}`)) continue;
      if (!allowedSet && position && (fret < position.start || fret > position.end)) continue;
      const midi = string.midi + fret;
      const noteIndex = midi % 12;
      if (scaleSet.has(noteIndex)) {
        notes.push({ midi, stringIndex, fret });
      }
    }
  });

  notes.sort((a, b) => a.midi - b.midi);
  const uniqueNotes = [];
  notes.forEach((note) => {
    const last = uniqueNotes[uniqueNotes.length - 1];
    if (last && last.midi === note.midi) return;
    uniqueNotes.push(note);
  });

  uniqueNotes.forEach((note, idx) => {
    const delay = idx * 180;
    setTimeout(() => {
      playNote(note.midi, 0.5, 0.8);
      const selector = `.note[data-string="${note.stringIndex}"][data-fret="${note.fret}"]`;
      const cell = fretboard.querySelector(selector);
      if (cell) flashNote(cell);
    }, delay);
  });
}

function updateMidiOutputs() {
  midiOutputSelect.innerHTML = "";
  const internalOption = document.createElement("option");
  internalOption.value = "internal";
  internalOption.textContent = "Sintetizador interno";
  midiOutputSelect.appendChild(internalOption);

  if (state.midiAccess) {
    for (const output of state.midiAccess.outputs.values()) {
      const option = document.createElement("option");
      option.value = output.id;
      option.textContent = output.name || `MIDI ${output.id}`;
      midiOutputSelect.appendChild(option);
    }
  }

  const hasSelected = Array.from(midiOutputSelect.options).some(
    (option) => option.value === state.midiOutputId
  );
  if (!hasSelected) {
    state.midiOutputId = "internal";
    state.midiOutput = null;
  }
  midiOutputSelect.value = state.midiOutputId;
}

function sendProgramChange() {
  if (!state.midiOutput) return;
  const instrument = INSTRUMENTS.find((item) => item.id === state.instrumentId) || INSTRUMENTS[0];
  state.midiOutput.send([0xc0, instrument.program]);
}

async function setupMidi() {
  if (!navigator.requestMIDIAccess) {
    updateMidiOutputs();
    return;
  }

  try {
    state.midiAccess = await navigator.requestMIDIAccess();
    updateMidiOutputs();
    state.midiAccess.onstatechange = updateMidiOutputs;
  } catch (error) {
    updateMidiOutputs();
  }
}

function bindEvents() {
  rootSelect.addEventListener("change", (event) => {
    state.rootIndex = Number(event.target.value);
    updateFretboard();
  });

  presetSelect.addEventListener("change", (event) => {
    state.presetId = event.target.value;
    const preset = scaleById(state.presetId);
    state.degreeMask = [...preset.mask];
    state.degreeAdjustments = [...preset.adjustments];
    updateDegreeToggles();
    updateFretboard();
  });

  degreeToggles.addEventListener("click", (event) => {
    if (!event.target.matches(".degree-toggle")) return;
    const idx = Number(event.target.dataset.index);
    state.degreeMask[idx] = !state.degreeMask[idx];
    updateDegreeToggles();
    updateFretboard();
  });

  degreeToggles.addEventListener("change", (event) => {
    if (!event.target.matches(".degree-adjust")) return;
    const idx = Number(event.target.dataset.index);
    state.degreeAdjustments[idx] = Number(event.target.value);
    updateFretboard();
  });

  fretCountInput.addEventListener("input", (event) => {
    state.fretCount = Number(event.target.value);
    fretCountValue.textContent = state.fretCount;
    updatePositionControls();
    updateFretboard();
  });

  positionStartInput.addEventListener("input", (event) => {
    state.positionStart = Number(event.target.value);
    updatePositionControls();
    updateFretboard();
  });

  positionWindowSelect.addEventListener("change", (event) => {
    state.positionWindowSize = Number(event.target.value);
    updatePositionControls();
    updateFretboard();
  });

  positionButtons.addEventListener("click", (event) => {
    const button = event.target.closest(".position-btn");
    if (!button) return;
    state.activePosition = Number(button.dataset.id);
    updatePositionButtons();
    buildFretboard();
    const positions = getPositions();
    const active = positions[state.activePosition];
    playScaleForRange(active);
  });

  playAllBtn.addEventListener("click", () => {
    playScaleForRange(null);
  });

  chordModeToggle.addEventListener("change", (event) => {
    state.chordMode = event.target.checked;
    chordHint.textContent = state.chordMode
      ? "Modo acorde activo. Click en notas para seleccionar."
      : "Click en el mastil para armar el acorde.";
  });

  showInversionToggle.addEventListener("change", (event) => {
    state.showInversion = event.target.checked;
    updateChordInfo();
  });

  clearChordBtn.addEventListener("click", () => {
    clearChord();
    updateFretboard();
  });

  midiOutputSelect.addEventListener("change", (event) => {
    state.midiOutputId = event.target.value;
    state.midiOutput = null;
    if (state.midiAccess && state.midiOutputId !== "internal") {
      state.midiOutput = state.midiAccess.outputs.get(state.midiOutputId) || null;
      sendProgramChange();
    }
  });

  instrumentSelect.addEventListener("change", (event) => {
    state.instrumentId = event.target.value;
    sendProgramChange();
  });

  volumeInput.addEventListener("input", (event) => {
    state.volume = Number(event.target.value);
    volumeValue.textContent = `${Math.round(state.volume * 100)}%`;
  });
}

function init() {
  buildRootOptions();
  buildPresetOptions();
  buildInstrumentOptions();
  buildDegreeToggles();
  fretCountValue.textContent = state.fretCount;
  volumeValue.textContent = `${Math.round(state.volume * 100)}%`;
  updatePositionControls();
  chordModeToggle.checked = state.chordMode;
  showInversionToggle.checked = state.showInversion;
  updateChordInfo();
  bindEvents();
  updateFretboard();
  setupMidi();
}

init();
