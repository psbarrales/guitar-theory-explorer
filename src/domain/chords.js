import { NOTES } from "./theory.js";

export const CHORD_DEFS = [
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

export function pitchClassName(pc) {
  return NOTES[(pc + 12) % 12];
}

export function detectChordData(selection) {
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

export function getInversionLabel(chordData) {
  if (!chordData) return "-";
  const bassInterval = (chordData.bassPc - chordData.rootPc + 12) % 12;
  if (bassInterval === 0) return "Posicion raiz";
  const ordered = chordData.def.intervals.map((i) => i % 12);
  const index = ordered.indexOf(bassInterval);
  if (index === -1) return "Inversion";
  if (index === 1) return "1ra inversion";
  if (index === 2) return "2da inversion";
  if (index === 3) return "3ra inversion";
  return "Inversion";
}
