import { useEffect, useMemo, useState } from "react";
import {
  formatFretMarkers,
  formatFretNumbers,
  formatFormulaText,
  formatScaleName,
  formatScaleNotesText,
  getNoteIntervalLabel,
  useGuitarLabState
} from "../application/useGuitarLabState.js";
import { INSTRUMENTS } from "../infrastructure/sound.js";
import { NOTES, SCALES, TUNING } from "../domain/theory.js";
import { CONSERVATORY_PROGRAM } from "../domain/conservatoryCourse.js";

const DEGREE_OPTIONS = [
  { value: -2, label: "bb" },
  { value: -1, label: "b" },
  { value: 0, label: "nat" },
  { value: 1, label: "#" },
  { value: 2, label: "x" }
];

const WIKI_PROFILES = [
  {
    match: /(interval|interválico)/i,
    theoryFocus: "mide distancia sonora entre notas y define tensión, color y función armónica o melódica",
    guitarTip: "canta cada intervalo antes de tocarlo para fijar la referencia auditiva"
  },
  {
    match: /(ritmo|compás|subdivisión|polirritmia)/i,
    theoryFocus: "organiza el tiempo musical mediante pulso, acento, subdivisión y jerarquía métrica",
    guitarTip: "practica con metrónomo en negras, luego en subdivisiones y finalmente con acentos desplazados"
  },
  {
    match: /(escala|modo|modal)/i,
    theoryFocus: "define colecciones de alturas y su comportamiento melódico, armónico y expresivo",
    guitarTip: "toca el mismo material en al menos dos zonas del mástil y en una sola cuerda"
  },
  {
    match: /(acorde|armonía|cadencia|dominante|modulación|función)/i,
    theoryFocus: "explica relaciones verticales entre sonidos y dirección tonal dentro de una frase o forma",
    guitarTip: "arpegia cada acorde y conecta voces guía (3ª y 7ª) entre cambios"
  },
  {
    match: /(lectura|notación|partitura|clave)/i,
    theoryFocus: "traduce símbolos escritos en decisiones sonoras precisas de altura, duración y articulación",
    guitarTip: "lee compases cortos diariamente sin detener el pulso, incluso con errores menores"
  },
  {
    match: /(contrapunto|voz|conducción)/i,
    theoryFocus: "coordina independencia de líneas y equilibrio entre movimiento melódico y coherencia armónica",
    guitarTip: "practica dos voces separando dinámicas para escuchar claramente cada línea"
  }
];

function getWikiProfile(concept, topic) {
  return WIKI_PROFILES.find((profile) => profile.match.test(concept) || profile.match.test(topic)) || {
    theoryFocus: "estructura el lenguaje musical y permite relacionar lectura, audición, análisis y ejecución",
    guitarTip: "combina estudio lento, repetición consciente y aplicación inmediata en repertorio"
  };
}

function buildStudyWikiEntry(entry) {
  const profile = getWikiProfile(entry.concept, entry.topic);
  const relatedConcepts = entry.topicConcepts
    .filter((item) => item !== entry.concept)
    .slice(0, 3)
    .join(", ");

  return {
    definition: `En este programa, ${entry.concept} se estudia como un concepto central porque ${profile.theoryFocus}.`,
    importance: `Su dominio permite conectar el tema "${entry.topic}" con decisiones musicales concretas: qué tocar, por qué suena así y cómo resolverlo en contexto real.`,
    guitarTransfer: `${entry.guitarContext}. Como rutina, ${profile.guitarTip}.`,
    practiceSteps: [
      `Analiza un ejemplo escrito del tema y subraya dónde aparece ${entry.concept}.`,
      `Traslada el concepto al diapasón en dos posiciones y un tempo cómodo (50–70 bpm).`,
      "Integra el concepto en una frase corta o progresión de 4 compases y grábate.",
      "Evalúa afinación, ritmo y claridad; corrige una sola variable por repetición."
    ],
    frequentErrors: [
      "Memorizar nombres sin escuchar su efecto sonoro.",
      "Practicar rápido antes de controlar pulso, articulación y acentos.",
      "No relacionar teoría con repertorio, improvisación o acompañamiento real."
    ],
    connections: relatedConcepts
      ? `Para profundizar, vincula este contenido con: ${relatedConcepts}.`
      : "Este concepto funciona como base transversal para los siguientes temas del semestre."
  };
}

export default function App() {
  const {
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
  } = useGuitarLabState();

  const scaleName = formatScaleName(matchingScale);
  const formulaText = formatFormulaText(formulaTokens);
  const scaleNotesText = formatScaleNotesText(scaleNotes);
  const fretNumbers = formatFretNumbers(state.fretCount);
  const fretMarkers = formatFretMarkers(state.fretCount);

  const activeNoteSet = activePosition && activePosition.notes && activePosition.notes.length
    ? new Set(activePosition.notes.map((note) => `${note.stringIndex}-${note.fret}`))
    : null;

  const diatonicFormula = diatonicTriads.length
    ? diatonicTriads.map((item) => item.numeral)
    : [];

  const [selectedGeneratedChord, setSelectedGeneratedChord] = useState(null);
  const [selectedGeneratedChordName, setSelectedGeneratedChordName] = useState("");
  const [generatedSectionCollapsed, setGeneratedSectionCollapsed] = useState(true);
  const [courseDrawerOpen, setCourseDrawerOpen] = useState(false);
  const [selectedStudyItem, setSelectedStudyItem] = useState(null);

  const studyContentEntries = useMemo(
    () => CONSERVATORY_PROGRAM.flatMap((semester, semesterIndex) => (
      semester.topics.flatMap((topic, topicIndex) => (
        topic.concepts.map((concept, conceptIndex) => ({
          id: `${semesterIndex}-${topicIndex}-${conceptIndex}`,
          semester: semester.semester,
          topic: topic.title,
        topicSummary: topic.summary,
        guitarContext: topic.guitarContext,
        semesterFocus: semester.focus,
        bibliography: semester.bibliography,
        topicConcepts: topic.concepts,
        concept,
        conceptIndex,
        conceptTotal: topic.concepts.length
        }))
      ))
    )),
    []
  );

  const groupedGeneratedChords = useMemo(() => {
    const groups = new Map();
    generatedScaleChords.forEach((voicing) => {
      if (!groups.has(voicing.name)) {
        groups.set(voicing.name, []);
      }
      groups.get(voicing.name).push(voicing);
    });

    return Array.from(groups.entries())
      .map(([name, voicings]) => ({
        name,
        voicings,
        count: voicings.length,
        minStrings: Math.min(...voicings.map((item) => item.stringCount)),
        maxStrings: Math.max(...voicings.map((item) => item.stringCount))
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [generatedScaleChords]);

  useEffect(() => {
    setGeneratedSectionCollapsed(true);
  }, [generatedScaleChords]);

  const activeChordGroup = selectedGeneratedChordName
    ? groupedGeneratedChords.find((group) => group.name === selectedGeneratedChordName)
    : null;

  const generatedChordFrets = selectedGeneratedChord
    ? selectedGeneratedChord.notes.map((note) => note.fret)
    : [];
  const selectedGeneratedChordIndex = selectedGeneratedChord && activeChordGroup
    ? activeChordGroup.voicings.findIndex((item) => item.id === selectedGeneratedChord.id)
    : -1;
  const selectedChordPositionLabel = selectedGeneratedChordIndex >= 0 && activeChordGroup
    ? `${selectedGeneratedChordIndex + 1} de ${activeChordGroup.voicings.length}`
    : "";
  const compactFrettedNotes = generatedChordFrets.filter((fret) => fret > 0);
  const compactFrets = compactFrettedNotes.length
    ? Array.from(
      { length: Math.max(...compactFrettedNotes) - Math.min(...compactFrettedNotes) + 1 },
      (_, index) => Math.min(...compactFrettedNotes) + index
    )
    : [];
  const formatVoicingFrets = (fretsSignature) => fretsSignature.split("-").reverse().join("-");
  const handlePositionClick = (position) => {
    setActivePosition(position.id);
    playScaleForRange(position);
  };

  const selectedStudyIndex = selectedStudyItem
    ? studyContentEntries.findIndex((entry) => entry.id === selectedStudyItem.id)
    : -1;
  const previousStudyItem = selectedStudyIndex > 0
    ? studyContentEntries[selectedStudyIndex - 1]
    : null;
  const nextStudyItem = selectedStudyIndex >= 0 && selectedStudyIndex < studyContentEntries.length - 1
    ? studyContentEntries[selectedStudyIndex + 1]
    : null;
  const selectedStudyWiki = selectedStudyItem ? buildStudyWikiEntry(selectedStudyItem) : null;

  return (
    <div className="page">
      <nav className="top-nav">
        <div className="top-nav-links">
          <a href="#explorer">Explorador</a>
          <a href="#diatonic">Progresion</a>
          <a href="#fretboard">Diapason</a>
        </div>
        <button type="button" className="action" onClick={() => setCourseDrawerOpen(true)}>
          Curso de teoria (Conservatorio)
        </button>
      </nav>
      <div className="mobile-toolbar">
        <button
          type="button"
          className="mobile-sidebar-toggle"
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
        >
          {sidebarCollapsed ? "Mostrar controles" : "Ocultar controles"}
        </button>
      </div>
      <div className={`layout ${sidebarCollapsed ? "sidebar-collapsed" : ""}`.trim()}>
        <button
          type="button"
          className={`mobile-backdrop ${sidebarCollapsed ? "hidden" : ""}`.trim()}
          onClick={() => setSidebarCollapsed(true)}
          aria-label="Cerrar panel lateral"
        />
        <aside className={`sidebar ${sidebarCollapsed ? "collapsed" : ""}`.trim()}>
          <div className="sidebar-header">
            <div>
              <h1>Guitar Scale Lab</h1>
              <p className="subtitle">Explora escalas, posiciones y acordes con audio y MIDI.</p>
            </div>
            <button
              type="button"
              className="icon-btn"
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            >
              {sidebarCollapsed ? "Abrir" : "Cerrar"}
            </button>
          </div>

          <div className="sidebar-section">
            <h3>Opciones</h3>
            <div className="control-group">
              <label htmlFor="positionStart">Inicio posiciones</label>
              <input
                id="positionStart"
                type="range"
                min={1}
                max={maxPositionStart}
                value={state.positionStart}
                onChange={(event) => setPositionStart(Number(event.target.value))}
              />
              <span>{state.positionStart}</span>
            </div>
            <div className="control-group">
              <label htmlFor="positionWindow">Ancho posicion</label>
              <select
                id="positionWindow"
                value={state.positionWindowSize}
                onChange={(event) => setPositionWindowSize(Number(event.target.value))}
              >
                <option value={4}>4 trastes</option>
                <option value={5}>5 trastes</option>
                <option value={6}>6 trastes</option>
              </select>
            </div>
            <div className="control-group">
              <label htmlFor="fretCount">Frets visibles</label>
              <input
                id="fretCount"
                type="range"
                min={12}
                max={24}
                value={state.fretCount}
                onChange={(event) => setFretCount(Number(event.target.value))}
              />
              <span>{state.fretCount}</span>
            </div>
          </div>

          <div className="sidebar-section">
            <h3>Audio</h3>
            <div className="control-group">
              <label htmlFor="instrumentSelect">Selector guitarra</label>
              <select
                id="instrumentSelect"
                value={state.instrumentId}
                onChange={(event) => setInstrumentId(event.target.value)}
              >
                {INSTRUMENTS.map((instrument) => (
                  <option key={instrument.id} value={instrument.id}>
                    {instrument.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="control-group">
              <label htmlFor="midiOutput">Salida MIDI</label>
              <select
                id="midiOutput"
                value={state.midiOutputId}
                onChange={(event) => setMidiOutputId(event.target.value)}
              >
                <option value="internal">Sintetizador interno</option>
                {midiOutputs.map((output) => (
                  <option key={output.id} value={output.id}>
                    {output.name || `MIDI ${output.id}`}
                  </option>
                ))}
              </select>
            </div>
            <div className="control-group">
              <label htmlFor="volume">Volumen</label>
              <input
                id="volume"
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={state.volume}
                onChange={(event) => setVolume(Number(event.target.value))}
              />
              <span>{Math.round(state.volume * 100)}%</span>
            </div>
            <p className="midi-hint">
              MIDI externo disponible. Elige una salida para controlar tu sintetizador.
            </p>
          </div>

          <div className="sidebar-section">
            <h3>Constructor</h3>
            <label className="toggle">
              <input
                type="checkbox"
                checked={state.chordMode}
                onChange={(event) => toggleChordMode(event.target.checked)}
              />
              <span>Modo acorde</span>
            </label>
            <label className="toggle">
              <input
                type="checkbox"
                checked={state.showInversion}
                onChange={(event) => toggleShowInversion(event.target.checked)}
              />
              <span>Mostrar inversion</span>
            </label>
            <button type="button" className="action" onClick={playChord}>
              Sonar acorde
            </button>
            <button type="button" className="action ghost" onClick={clearChord}>
              Limpiar
            </button>
          </div>
        </aside>

        <main className="content">
          <section id="explorer" className="hero compact">
            <div>
              <p className="eyebrow">Escala activa</p>
              <h1>{scaleName}</h1>
              <p className="subtitle">{scaleNotesText}</p>
            </div>
            <div className="status">
              <div>
                <span className="label">Formula</span>
                <div className="formula-preview">{formulaText}</div>
              </div>
              <div>
                <span className="label">Notas</span>
                <div>{scaleNotesText}</div>
              </div>
            </div>
          </section>

          <section className="panel scale-bar">
            <div className="control-group">
              <div className="control-header">
                <div>
                  <h3>Tonica</h3>
                  <p>Elige la nota raiz.</p>
                </div>
              </div>
              <select
                value={state.rootIndex}
                onChange={(event) => setRootIndex(Number(event.target.value))}
              >
                {NOTES.map((note, index) => (
                  <option key={note} value={index}>
                    {note}
                  </option>
                ))}
              </select>
            </div>

            <div className="control-group">
              <div className="control-header">
                <div>
                  <h3>Escala</h3>
                  <p>Presets y formula editable.</p>
                </div>
              </div>
              <select
                value={state.presetId}
                onChange={(event) => applyPreset(event.target.value)}
              >
                {SCALES.map((scale) => (
                  <option key={scale.id} value={scale.id}>
                    {scale.name}
                  </option>
                ))}
              </select>
              <div className="formula-preview">{formulaText}</div>
            </div>

            <div className="control-group">
              <div className="control-header">
                <div>
                  <h3>Editor de formula</h3>
                  <p>Activa grados y ajusta bemoles/sostenidos.</p>
                </div>
              </div>
              <div className="degree-grid">
                {state.degreeMask.map((active, index) => (
                  <div key={`degree-${index}`} className="degree-card">
                    <button
                      type="button"
                      className={`degree-toggle ${active ? "active" : ""}`.trim()}
                      onClick={() => toggleDegree(index)}
                    >
                      {index + 1}
                    </button>
                    <select
                      className="degree-adjust"
                      value={state.degreeAdjustments[index]}
                      onChange={(event) => setDegreeAdjustment(index, Number(event.target.value))}
                      disabled={!active}
                    >
                      {DEGREE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section id="diatonic" className="panel diatonic-chords">
            <div className="diatonic-header">
              <div>
                <h2>Progresion diatonica</h2>
                <p>Selecciona un grado para marcar las notas del acorde.</p>
              </div>
              <button type="button" className="action ghost" onClick={clearDiatonicChord}>
                Limpiar seleccion
              </button>
            </div>
            <div className="diatonic-formula">
              {diatonicFormula.length
                ? diatonicFormula.map((symbol, index) => (
                    <span
                      key={`${symbol}-${index}`}
                      className={[0, 3, 4].includes(index) ? "accent" : ""}
                    >
                      {symbol}
                    </span>
                  ))
                : "-"}
            </div>
            <div className="diatonic-grid">
              {diatonicTriads.map((chord) => (
                <button
                  type="button"
                  key={chord.index}
                  className={`diatonic-btn ${
                    state.diatonicChordIndex === chord.index ? "active" : ""
                  }`.trim()}
                  onClick={() => {
                    if (state.diatonicChordIndex === chord.index) {
                      clearDiatonicChord();
                    } else {
                      setDiatonicChordIndex(chord.index);
                    }
                  }}
                >
                  <strong>{chord.numeral}</strong>
                  <span>{chord.name}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="panel generated-chords">
            <div className="diatonic-header">
              <div>
                <h2>Acordes generados de la escala</h2>
                <p>Agrupados por nombre. Abre cada nota para ver todas sus formas (3 a 6 cuerdas).</p>
              </div>
              <button
                type="button"
                className="action ghost"
                onClick={() => setGeneratedSectionCollapsed(!generatedSectionCollapsed)}
              >
                {generatedSectionCollapsed ? "Mostrar" : "Minimizar"}
              </button>
            </div>
            {!generatedSectionCollapsed ? (
              <div className="generated-chords-grid">
                {groupedGeneratedChords.map((group) => (
                  <button
                    key={group.name}
                    type="button"
                    className="generated-chord-btn"
                    onClick={() => {
                      setSelectedGeneratedChordName(group.name);
                      setSelectedGeneratedChord(group.voicings[0]);
                      playGeneratedChord(group.voicings[0]);
                    }}
                    title={`${group.count} formas para ${group.name}`}
                  >
                    <strong>{group.name}</strong>
                    <span>{group.count} formas</span>
                    <small>
                      {group.minStrings}-{group.maxStrings} cuerdas
                    </small>
                  </button>
                ))}
              </div>
            ) : null}
          </section>

          <section className="panel">
            <div className="positions-header">
              <h2>Posiciones CAGED</h2>
            </div>
            <div className="position-grid">
              {positions.map((position) => (
                <button
                  key={position.id}
                  type="button"
                  className={`position-btn ${
                    state.activePosition === position.id ? "active" : ""
                  }`.trim()}
                  onClick={() => handlePositionClick(position)}
                >
                  <strong>{position.name}</strong>
                  <span>Frets {position.start} - {position.end}</span>
                  <span>Click para reproducir</span>
                </button>
              ))}
            </div>
          </section>

          <section className="panel chord-builder">
            <div className="chord-header">
              <div>
                <h2>Constructor de acordes</h2>
                <p>Marca una nota por cuerda (max 5 trastes de span).</p>
              </div>
              <div className="chord-actions">
                <label className="toggle">
                  <input
                    type="checkbox"
                    checked={state.chordMode}
                    onChange={(event) => toggleChordMode(event.target.checked)}
                  />
                  <span>Modo acorde</span>
                </label>
                <label className="toggle">
                  <input
                    type="checkbox"
                    checked={state.showInversion}
                    onChange={(event) => toggleShowInversion(event.target.checked)}
                  />
                  <span>Mostrar inversion</span>
                </label>
                <button type="button" className="action" onClick={playChord}>
                  Sonar acorde
                </button>
                <button type="button" className="action ghost" onClick={clearChord}>
                  Limpiar
                </button>
              </div>
            </div>
            <div className="chord-info">
              <div>
                <span className="label">Acorde</span>
                <div>{chordDisplayName}</div>
              </div>
              <div>
                <span className="label">Inversion</span>
                <div>{chordInversionLabel}</div>
              </div>
              <div>
                <span className="label">Notas</span>
                <div>{chordNotesText}</div>
              </div>
              <div>
                <span className="label">Span</span>
                <div>{chordSpan !== null ? `${chordSpan} trastes` : "-"}</div>
              </div>
              <p className="chord-hint">{chordHint}</p>
            </div>
          </section>

          <section id="fretboard" className="panel fretboard-wrap">
            <div className="fretboard-header">
              <div className="legend">
                <span className="chip root">Tonica</span>
                <span className="chip scale">Nota de escala</span>
                <span className="chip muted">Fuera de escala</span>
                <span className="chip chord">Acorde</span>
              </div>
              <button type="button" className="action" onClick={() => playScaleForRange(null)}>
                Reproducir escala completa
              </button>
            </div>
            <div className="fret-numbers">
              {fretNumbers.map((fret) => (
                <div key={`fret-num-${fret}`}>{fret}</div>
              ))}
            </div>
            <div className="fret-markers">
              {fretMarkers.map((marker, index) => (
                <div key={`marker-${index}`}>
                  {marker ? (
                    <div className={`marker ${marker === "double" ? "double" : ""}`.trim()} />
                  ) : null}
                </div>
              ))}
            </div>
            <div className="fretboard">
              {TUNING.map((string, stringIndex) => (
                <div
                  key={`string-${stringIndex}`}
                  className="string-row"
                  style={{
                    gridTemplateColumns: `60px repeat(${state.fretCount + 1}, minmax(46px, 1fr))`
                  }}
                >
                  <div className="string-label">{string.label}</div>
                  {fretNumbers.map((fret) => {
                    const midi = string.midi + fret;
                    const noteIndex = midi % 12;
                    const noteName = NOTES[noteIndex];
                    const inScale = scaleSet.has(noteIndex);
                    const isRoot = inScale && noteIndex === state.rootIndex;
                    const inWindow = activePosition
                      ? fret >= activePosition.start && fret <= activePosition.end
                      : true;
                    const inRange = activeNoteSet
                      ? activeNoteSet.has(`${stringIndex}-${fret}`)
                      : inWindow;
                    const chordNote = state.chordNotes[stringIndex];
                    const isChordNote = chordNote && chordNote.fret === fret;
                    const isDiatonicChordTone = diatonicChordTones
                      ? diatonicChordTones.has(noteIndex)
                      : false;
                    const showScale = !activeNoteSet || inRange || isChordNote;
                    const intervalLabel = isChordNote
                      ? getNoteIntervalLabel(state.rootIndex, noteIndex)
                      : "";
                    const noteId = `${stringIndex}-${fret}`;
                    const classes = ["note"];
                    if (inScale && showScale) classes.push("in-scale");
                    if (isRoot && showScale) classes.push("root");
                    if (!inScale || !showScale) classes.push("muted");
                    if (inWindow) classes.push("in-window");
                    if (activeNoteSet && inRange) classes.push("in-position");
                    if (!isChordNote && activeNoteSet && inWindow && !inRange) classes.push("suppressed");
                    if (!isChordNote && inScale && !inWindow) classes.push("out-range");
                    if (isDiatonicChordTone && !isChordNote) classes.push("prog-chord");
                    if (isChordNote) classes.push("chord");
                    if (playingNotes.has(noteId)) classes.push("playing");

                    return (
                      <button
                        key={`note-${stringIndex}-${fret}`}
                        type="button"
                        className={classes.join(" ")}
                        onClick={() =>
                          handleNoteClick({
                            stringIndex,
                            fret,
                            midi,
                            pitchClass: noteIndex
                          })
                        }
                      >
                        <span data-interval={intervalLabel}>{noteName}</span>
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </section>
        </main>
      </div>

      {courseDrawerOpen ? (
        <div className="course-drawer-layer" role="dialog" aria-modal="true" aria-label="Curso de teoria">
          <button
            type="button"
            className="course-drawer-backdrop"
            onClick={() => setCourseDrawerOpen(false)}
            aria-label="Cerrar curso"
          />
          <aside className="course-drawer">
            <div className="course-drawer-header">
              <div>
                <p className="eyebrow">Programa completo</p>
                <h2>Plan de teoria musical para guitarra (6 semestres)</h2>
                <p>
                  Ruta curricular inspirada en conservatorio: teoria, entrenamiento auditivo,
                  armonia, lectura, tecnica y proyecto final.
                </p>
              </div>
              <button type="button" className="icon-btn" onClick={() => setCourseDrawerOpen(false)}>
                Cerrar
              </button>
            </div>

            <div className="course-semester-grid">
              {CONSERVATORY_PROGRAM.map((semester, semesterIndex) => (
                <article key={semester.semester} className="course-semester-card">
                  <h3>{semester.semester}</h3>
                  <p>{semester.focus}</p>
                  <div className="course-semester-meta">
                    <div>
                      <h4>Bibliografia sugerida</h4>
                      <ul>
                        {semester.bibliography.map((book) => (
                          <li key={`${semester.semester}-${book}`}>{book}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                  <div className="course-topics-grid">
                    {semester.topics.map((topic, topicIndex) => (
                      <section key={`${semester.semester}-${topic.title}`} className="course-topic-card">
                        <img src={topic.image} alt={topic.title} loading="lazy" />
                        <div>
                          <h4>{topic.title}</h4>
                          <p>{topic.summary}</p>
                          <details open>
                            <summary>Contenido de estudio</summary>
                            <ul>
                              {topic.concepts.map((item, conceptIndex) => (
                                <li key={`${topic.title}-content-${item}`}>
                                  <button
                                    type="button"
                                    className="course-topic-link"
                                    onClick={() => {
                                      const selectedId = `${semesterIndex}-${topicIndex}-${conceptIndex}`;
                                      const selectedEntry = studyContentEntries.find((entry) => entry.id === selectedId);
                                      setSelectedStudyItem(selectedEntry || null);
                                      setCourseDrawerOpen(false);
                                    }}
                                  >
                                    {item}
                                  </button>
                                </li>
                              ))}
                            </ul>
                          </details>
                          <p><strong>Aplicacion en guitarra:</strong> {topic.guitarContext}</p>
                        </div>
                      </section>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </aside>
        </div>
      ) : null}

      {selectedStudyItem ? (
        <div className="study-page-layer" role="dialog" aria-modal="true" aria-label="Estudio completo">
          <button
            type="button"
            className="study-page-backdrop"
            aria-label="Cerrar estudio"
            onClick={() => setSelectedStudyItem(null)}
          />
          <article className="study-page">
            <header className="study-page-header">
              <div>
                <p className="eyebrow">{selectedStudyItem.semester}</p>
                <h2>{selectedStudyItem.concept}</h2>
                <p className="study-page-topic">Tema: {selectedStudyItem.topic}</p>
              </div>
              <button type="button" className="icon-btn" onClick={() => setSelectedStudyItem(null)}>
                Cerrar
              </button>
            </header>

            <div className="study-page-content">
              <section>
                <h3>Enfoque del estudio completo</h3>
                <p>
                  {selectedStudyWiki?.definition}
                </p>
                <p>{selectedStudyWiki?.importance}</p>
              </section>

              <section>
                <h3>Base teórica y marco del semestre</h3>
                <p><strong>Foco del semestre:</strong> {selectedStudyItem.semesterFocus}</p>
                <p>{selectedStudyItem.topicSummary}</p>
                <p>{selectedStudyWiki?.connections}</p>
              </section>

              <section>
                <h3>Plan práctico para guitarra</h3>
                <ol>
                  {selectedStudyWiki?.practiceSteps.map((step) => (
                    <li key={`${selectedStudyItem.id}-${step}`}>{step}</li>
                  ))}
                </ol>
              </section>

              <section>
                <h3>Aplicación directa al instrumento</h3>
                <p>{selectedStudyWiki?.guitarTransfer}</p>
              </section>

              <section>
                <h3>Errores comunes al estudiar este contenido</h3>
                <ul>
                  {selectedStudyWiki?.frequentErrors.map((error) => (
                    <li key={`${selectedStudyItem.id}-${error}`}>{error}</li>
                  ))}
                </ul>
              </section>

              <section>
                <h3>Bibliografía recomendada</h3>
                <ul>
                  {selectedStudyItem.bibliography.map((book) => (
                    <li key={`${selectedStudyItem.id}-${book}`}>{book}</li>
                  ))}
                </ul>
              </section>
            </div>

            <footer className="study-page-footer">
              <span>
                Contenido {selectedStudyItem.conceptIndex + 1} de {selectedStudyItem.conceptTotal} en este tema
              </span>
              <div>
                <button
                  type="button"
                  className="action"
                  disabled={!previousStudyItem}
                  onClick={() => previousStudyItem && setSelectedStudyItem(previousStudyItem)}
                >
                  ← Anterior
                </button>
                <button
                  type="button"
                  className="action"
                  disabled={!nextStudyItem}
                  onClick={() => nextStudyItem && setSelectedStudyItem(nextStudyItem)}
                >
                  Siguiente →
                </button>
              </div>
            </footer>
          </article>
        </div>
      ) : null}

      {selectedGeneratedChord && activeChordGroup ? (
        <div className="generated-chord-modal" role="dialog" aria-modal="true">
          <button
            type="button"
            className="generated-chord-modal-backdrop"
            onClick={() => {
              setSelectedGeneratedChord(null);
              setSelectedGeneratedChordName("");
            }}
            aria-label="Cerrar vista de acorde"
          />
          <div className="generated-chord-modal-compact-card">
            <button
              type="button"
              className="generated-chord-close"
              onClick={() => {
                setSelectedGeneratedChord(null);
                setSelectedGeneratedChordName("");
              }}
              aria-label="Cerrar"
            >
              ×
            </button>
            <h3>{selectedGeneratedChord.name}</h3>
            <p className="generated-chord-counter">{selectedChordPositionLabel}</p>

            <div className="generated-chord-variations">
              {activeChordGroup.voicings.map((voicing) => (
                <button
                  type="button"
                  key={voicing.id}
                  className={`generated-variation-btn ${
                    selectedGeneratedChord.id === voicing.id ? "active" : ""
                  }`.trim()}
                  onClick={() => {
                    setSelectedGeneratedChord(voicing);
                    playGeneratedChord(voicing);
                  }}
                >
                  {formatVoicingFrets(voicing.frets)} · {voicing.stringCount} cuerdas · span {voicing.span}
                </button>
              ))}
            </div>

            <div
              className="compact-chord-grid"
              style={{ "--compact-fret-count": Math.max(compactFrets.length, 1) }}
            >
              {compactFrets.length ? (
                <>
                  <div className="compact-fret-header">
                    {compactFrets.map((fret) => (
                      <span key={`compact-fret-${fret}`}>{fret}</span>
                    ))}
                  </div>
                  {TUNING.map((string, stringIndex) => {
                    const chordNote = selectedGeneratedChord.notes.find((note) => note.stringIndex === stringIndex);
                    const isOpenString = chordNote && chordNote.fret === 0;
                    const openStringLabel = isOpenString ? "O" : "X";
                    const openStringTitle = isOpenString
                      ? `Cuerda al aire (${NOTES[chordNote.pitchClass]})`
                      : "No tocar esta cuerda";
                    return (
                      <div className="compact-string-row" key={`compact-string-${stringIndex}`}>
                        <span
                          className={`compact-open-marker ${isOpenString ? "active" : "muted"}`.trim()}
                          title={openStringTitle}
                          aria-label={openStringTitle}
                        >
                          {openStringLabel}
                        </span>
                        {compactFrets.map((fret) => {
                          const active = chordNote && chordNote.fret === fret;
                          const intervalLabel = active
                            ? getNoteIntervalLabel(state.rootIndex, chordNote.pitchClass)
                            : "";
                          const noteLabel = active ? NOTES[chordNote.pitchClass] : "";
                          return (
                            <span
                              key={`compact-${stringIndex}-${fret}`}
                              className={`compact-dot ${active ? "active" : ""}`.trim()}
                              data-interval={intervalLabel}
                              title={active ? `${noteLabel} (${intervalLabel})` : undefined}
                            >
                              {noteLabel}
                            </span>
                          );
                        })}
                      </div>
                    );
                  })}
                </>
              ) : null}
            </div>

            <button
              type="button"
              className="compact-play-btn"
              onClick={() => playGeneratedChord(selectedGeneratedChord)}
            >
              ▶
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
