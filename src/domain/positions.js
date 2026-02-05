import { TUNING } from "./theory.js";

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

export function buildCagedPositions({
  scaleSet,
  fretCount,
  positionStart,
  positionWindowSize
}) {
  const windowSize = positionWindowSize;
  const step = 3;
  const maxStart = Math.max(1, fretCount - (windowSize - 1));
  const startBase = Math.min(Math.max(1, positionStart), maxStart);
  const starts = Array.from({ length: 5 }, (_, idx) =>
    Math.min(startBase + idx * step, maxStart)
  );
  const labels = ["C", "A", "G", "E", "D"];

  const buildPositionForStart = (start, index) => {
    const end = Math.min(start + windowSize - 1, fretCount);
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
