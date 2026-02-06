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
const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII"];

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
  instrumentId: INSTRUMENTS[0].id,
  midiOutputId: "internal",
  chordMode: true,
  chordNotes: new Array(6).fill(null),
  showInversion: true,
  diatonicChordIndex: null
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
    if (typeof saved.instrumentId === "string" && INSTRUMENTS.some((i) => i.id === saved.instrumentId)) {
      next.instrumentId = saved.instrumentId;
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
    instrumentId: state.instrumentId,
    midiOutputId: state.midiOutputId,
    chordMode: state.chordMode,
    showInversion: state.showInversion,
    diatonicChordIndex: state.diatonicChordIndex,
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

export function useGuitarLabState() {
  const [state, setState] = useState(() => loadStoredState());
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => loadSidebarState());
  const [chordHint, setChordHint] = useState(
    state.chordMode
      ? "Modo acorde activo. Click en notas para seleccionar."
      : "Click en el mastil para armar el acorde."
  );
  const [playingNotes, setPlayingNotes] = useState(new Set());
  const [midiAccess, setMidiAccess] = useState(null);
  const [midiOutputs, setMidiOutputs] = useState([]);

  const synthRef = useRef(new Synth());
  const midiOutputRef = useRef(null);

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
  const generatedScaleChords = useMemo(
    () =>
      generateScaleChordVoicings({
        scaleSet,
        tuning: TUNING,
        minFret: 0,
        maxFret: Math.min(12, state.fretCount),
        maxSpan: 5,
        minStrings: 3,
        maxStrings: 6
      }),
    [scaleSet, state.fretCount]
  );
  const diatonicChordTones = useMemo(() => {
    if (state.diatonicChordIndex === null) return null;
    const chord = diatonicTriads.find((item) => item.index === state.diatonicChordIndex);
    return chord ? chord.tones : null;
  }, [state.diatonicChordIndex, diatonicTriads]);

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
    const instrument = INSTRUMENTS.find((item) => item.id === state.instrumentId) || INSTRUMENTS[0];
    output.send([0xc0, instrument.program]);
  }, [state.instrumentId, state.midiOutputId]);

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
    (midi, duration = 0.6, velocity = 0.8) => {
      if (state.midiOutputId !== "internal" && midiOutputRef.current) {
        const velocityValue = Math.floor(velocity * 127);
        midiOutputRef.current.send([0x90, midi, velocityValue]);
        midiOutputRef.current.send([0x80, midi, 0], window.performance.now() + duration * 1000);
      } else {
        synthRef.current.play(midi, duration, velocity, state.instrumentId, state.volume);
      }
    },
    [state.instrumentId, state.midiOutputId, state.volume]
  );

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

  const setInstrumentId = useCallback((value) => {
    setState((prev) => ({ ...prev, instrumentId: value }));
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
    generatedScaleChords,
    diatonicChordTones,
    maxPositionStart,
    chordDisplayName,
    chordInversionLabel,
    chordNotesText,
    chordSpan,
    handleNoteClick,
    playScaleForRange,
    playChord,
    playGeneratedChord,
    setRootIndex,
    applyPreset,
    toggleDegree,
    setDegreeAdjustment,
    setFretCount,
    setPositionStart,
    setPositionWindowSize,
    setActivePosition,
    setVolume,
    setInstrumentId,
    setMidiOutputId,
    toggleChordMode,
    toggleShowInversion,
    clearChord,
    setDiatonicChordIndex,
    clearDiatonicChord
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

export function getInstrumentName(id) {
  return INSTRUMENTS.find((instrument) => instrument.id === id)?.name || "";
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
