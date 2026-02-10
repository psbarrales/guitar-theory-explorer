import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  INTERVAL_LABELS,
  NOTES,
  SCALES,
  TUNING,
  getFormulaTokens,
  getScaleDegrees,
  getScaleNoteIndices,
  getScaleNoteNames,
  noteNameFromIndex
} from "../domain/theory.js";
import { buildCagedPositions } from "../domain/positions.js";
import {
  detectChordData,
  generateScaleChordVoicings,
  getInversionLabel,
  pitchClassName
} from "../domain/chords.js";
import { Synth } from "../infrastructure/synth.js";
import { INSTRUMENTS } from "../infrastructure/sound.js";

const STORAGE_KEY = "guitar-scale-lab-state-v1";
const SIDEBAR_KEY = "guitar-scale-lab-sidebar-v1";
const BACKING_PRESETS_KEY = "guitar-scale-lab-backing-presets-v1";
const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII"];
const DRUM_KEYS = ["kick", "snare", "hat", "crash", "tomLow", "tomHigh", "perc1", "perc2"];
const STEPS_PER_BEAT = 4;
export const STRUM_PATTERNS = [
  { id: "down_1", name: "1 tiempo · D", steps: ["D"] },
  { id: "up_1", name: "1 tiempo · U", steps: ["U"] },
  { id: "du_2", name: "2 tiempos · D U", steps: ["D", "U"] },
  { id: "dud_3", name: "3 tiempos · D U D", steps: ["D", "U", "D"] },
  { id: "down_4", name: "Abajo x4", steps: ["D", "D", "D", "D"] },
  { id: "down_8", name: "Abajo x8", steps: ["D", "D", "D", "D", "D", "D", "D", "D"] },
  { id: "du_du", name: "D U D U", steps: ["D", "U", "D", "U"] },
  { id: "dduudu", name: "D D U U D U", steps: ["D", "D", "U", "U", "D", "U"] },
  { id: "ddudud", name: "D D U D U D", steps: ["D", "D", "U", "D", "U", "D"] },
  { id: "d_ud_u", name: "D - U D - U", steps: ["D", "-", "U", "D", "-", "U"] },
  { id: "ddu_dud", name: "D D U - D U D", steps: ["D", "D", "U", "-", "D", "U", "D"] },
  { id: "du_udu", name: "D U - U D U", steps: ["D", "U", "-", "U", "D", "U"] },
  { id: "dududu", name: "D U D U D U", steps: ["D", "U", "D", "U", "D", "U"] },
  { id: "dd_uu", name: "D D - U U -", steps: ["D", "D", "-", "U", "U", "-"] },
  { id: "duudud", name: "D U U D U D", steps: ["D", "U", "U", "D", "U", "D"] }
];

const baseScale = SCALES[0];

const DEFAULT_STATE = {
  rootIndex: 0,
  presetId: baseScale.id,
  degreeMask: [...baseScale.mask],
  degreeAdjustments: [...baseScale.adjustments],
  fretCount: 17,
  positionStart: 1,
  positionWindowSize: 5,
  activePosition: 0,
  volume: 0.7,
  mainProgram: 24,
  metronomeEnabled: false,
  metronomeBpm: 120,
  metronomeBeatsPerBar: 4,
  metronomeMode: "every",
  metronomeVolume: 0.8,
  backingEnabled: false,
  backingBpm: 120,
  backingBeatsPerBar: 4,
  backingBars: 4,
  backingDrums: {
    kick: [true, false, false, false, false, false, false, false, true, false, false, false, false, false, false, false],
    snare: [false, false, false, false, true, false, false, false, false, false, false, false, true, false, false, false],
    hat: [
      true, true, true, true,
      true, true, true, true,
      true, true, true, true,
      true, true, true, true
    ],
    crash: [true, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false],
    tomLow: [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false],
    tomHigh: [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false],
    perc1: [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false],
    perc2: [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false]
  },
  backingDrumPrograms: {
    perc1: 128,
    perc2: 128
  },
  backingDrumNotes: {
    kick: 36,
    snare: 38,
    hat: 42,
    crash: 49,
    tomLow: 45,
    tomHigh: 50
  },
  backingChords: [],
  backingDrumVolume: 0.9,
  backingChordVolume: 0.8,
  midiOutputId: "internal",
  chordMode: true,
  chordNotes: new Array(6).fill(null),
  showInversion: true,
  diatonicChordIndex: null,
  diatonicArpeggioIndex: null
};

function applySavedChordNotes(rawNotes, fretCount) {
  const notes = new Array(6).fill(null);
  if (!Array.isArray(rawNotes)) return notes;
  rawNotes.forEach((raw, idx) => {
    if (!raw) return;
    const stringIndex = Number.isInteger(raw.stringIndex) ? raw.stringIndex : idx;
    const fret = Number.isFinite(raw.fret) ? raw.fret : null;
    if (stringIndex < 0 || stringIndex >= TUNING.length) return;
    if (fret === null || fret < 0) return;
    const cappedFret = Math.min(Math.round(fret), fretCount);
    const midi = TUNING[stringIndex].midi + cappedFret;
    notes[stringIndex] = {
      stringIndex,
      fret: cappedFret,
      midi,
      pitchClass: midi % 12
    };
  });
  return notes;
}

function loadStoredState() {
  if (typeof window === "undefined" || !window.localStorage) return { ...DEFAULT_STATE };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_STATE };
    const saved = JSON.parse(raw);
    const next = { ...DEFAULT_STATE };

    if (Number.isInteger(saved.rootIndex) && saved.rootIndex >= 0 && saved.rootIndex < 12) {
      next.rootIndex = saved.rootIndex;
    }
    if (typeof saved.presetId === "string" && SCALES.some((s) => s.id === saved.presetId)) {
      next.presetId = saved.presetId;
    }
    if (Array.isArray(saved.degreeMask) && saved.degreeMask.length === 7) {
      next.degreeMask = saved.degreeMask.map((value, idx) =>
        typeof value === "boolean" ? value : DEFAULT_STATE.degreeMask[idx]
      );
    }
    if (Array.isArray(saved.degreeAdjustments) && saved.degreeAdjustments.length === 7) {
      next.degreeAdjustments = saved.degreeAdjustments.map((value, idx) =>
        Number.isFinite(value) ? value : DEFAULT_STATE.degreeAdjustments[idx]
      );
    }
    if (Number.isFinite(saved.fretCount) && saved.fretCount >= 12) {
      next.fretCount = Math.round(saved.fretCount);
    }
    if (Number.isFinite(saved.positionStart) && saved.positionStart >= 1) {
      next.positionStart = Math.round(saved.positionStart);
    }
    if (Number.isFinite(saved.positionWindowSize) && saved.positionWindowSize >= 4) {
      next.positionWindowSize = Math.round(saved.positionWindowSize);
    }
    if (Number.isFinite(saved.activePosition)) {
      next.activePosition = Math.min(4, Math.max(0, Math.round(saved.activePosition)));
    }
    if (Number.isFinite(saved.volume)) {
      next.volume = Math.min(1, Math.max(0, saved.volume));
    }
    if (typeof saved.metronomeEnabled === "boolean") {
      next.metronomeEnabled = saved.metronomeEnabled;
    }
    if (Number.isFinite(saved.metronomeBpm)) {
      next.metronomeBpm = Math.min(300, Math.max(30, Math.round(saved.metronomeBpm)));
    }
    if (Number.isFinite(saved.metronomeBeatsPerBar)) {
      next.metronomeBeatsPerBar = Math.min(16, Math.max(1, Math.round(saved.metronomeBeatsPerBar)));
    }
    if (typeof saved.metronomeMode === "string") {
      next.metronomeMode = saved.metronomeMode;
    }
    if (Number.isFinite(saved.metronomeVolume)) {
      next.metronomeVolume = Math.min(1, Math.max(0, saved.metronomeVolume));
    }
    if (typeof saved.backingEnabled === "boolean") {
      next.backingEnabled = saved.backingEnabled;
    }
    if (Number.isFinite(saved.backingBpm)) {
      next.backingBpm = Math.min(300, Math.max(30, Math.round(saved.backingBpm)));
    }
    if (Number.isFinite(saved.backingBeatsPerBar)) {
      next.backingBeatsPerBar = Math.min(16, Math.max(1, Math.round(saved.backingBeatsPerBar)));
    }
    if (Number.isFinite(saved.backingBars)) {
      next.backingBars = Math.min(32, Math.max(1, Math.round(saved.backingBars)));
    }
    if (saved.backingDrums && typeof saved.backingDrums === "object") {
      next.backingDrums = { ...DEFAULT_STATE.backingDrums };
      Object.keys(next.backingDrums).forEach((key) => {
        if (Array.isArray(saved.backingDrums[key])) {
          next.backingDrums[key] = saved.backingDrums[key].map(Boolean);
        }
      });
    }
    if (saved.backingDrumPrograms && typeof saved.backingDrumPrograms === "object") {
      next.backingDrumPrograms = { ...DEFAULT_STATE.backingDrumPrograms };
      Object.keys(next.backingDrumPrograms).forEach((key) => {
        if (Number.isFinite(saved.backingDrumPrograms[key])) {
          next.backingDrumPrograms[key] = Math.min(
            128,
            Math.max(0, Math.round(saved.backingDrumPrograms[key]))
          );
        }
      });
    }
    if (saved.backingDrumNotes && typeof saved.backingDrumNotes === "object") {
      next.backingDrumNotes = { ...DEFAULT_STATE.backingDrumNotes };
      Object.keys(next.backingDrumNotes).forEach((key) => {
        if (Number.isFinite(saved.backingDrumNotes[key])) {
          next.backingDrumNotes[key] = Math.min(
            81,
            Math.max(35, Math.round(saved.backingDrumNotes[key]))
          );
        }
      });
    }
    if (Array.isArray(saved.backingChords)) {
      next.backingChords = saved.backingChords
        .map((item) => {
          if (!item || typeof item !== "object") return null;
          if (typeof item.voicingId !== "string") return null;
          return {
            voicingId: item.voicingId,
            name: typeof item.name === "string" ? item.name : "Acorde",
            duration: Math.min(16, Math.max(1, Math.round(item.duration || 1))),
            startBeat: Number.isFinite(item.startBeat) ? Math.max(0, Math.round(item.startBeat)) : null,
            strumPatternId: typeof item.strumPatternId === "string" ? item.strumPatternId : "down_8"
          };
        })
        .filter(Boolean)
        .slice(0, 6);
    }
    if (Number.isFinite(saved.backingDrumVolume)) {
      next.backingDrumVolume = Math.min(1, Math.max(0, saved.backingDrumVolume));
    }
    if (Number.isFinite(saved.backingChordVolume)) {
      next.backingChordVolume = Math.min(1, Math.max(0, saved.backingChordVolume));
    }
    if (Number.isFinite(saved.mainProgram)) {
      next.mainProgram = Math.min(127, Math.max(0, Math.round(saved.mainProgram)));
    } else if (typeof saved.instrumentId === "string") {
      const legacy = INSTRUMENTS.find((i) => i.id === saved.instrumentId);
      if (legacy) next.mainProgram = legacy.program;
    }
    if (typeof saved.midiOutputId === "string") {
      next.midiOutputId = saved.midiOutputId;
    }
    if (typeof saved.chordMode === "boolean") {
      next.chordMode = saved.chordMode;
    }
    if (typeof saved.showInversion === "boolean") {
      next.showInversion = saved.showInversion;
    }
    if (Number.isFinite(saved.diatonicChordIndex)) {
      next.diatonicChordIndex = saved.diatonicChordIndex;
    }
    if (Number.isFinite(saved.diatonicArpeggioIndex)) {
      next.diatonicArpeggioIndex = saved.diatonicArpeggioIndex;
    }
    if (Array.isArray(saved.chordNotes)) {
      next.chordNotes = applySavedChordNotes(saved.chordNotes, next.fretCount);
    }

    return next;
  } catch (error) {
    return { ...DEFAULT_STATE };
  }
}

function loadSidebarState() {
  if (typeof window === "undefined" || !window.localStorage) return false;
  try {
    return localStorage.getItem(SIDEBAR_KEY) === "1";
  } catch (error) {
    return false;
  }
}

function saveState(state) {
  if (typeof window === "undefined" || !window.localStorage) return;
  const payload = {
    rootIndex: state.rootIndex,
    presetId: state.presetId,
    degreeMask: state.degreeMask,
    degreeAdjustments: state.degreeAdjustments,
    fretCount: state.fretCount,
    positionStart: state.positionStart,
    positionWindowSize: state.positionWindowSize,
    activePosition: state.activePosition,
    volume: state.volume,
    metronomeEnabled: state.metronomeEnabled,
    metronomeBpm: state.metronomeBpm,
    metronomeBeatsPerBar: state.metronomeBeatsPerBar,
    metronomeMode: state.metronomeMode,
    metronomeVolume: state.metronomeVolume,
    backingEnabled: state.backingEnabled,
    backingBpm: state.backingBpm,
    backingBeatsPerBar: state.backingBeatsPerBar,
    backingBars: state.backingBars,
    backingDrums: state.backingDrums,
    backingDrumPrograms: state.backingDrumPrograms,
    backingDrumNotes: state.backingDrumNotes,
    backingChords: state.backingChords,
    backingDrumVolume: state.backingDrumVolume,
    backingChordVolume: state.backingChordVolume,
    mainProgram: state.mainProgram,
    midiOutputId: state.midiOutputId,
    chordMode: state.chordMode,
    showInversion: state.showInversion,
    diatonicChordIndex: state.diatonicChordIndex,
    diatonicArpeggioIndex: state.diatonicArpeggioIndex,
    chordNotes: state.chordNotes.map((note, index) => {
      if (!note) return null;
      return {
        stringIndex: Number.isInteger(note.stringIndex) ? note.stringIndex : index,
        fret: note.fret
      };
    })
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (error) {
    // ignore storage errors
  }
}

function getArpeggioQuality(thirdInt, fifthInt, seventhInt) {
  if (thirdInt === 4 && fifthInt === 7 && seventhInt === 11) return "maj7";
  if (thirdInt === 4 && fifthInt === 7 && seventhInt === 10) return "7";
  if (thirdInt === 3 && fifthInt === 7 && seventhInt === 10) return "m7";
  if (thirdInt === 3 && fifthInt === 6 && seventhInt === 10) return "m7b5";
  if (thirdInt === 3 && fifthInt === 6 && seventhInt === 9) return "dim7";
  if (thirdInt === 3 && fifthInt === 7 && seventhInt === 11) return "mMaj7";
  if (thirdInt === 4 && fifthInt === 8 && seventhInt === 11) return "maj7#5";
  if (thirdInt === 4 && fifthInt === 8 && seventhInt === 10) return "7#5";
  return "7";
}

function getArpeggioNumeral(baseRoman, quality) {
  if (quality === "maj7" || quality === "maj7#5") return `${baseRoman.toUpperCase()}maj7`;
  if (quality === "7" || quality === "7#5") return `${baseRoman.toUpperCase()}7`;
  if (quality === "m7" || quality === "mMaj7") return `${baseRoman.toLowerCase()}${quality}`;
  if (quality === "m7b5") return `${baseRoman.toLowerCase()}ø7`;
  if (quality === "dim7") return `${baseRoman.toLowerCase()}°7`;
  return `${baseRoman}7`;
}

function buildDiatonicArpeggios(state) {
  const degrees = getScaleDegrees(state);
  const count = degrees.length;
  if (count < 4) return [];

  return degrees.map((degree, idx) => {
    const third = degrees[(idx + 2) % count];
    const fifth = degrees[(idx + 4) % count];
    const seventh = degrees[(idx + 6) % count];
    const rootPc = degree.pc;
    const thirdInt = (third.pc - rootPc + 12) % 12;
    const fifthInt = (fifth.pc - rootPc + 12) % 12;
    const seventhInt = (seventh.pc - rootPc + 12) % 12;
    const quality = getArpeggioQuality(thirdInt, fifthInt, seventhInt);
    const numeral = getArpeggioNumeral(ROMAN[idx] || `${idx + 1}`, quality);
    const name = `${pitchClassName(rootPc)}${quality}`;

    return {
      index: idx,
      numeral,
      name,
      quality,
      rootPc,
      tones: new Set([rootPc, third.pc, fifth.pc, seventh.pc])
    };
  });
}

function buildDiatonicTriads(state) {
  const degrees = getScaleDegrees(state);
  const count = degrees.length;
  if (count < 3) return [];

  return degrees.map((degree, idx) => {
    const third = degrees[(idx + 2) % count];
    const fifth = degrees[(idx + 4) % count];
    const rootPc = degree.pc;
    const thirdInt = (third.pc - rootPc + 12) % 12;
    const fifthInt = (fifth.pc - rootPc + 12) % 12;

    let quality = "";
    let numeral = ROMAN[idx] || `${idx + 1}`;
    if (thirdInt === 4 && fifthInt === 7) {
      quality = "";
      numeral = numeral.toUpperCase();
    } else if (thirdInt === 3 && fifthInt === 7) {
      quality = "m";
      numeral = numeral.toLowerCase();
    } else if (thirdInt === 3 && fifthInt === 6) {
      quality = "dim";
      numeral = `${numeral.toLowerCase()}°`;
    } else if (thirdInt === 4 && fifthInt === 8) {
      quality = "aug";
      numeral = `${numeral.toUpperCase()}+`;
    }

    const name = `${pitchClassName(rootPc)}${quality}`;
    return {
      index: idx,
      numeral,
      name,
      rootPc,
      tones: new Set([rootPc, third.pc, fifth.pc])
    };
  });
}

function scaleMatchesState(scale, state) {
  for (let i = 0; i < 7; i += 1) {
    if (state.degreeMask[i] !== scale.mask[i]) return false;
    if (state.degreeMask[i] && state.degreeAdjustments[i] !== scale.adjustments[i]) return false;
  }
  return true;
}

function loadBackingPresets() {
  if (typeof window === "undefined" || !window.localStorage) return [];
  try {
    const raw = localStorage.getItem(BACKING_PRESETS_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch (error) {
    return [];
  }
}

function saveBackingPresets(presets) {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    localStorage.setItem(BACKING_PRESETS_KEY, JSON.stringify(presets));
  } catch (error) {
    // ignore
  }
}

export function useGuitarLabState() {
  const [state, setState] = useState(() => loadStoredState());
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => loadSidebarState());
  const [backingPresets, setBackingPresets] = useState(() => loadBackingPresets());
  const [chordHint, setChordHint] = useState(
    state.chordMode
      ? "Modo acorde activo. Click en notas para seleccionar."
      : "Click en el mastil para armar el acorde."
  );
  const [playingNotes, setPlayingNotes] = useState(new Set());
  const [midiAccess, setMidiAccess] = useState(null);
  const [midiOutputs, setMidiOutputs] = useState([]);
  const [metronomeBeat, setMetronomeBeat] = useState(0);
  const [backingBeat, setBackingBeat] = useState(0);
  const [backingChordLabel, setBackingChordLabel] = useState(null);
  const [backingActiveEventIndex, setBackingActiveEventIndex] = useState(-1);

  const synthRef = useRef(new Synth());
  const midiOutputRef = useRef(null);
  const metronomeTimerRef = useRef(null);
  const metronomeBeatRef = useRef(0);
  const tapTimesRef = useRef([]);
  const backingTimerRef = useRef(null);
  const backingBeatRef = useRef(0);
  const backingChordIndexRef = useRef(-1);

  const scaleSet = useMemo(() => getScaleNoteIndices(state), [state]);
  const scaleNotes = useMemo(() => getScaleNoteNames(state), [state]);
  const formulaTokens = useMemo(
    () => getFormulaTokens(state.degreeMask, state.degreeAdjustments),
    [state.degreeMask, state.degreeAdjustments]
  );

  const matchingScale = useMemo(
    () => SCALES.find((scale) => scaleMatchesState(scale, state)) || null,
    [state]
  );

  const positions = useMemo(
    () =>
      buildCagedPositions({
        scaleSet,
        fretCount: state.fretCount,
        positionStart: state.positionStart,
        positionWindowSize: state.positionWindowSize
      }),
    [scaleSet, state.fretCount, state.positionStart, state.positionWindowSize]
  );

  const activePosition = positions[state.activePosition] || positions[0] || null;

  const chordSelection = useMemo(() => state.chordNotes.filter(Boolean), [state.chordNotes]);
  const chordData = useMemo(() => detectChordData(chordSelection), [chordSelection]);

  const diatonicTriads = useMemo(() => buildDiatonicTriads(state), [state]);
  const diatonicArpeggios = useMemo(() => buildDiatonicArpeggios(state), [state]);
  const generatedScaleChords = useMemo(
    () =>
      generateScaleChordVoicings({
        scaleSet,
        tuning: TUNING,
        minFret: 0,
        maxFret: Math.min(12, state.fretCount),
        maxSpan: 5,
        minStrings: 3,
        maxStrings: 6,
        maxResults: 12000
      }),
    [scaleSet, state.fretCount]
  );

  const chordVoicingMap = useMemo(() => {
    const map = new Map();
    generatedScaleChords.forEach((voicing) => {
      map.set(voicing.id, voicing);
    });
    return map;
  }, [generatedScaleChords]);
  const diatonicChordTones = useMemo(() => {
    if (state.diatonicChordIndex === null) return null;
    const chord = diatonicTriads.find((item) => item.index === state.diatonicChordIndex);
    return chord ? chord.tones : null;
  }, [state.diatonicChordIndex, diatonicTriads]);
  const diatonicArpeggioTones = useMemo(() => {
    if (state.diatonicArpeggioIndex === null) return null;
    const arpeggio = diatonicArpeggios.find((item) => item.index === state.diatonicArpeggioIndex);
    return arpeggio ? arpeggio.tones : null;
  }, [state.diatonicArpeggioIndex, diatonicArpeggios]);

  const maxPositionStart = useMemo(
    () => Math.max(1, state.fretCount - (state.positionWindowSize - 1)),
    [state.fretCount, state.positionWindowSize]
  );

  useEffect(() => {
    if (state.positionStart > maxPositionStart) {
      setState((prev) => ({ ...prev, positionStart: maxPositionStart }));
    }
  }, [maxPositionStart, state.positionStart]);

  useEffect(() => {
    setState((prev) => {
      const nextBeats = Math.min(16, Math.max(1, prev.backingBeatsPerBar)) * STEPS_PER_BEAT;
      const nextDrums = { ...prev.backingDrums };
      let changed = false;
      DRUM_KEYS.forEach((key) => {
        const current = Array.isArray(nextDrums[key]) ? nextDrums[key] : [];
        if (current.length !== nextBeats) {
          const resized = Array.from({ length: nextBeats }, (_, idx) => Boolean(current[idx]));
          nextDrums[key] = resized;
          changed = true;
        }
      });
      return changed ? { ...prev, backingDrums: nextDrums } : prev;
    });
  }, [state.backingBeatsPerBar]);

  useEffect(() => {
    setState((prev) => {
      const totalBeats = Math.max(1, prev.backingBars * prev.backingBeatsPerBar);
      let cursor = 0;
      let changed = false;
      const nextChords = prev.backingChords.map((item) => {
        if (Number.isFinite(item.startBeat)) return item;
        const startBeat = Math.min(totalBeats - 1, Math.max(0, cursor));
        cursor = startBeat + Math.max(1, item.duration || 1);
        changed = true;
        return { ...item, startBeat };
      });
      return changed ? { ...prev, backingChords: nextChords } : prev;
    });
  }, [state.backingBars, state.backingBeatsPerBar, state.backingChords]);

  useEffect(() => {
    const next = state.chordNotes.map((note) => {
      if (!note) return null;
      if (note.fret > state.fretCount) return null;
      return note;
    });
    const changed = next.some((note, idx) => note !== state.chordNotes[idx]);
    if (changed) {
      setState((prev) => ({ ...prev, chordNotes: next }));
    }
  }, [state.chordNotes, state.fretCount]);

  useEffect(() => {
    if (matchingScale && state.presetId !== matchingScale.id) {
      setState((prev) => ({ ...prev, presetId: matchingScale.id }));
    }
  }, [matchingScale, state.presetId]);

  useEffect(() => {
    saveState(state);
  }, [state]);

  useEffect(() => {
    if (typeof window === "undefined" || !window.localStorage) return;
    try {
      localStorage.setItem(SIDEBAR_KEY, sidebarCollapsed ? "1" : "0");
    } catch (error) {
      // ignore
    }
  }, [sidebarCollapsed]);

  useEffect(() => {
    saveBackingPresets(backingPresets);
  }, [backingPresets]);

  useEffect(() => {
    if (!navigator.requestMIDIAccess) return;
    navigator
      .requestMIDIAccess()
      .then((access) => {
        setMidiAccess(access);
      })
      .catch(() => {
        setMidiAccess(null);
      });
  }, []);

  useEffect(() => {
    if (!midiAccess) {
      setMidiOutputs([]);
      return;
    }
    const updateOutputs = () => {
      setMidiOutputs(Array.from(midiAccess.outputs.values()));
    };
    updateOutputs();
    midiAccess.onstatechange = updateOutputs;
    return () => {
      midiAccess.onstatechange = null;
    };
  }, [midiAccess]);

  useEffect(() => {
    if (!midiAccess || state.midiOutputId === "internal") {
      midiOutputRef.current = null;
      return;
    }
    midiOutputRef.current = midiAccess.outputs.get(state.midiOutputId) || null;
  }, [midiAccess, state.midiOutputId]);

  useEffect(() => {
    if (state.midiOutputId === "internal") return;
    const output = midiOutputRef.current;
    if (!output) {
      setState((prev) => ({ ...prev, midiOutputId: "internal" }));
      return;
    }
    output.send([0xc0, state.mainProgram]);
  }, [state.mainProgram, state.midiOutputId]);

  useEffect(() => {
    if (metronomeTimerRef.current) {
      window.clearInterval(metronomeTimerRef.current);
      metronomeTimerRef.current = null;
    }
    if (!state.metronomeEnabled) return;

    const bpm = Math.min(300, Math.max(30, state.metronomeBpm));
    const beatsPerBar = Math.min(16, Math.max(1, state.metronomeBeatsPerBar));
    const interval = 60000 / bpm;

    metronomeBeatRef.current = 0;
    const tick = () => {
      const beat = metronomeBeatRef.current;
      const isDownbeat = beat === 0;
      if (state.metronomeMode === "alternating") {
        synthRef.current.click(isDownbeat ? "accent" : "secondary", state.metronomeVolume);
      } else if (state.metronomeMode === "accent") {
        synthRef.current.click(isDownbeat ? "accent" : "primary", state.metronomeVolume);
      } else {
        synthRef.current.click("primary", state.metronomeVolume);
      }
      setMetronomeBeat(beat);
      metronomeBeatRef.current = (beat + 1) % beatsPerBar;
    };

    tick();
    metronomeTimerRef.current = window.setInterval(tick, interval);
    return () => {
      if (metronomeTimerRef.current) {
        window.clearInterval(metronomeTimerRef.current);
        metronomeTimerRef.current = null;
      }
    };
  }, [
    state.metronomeEnabled,
    state.metronomeBpm,
    state.metronomeBeatsPerBar,
    state.metronomeMode,
    state.metronomeVolume
  ]);

  const backingChordEvents = useMemo(() => {
    const totalBeats = Math.max(1, state.backingBars * state.backingBeatsPerBar);
    const timeline = Array.from({ length: totalBeats }, () => null);
    const events = state.backingChords
      .map((item, sourceIndex) => {
        const voicing = chordVoicingMap.get(item.voicingId);
        if (!voicing) return null;
        const startBeat = Number.isFinite(item.startBeat) ? Math.max(0, item.startBeat) : null;
        if (startBeat === null) return null;
        const pattern = STRUM_PATTERNS.find((p) => p.id === item.strumPatternId) || STRUM_PATTERNS[1];
        return {
          sourceIndex,
          startBeat,
          duration: Math.min(totalBeats, Math.max(1, item.duration || 1)),
          label: item.name,
          voicing,
          pattern
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.startBeat - b.startBeat)
      .map((evt) => ({ ...evt }));

    events.forEach((evt, idx) => {
      const next = events[idx + 1];
      if (next && next.startBeat > evt.startBeat) {
        evt.duration = Math.min(evt.duration, next.startBeat - evt.startBeat);
      }
    });

    const eventsByStart = new Map();
    events.forEach((evt) => {
      eventsByStart.set(evt.startBeat, evt);
    });

    events.forEach((evt) => {
      const end = Math.min(totalBeats, evt.startBeat + evt.duration);
      for (let i = evt.startBeat; i < end; i += 1) {
        timeline[i] = evt.label;
      }
    });

    return { events, eventsByStart, totalBeats, timeline };
  }, [chordVoicingMap, state.backingBars, state.backingBeatsPerBar, state.backingChords]);

  const flashNote = useCallback((id) => {
    setPlayingNotes((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
    window.setTimeout(() => {
      setPlayingNotes((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }, 180);
  }, []);

  const playNote = useCallback(
    (midi, duration = 0.35, velocity = 1.0) => {
      if (state.midiOutputId !== "internal" && midiOutputRef.current) {
        const velocityValue = Math.floor(velocity * 127);
        midiOutputRef.current.send([0x90, midi, velocityValue]);
        midiOutputRef.current.send([0x80, midi, 0], window.performance.now() + duration * 1000);
      } else {
        synthRef.current.playProgramNote(midi, duration, velocity, state.mainProgram, state.volume);
      }
    },
    [state.mainProgram, state.midiOutputId, state.volume]
  );

  useEffect(() => {
    if (backingTimerRef.current) {
      window.clearInterval(backingTimerRef.current);
      backingTimerRef.current = null;
    }
    if (!state.backingEnabled) {
      setBackingBeat(0);
      setBackingChordLabel(null);
      setBackingActiveEventIndex(-1);
      backingBeatRef.current = 0;
      backingChordIndexRef.current = -1;
      return;
    }

    const bpm = Math.min(300, Math.max(30, state.backingBpm));
    const beatsPerBar = Math.min(16, Math.max(1, state.backingBeatsPerBar));
    const interval = 60000 / bpm / STEPS_PER_BEAT;
    const totalSteps = Math.max(1, state.backingBars * beatsPerBar * STEPS_PER_BEAT);
    backingBeatRef.current = 0;
    backingChordIndexRef.current = -1;

    const tick = () => {
      const step = backingBeatRef.current;
      const beatIndex = Math.floor(step / STEPS_PER_BEAT);
      const stepInBar = step % (beatsPerBar * STEPS_PER_BEAT);
      const beatInBar = Math.floor(stepInBar / STEPS_PER_BEAT);

      DRUM_KEYS.forEach((key) => {
        const pattern = state.backingDrums[key] || [];
        if (pattern[stepInBar]) {
          const fixedDrums = new Set(["kick", "snare", "hat", "crash", "tomLow", "tomHigh"]);
          if (fixedDrums.has(key)) {
            const note = state.backingDrumNotes[key];
            if (Number.isFinite(note)) {
              synthRef.current.playProgramNote(note, 0.12, 0.9, 128, state.backingDrumVolume);
            } else {
              synthRef.current.playDrum(key, state.backingDrumVolume);
            }
            return;
          }
          const program = state.backingDrumPrograms[key];
          const noteMap = { perc1: 56, perc2: 70 };
          const midi = noteMap[key] || 60;
          if (Number.isFinite(program)) {
            synthRef.current.playProgramNote(midi, 0.12, 0.9, program, state.backingDrumVolume);
          } else {
            synthRef.current.playDrum("hat", state.backingDrumVolume);
          }
        }
      });

      if (step % STEPS_PER_BEAT === 0) {
        const evt = backingChordEvents.eventsByStart.get(beatIndex);
        if (evt) {
          const durationSeconds = evt.duration * (60 / bpm);
          const steps = evt.pattern?.steps?.length ? evt.pattern.steps : ["D"];
          const stepDuration = durationSeconds / steps.length;
          const noteDuration = Math.min(0.5, stepDuration * 0.9);
          const orderedDown = [...evt.voicing.notes].sort((a, b) => b.stringIndex - a.stringIndex);
          const orderedUp = [...evt.voicing.notes].sort((a, b) => a.stringIndex - b.stringIndex);

          steps.forEach((step, idx) => {
            if (step === "-" || step === "x") return;
            const isDown = step.toUpperCase() === "D";
            const order = isDown ? orderedDown : orderedUp;
            const baseDelay = idx * stepDuration * 1000;
            order.forEach((note, noteIdx) => {
              const strumDelay = baseDelay + noteIdx * 12;
              window.setTimeout(() => {
                playNote(note.midi, noteDuration, state.backingChordVolume);
              }, strumDelay);
            });
          });
          backingChordIndexRef.current = evt.sourceIndex;
          setBackingChordLabel(evt.label);
          setBackingActiveEventIndex(evt.sourceIndex);
        }

        if (backingChordEvents.timeline[beatIndex] === null) {
          setBackingChordLabel(null);
          setBackingActiveEventIndex(-1);
        }
      }

      setBackingBeat(beatInBar);
      backingBeatRef.current = (step + 1) % totalSteps;
      if (backingBeatRef.current === 0) {
        backingChordIndexRef.current = -1;
        setBackingChordLabel(null);
        setBackingActiveEventIndex(-1);
      }
    };

    tick();
    backingTimerRef.current = window.setInterval(tick, interval);
    return () => {
      if (backingTimerRef.current) {
        window.clearInterval(backingTimerRef.current);
        backingTimerRef.current = null;
      }
    };
  }, [
    state.backingEnabled,
    state.backingBpm,
    state.backingBeatsPerBar,
    state.backingBars,
    state.backingDrums,
    state.backingDrumVolume,
    state.backingChordVolume,
    backingChordEvents,
    playNote
  ]);

  const playScaleForRange = useCallback(
    (position) => {
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
        window.setTimeout(() => {
          playNote(note.midi, 0.5, 0.8);
          flashNote(`${note.stringIndex}-${note.fret}`);
        }, delay);
      });
    },
    [playNote, flashNote, scaleSet, state.fretCount]
  );

  const playChord = useCallback(() => {
    if (!chordSelection.length) {
      setChordHint("Selecciona notas para reproducir el acorde.");
      return;
    }
    const ordered = [...chordSelection].sort((a, b) => a.midi - b.midi);
    ordered.forEach((note, idx) => {
      const delay = idx * 60;
      window.setTimeout(() => {
        playNote(note.midi, 1.0, 0.85);
        flashNote(`${note.stringIndex}-${note.fret}`);
      }, delay);
    });
  }, [chordSelection, flashNote, playNote]);

  const playGeneratedChord = useCallback(
    (voicing) => {
      if (!voicing || !voicing.notes || !voicing.notes.length) return;
      voicing.notes.forEach((note, idx) => {
        const delay = idx * 60;
        window.setTimeout(() => {
          playNote(note.midi, 1.0, 0.85);
          flashNote(`${note.stringIndex}-${note.fret}`);
        }, delay);
      });
    },
    [flashNote, playNote]
  );

  const playStrum = useCallback(
    (voicing, patternId, durationBeats = 1) => {
      if (!voicing || !voicing.notes || !voicing.notes.length) return;
      const pattern = STRUM_PATTERNS.find((p) => p.id === patternId) || STRUM_PATTERNS[1];
      const steps = pattern?.steps?.length ? pattern.steps : ["D"];
      const bpm = Math.min(300, Math.max(30, state.backingBpm || 120));
      const durationSeconds = Math.max(0.2, durationBeats * (60 / bpm));
      const stepDuration = durationSeconds / steps.length;
      const noteDuration = Math.min(0.5, stepDuration * 0.9);
      const orderedDown = [...voicing.notes].sort((a, b) => b.stringIndex - a.stringIndex);
      const orderedUp = [...voicing.notes].sort((a, b) => a.stringIndex - b.stringIndex);

      steps.forEach((step, idx) => {
        if (step === "-" || step === "x") return;
        const isDown = step.toUpperCase() === "D";
        const order = isDown ? orderedDown : orderedUp;
        const baseDelay = idx * stepDuration * 1000;
        order.forEach((note, noteIdx) => {
          const strumDelay = baseDelay + noteIdx * 12;
          window.setTimeout(() => {
            playNote(note.midi, noteDuration, state.backingChordVolume);
          }, strumDelay);
        });
      });
    },
    [playNote, state.backingBpm, state.backingChordVolume]
  );

  const playDiatonicArpeggio = useCallback(
    (arpeggio) => {
      if (!arpeggio || !arpeggio.tones || !arpeggio.tones.size) return;
      const notes = [];
      const minFret = activePosition ? Math.max(0, activePosition.start) : 0;
      const maxFret = activePosition
        ? Math.min(state.fretCount, activePosition.end)
        : state.fretCount;
      TUNING.forEach((string, stringIndex) => {
        for (let fret = minFret; fret <= maxFret; fret += 1) {
          const midi = string.midi + fret;
          const pitchClass = midi % 12;
          if (!arpeggio.tones.has(pitchClass)) continue;
          notes.push({ midi, stringIndex, fret });
        }
      });

      const uniqueNotes = [];
      notes.sort((a, b) => a.midi - b.midi);
      notes.forEach((note) => {
        const last = uniqueNotes[uniqueNotes.length - 1];
        if (last && last.midi === note.midi) return;
        uniqueNotes.push(note);
      });

      const sequence = uniqueNotes.length > 2
        ? uniqueNotes.concat(uniqueNotes.slice(1, -1).reverse())
        : uniqueNotes;

      sequence.forEach((note, idx) => {
        const delay = idx * 150;
        window.setTimeout(() => {
          playNote(note.midi, 0.5, 0.85);
          flashNote(`${note.stringIndex}-${note.fret}`);
        }, delay);
      });
    },
    [activePosition, flashNote, playNote, state.fretCount]
  );

  const setRootIndex = useCallback((value) => {
    setState((prev) => ({ ...prev, rootIndex: value }));
  }, []);

  const applyPreset = useCallback((presetId) => {
    const preset = SCALES.find((scale) => scale.id === presetId) || SCALES[0];
    setState((prev) => ({
      ...prev,
      presetId: preset.id,
      degreeMask: [...preset.mask],
      degreeAdjustments: [...preset.adjustments]
    }));
  }, []);

  const toggleDegree = useCallback((index) => {
    setState((prev) => {
      const nextMask = [...prev.degreeMask];
      nextMask[index] = !nextMask[index];
      return { ...prev, degreeMask: nextMask };
    });
  }, []);

  const setDegreeAdjustment = useCallback((index, value) => {
    setState((prev) => {
      const next = [...prev.degreeAdjustments];
      next[index] = value;
      return { ...prev, degreeAdjustments: next };
    });
  }, []);

  const setFretCount = useCallback((value) => {
    setState((prev) => ({ ...prev, fretCount: value }));
  }, []);

  const setPositionStart = useCallback((value) => {
    setState((prev) => ({ ...prev, positionStart: value }));
  }, []);

  const setPositionWindowSize = useCallback((value) => {
    setState((prev) => ({ ...prev, positionWindowSize: value }));
  }, []);

  const setActivePosition = useCallback((value) => {
    setState((prev) => ({ ...prev, activePosition: value }));
  }, []);

  const setVolume = useCallback((value) => {
    setState((prev) => ({ ...prev, volume: value }));
  }, []);

  const setBackingEnabled = useCallback((value) => {
    setState((prev) => ({ ...prev, backingEnabled: value }));
  }, []);

  const setBackingBpm = useCallback((value) => {
    const bpm = Math.min(300, Math.max(30, Math.round(value)));
    setState((prev) => ({ ...prev, backingBpm: bpm }));
  }, []);

  const setBackingBeatsPerBar = useCallback((value) => {
    const beats = Math.min(16, Math.max(1, Math.round(value)));
    setState((prev) => ({ ...prev, backingBeatsPerBar: beats }));
  }, []);

  const setBackingBars = useCallback((value) => {
    const bars = Math.min(32, Math.max(1, Math.round(value)));
    setState((prev) => ({ ...prev, backingBars: bars }));
  }, []);

  const setBackingDrumVolume = useCallback((value) => {
    const volume = Math.min(1, Math.max(0, value));
    setState((prev) => ({ ...prev, backingDrumVolume: volume }));
  }, []);

  const setBackingDrumProgram = useCallback((rowKey, program) => {
    const nextProgram = Math.min(128, Math.max(0, Math.round(program)));
    setState((prev) => ({
      ...prev,
      backingDrumPrograms: { ...prev.backingDrumPrograms, [rowKey]: nextProgram }
    }));
  }, []);

  const setBackingDrumNote = useCallback((rowKey, note) => {
    const nextNote = Math.min(81, Math.max(35, Math.round(note)));
    setState((prev) => ({
      ...prev,
      backingDrumNotes: { ...prev.backingDrumNotes, [rowKey]: nextNote }
    }));
  }, []);

  const setBackingChordVolume = useCallback((value) => {
    const volume = Math.min(1, Math.max(0, value));
    setState((prev) => ({ ...prev, backingChordVolume: volume }));
  }, []);

  const toggleBackingCell = useCallback((rowKey, index) => {
    setState((prev) => {
      const current = prev.backingDrums[rowKey] || [];
      const nextRow = current.map((value, idx) => (idx === index ? !value : value));
      return {
        ...prev,
        backingDrums: {
          ...prev.backingDrums,
          [rowKey]: nextRow
        }
      };
    });
  }, []);

  const setBackingDrums = useCallback((nextDrums) => {
    if (!nextDrums || typeof nextDrums !== "object") return;
    setState((prev) => ({
      ...prev,
      backingDrums: nextDrums
    }));
  }, []);

  const addBackingChord = useCallback((item) => {
    if (!item || typeof item.voicingId !== "string") return;
    setState((prev) => {
      if (prev.backingChords.length >= 6) return prev;
      const totalBeats = Math.max(1, prev.backingBars * prev.backingBeatsPerBar);
      const occupied = prev.backingChords
        .filter((chord) => Number.isFinite(chord.startBeat))
        .map((chord) => ({
          start: chord.startBeat,
          end: chord.startBeat + Math.max(1, chord.duration || 1)
        }))
        .sort((a, b) => a.start - b.start);
      let startBeat = 0;
      occupied.forEach((slot) => {
        if (startBeat >= slot.start && startBeat < slot.end) {
          startBeat = slot.end;
        }
      });
      startBeat = Math.min(totalBeats - 1, Math.max(0, startBeat));
      const nextItem = {
        ...item,
        startBeat,
        strumPatternId: item.strumPatternId || "down_8"
      };
      return { ...prev, backingChords: [...prev.backingChords, nextItem] };
    });
  }, []);

  const setBackingChords = useCallback((nextList) => {
    if (!Array.isArray(nextList)) return;
    setState((prev) => ({
      ...prev,
      backingChords: nextList.slice(0, 6).map((item) => ({
        voicingId: item.voicingId,
        name: item.name,
        duration: Math.max(1, Math.round(item.duration || 1)),
        startBeat: Number.isFinite(item.startBeat) ? Math.max(0, Math.round(item.startBeat)) : null,
        strumPatternId: typeof item.strumPatternId === "string" ? item.strumPatternId : "down_8"
      }))
    }));
  }, []);

  const updateBackingChord = useCallback((index, update) => {
    setState((prev) => {
      const next = [...prev.backingChords];
      if (!next[index]) return prev;
      next[index] = { ...next[index], ...update };
      return { ...prev, backingChords: next };
    });
  }, []);

  const removeBackingChord = useCallback((index) => {
    setState((prev) => {
      const next = prev.backingChords.filter((_, idx) => idx !== index);
      return { ...prev, backingChords: next };
    });
  }, []);

  const saveBackingPreset = useCallback((name) => {
    const trimmed = String(name || "").trim();
    if (!trimmed) return;
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const payload = {
      id,
      name: trimmed,
      createdAt: Date.now(),
      data: {
        backingBpm: state.backingBpm,
        backingBeatsPerBar: state.backingBeatsPerBar,
        backingBars: state.backingBars,
        backingDrums: state.backingDrums,
        backingDrumPrograms: state.backingDrumPrograms,
        backingDrumNotes: state.backingDrumNotes,
        backingChords: state.backingChords,
        backingDrumVolume: state.backingDrumVolume,
        backingChordVolume: state.backingChordVolume
      }
    };
    setBackingPresets((prev) => [payload, ...prev].slice(0, 20));
  }, [
    state.backingBars,
    state.backingBeatsPerBar,
    state.backingBpm,
    state.backingChords,
    state.backingChordVolume,
    state.backingDrumNotes,
    state.backingDrumPrograms,
    state.backingDrumVolume,
    state.backingDrums
  ]);

  const loadBackingPreset = useCallback((preset) => {
    if (!preset?.data) return;
    setState((prev) => ({
      ...prev,
      backingBpm: preset.data.backingBpm ?? prev.backingBpm,
      backingBeatsPerBar: preset.data.backingBeatsPerBar ?? prev.backingBeatsPerBar,
      backingBars: preset.data.backingBars ?? prev.backingBars,
      backingDrums: preset.data.backingDrums ?? prev.backingDrums,
      backingDrumPrograms: preset.data.backingDrumPrograms ?? prev.backingDrumPrograms,
      backingDrumNotes: preset.data.backingDrumNotes ?? prev.backingDrumNotes,
      backingChords: preset.data.backingChords ?? prev.backingChords,
      backingDrumVolume: preset.data.backingDrumVolume ?? prev.backingDrumVolume,
      backingChordVolume: preset.data.backingChordVolume ?? prev.backingChordVolume
    }));
  }, []);

  const deleteBackingPreset = useCallback((id) => {
    setBackingPresets((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const setMetronomeEnabled = useCallback((value) => {
    setState((prev) => ({ ...prev, metronomeEnabled: value }));
  }, []);

  const setMetronomeBpm = useCallback((value) => {
    const bpm = Math.min(300, Math.max(30, Math.round(value)));
    setState((prev) => ({ ...prev, metronomeBpm: bpm }));
  }, []);

  const setMetronomeBeatsPerBar = useCallback((value) => {
    const beats = Math.min(16, Math.max(1, Math.round(value)));
    setState((prev) => ({ ...prev, metronomeBeatsPerBar: beats }));
  }, []);

  const setMetronomeMode = useCallback((value) => {
    setState((prev) => ({ ...prev, metronomeMode: value }));
  }, []);

  const setMetronomeVolume = useCallback((value) => {
    const volume = Math.min(1, Math.max(0, value));
    setState((prev) => ({ ...prev, metronomeVolume: volume }));
  }, []);

  const tapTempo = useCallback(() => {
    const now = window.performance.now();
    const windowMs = 2000;
    const next = tapTimesRef.current.filter((time) => now - time <= windowMs);
    next.push(now);
    tapTimesRef.current = next;
    if (next.length < 2) return;
    const intervals = [];
    for (let i = 1; i < next.length; i += 1) {
      intervals.push(next[i] - next[i - 1]);
    }
    const average = intervals.reduce((sum, value) => sum + value, 0) / intervals.length;
    const bpm = Math.min(300, Math.max(30, Math.round(60000 / average)));
    setState((prev) => ({ ...prev, metronomeBpm: bpm }));
  }, []);

  const setMainProgram = useCallback((value) => {
    const program = Math.min(127, Math.max(0, Math.round(value)));
    setState((prev) => ({ ...prev, mainProgram: program }));
  }, []);

  const setMidiOutputId = useCallback((value) => {
    setState((prev) => ({ ...prev, midiOutputId: value }));
  }, []);

  const toggleChordMode = useCallback((value) => {
    setState((prev) => ({ ...prev, chordMode: value }));
    setChordHint(
      value
        ? "Modo acorde activo. Click en notas para seleccionar."
        : "Click en el mastil para armar el acorde."
    );
  }, []);

  const toggleShowInversion = useCallback((value) => {
    setState((prev) => ({ ...prev, showInversion: value }));
  }, []);

  const clearChord = useCallback(() => {
    setState((prev) => ({ ...prev, chordNotes: new Array(6).fill(null) }));
    setChordHint("Click en el mastil para armar el acorde.");
  }, []);

  const handleChordSelection = useCallback(
    (note) => {
      setState((prev) => {
        const current = prev.chordNotes[note.stringIndex];
        if (current && current.fret === note.fret) {
          const next = [...prev.chordNotes];
          next[note.stringIndex] = null;
          return { ...prev, chordNotes: next };
        }

        const next = [...prev.chordNotes];
        next[note.stringIndex] = note;
        const frets = next.filter(Boolean).map((item) => item.fret);
        if (frets.length) {
          const span = Math.max(...frets) - Math.min(...frets);
          if (span > 5) {
            setChordHint("El acorde supera 5 trastes. Elige otra nota.");
            return prev;
          }
        }
        setChordHint("Modo acorde activo. Click en notas para seleccionar.");
        return { ...prev, chordNotes: next };
      });
    },
    []
  );

  const setDiatonicChordIndex = useCallback((index) => {
    setState((prev) => ({ ...prev, diatonicChordIndex: index }));
  }, []);

  const clearDiatonicChord = useCallback(() => {
    setState((prev) => ({ ...prev, diatonicChordIndex: null }));
  }, []);

  const setDiatonicArpeggioIndex = useCallback((index) => {
    setState((prev) => ({ ...prev, diatonicArpeggioIndex: index }));
  }, []);

  const clearDiatonicArpeggio = useCallback(() => {
    setState((prev) => ({ ...prev, diatonicArpeggioIndex: null }));
  }, []);

  const handleNoteClick = useCallback(
    (note) => {
      playNote(note.midi, 0.6, 0.85);
      flashNote(`${note.stringIndex}-${note.fret}`);
      if (!state.chordMode) {
        setChordHint("Activa Modo acorde para seleccionar.");
        return;
      }
      handleChordSelection(note);
    },
    [flashNote, handleChordSelection, playNote, state.chordMode]
  );

  const chordSpan = chordSelection.length
    ? Math.max(...chordSelection.map((note) => note.fret)) -
      Math.min(...chordSelection.map((note) => note.fret))
    : null;

  const chordDisplayName = (() => {
    if (!chordSelection.length) return "-";
    const lowest = [...chordSelection].sort((a, b) => a.midi - b.midi)[0];
    const fallbackRoot = lowest ? pitchClassName(lowest.pitchClass) : "-";
    if (!chordData) return `${fallbackRoot} (personalizado)`;
    if (state.showInversion && chordData.bassPc !== chordData.rootPc) {
      return `${chordData.name}/${pitchClassName(chordData.bassPc)}`;
    }
    return chordData.name;
  })();

  const chordNotesText = chordSelection.length
    ? [...chordSelection]
        .sort((a, b) => a.midi - b.midi)
        .map((note) => {
          const interval = (note.pitchClass - state.rootIndex + 12) % 12;
          const label = INTERVAL_LABELS[interval] || "";
          return label
            ? `${pitchClassName(note.pitchClass)} ${label}`
            : pitchClassName(note.pitchClass);
        })
        .join(" ")
    : "-";

  const chordInversionLabel = chordData ? getInversionLabel(chordData) : "-";

  return {
    state,
    sidebarCollapsed,
    setSidebarCollapsed,
    chordHint,
    playingNotes,
    midiOutputs,
    scaleSet,
    scaleNotes,
    formulaTokens,
    matchingScale,
    positions,
    activePosition,
    diatonicTriads,
    diatonicArpeggios,
    generatedScaleChords,
    diatonicChordTones,
    diatonicArpeggioTones,
    maxPositionStart,
    chordDisplayName,
    chordInversionLabel,
    chordNotesText,
    chordSpan,
    handleNoteClick,
    playScaleForRange,
    playChord,
    playGeneratedChord,
    playStrum,
    playDiatonicArpeggio,
    setRootIndex,
    applyPreset,
    toggleDegree,
    setDegreeAdjustment,
    setFretCount,
    setPositionStart,
    setPositionWindowSize,
    setActivePosition,
    setVolume,
    metronomeBeat,
    setMetronomeEnabled,
    setMetronomeBpm,
    setMetronomeBeatsPerBar,
    setMetronomeMode,
    setMetronomeVolume,
    tapTempo,
    backingBeat,
    backingChordLabel,
    backingActiveEventIndex,
    backingChordEvents,
    backingPresets,
    setBackingEnabled,
    setBackingBpm,
    setBackingBeatsPerBar,
    setBackingBars,
    setBackingDrumVolume,
    setBackingDrumProgram,
    setBackingDrumNote,
    setBackingChordVolume,
    toggleBackingCell,
    setBackingDrums,
    addBackingChord,
    setBackingChords,
    updateBackingChord,
    removeBackingChord,
    saveBackingPreset,
    loadBackingPreset,
    deleteBackingPreset,
    setMainProgram,
    setMidiOutputId,
    toggleChordMode,
    toggleShowInversion,
    clearChord,
    setDiatonicChordIndex,
    clearDiatonicChord,
    setDiatonicArpeggioIndex,
    clearDiatonicArpeggio
  };
}

export function formatFretMarkers(fretCount) {
  const markerFrets = new Set([3, 5, 7, 9, 12, 15, 17, 19]);
  const markers = [];
  for (let fret = 0; fret <= fretCount; fret += 1) {
    if (markerFrets.has(fret)) {
      markers.push(fret === 12 ? "double" : "single");
    } else {
      markers.push(null);
    }
  }
  return markers;
}

export function formatFretNumbers(fretCount) {
  return Array.from({ length: fretCount + 1 }, (_, idx) => idx);
}

export function formatNoteLabel(noteIndex) {
  return noteNameFromIndex(noteIndex % 12);
}

export function getNoteIntervalLabel(rootIndex, noteIndex) {
  const interval = (noteIndex - rootIndex + 12) % 12;
  return INTERVAL_LABELS[interval] || "";
}

export function getInstrumentName(program) {
  const entry = INSTRUMENTS.find((instrument) => instrument.program === program);
  return entry ? entry.name : "";
}

export function formatScaleName(scale) {
  return scale ? scale.name : "Escala personalizada";
}

export function formatFormulaText(tokens) {
  return tokens.length ? tokens.join(" ") : "-";
}

export function formatScaleNotesText(notes) {
  return notes.length ? notes.join(" ") : "-";
}

export function getFretboardNoteName(midi) {
  return NOTES[midi % 12];
}
