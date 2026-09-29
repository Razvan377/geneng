/** Mode 1 — restriction mapping puzzles. */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Gel } from '../components/Gel';
import { IconBulb, IconCalendar, IconCheck, IconCross, IconPlus, IconRefresh, IconTimer, IconTrash } from '../components/Icons';
import { MapView, MarkerGlyph, segmentsOf, type EnzymeStyle, type Marker } from '../components/MapEditor';
import { PageHeader, SeedBar, Segmented, Toggle } from '../components/ui';
import { WorkedSolutionView } from '../components/WorkedSolutionView';
import { useClock, useSetting } from '../lib/hooks';
import { navigate, shareUrl, useRoute } from '../lib/router';
import { ENZYME_STYLES } from '../lib/theme';
import { EXAM_MINUTES, mapPoints } from '../quiz/mapScoring';
import { parseNumber } from '../science/numbers';
import { HINT_TITLES, hintDetails, workedSolution } from '../science/explain';
import { formatBands, formatFragments, formatKb } from '../science/format';
import { classicById, CLASSICS, generatePuzzle, type Difficulty, type Puzzle } from '../science/puzzle';
import { createRng, dailySeed, isoDate, randomSeed } from '../science/rng';
import { checkMap, type MapCheck } from '../science/solver';
import type { SiteMap } from '../science/digest';
import { useProgress } from '../state/ProgressContext';
import { laneTitle, puzzleGel } from './mapping/gelLanes';

type PlayMode = Difficulty | 'exam';

interface Setup {
  puzzle: Puzzle;
  playMode: PlayMode;
  exam: boolean;
  kind: string;
  dailyDate?: string;
  /** Route params that reproduce this puzzle. */
  params: Record<string, string>;
}

/** Weekend dailies are hard, weekday dailies medium. */
export function dailyDifficulty(date: string): Difficulty {
  const [y, m, d] = date.split('-').map(Number);
  const dow = new Date(y, m - 1, d).getDay();
  return dow === 0 || dow === 6 ? 'hard' : 'medium';
}

function resolveSetup(params: URLSearchParams): Setup | null {
  const classic = params.get('classic');
  if (classic) {
    const puzzle = classicById(classic);
    if (puzzle) return { puzzle, playMode: puzzle.difficulty, exam: false, kind: `map.${puzzle.difficulty}`, params: { classic } };
  }
  const daily = params.get('daily');
  if (daily) {
    const date = /^\d{4}-\d{2}-\d{2}$/.test(daily) ? daily : isoDate(new Date());
    const difficulty = dailyDifficulty(date);
    const [y, m, d] = date.split('-').map(Number);
    const puzzle = generatePuzzle(dailySeed(new Date(y, m - 1, d)), difficulty, 'daily');
    return { puzzle, playMode: difficulty, exam: false, kind: `map.${difficulty}`, dailyDate: date, params: { daily: date } };
  }
  const seed = params.get('seed');
  if (!seed) return null;
  const d = params.get('d');
  const playMode: PlayMode = d === 'easy' || d === 'hard' || d === 'exam' ? d : 'medium';
  if (playMode === 'exam') {
    const difficulty: Difficulty = createRng(`exam/${seed}`).chance(0.5) ? 'medium' : 'hard';
    return { puzzle: generatePuzzle(seed, difficulty), playMode, exam: true, kind: 'map.exam', params: { d: playMode, seed } };
  }
  return { puzzle: generatePuzzle(seed, playMode), playMode, exam: false, kind: `map.${playMode}`, params: { d: playMode, seed } };
}

const MODE_OPTIONS = [
  { value: 'easy' as const, label: 'Easy' },
  { value: 'medium' as const, label: 'Medium' },
  { value: 'hard' as const, label: 'Hard' },
  { value: 'exam' as const, label: 'Exam' },
];

export function MappingMode() {
  const { params } = useRoute();
  const setup = useMemo(() => resolveSetup(params), [params]);

  useEffect(() => {
    if (!setup) navigate('/map', { d: params.get('d') ?? 'medium', seed: randomSeed() }, { replace: true });
  }, [setup, params]);

  if (!setup) return null;
  const newPuzzle = (mode: PlayMode) => navigate('/map', { d: mode, seed: randomSeed() });
  const current = setup.puzzle.source === 'random' ? setup.playMode : null;

  return (
    <div className="page">
      <PageHeader title="Restriction mapping" subtitle="Deduce where each enzyme cuts from single, double and partial digests." />
      <div className="toolbar">
        <Segmented label="Difficulty" options={MODE_OPTIONS} value={current} onChange={newPuzzle} />
        <div className="toolbar-group" role="group" aria-label="Classic levels">
          <span className="toolbar-label">Classics</span>
          {CLASSICS.map((c) => {
            const id = c.id.replace('classic-', '');
            return (
              <button
                key={c.id}
                type="button"
                className={`btn btn-sm ${setup.puzzle.id === c.id ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => navigate('/map', { classic: id })}
                title={c.title}
              >
                {id}
              </button>
            );
          })}
        </div>
        <button type="button" className={`btn btn-sm ${setup.dailyDate ? 'btn-primary' : 'btn-outline'}`} onClick={() => navigate('/map', { daily: isoDate(new Date()) })}>
          <IconCalendar size={15} /> Daily
        </button>
        <button type="button" className="btn btn-sm btn-outline" onClick={() => newPuzzle(setup.puzzle.source === 'random' ? setup.playMode : 'medium')}>
          <IconRefresh size={15} /> New puzzle
        </button>
      </div>
      <MappingGame key={`${setup.puzzle.id}/${setup.playMode}`} setup={setup} onNext={() => newPuzzle(setup.puzzle.source === 'random' ? setup.playMode : 'medium')} />
    </div>
  );
}

// ---------------------------------------------------------------------------------------------

type Status = 'playing' | 'solved' | 'revealed' | 'timeout';

function MappingGame({ setup, onNext }: { setup: Setup; onNext(): void }) {
  const { puzzle, exam, kind, dailyDate } = setup;
  const { problem } = puzzle;
  const { record, recordDaily } = useProgress();

  const enzymes: EnzymeStyle[] = problem.enzymes.map((name, i) => ({ name, ...ENZYME_STYLES[i % ENZYME_STYLES.length] }));
  const [view, setView] = useSetting<'gel' | 'table'>('mapView', 'gel');
  const [showUncut, setShowUncut] = useState(false);
  const [lengthText, setLengthText] = useState(puzzle.lengthGiven ? formatKb(puzzle.length) : '');
  const [markers, setMarkers] = useState<Marker[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [hints, setHints] = useState(0);
  const [result, setResult] = useState<MapCheck | null>(null);
  const [wrongChecks, setWrongChecks] = useState(0);
  const [status, setStatus] = useState<Status>('playing');
  const [earned, setEarned] = useState(0);
  const [startedAt] = useState(() => Date.now());
  const nextId = useRef(1);
  const recorded = useRef(false);

  const grid = puzzle.grid;
  const parsedKb = parseNumber(lengthText);
  const lengthBp =
    parsedKb !== null && parsedKb > 0 && parsedKb <= 200 ? Math.max(grid * 2, Math.round((parsedKb * 1000) / grid) * grid) : null;
  const locked = status !== 'playing';

  const gel = useMemo(() => puzzleGel(puzzle, showUncut), [puzzle, showUncut]);
  const worked = useMemo(() => workedSolution(puzzle), [puzzle]);
  const details = useMemo(() => hintDetails(puzzle), [puzzle]);

  const examSeconds = EXAM_MINUTES[puzzle.difficulty] * 60;
  const elapsed = useClock(startedAt, exam && status === 'playing');
  const secondsLeft = Math.max(0, examSeconds - elapsed);

  const siteMap = useCallback((): SiteMap => {
    const map: SiteMap = Object.fromEntries(problem.enzymes.map((e) => [e, [] as number[]]));
    for (const m of markers) map[m.enzyme].push(m.pos);
    return map;
  }, [markers, problem.enzymes]);

  const finish = useCallback(
    (correct: boolean, points: number) => {
      if (recorded.current) return;
      recorded.current = true;
      record({ kind, correct, points });
      if (dailyDate) recordDaily(dailyDate, { solved: correct, points });
    },
    [kind, dailyDate, record, recordDaily],
  );

  const runCheck = useCallback(
    (fromTimer = false) => {
      if (lengthBp === null) {
        setResult(null);
        return null;
      }
      const r = checkMap(problem, lengthBp, siteMap());
      setResult(r);
      if (r.ok) {
        const points = mapPoints({ difficulty: puzzle.difficulty, exam, hints: Math.min(hints, 3), wrongChecks, secondsLeft });
        setEarned(points);
        setStatus('solved');
        finish(true, points);
      } else if (!fromTimer) {
        setWrongChecks((n) => n + 1);
      }
      return r;
    },
    [lengthBp, problem, siteMap, puzzle.difficulty, exam, hints, wrongChecks, secondsLeft, finish],
  );

  // Exam clock: when time runs out, check whatever is on the ruler, then show the solution.
  useEffect(() => {
    if (!exam || status !== 'playing' || secondsLeft > 0) return;
    const r = runCheck(true);
    if (!r?.ok) {
      setStatus('timeout');
      setHints(4);
      finish(false, 0);
    }
  }, [exam, status, secondsLeft, runCheck, finish]);

  const reveal = () => {
    setHints(4);
    if (status === 'playing') {
      setStatus('revealed');
      finish(false, 0);
    }
  };

  const clampPos = (pos: number) => {
    if (!lengthBp) return pos;
    if (problem.topology === 'circular') return ((Math.round(pos / grid) * grid) % lengthBp + lengthBp) % lengthBp;
    return Math.min(lengthBp - grid, Math.max(grid, Math.round(pos / grid) * grid));
  };

  /** New sites go in the middle of the largest empty stretch, so they never pile up. */
  const addSite = (enzyme: string) => {
    if (!lengthBp || locked) return;
    const gaps = segmentsOf(problem.topology, lengthBp, markers);
    const widest = gaps.length ? gaps.reduce((a, b) => (b.to - b.from > a.to - a.from ? b : a)) : { from: 0, to: lengthBp };
    const pos = clampPos((widest.from + widest.to) / 2);
    const id = `m${nextId.current++}`;
    setMarkers((ms) => [...ms, { id, enzyme, pos }]);
    setSelected(id);
    setResult(null);
  };

  const moveMarker = (id: string, pos: number) => {
    if (locked) return;
    setMarkers((ms) => ms.map((m) => (m.id === id ? { ...m, pos: clampPos(pos) } : m)));
    setResult(null);
  };

  const removeMarker = (id: string) => {
    if (locked) return;
    setMarkers((ms) => ms.filter((m) => m.id !== id));
    setSelected(null);
    setResult(null);
  };

  // Keep markers inside the molecule if the length changes.
  useEffect(() => {
    if (!lengthBp) return;
    setMarkers((ms) => ms.map((m) => ({ ...m, pos: clampPos(m.pos) })));
  }, [lengthBp]); // clampPos only depends on lengthBp here

  const failing = new Set(result && !result.ok ? result.lanes.filter((l) => !l.ok).map((l) => l.lane.id) : []);
  const gelLanes = gel.lanes.map((l) => (failing.has(l.id) ? { ...l, status: 'error' as const } : l));
  const selectedMarker = markers.find((m) => m.id === selected) ?? null;
  const segs = lengthBp ? segmentsOf(problem.topology, lengthBp, markers) : [];
  const url = shareUrl('/map', setup.params);
  const circular = problem.topology === 'circular';

  return (
    <>
      <div className="map-layout">
        <section className="card" aria-labelledby="data-title">
          <div className="card-head">
            <div>
              <h2 id="data-title">
                {puzzle.title}
                {puzzle.source === 'daily' && <span className="tag tag-accent">Daily · {dailyDate}</span>}
                <span className="tag">{exam ? 'exam' : puzzle.difficulty}</span>
              </h2>
              <p className="intro">{puzzle.intro}</p>
            </div>
          </div>
          <div className="row-between">
            <Segmented
              size="sm"
              label="Data view"
              options={[
                { value: 'gel', label: 'Gel' },
                { value: 'table', label: 'Table' },
              ]}
              value={view}
              onChange={setView}
            />
            {view === 'gel' && <Toggle checked={showUncut} onChange={setShowUncut} label={circular ? 'Uncut plasmid' : 'Uncut DNA'} />}
          </div>

          {view === 'gel' ? (
            <>
              <Gel
                lanes={gelLanes}
                model={gel.model}
                ariaLabel={`Agarose gel with ${gel.lanes.length} lanes; the table view lists the same fragment sizes.`}
                ladderLabels={(s) => formatKb(s, 1)}
                ladderUnit="kb"
              />
              <ol className="lane-legend">
                {gel.legend.map((l) => (
                  <li key={l.label} className={failing.has(l.laneId) ? 'is-bad' : undefined}>
                    <span className="lane-no">{l.label}</span>
                    {l.text}
                  </li>
                ))}
              </ol>
              <p className="fine-print">Tap a band to see its size. Brightness ∝ mass: doublets glow brighter, small fragments are fainter.</p>
            </>
          ) : (
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Digest</th>
                    <th>Fragments (kb)</th>
                  </tr>
                </thead>
                <tbody>
                  {problem.lanes.map((lane, i) => (
                    <tr key={lane.id} className={failing.has(lane.id) ? 'is-bad' : undefined}>
                      <td className="lane-no-cell">{i + 1}</td>
                      <td>{laneTitle(lane)}</td>
                      <td className="num">
                        {lane.kind === 'partial' ? (
                          <>
                            <span className="muted">bands </span>
                            {formatBands(lane.fragments)}
                          </>
                        ) : (
                          formatFragments(lane.fragments)
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <SeedBar seed={puzzle.source === 'random' ? puzzle.id : puzzle.source === 'daily' ? `daily ${dailyDate}` : puzzle.title} url={url} />
        </section>

        <section className="card" aria-labelledby="build-title">
          <div className="card-head">
            <h2 id="build-title">Your map</h2>
            {exam && (
              <div className={`timer${secondsLeft < 60 && status === 'playing' ? ' is-urgent' : ''}`} role="timer" aria-live="off">
                <IconTimer size={16} />
                {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, '0')}
              </div>
            )}
          </div>

          <div className="length-row">
            <label htmlFor="mol-length">Total length</label>
            {puzzle.lengthGiven ? (
              <strong>{formatKb(puzzle.length)} kb</strong>
            ) : (
              <>
                <input
                  id="mol-length"
                  className="input input-num"
                  inputMode="decimal"
                  placeholder="?"
                  value={lengthText}
                  disabled={locked}
                  onChange={(e) => {
                    setLengthText(e.target.value);
                    setResult(null);
                  }}
                />
                <span>kb</span>
              </>
            )}
            <span className="muted small">{circular ? 'circular' : 'linear'} · snaps to {formatKb(grid)} kb</span>
          </div>

          {lengthBp ? (
            <>
              <div className="palette" role="group" aria-label="Add restriction sites">
                {enzymes.map((e) => {
                  const count = markers.filter((m) => m.enzyme === e.name).length;
                  return (
                    <button
                      key={e.name}
                      type="button"
                      className="palette-btn"
                      onClick={() => addSite(e.name)}
                      disabled={locked}
                      aria-label={`Add site: ${e.name} (${count} placed)`}
                    >
                      <svg width="16" height="16" aria-hidden="true">
                        <MarkerGlyph shape={e.shape} color={e.color} x={8} y={8} r={5.5} />
                      </svg>
                      <span>{e.name}</span>
                      <span className="palette-count">{count}</span>
                      <IconPlus size={14} />
                    </button>
                  );
                })}
              </div>
              <MapView
                topology={problem.topology}
                length={lengthBp}
                grid={grid}
                enzymes={enzymes}
                markers={markers}
                selectedId={selected}
                onSelect={setSelected}
                onMove={moveMarker}
                onRemove={removeMarker}
                readOnly={locked}
              />
              <p className="fragments-line">
                <span className="muted">Fragments of your map: </span>
                {markers.length ? `${formatFragments(segs.map((s) => s.to - s.from))} kb` : 'add sites with the buttons above, then drag them'}
              </p>
              {selectedMarker && !locked && (
                <div className="marker-controls">
                  <span className="marker-controls-name">
                    <svg width="16" height="16" aria-hidden="true">
                      <MarkerGlyph {...enzymes.find((e) => e.name === selectedMarker.enzyme)!} x={8} y={8} r={5.5} />
                    </svg>
                    {selectedMarker.enzyme} site at
                  </span>
                  <button type="button" className="btn btn-sm btn-outline" onClick={() => moveMarker(selectedMarker.id, selectedMarker.pos - grid)} aria-label={`Move left ${formatKb(grid)} kb`}>
                    −{formatKb(grid)}
                  </button>
                  <strong className="marker-pos">{formatKb(selectedMarker.pos)} kb</strong>
                  <button type="button" className="btn btn-sm btn-outline" onClick={() => moveMarker(selectedMarker.id, selectedMarker.pos + grid)} aria-label={`Move right ${formatKb(grid)} kb`}>
                    +{formatKb(grid)}
                  </button>
                  <button type="button" className="btn btn-sm btn-ghost" onClick={() => removeMarker(selectedMarker.id)}>
                    <IconTrash size={15} /> Remove
                  </button>
                </div>
              )}
            </>
          ) : (
            <p className="empty-note">Enter the total length of the molecule to draw the {circular ? 'circle' : 'ruler'}. {hints === 0 && !exam ? 'Stuck? Use the first hint.' : ''}</p>
          )}

          <div className="actions">
            <button type="button" className="btn btn-primary" onClick={() => runCheck()} disabled={locked || !lengthBp || markers.length === 0}>
              <IconCheck size={16} /> Check map
            </button>
            {!exam && status === 'playing' && hints < 3 && (
              <button type="button" className="btn btn-outline" onClick={() => setHints((h) => h + 1)}>
                <IconBulb size={16} /> Hint {hints + 1}/3
              </button>
            )}
            {status === 'playing' && (exam || hints >= 3) && (
              <button type="button" className="btn btn-outline" onClick={reveal}>
                {exam ? 'Give up and show solution' : 'Show worked solution'}
              </button>
            )}
            {markers.length > 0 && !locked && (
              <button type="button" className="btn btn-ghost" onClick={() => { setMarkers([]); setSelected(null); setResult(null); }}>
                Clear
              </button>
            )}
          </div>

          {lengthBp === null && lengthText && <p className="feedback feedback-bad">“{lengthText}” is not a length I can use — type a number of kb, e.g. 9.5</p>}

          {status === 'solved' && (
            <div className="feedback feedback-good" role="status">
              <IconCheck size={18} />
              <div>
                <strong>Correct map — it explains all {problem.lanes.length} lanes.</strong>
                <span> +{earned} points</span>
                {circular ? ' (any rotation or mirror image is equally right).' : ' (its mirror image is equally right).'}
              </div>
              <button type="button" className="btn btn-primary btn-sm" onClick={onNext}>
                Next puzzle
              </button>
            </div>
          )}
          {status === 'timeout' && (
            <div className="feedback feedback-bad" role="status">
              <IconTimer size={18} />
              <div>
                <strong>Time's up.</strong> The worked solution is below.
              </div>
              <button type="button" className="btn btn-primary btn-sm" onClick={onNext}>
                Next puzzle
              </button>
            </div>
          )}
          {status === 'revealed' && (
            <div className="feedback feedback-neutral" role="status">
              <div>Solution shown below — try the next one without it.</div>
              <button type="button" className="btn btn-primary btn-sm" onClick={onNext}>
                Next puzzle
              </button>
            </div>
          )}

          {result && !result.ok && <CheckReport result={result} />}
        </section>
      </div>

      {hints > 0 && (
        <section className="card hints" aria-labelledby="hints-title">
          <h2 id="hints-title">{hints >= 4 ? 'Worked solution' : 'Hints'}</h2>
          <ol className="hint-list">
            {HINT_TITLES.slice(0, Math.min(hints, 3)).map((title, i) => (
              <li key={i}>
                <strong>{title}</strong> <span>{details[i]}</span>
              </li>
            ))}
          </ol>
          {hints >= 4 && <WorkedSolutionView solution={worked} topology={problem.topology} enzymes={enzymes} />}
        </section>
      )}
      {status === 'solved' && hints < 4 && (
        <details className="card hints">
          <summary>Compare with the worked solution</summary>
          <WorkedSolutionView solution={worked} topology={problem.topology} enzymes={enzymes} />
        </details>
      )}
    </>
  );
}

function CheckReport({ result }: { result: MapCheck }) {
  return (
    <div className="check-report" role="status">
      <p className="feedback feedback-bad">
        <IconCross size={18} />
        <span>
          Not yet: {result.lanes.filter((l) => !l.ok).length} of {result.lanes.length} lanes do not match your map.
          {!result.lengthOk && ' The total length is also off — every single digest must add up to it.'}
        </span>
      </p>
      {result.wrongSiteCounts.length > 0 && (
        <ul className="plain-list">
          {result.wrongSiteCounts.map((w) => (
            <li key={w.enzyme}>
              {w.enzyme}: you placed {w.placed} {w.placed === 1 ? 'site' : 'sites'}, but its single digest needs a different number.
            </li>
          ))}
        </ul>
      )}
      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th aria-label="match" />
              <th>Digest</th>
              <th>Observed</th>
              <th>Your map gives</th>
            </tr>
          </thead>
          <tbody>
            {result.lanes.map((l) => (
              <tr key={l.lane.id} className={l.ok ? undefined : 'is-bad'}>
                <td className={l.ok ? 'ok' : 'bad'}>{l.ok ? <IconCheck size={15} /> : <IconCross size={15} />}</td>
                <td>{laneTitle(l.lane)}</td>
                <td className="num">{l.lane.kind === 'partial' ? formatBands(l.expected) : formatFragments(l.expected)}</td>
                <td className="num">{l.lane.kind === 'partial' ? formatBands(l.obtained) : formatFragments(l.obtained)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
