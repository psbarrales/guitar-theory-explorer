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

const DEGREE_OPTIONS = [
  { value: -2, label: "bb" },
  { value: -1, label: "b" },
  { value: 0, label: "nat" },
  { value: 1, label: "#" },
  { value: 2, label: "x" }
];

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
    diatonicChordTones,
    maxPositionStart,
    chordDisplayName,
    chordInversionLabel,
    chordNotesText,
    chordSpan,
    handleNoteClick,
    playScaleForRange,
    playChord,
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

  const handlePositionClick = (position) => {
    setActivePosition(position.id);
    playScaleForRange(position);
  };

  return (
    <div className="page">
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
          <section className="hero compact">
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

          <section className="panel diatonic-chords">
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

          <section className="panel fretboard-wrap">
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
    </div>
  );
}
