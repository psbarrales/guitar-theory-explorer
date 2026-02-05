export const NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
export const MAJOR_INTERVALS = [0, 2, 4, 5, 7, 9, 11];
export const INTERVAL_LABELS = {
  0: "1",
  1: "b2",
  2: "2",
  3: "b3",
  4: "3",
  5: "4",
  6: "#4",
  7: "5",
  8: "#5",
  9: "6",
  10: "b7",
  11: "7"
};

export const TUNING = [
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

export function parseFormula(formula) {
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

export const SCALES = RAW_SCALES.map((scale) => ({
  ...scale,
  ...parseFormula(scale.formula)
}));

export function noteNameFromIndex(index) {
  return NOTES[(index + 12) % 12];
}

export function scaleById(id) {
  return SCALES.find((scale) => scale.id === id) || SCALES[0];
}

export function getActiveIntervals({ rootIndex, degreeMask, degreeAdjustments }) {
  const intervals = [];
  for (let i = 0; i < 7; i += 1) {
    if (!degreeMask[i]) continue;
    const interval = (MAJOR_INTERVALS[i] + degreeAdjustments[i] + 120) % 12;
    intervals.push(interval);
  }
  return intervals;
}

export function getScaleNoteIndices(state) {
  return new Set(getActiveIntervals(state).map((interval) => (state.rootIndex + interval) % 12));
}

export function getScaleNoteNames(state) {
  return getActiveIntervals(state).map((interval) => noteNameFromIndex(state.rootIndex + interval));
}

export function formatDegreeToken(degreeIndex, degreeAdjustments) {
  const adj = degreeAdjustments[degreeIndex];
  let accidental = "";
  if (adj === -2) accidental = "bb";
  if (adj === -1) accidental = "b";
  if (adj === 1) accidental = "#";
  if (adj === 2) accidental = "x";
  return `${accidental}${degreeIndex + 1}`;
}

export function getFormulaTokens(degreeMask, degreeAdjustments) {
  const tokens = [];
  for (let i = 0; i < 7; i += 1) {
    if (!degreeMask[i]) continue;
    tokens.push(formatDegreeToken(i, degreeAdjustments));
  }
  return tokens;
}

export function getScaleDegrees(state) {
  const degrees = [];
  for (let i = 0; i < 7; i += 1) {
    if (!state.degreeMask[i]) continue;
    const interval = (MAJOR_INTERVALS[i] + state.degreeAdjustments[i] + 120) % 12;
    const pc = (state.rootIndex + interval) % 12;
    degrees.push({ degree: i + 1, pc, interval });
  }
  return degrees;
}
