import musyngkiteNames from "soundfont-player/names/musyngkite.json";

export const INSTRUMENTS = [
  { id: "nylon", name: "Guitarra nylon", program: 24, wave: "triangle", filter: 1200 },
  { id: "steel", name: "Guitarra acero", program: 25, wave: "triangle", filter: 1800 },
  { id: "jazz", name: "Electrica jazz", program: 26, wave: "sine", filter: 900 },
  { id: "clean", name: "Electrica clean", program: 27, wave: "sawtooth", filter: 1400 },
  { id: "dist", name: "Electrica distorsion", program: 30, wave: "square", filter: 2000 }
];

export const GM_INSTRUMENTS = musyngkiteNames.map((rawName, program) => ({
  program,
  rawName,
  name: rawName
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
})).concat([
  { program: 128, rawName: "percussion", name: "Percussion (GM Drum Kit)" }
]);
