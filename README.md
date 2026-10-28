# Digest Lab

A practice game for the **Enginyeria Genètica** exam (Universitat de Barcelona), built on T.A. Brown,
*Gene Cloning and DNA Analysis*. Everything runs in the browser: no backend, no account. Progress is kept
in `localStorage`, and the app still works if storage is blocked.

| Mode | What you practise |
| --- | --- |
| **1 · Restriction mapping** | Random puzzles (easy / medium / hard / exam), three Classic levels, a daily challenge. Data shown as a virtual agarose gel or a table; build the map by dragging sites onto a ruler (linear DNA) or a circle (plasmids). |
| **2 · Gel reading** | Estimate band sizes, then see the semi-log standard curve; choose the agarose %; decide when PFGE is needed. |
| **3 · Enzyme ends & ligation** | 5′/3′/blunt ends, compatible ends, re-cutting hybrid sites (BamHI/BglII), iso- vs neoschizomers, directional cloning, alkaline phosphatase. |
| **4 · PCR calculator** | Wallace-rule Tm and annealing temperature, spotting bad primer pairs, 2ⁿ amplification, product length, reverse primers, primers that add restriction sites. |
| **5 · Numbers drill** | 4ⁿ site frequency, enzyme units, A260 quantification and A260/A280 purity, Clarke–Carbon library size, vector capacities. |
| **6 · True / false** | Exam statements in Spanish from `src/data/statements.json`, with trap words highlighted after answering. |
| **Blots & variants** | Draw the expected Southern (EcoRI + probe), Northern, RT-PCR and Western results for a gene and its variants (intron loss, exon skipping, nonsense, in-frame/frameshift deletions, insertions, EcoRI-site loss, promoter deletion); isoform Northerns with two probes; Southern blots of a restriction map; Western blots of mutants. |
| **Cloning strategy** | Which enzymes cut inside the gene, pUC18 vs pUC19 orientation under Plac, rescuing wrong-order sites by blunting (Klenow / T4 DNA pol / S1), selection and blue/white screening (also with an AmpR host), primers for a gene drawn right-to-left, NdeI to keep the RBS–ATG distance. |
| **Expression & purification** | Host from vector elements (E. coli, S. cerevisiae, S. pombe, Pichia, mammalian), inducers (IPTG, λDE3, cI857, arabinose, galactose, thiamine, methanol), tags + matrix + elution + protease, cloning in frame with a tag (computed from sequences), SDS-PAGE lane matching for a GST/MBP purification, tag vs protein antibodies, troubleshooting, cell-free expression. |
| **Functional analysis** | Yeast two-hybrid (strain, autoactivation and interaction plates, domain mapping), CRISPR knockout screens, RNAi target validation, luciferase promoter bashing, recognising techniques (qPCR, Western + loading control, immunofluorescence/DAPI…). |

The Gel mode also has DNA quantification by band intensity against a marker dilution series, and the Numbers drill
has enzyme units corrected for site density (units defined on λ DNA). These problem types follow the course problem
sets (cloning problems, lessons 1–2, Northern/Southern/Western problems 1–3, techniques 4–8, functional 9–10,
expression vectors 11–14).

**New answer formats.** *Draw the blot*: type the band sizes of every lane (or “No band”) and see your blot drawn
next to the expected one. *Match*: assign samples to lanes. *Case problems*: one scenario, several parts answered in
turn (for example the four blots of the same gene).

**Mock exam.** A full seven-problem exam in the layout of the solved problem collection: cloning strategy,
cloning with PCR primers, lab calculations, gene expression analysis (Southern / Northern / RT-PCR / Western),
expression vectors, yeast two-hybrid and techniques. Every exam is generated from a new seed, so there is no limit
on how many you can take. Answers are saved without feedback (and can be changed) until you press **Finish exam**;
then every part is corrected and explained and you get a grade out of 10 with the per-problem breakdown. Past exams
are listed with their grades and can be retaken.

## Game theory

A second subject: **Game Theory and Economic Applications** (Tejada, UB) — static games of complete information.

- **Mock midterm** (`#/gt-exam`): four problems worth 3 + 2 + 3 + 2 points, in the format of the October 2023 paper —
  a symmetric 2×2 game with parameters (dominance conditions, equilibrium conditions, the indifference relation for a
  given mix, recognising a prisoners’ dilemma / coordination / hawk–dove game, the mixed equilibrium formula) or a
  prisoners’ dilemma with a side payment α; a numeric bimatrix with dominated strategies and iterated elimination (or
  rationalizability with domination by a mixture); a story to turn into a bimatrix (ticket contest, hawk–dove, penalty
  kicks, credit war, or payoff vs risk dominance); and a game with continuous strategies (double auction, cleaning the
  street, crime and enforcement, splitting money, distance game, or Cournot / collusion / Bertrand). New payoffs and
  parameters every time; graded out of 10 with the paper’s points.
- **Practice by topic** (`#/gt`): the same twelve problem types one at a time, with immediate feedback. Corrections
  underline best replies, strike out eliminated strategies, ring equilibria and draw best-response functions as in the
  slides. Probabilities can be typed as fractions (`2/5`).

All games are solved by `src/science/games.ts` (pure and mixed equilibria, strict/weak dominance, IESDS,
never-best-responses, Pareto efficiency, risk thresholds, Cournot), tested against the examples in the slides and in
problem set 1.

Every question shows the reasoning, not just right/wrong. Points, streaks, per-mode accuracy and a
**weak spots** screen track what to practise next.

## Running it

Requires Node.js 20 or newer (developed on Node 24) and npm.

```bash
npm install
```

```bash
npm run dev
```

Then open the URL Vite prints (usually http://localhost:5173).

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server with hot reload |
| `npm test` | Runs the Vitest suite once (`npm run test:watch` to keep it running) |
| `npm run typecheck` | TypeScript check with no output files |
| `npm run build` | Type-checks, then builds the static site into `dist/` |
| `npm run preview` | Serves the built `dist/` locally |

The build is a plain static site. Routing uses the URL hash and asset paths are relative, so `dist/` can be
opened from any folder or sub-path (GitHub Pages, a university web space, or a USB stick).

## Seeds, sharing and replaying

Every puzzle and question is generated from a short seed with a seeded PRNG (cyrb128 hash + sfc32), so
the seed is all you need to replay or share one. The seed is always in the URL:

- `#/map?d=hard&seed=k3j9x2`: a random mapping puzzle (`d` = `easy` / `medium` / `hard` / `exam`)
- `#/map?classic=B`: a Classic level (A, B or C)
- `#/map?daily=2026-09-27`: the daily challenge. Its seed is the date, so everyone gets the same puzzle. Weekday dailies are medium, weekend dailies are hard.
- `#/ends?type=recut&seed=abc`: a question of one type (drop `type` for a mix)
- `#/exam?seed=q7w2pz`: a mock exam (open `#/exam` to start a new one or see your past exams)
- `#/gt?type=mixed&seed=abc`: a game theory question; `#/gt-exam?seed=q7w2pz`: a game theory mock midterm

Each page has a **Copy link** button.

## Project layout

```
src/
  science/          Pure, unit-tested science core (no React)
    rng.ts            seeded PRNG, daily seeds
    dna.ts            complement, reverse complement, GC content
    enzymes.ts        enzyme table (sites, cut positions, end types)
    digest.ts         single/double/partial digests, lanes
    solver.ts         brute-force map solver, mirror/rotation canonical form, uniqueness, map checking
    puzzle.ts         puzzle generator (per difficulty) and the Classic levels
    explain.ts        hints and step-by-step worked solutions (from a traced solver run)
    gel.ts            migration model (∝ log10 size), band merging/intensity, ladders, agarose table, standard curve
    pcr.ts            Wallace Tm, primer checks, amplification, PCR product, cloning primers
    numbers.ts        4ⁿ, enzyme units, A260, Clarke–Carbon, vector capacities, number parsing
    ends.ts           sticky/blunt ends, ligation, hybrid sites, schizomers, directional cloning, phosphatase
    geneModel.ts      exons/introns/UTRs, EcoRI sites, probe, primers, epitope; variants → Southern/Northern/RT-PCR/Western
    translate.ts      genetic code, translation, 110 Da per amino acid
    games.ts          game theory: bimatrix games, dominance, IESDS, pure/mixed Nash, rationalizability, Cournot
  quiz/             Question generators for modes 2–6, grading, scoring, statements loader
    mockExam.ts       mock exam layout (seven problems from one seed) and exam grading
    gameQuestions.ts  game theory question generators (twelve problem types)
    gtExam.ts         game theory mock midterm (3 + 2 + 3 + 2 points)
  state/            Safe localStorage wrapper, progress (points, streaks, stats)
  components/       Gel, map editor, question card, visuals (SVG)
  modes/            One page per mode, plus home and stats
  data/statements.json
```

## The science core and its tests

`npm test` runs about 200 tests. The main ones:

- **Digests**: linear molecules give cuts + 1 fragments, circular ones give cuts fragments (one cut gives one full-length molecule); partial digests; Brown Fig. 4.16's KpnI partial.
- **Solver**: the two Classic levels from the slides are the fixtures. **Classic A** solves uniquely to E2 at 1 kb and E1 at 4 kb. **Classic B** solves uniquely to a 9.5 kb molecule with KpnI 2 · EcoRI 3 · KpnI 5.5 · HindIII 8 (or the mirror image). Classic C (λ DNA, Brown Fig. 4.16) is ambiguous without its partial digest and unique with it. Mirror images and rotations share one canonical key. Wrong maps report which lanes fail, with expected and obtained fragments.
- **Generator**: for many seeds and every difficulty, puzzles are reproducible and always have exactly one answer. Hard linear puzzles really do need their partial digest.
- **Gel**: migration is linear in log10(size); large bands bunch together; co-migrating fragments merge into brighter bands; intensity scales with mass; uncut plasmid forms run open-circular > linear > supercoiled; the standard curve recovers band sizes.
- **Tm**: `AGACTCAGAGAGAACCC` → 52 °C (Brown Fig. 9.9); the primer-pair checker detects each defect.
- **Coverage**: a 2×10⁹ bp genome with 2×10⁴ bp inserts needs ≈ 4.6×10⁵ clones for 99%, and 10⁵ clones gives ≈ 63%.
- **Ends**: the BamHI/BglII hybrid site is cut by neither enzyme but still by Sau3AI. Ligation compatibility is also checked against a strand-level rule for every pair of enzymes in the table.
- **Question generators**: every generator produces well-formed, reproducible questions for many seeds, and its answer agrees with an independent computation.
- **Gene variants** (fixture: the OMG1 problem, CDS 300 + 600 + 501 = 1401 nt → 466 aa ≈ 51.3 kDa): intron loss only changes the Southern fragment, in-frame exon skipping removes exon/3 amino acids, skipping or deleting a length that is not a multiple of 3 loses a C-terminal epitope (real translation finds the new stop), nonsense codons truncate, losing an EcoRI site merges fragments, promoter deletion abolishes RNA and protein but not the Southern band.
- **Reading frame**: the site offered as correct really puts the cDNA ATG a multiple of 3 after the tag ATG with no stop in between; pUC18/pUC19 orientation; the Lesson 2 unit problem gives 5 U.

### How the solver works

A single digest fixes an enzyme's sites up to the order of its fragments, plus a rotation on a circle. The
solver places enzymes one at a time and tries every arrangement of each enzyme's fragments. On a circle it
also tries every offset on the grid g = gcd(all fragment sizes). A partial map is discarded as soon as a
double or partial digest involving only placed enzymes disagrees with it. After every step, partial maps
are de-duplicated on a canonical key: the lexicographically smallest of the map, its mirror image and
(for circles) all its rotations. The number of surviving maps is the number of distinct answers, so
"unique" means exactly one. The worked solution is written from a traced run of the same search, so every
placement it shows was actually tested.

## Adding true/false statements

Edit **`src/data/statements.json`**. It is an array of objects:

```json
{
  "id": "2024-jan-07",
  "exam": "2024 January",
  "number": 7,
  "topic": "Restriction enzymes",
  "textEs": "Las isoesquizómeras reconocen la misma secuencia diana.",
  "textEn": "Isoschizomers recognise the same target sequence.",
  "answer": true,
  "explanation": "Isoschizomers share the recognition sequence…",
  "debatable": false
}
```

| Field | Type | Notes |
| --- | --- | --- |
| `id` | string | Must be unique. |
| `exam` | string | Used by the exam filter (the filter appears once there is more than one exam). |
| `number` | number | Question number within that exam (shown on the card). |
| `topic` | string | Used by the topic filter and as the stats key (`tf.<topic-slug>`), so keep the spelling consistent. |
| `textEs` | string | Shown first. |
| `textEn` | string | Shown on request, and after answering. |
| `answer` | boolean | `true` = Verdadero, `false` = Falso. |
| `explanation` | string | Shown after answering. Wrap text in backticks for monospace (`` `G^AATTC` ``) and in `**…**` for bold. |
| `debatable` | boolean, optional | Adds a note that the answer follows the examiners' key. |

The file is validated when the app loads (and by `npm test`). Invalid entries are skipped and listed in a
warning at the top of the True / false page, so one typo never breaks the rest. The ten entries with
`"exam": "sample"` are examples; delete them once your own set is in.

**Trap words.** After answering, these words are highlighted in the Spanish text: siempre, solo, sólo,
solamente, ninguna, cualquier, todos, únicamente, plus the inflections cualquiera, ningún, ninguno and
todas. Matching is whole-word, case-insensitive and accent-aware. The lists are `TRAP_WORDS` and
`TRAP_VARIANTS` in `src/quiz/statements.ts`.

## Adding enzymes

Enzymes live in **`src/science/enzymes.ts`**. Add one line to `ENZYMES`:

```ts
{ name: 'ClaI', site: 'ATCGAT', cut: 2, source: 'Caryophanon latum' },
```

- `site` is the top strand, 5′→3′.
- `cut` is how many bases of the site lie 5′ of the top-strand cut. `G^AATTC` → 1, `GAT^ATC` → 3, `^GATC` → 0, `CTGCA^G` → 5.
- Everything else is derived from those two fields: the bottom-strand cut (the mirror position), the end type (5′ overhang, 3′ overhang or blunt), the overhang sequence, ligation compatibility and hybrid-site analysis.
- Sites must be palindromic, as nearly all type II sites are. The test suite checks every entry.
- To use the enzyme in **mapping puzzles**, add `mapping: true` and a short gel-lane label, e.g. `short: 'C'`.
- To use it in specific **Mode 3 questions**, add it to the pools at the top of each generator in `src/quiz/endsQuestions.ts`: `TYPE_POOL`, `COMPATIBLE_PAIRS`, `INCOMPATIBLE_PAIRS`, `RECUT_PAIRS`, `SCHIZOMER_PAIRS`, and the `MCS` used for directional cloning.

Run `npm test` afterwards.

## Other tables you may want to edit

- **Agarose % → separation range**: `AGAROSE_TABLE` in `src/science/gel.ts`. The 0.7, 1.2 and 2 % rows come from the course slides and 0.5 % from Brown §4.2.6. The other rows are standard lab-manual values; replace them with your own table if it differs.
- **Ladders**: `LADDERS` in `src/science/gel.ts` (1 kb ladder, λ/HindIII, 100 bp, extended range).
- **Vector capacities**: `VECTOR_CAPACITIES` in `src/science/numbers.ts`.
- **Annealing offset** (Tm − 2 °C): `ANNEALING_OFFSET` in `src/science/pcr.ts`.
- **Classic levels**: `CLASSIC_A/B/C` in `src/science/puzzle.ts`. To add one, define its lanes (fragment sizes in kb) and a `truth` map, add it to `CLASSICS`, and add a test in `solver.test.ts` checking that it solves uniquely to your answer.

## Scoring

- **Mapping**: 30 / 50 / 80 points for easy / medium / hard. Each hint costs 20% and each wrong check 10%, down to a floor of 20%. Exam mode pays 1.5× plus 1 point per 10 s left on the clock (8 min for medium, 12 min for hard). Showing the worked solution scores 0 and counts as a miss.
- **Quiz questions**: 10 points, plus a streak bonus of up to +10. Gel estimates get partial credit: within 5% of the true size scores 10, within 10% scores 7 (both count as correct), within 20% scores 4.
- **Mock exam**: every problem weighs the same; a problem's score is the average of its parts (partial credit
  counts, unanswered parts score 0). The grade is out of 10, with the bands Suspès (< 5), Aprovat, Notable (≥ 7) and
  Excel·lent (≥ 9). When you finish, every part also counts towards your stats and weak spots.
- **Game theory midterm**: problems are weighted by their points on the paper (3, 2, 3, 2); within a problem every
  part weighs the same.
- Stats are kept per question type. The weak-spots screen ranks types by smoothed accuracy (correct + 1) / (attempts + 2) once a type has at least 2 attempts.
# geneng
