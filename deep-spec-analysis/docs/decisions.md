# deep-spec-analysis — design decision record

English | [日本語](decisions.ja.md)

The record of implementation-time decisions, spike results, and deviations from the requirements draft (docs/TODO.md, 2026-08).

## Spike results (verifying assumptions A1–A4)

- **A1: does z3-solver (WASM) run under bun → NO (with a workaround)**
  Both z3-solver 5.2.0 and 4.15.8 die instantly under bun 1.3.13 on an Emscripten pthread worker startup assertion (`Aborted(Assertion failed)` in `removeRunDependency`). Under node 24 everything works: unsat / sat + model extraction / unsat cores (`solver.unsatCore()`) / SMT-LIB intake via `solver.fromString`.
  → **Resolution**: the SMT backend always isolates solver execution in a child process. It re-enters the same file with `--smt-child`, preferring node with a bun fallback (auto-recovers if bun is ever fixed). If neither works, it closes into contract-2 `unavailable` (NFR3).
- **A2: seeded determinism of the quint CLI → HOLDS (one correction)**
  `quint run --seed` makes the trace contents (states) deterministic, but the ITF `#meta` (timestamp / description) varies per run — so all `#meta` is stripped before storing witnesses. Byte identity (NFR1) measured and confirmed.
- **A2': Apalache** — even without an apalache-mc binary, quint self-manages Apalache into `~/.quint/apalache-dist-*` as long as Java exists, and `quint verify` works. Detection is deterministic: "java runnable AND (APALACHE_DIST or ~/.quint/apalache-dist-*)".
- **A4: manifest dependencies** — unresolved (deferred) on the framework side, so unused. The backends judge consistency via the findings files' `irHash` / `irVersion` instead.

## Resolution of the open questions (Q1–Q5)

- **Q1 (scopes)**: `enterprise` and `feature`. Declared on the stage's `scopes:` (the framework declares stage→scope). Extending to mvp etc. waits for usage data.
- **Q2 (granularity of numeric)**: kept as an independent nature. Its shape (`assert`) equals invariant's, but the value of distinguishing quantitative requirements in the coverage table wins.
- **Q3 (Apalache)**: used only when detected (promotes to bounded). Setup steps live in the doctor's fix messages and the README; never bundled.
- **Q4 (timeout budgets)**: SMT: 2s per query (the z3 `timeout` parameter) + a 45s child budget + a 55s wall clock, sensor manifest 75s. Quint: run 30s / verify 45s / 15s per scenario, manifest 75s. ir-valid: 15s. All inside the hook's child-process ceiling (90s). Overruns close into `skipped[reason: timeout]`.
- **Q5 (EARS-normalized text)**: kept in the IR as the `ears` field and quoted human-readably in the report (not JSON-only).

## Deviations from the requirements draft

1. **Plugin name = `deep-spec-analysis`** (the C4 draft said `deep-spec`) — per user instruction (2026-08-28). The framework's artifact-prefix rule (produces must start with `<plugin>-`) renamed the logical artifact `deep-spec-formal-model` → **`deep-spec-analysis-formal-model`** (FR1.7 / FR3.2). The doctor becomes **`deep-spec-analysis-doctor.ts`** per the `<plugin>-doctor.ts` convention (FR11.1).
2. **Sensor tool filenames** (the FR6.1 / FR7.1 draft said `deep-spec-verify-smt.ts` etc.) — the framework's compiled-binary path (`resolveSensorScriptPath` in `aidlc-sensor.ts`) forces the script name `aidlc-sensor-<id>.ts`, so **`aidlc-sensor-deep-spec-verify-smt.ts` / `-quint.ts` / `-ir-valid.ts`** are used. The "1 backend = 1 sensor + 1 tool" mapping (NFR4) is preserved.
3. **Cross-check placement** (FR8) — separated into the standalone file `deep-spec-verify/cross-check.json` instead of inside each backend's findings file. Both backends recompute it after their own write as a "pure function of every sibling file with the same `irHash`" (last writer wins, but all writers converge on identical bytes). Reason: writing into the backend's own file makes content depend on firing count/order, contradicting NFR1 (byte identity). The v1 comparison surface is "verdicts of fully-bound, event-free scenarios" — the one check both backends implement independently with identical semantics, so a disagreement = a formalization/compiler defect (the intent of FR8.2) holds with no false positives. Event obligations are checked by both but with complementary semantics (static consistency vs reachability), so v1 excludes them from verdict comparison.
4. **Physical form of the IR**: the engine resolves artifact filenames as `.md`, so the IR JSON is stored as a single ```json fence inside `deep-spec-analysis-formal-model.md` (FR1.1's JSON-ness is preserved; the sensors extract the fence deterministically).
5. **Stage slug = `deep-spec-analysis-verify`** (the FR3.1 draft said `deep-spec-analysis`) — compose enforces that a plugin-owned stage's slug carries the `<plugin>-` prefix (the offline validator passes it, but compose drops it). With the plugin named `deep-spec-analysis`, the bare slug `deep-spec-analysis` is impossible. The stage record becomes `<record>/inception/deep-spec-analysis-verify/`. Changing the suffix is a mechanical 3-reference rename (file name, slug, body).
6. **Completeness-gap semantics** (FR6.3b): per trigger, checks "does a state exist that satisfies background + invariants but no guard". It includes states the trigger can never actually reach, so it can over-report — accepted deliberately, matching this plugin's EARS philosophy of "unspecified regions go to the human" (the question becomes A: accept the implicit no-op / B: add a rule).
7. **Bundled installer = `scripts/install.ts`** (added 2026-08-29) — automates `aidlc-plugin-build.ts` → compose (`aidlc plugin sync`, falling back to running `hooks/compose.ts` directly under bun) into one command. Whether to folder-drop branches on `plugin-targets.json`'s `kind`: store kinds (claude/codex/copilot/opencode) compose straight from `dist/` and copy nothing into the project; folder-drop applies only to kiro/kiro-ide/cursor (their hosts' convention). Initially it dropped for all harnesses; corrected after finding store kinds only left `stages/` debris in the project root. `tools/` is distributed to projects by compose, so the installer lives in the non-distributed `scripts/` (added to the tsconfig include, CI-typechecked). The harness→leaf mapping is not hardcoded — it reads aidlc's bundled `plugin-targets.json`. `--dry-run` delegates to `aidlc-plugin-test.ts --install`. The absence of a trust gate versus the store path is documented in README/architecture.md.
8. **Auto-applying B-approved revisions** (added 2026-08-29, a change from the original design) — originally "requirements.md is never edited; revisions land in the report as ready-to-apply proposals only", but leaving the post-approval application to human hand-editing was a UX defect (user-reported). Step 6 now has the stage itself apply revisions answered B (double-approved: the individual answer plus the Consolidated Summary Confirmation) to `requirements.md` verbatim, rewrite the formal model, re-fire the sensors, and confirm resolution in a second pass. Consistent with the artifact-ownership model: requirements-analysis and this stage share the `aidlc-product-agent` lead. Safety properties preserved: only approved text is applied, A/X items and unmentioned areas stay unchanged, before/after is recorded in the report's Applied Revisions, and the deterministic sensors remain read-only.

## Verification matrix (measured, 2026-08-28)

| Check | Ran | Result |
|---|---|---|
| aidlc-plugin-validate | ✔ | VALID (errors 0) |
| fixture: expected SMT findings | ✔ | conflict×2 (unsat-core attribution) / gap×1 / scenario-violation×1 / skip×2 |
| fixture: expected Quint findings (simulation, seed 0x2a) | ✔ | conflict×1 (2-state trace) / scenario-violation×1 / skip×3 |
| fixture: Quint bounded mode (Apalache) | ✔ | same findings; OB-8 (leads-to) has no counterexample = checked clean |
| cross-check convergence + disagreement detection | ✔ | findings empty when healthy; injecting a forged sibling detects the SC-2 disagreement |
| NFR1 byte identity (re-run) | ✔ | no diff across all three files (smt/quint/cross-check) |
| NFR3 degradation (quint missing / runtime missing / irVersion mismatch) | ✔ | closes into unavailable/skipped, exit 127/0, never halts |

## Intent-level E2E verification (measured, 2026-08-29, in the sandbox)

The manual checks below are automated as `tests/intent-e2e.test.ts` (run by CI on every `bun test`). The LLM conversation layer (formalization, the A/B gate, the report) is stood in for by fixtures, so strictly speaking this is an "intent-level integration test of the deterministic path", not a full E2E.

| Check | Ran | Result |
|---|---|---|
| Installer onto a vanilla AI-DLC base | ✔ | store kind ⇒ no drop, composes into `.claude/`, drops 0, clean root |
| `intent-create --scope classic` | ✔ | intent minted. **2.10 deep-spec-analysis-verify is SKIP** (scope routing by the stage's `scopes: [enterprise, feature]` — per spec) |
| `intent-create --scope feature` | ✔ | 2.10 is **EXECUTE**, on-path among 34 stages |
| Firing all three sensors on a real intent record (the real `--stage`/`--output-path` contract) | ✔ | ir-valid: pass / SMT (exhaustive): 5 findings (same-trigger conflict×3 with unsat cores + a completeness gap with a concrete counterexample state + the SC-5 scenario violation) / Quint: 2 findings (**a 2-state trace of the event machine breaking the OB-4 invariant** — the state-machine lens SMT lacks — plus the SC-5 scenario violation agreeing with SMT) / cross-check: both backends compared SC-3 and SC-5 with zero disagreements / When-event scenarios and the partial-bindings reject are explicit capability skips |
| Headless `/aidlc` (`claude -p`) run | △ | works from orchestrator start to the plan-selection gate. aidlc is gate-driven by design, so a non-interactive run to completion is impossible (each gate needs a `--resume` injection). The sandbox dist forces Bedrock (`CLAUDE_CODE_USE_BEDROCK=1`), so non-AWS environments must override via `settings.local.json` |
| **Late adoption** (verifying an intent created before the plugin was installed) | ✔ | feature-scope intent created on a vanilla base (32 stages, no verify-stage mention) → installer added later → `aidlc-orchestrate next --stage deep-spec-analysis-verify --single` accepted (load-steering → run-stage; consumes resolve to the existing record's requirements.md) → sensors detect all 5 findings on that record. classic scope is explicitly refused even in single mode ("skipped for scope classic"). Regression-verified every run by the late-adoption block of `tests/intent-e2e.test.ts` |
| **Automatic detection of unverified requirements** (late adoption that never relies on human attention) | ✔ | the doctor gained a verification-coverage scan: walks every space × intent, lists (as advisory rows with the switch + `--single` commands) intents whose scope matches the stage definition's `scopes:` and which have requirements.md but no verification record; intents whose requirements.md changed after verification are detected as stale. The installer runs the same scan right after compose to show install-time verification debt. All transitions measured and test-covered: unverified → detected, verified → `1/1 verified`, touch → stale |

## Design decisions of design-verification extension phase 1 (refcheck) (2026-08-29, v0.2.0)

The canonical requirements are [issue #2 (the full requirements definition)](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/issues/2) and [issue #3 (phase 1)](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/issues/3). Implemented: three solver-free, LLM-free reference-integrity sensors (`deep-spec-refcheck-{domain,contract,functional}`) joined to domain-design / contract-design / functional-design via contributions' `adds.sensors`, the findings contract (contract 2) rectified and extended, and a report-only structural-debt scan added to the doctor. Zero stages added (one arrives in phases 2/3).

### Resolution of the open questions (the Qs assigned to issue #3)

- **Q3 (YAML parsing)**: a hand-written deterministic subset parser (`tools/deep-spec-lib.ts`). The sensors must run without depending on the target project's `node_modules`, so a vendored dependency is impossible. Out-of-subset input (anchors, aliases, tags, flow maps) falls to `structure-invalid`/`unrecognized-format` — never an interpretation guess.
- **Q4 (mermaid subset)**: only simple states + transitions of `stateDiagram-v2`. Composite states / choice / fork / join skip the whole machine as `unrecognized-format`. frontend-components.md is out of scope for phase 1 (requirement O10 stands).
- **Q7 (mandatory-fix?)**: everything in phase 1 is advisory. Matching the fact that the framework does not enforce blocking for write-fired sensors, the gate is the end-of-steps fragment on the core stages ("fix or record before the summary confirmation").
- **Q8 (contribution scopes)**: follow the target stage's full scope set. `when:` is never evaluated so there is no narrowing mechanism anyway, and refcheck is bun-only, ~10s, advisory — attaching broadly is harmless.

### Deviations/refinements from the requirements (issue #2 FRs)

1. **Only 3 kinds added** (`structure-invalid` / `reference-broken` / `consistency-mismatch`). Not FR1.4's all-7-at-once — phases 2/3 add their kinds themselves, aligning contract changes with phase boundaries.
2. **Top-level `checked[]` added to contract 2**. Contract 2 had no slot for check-family-granular no-silence (FR2.9/FR5.5 "appears even when clean"). A clean run and a never-ran family are now distinguishable from the file alone.
3. **Skip reason `absent-input` added**. A missing sibling artifact means something different from `unavailable` (solver/runtime missing) and from `unrecognized-format`.
4. **The bundled plugin lib `tools/deep-spec-lib.ts`**. C9 "self-contained" is refined to mean "never import framework/core tools": a first-party lib distributed in the same compose delta is fine (the same pattern as core's `aidlc-lib.ts`). The v1 smt/quint tools also use this lib's `validateSchema` for contract-2 self-validation.
5. **CD-1/CD-3's unit source is the `units:` edge block of `unit-of-work-dependency.md`** (FR4.1's letter said unit-of-work.md). It is the machine-readable source the framework itself computes its batch fan-out from — more robust than parsing prose.
6. **FD-S lifecycle-attribute resolution order**: an explicit `Entity.attr` in the heading > an attribute named `status`/`state` with allowed values > the unique attribute with allowed values > undecidable skips as `unrecognized-format`.
7. **Duplicate-report elimination**: DD-7 does not report self-loops (DD-3 owns them). The XS scan folds duplicate declarations on the components.md side to one pass by normalized name (the duplication itself is DD-5's finding).
8. **Rectifications 1 & 2 (the known v1 problems)**: the `verdicts` witness variant is formally defined, resolving cross-check.json's contract deviation (per-backend verdicts are essential information; rewriting them into model/trace/core would discard information AND break the v1 goldens — the contract was brought up to the implementation's intent). Every contract-2 writer (v1's smt/quint included) must self-validate before writing (non-conforming → degrade to `unavailable` with the validation error), and the schema conformance of every golden findings file is permanently asserted by `tests/refcheck.test.ts`.
9. **Version**: the requirements' FR16 "phase 1 = v1.1.0" was nominal. The real series is 0.x, so phase 1 = **v0.2.0** (likewise a minor bump).

### Verification matrix (measured, 2026-08-29)

| Target | Result | Evidence |
|---|---|---|
| refcheck conformance (`tests/refcheck.test.ts`, 22 tests) | ✔ | golden byte identity for both broken/clean records (3 sensors × 2), re-run byte identity (NFR1), the clean golden's checked lists every family (DD×8 = the DD-0 shape check + the 7 rules DD-1..7 / CD×3 / FD+XS×16), degradation (out-of-subset YAML → FD-E1 + family skips, missing components.md → XS absent-input, missing units block → CD-1/CD-3 absent-input), `--report-only` writes nothing, not-applicable pass-through |
| **Schema conformance of every golden** (rectification 2b) | ✔ | the v1 conformance goldens (smt/quint/cross-check) plus every refcheck golden conform to the extended deep-spec-findings-schema.json |
| v1 regression | ✔ | conformance 11 tests unchanged, goldens byte-identical (output contract unchanged even after adding self-validation), existing 12 intent-e2e tests unchanged |
| intent-e2e phase-1 block (+4 tests) | ✔ | compose places the 3 sensors + lib into `.claude/`, the contributions join the 3 core stages' `sensors:`, the composed sensor detects planted defects (DD-2, a cycle) on the sandbox's real record, the doctor's report-only scan shows the debt rows (advisory) |
| validator / builds | ✔ | `aidlc-plugin-validate` VALID (errors 0), all 7 harness builds OK |

### A defect found by live sandbox exercise, and its fix (2026-08-29, v0.2.0 addendum)

A defect the automated E2E can never hit (it always starts from a fresh tmp tree) was found by late-adoption-upgrading the workspace's real sandbox (`deep-spec-analysis-sandbox/`, with v0.1.0 already composed):

- **Symptom**: the framework's compose hook copies payloads **no-clobber** (new files land; existing files are never overwritten). Upgrading v0.1.0 → v0.2.0 places the new refcheck sensors but **leaves the changed existing files (the findings schema, the self-validating smt/quint) at their old versions**, a version skew. Result: the new sensors self-validate against the old schema and **every document degrades to unavailable** with `/method: not one of ["exhaustive","bounded","simulation"]` — phase 1 is wiped out on upgraded installs. `plugin-sync` is powerless on this path (installer-direct compose): "no installed plugins".
- **Fix**: `scripts/install.ts` gains an **upgrade refresh** — before composing, it removes from the harness tree only the existing files that share a name with the payloads the dist projection ships (sensors/ tools/ knowledge/ agents/ scopes/ stages/), letting the no-clobber copy re-place the current versions. Nothing outside the plugin's delta is touched (additive-only preserved); contribution merges into stages are content-based and refresh themselves. If compose fails to re-place a file, the existing sentinel check fails loudly (no silent absence).
- **Regression test**: the upgrade-path block of `tests/intent-e2e.test.ts` — deliberately stale-ify the composed schema → re-run the installer → assert the `upgrade refresh` output line, the refreshed schema, and a successful live fire of the composed sensor.
- **Live-fire matrix (real sandbox, via the dispatcher `aidlc-sensor.ts fire`)**: all 3 sensors registered, glob-matched (including `**/functional-design/*.md` on the bespoke matcher), and fired. On defective artifacts: domain 9 / contract 4 / functional 15 findings; the doctor's report-only scan discovered u2-billing (never fired manually) by itself — 31 findings across 4 artifacts, all advisory.

## Design decisions of design-verification extension phase 2 (design IR + standalone SMT/Quint checks) (2026-08-29, v0.3.0)

The canonical requirements are [issue #2](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/issues/2) and [issue #4 (phase 2)](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/issues/4). Implemented: the design IR (contract 3, `deep-spec-design-ir-schema.json`), the verification stage `deep-spec-analysis-functional-verify` (construction, aggregator, no for_each), the sensor trio `deep-spec-design-{ir-valid,verify-smt,verify-quint}`, and the doctor's per-unit coverage scan.

### Core architecture: compile-down reuse

Each unit of the design IR is lowered to a contract-1 document (transition → an event obligation with the implicit `state==from` guard and `state'=to` effect; ignores → explicit no-op events), and **the proven v1 backends are executed as child processes**; findings are remapped into design vocabulary (DOB/TR/SM/DSC, per-unit attribution). Zero duplicated solver plumbing. The shared machinery is `tools/deep-spec-design-lib.ts` (a bundled plugin lib, following the phase-1 precedent).

The two new checks ride **v1's antecedent-vacuity check via synthetic tautological invariants**:

- `unreachable` (dead guard): `implies(guard, true)` — an unsatisfiable antecedent (the guard) IS deadness
- `redundancy` (shadowing): `implies(and(guardB, not(guardA)), true)` — vacuity ⇔ guardB⇒guardA; combined with canonical effect equality, subsumption. Mutual subsumption collapses to one "equivalent" finding, and vacuous subsumption of dead elements is suppressed

Being tautologies, they change none of the global/gap/scenario verdicts (measured).

### Quint unreachable-state detection (resolving Q1)

Bounded mode only, capped (`AIDLC_DEEP_SPEC_QUINT_UNREACH_CAP`, default 2). For each non-initial machine state, a variant lowering with "events + the single invariant `attr != state`" runs the v1 bounded verify; a state counts as **reached only when the violation trace actually ends in it** (a conflict alone is not enough — found during implementation: leaving the design invariants in invAll lets any reachable violation mask the probe, mis-marking every state "reached". The variant excludes the design invariants entirely — "not reached even in unconstrained exploration" really means unreachable, the sound direction). Cap overflow and probe failures skip with a reason (no silence). Measured: with a warm Apalache JVM, ~1s per probe, ~10s total at cap 2. Simulation mode is a capability skip (non-observation under random simulation is not evidence).

### Deviations/refinements from the requirements (issue #2 FRs)

1. **`initial` does not constrain exploration (v0.3.0)**: FR6.7's "initial → init constraint" has no injection point in the compile-down target's v1 init (any legal state) and is unimplemented. The consequence is conservative (invariant preservation over-reports; unreachability under-reports; both sound). ir-valid checks initial's value membership. Revisit in phase 3 or when the v1 backend gains an init constraint.
2. **Redundancy's effect equality is canonical string comparison** (a conservative approximation of FR7.5's "semantically equivalent" — syntactically different but semantically equal effects are not reported; the zero-false-positive direction).
3. **Continuing zero contract-2 deviations**: kinds `unreachable` / `redundancy` added (additively, per the phase plan).
4. **TR ids are unique within the unit** (resolving the first half of Q10; dense across machines). Cross-unit DSC/TR collisions are disambiguated by the findings' `unit` field (FR1.10's design intent).
5. **Version**: phase 2 = v0.3.0 (0.x series).

### Verification matrix (measured, 2026-08-29)

| Target | Result | Evidence |
|---|---|---|
| design conformance (`tests/design-verify.test.ts`, 12 tests) | ✔ | ir-valid positive/negative fixtures (duplicate TR, out-of-range initial, self-attribute assignment, phantom BR, BR-coverage silence all detected), SMT golden byte identity (conflict TR-1/TR-2, unreachable TR-4, mutual redundancy DOB-3/DOB-4, gap×4, no false report on the ignore cell), Quint simulation golden + cross-check convergence, re-run byte identity, byte-identical shared contract-1/3 definitions (expr differs only in the prime doc-string; structural identity tested), **mutual non-firing of v1 vs design models**, missing irKind → unavailable, missing quint → exit 127, version mismatch → skip-all |
| intent-e2e phase-2 block (+5 tests) | ✔ | stage registered in the graph, feature=EXECUTE / classic=SKIP, `--single` accepted (load-steering), **trio fired through the real dispatcher** (ir-valid passed / smt failed with all 4 kinds / quint failed), doctor per-unit coverage 0/3 → 1/3 → 0/3 with stale after a touch |
| **Live sandbox exercise** (late-adoption upgrade) | ✔ | upgrade refresh of 18 files → compose, dispatcher fire with smt 7 findings, **Quint bounded auto-detected (real Apalache) finds the unreachable "archived" state** plus DOB-1's 2-state trace plus explicit skips for the cap overflow (10.4s), cross-check agreement on DSC-1, doctor flips the feature intent's unit unverified → verified (1/1), and **the classic intent is scope-excluded (per spec)** |
| v1 / phase-1 regression | ✔ | all 72 tests green, existing goldens byte-identical |
| validator / builds | ✔ | VALID (errors 0), all 7 harness builds OK |

### Phase-2 review addendum (2026-08-29, responding to the 7 CodeRabbit findings on PR #7)

- **Run-budget propagation to child processes** (real bug): budget checks only guarded child *starts*, so a child spawned near the end of the budget could run its full wall timeout, and the sensor itself would be killed by the dispatcher's timeout — the worst degradation, zero findings documents. Both backends now pass `min(unit wall, remaining budget)` as the child's timeout, and skip units/probes with `timeout` when under 3s remain.
- **Sharing UNREACH_CAP across the run** (real bug): the probe counter effectively reset per unit, so multi-unit runs could exceed the cap. The counter moved outside the unit loop.
- **Three ir-valid enforcement gaps**: (a) enum literals bind to the sibling `ref` attribute in binary comparisons (the any-enum shortcut — passing because some other attribute declares the value — is gone. The v1 ir-valid keeps its shipped semantics; the backends' compile-error skips are the levee). (b) Missing int min/max is an error (mechanically enforcing the authoring contract's MANDATORY; not making the schema require it preserves the byte-identical shared definitions with contract 1). (c) A unit name matching no construction directory errors even with zero brRefs (closing the hole where a typo silently erased the whole BR coverage check).
- **Doctor**: cross-check.json alone no longer counts as verified (a real backend document is required). Unit-level completion records (distinguishing clean from never-ran) need per-unit checked vocabulary in contract 2 — carried over as a phase-3 consideration.
- The invalid fixture's summary now matches its actual planted defects (including the 4 BR-coverage errors), with negative tests for the 3 new checks.

## Design decisions of design-verification extension phase 3 (refinement checks) (2026-08-29, v0.4.0)

The canonical requirements are [issue #2](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/issues/2) and [issue #5 (phase 3)](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/issues/5). Implemented: the refinement map (contract 4, `deep-spec-refinement-map-schema.json`), `deep-spec-refinement-lib.ts` (map validation, alpha substitution, the SMT query builder, Quint extra invariants), the refinement passes wired into both design backends, the stage's map-authoring step, and the doctor's refinement-stale.

### Architecture

- **The map is a first-class artifact** (`deep-spec-analysis-refinement-map.md`, a single json fence). The LLM proposes, humans gate, deterministic tools validate — the same neurosymbolic split as the IRs, one level up. Direction is standard data refinement: each **requirements** attribute is defined over **design** attributes by an expression (bool/int) or a total enumMap (enum, merging allowed), making alpha substitution mechanical.
- **Firing stays on the existing formal-model write**: phase 3 activates on the presence of the requirements formal model; the map and requirements IR are read as siblings. Missing map → `absent-input`, hash drift → `stale-input`, missing unit entry → `absent-input` — all explicit skips (no silence). The findings documents stamp `inputs[]` with the file hashes of the three artifacts (functional model, map, requirements model).
- **SMT launches v1's general-purpose z3 child (`--smt-child`) with direct payloads**: this lib only builds SMT-LIB scripts; runtime fallback, budgets, and the model/core decoding protocol stay v1's. Checks: invariant refinement sat(designLegal ∧ ¬alpha(P)) (the over-report direction shares v1's completeness-gap philosophy) / enabledness sat(alphaG ∧ ¬∨designGuards) / one-step event simulation (a 2-state script: the full design step including the design frame ∧ alphaG(pre) ∧ ¬(fBar ∧ requirements frame)) / scenario replay (accept=unsat→core, reject=sat→model).
- **Quint is a second run with alpha(P) added to the lowering as extra invariants**: a violation trace attributed to a requirements-side component is a reachable refinement-violation. When a reachable design-invariant violation comes first, the extras are explicitly skipped as "masked" (capability; resolve the design conflicts first). Event simulation, enabledness, and scenario replay are SMT-only in v1 (explicit capability skips); phase 3 has no cross-check surface.
- **mapping-gap is a pure function of the map and both IRs**, so both backend documents carry it identically (deduplicated at question time).

### Resolving Q2 (the abstract frame semantics of event simulation)

Requirements attributes the effect does not assign must satisfy alpha(a)(pre) == alpha(a)(post) (enumMap attributes expand into an iff conjunction of "belongs to the same requirements-value class"). Frame equalities for unmapped attributes are uncheckable and therefore not imposed (stated in the authoring guide).

### Verification matrix (measured, 2026-08-29)

| Target | Result | Evidence |
|---|---|---|
| refinement conformance (`tests/refinement.test.ts`, 5 tests) | ✔ | smt/quint/cross-check golden byte identity + re-run identity. All planted defect classes: **refinement-violation OB-1 (both a static model AND a Quint reachable trace)**, SC-2 (reject admitted), the enabledness gap (OB-2+TR-2), mapping-gap (attribute closure), OB-3 waived (with the unmapped ledger's reason text). Degradation: missing map → absent-input×5, tampered hash → stale-input (naming the drifted side), missing unit entry → absent-input |
| Self-validation earning its keep | ✔ | in the run before the phase-3 kinds were added to the schema, write-time self-validation degraded the document to unavailable naming the missing kind (the recurrence prevention of rectification 2 actually worked). The design tools' stdout was also unified to report the written document's truth |
| intent-e2e phase-3 block (+2 tests) | ✔ | through the real dispatcher: ir-valid passed / smt failed (refinement-violation, mapping-gap, inputs 3, OB-3 waived), and the doctor emits the refinement-stale row (with the `--single` fix command) after the requirements are re-verified |
| **Live sandbox exercise** (upgrade from v0.3.0) | ✔ | upgrade refresh of 28 files → compose; dispatcher fire: SMT = static refinement-violation OB-1, SC-2, enabledness, mapping-gap; **Quint bounded (real Apalache) = refinement-violation OB-1 with a reachable trace** (closing/0 → closed/0), plus a deadlock gap simulation had not surfaced; the doctor's refinement-stale transition; cleaned after verification |
| Regression | ✔ | all 79 tests green, v1/phase-1/phase-2 goldens byte-identical, validator VALID, all 7 harness builds OK |

### Full-coverage audit of merged-PR review comments (2026-08-29)

Re-audited every PR's review comments: #6 = 6/6, #7 = 7/7, #8 = 0, #9 = 3 valid addressed + 1 false positive verified. The one partially-addressed item — **the 7th comment of #7 (per-unit judgment in the doctor) — is now fully addressed**: the design backends record every unit whose verification actually ran in contract 2's `checked[]` as `unit:<name>` (the same vocabulary as the phase-1 check-family ledger, riding the targetId unit: namespace), and the doctor's verified verdict tightened from "a backend JSON exists" to "the unit appears in the checked[] of a non-unavailable backend document" — a clean unit and a never-ran unit are now distinguishable from the file alone. Goldens regenerated; a completion-evidence assertion added to the e2e.

## sourceDigest — anchoring the IR to the exact requirements text (2026-08-29, v0.5.0)

The gap: the only machine link between the IR and requirements.md was the
frRefs id reverse-check (ids exist, text unchecked) plus the doctor's mtime
heuristic — and mtimes lie (git checkouts reset them; a touch after an edit
hides the edit entirely). A requirements change after verification could go
unnoticed. Decisions:

- **Contract 1 gains an optional top-level `sourceDigest`** — sha256 (hex)
  of the raw requirements.md bytes. Schema-optional (a required field would
  be a breaking major bump and would invalidate every existing model, and
  the lowered contract-1 docs of the phase-2 compile-down never see a
  requirements file); **sensor-required**: `deep-spec-ir-valid` errors on a
  missing or drifted digest, and the error carries the recomputed expected
  value so the fix is mechanical (the agent computes with `shasum -a 256`,
  never from memory — the same pattern as contract 4's irHash anchors).
- **The doctor's staleness went content-based**: when the model carries a
  digest, stale ⇔ hash mismatch, mtimes ignored. Legacy models without one
  keep the old mtime fallback — no retroactive noise; their next
  re-verification stamps the anchor because the sensor now demands it.
- The stage stamps the digest at Step 2 and restamps it in the Step 6
  close-the-loop rewrite (B-revisions edit requirements.md, so the second
  pass necessarily re-anchors).
- Conformance goldens regenerated: the fixture IR gained the field, so the
  embedded `irHash` changed — the only diff in all three expected files.

### Verification matrix (measured, 2026-08-29)

| Target | Result | Evidence |
|---|---|---|
| conformance (+2 tests) | ✔ | drifted source rejected with both digests named; stripped digest rejected with the exact value to add; goldens byte-identical twice |
| intent-e2e (+4 tests) | ✔ | real dispatcher refuses the model after a requirements edit even with the model mtime pushed 1h into the future; doctor flips verified → stale on content alone and back on restoring the exact bytes |
| **Live sandbox exercise** | ✔ | vanilla install → feature intent → digest-stamped model → dispatcher: ir-valid passed, SMT caught the planted completeness gap, Quint bounded (real Apalache) clean, doctor 1/1 verified. Drift + future-dated model: ir-valid failed naming old and new sha256, doctor stale 0/1. Restamp with the digest from the error → passed, 1/1. Stale v0.4.0 composed schema rejected the field (`unexpected property "sourceDigest"`) and the installer's upgrade refresh healed it. Bonus: ir-valid caught a real authoring mistake (`primed` for `prime`) during the exercise |
| Regression | ✔ | all 85 tests green, validator VALID (0 errors), claude harness build OK |

## DDD migration PR0 — parity harness, order proof, architecture rules (2026-08-29, roadmap #12)

The tools/ tree is being migrated to Domain Primitives / Always-Valid Domain
Model with Clean Architecture layers (context-first: `tools/<context>/{domain,
usecase,adapter}/`, entries stay flat — the dispatcher resolves basenames).
PR0 lands the safety net only, zero production change:

- **Parity snapshot** (`tests/parity/snapshot.ts`): fires all nine sensors
  over every fixture scenario and records the full observable surface —
  findings-file bytes, the verbatim stdout verdict line, and the exit code —
  into a deterministic tree. The per-PR ritual diffs a base-commit snapshot
  against the refactored one (`diff -r` must be empty), which protects
  strictly more than the 15 goldens (verdict lines and exit codes are not in
  them). It refuses to run without node and the pinned quint, so a degraded
  environment can never be recorded as truth.
- **Parity determinism test** (`AIDLC_PARITY=1`, opt-in): two snapshots of
  the same commit must be byte-identical.
- **KIND_RANK order proof** (`tests/kind-rank.test.ts`): the 4-kind v1 table
  (unknown→9) and the 11-kind extended table (unknown→99) are extracted from
  the actual sources by regex and proven order-compatible. The migration
  still keeps them as two comparator VOs (byte-safety over unification).
- **Architecture rules** (`tests/architecture/rules.ts` + test): pure
  `(path, source) → violations` functions for the layer DAG, the sanctioned
  import set, the entries-only `process.*`/`import.meta` rule, no
  `export *`, and the no-test-payload rule — every rule proven by an inline
  red example before it scans the real tree (the rule-set's DoD). The 13
  current flat files ride a LEGACY allowlist that must only shrink; PR10
  empties it.

## DDD migration PR1 — the kernel/domain extraction and the coverage floor (2026-08-29, #14)

First layered directory. `tools/kernel/domain/` now holds the verbatim moves
of every pure function that used to live at the top of `deep-spec-lib.ts`
(Json/isObject, canonicalStringify, sha256, idCompare/sortedUnique,
extractFences, the YAML-subset parser, parseMarkdownTables, the draft-07
subset validateSchema, safeTarget, requirementIds, normalizeName) plus the
new house `Result` (`ok`/`err`/`unreachable`, no combinators). Decisions:

- **Verbatim move, one concept per file, explicit `index.ts` facade** (no
  `export *`). Moved code keeps its original English comments — rewriting
  comments inside a byte-frozen move would be diff noise; the Japanese
  comment policy applies to new and re-modeled code (headers here are
  Japanese already).
- **No re-exports from `deep-spec-lib.ts`** (the no-shim rule): all eleven
  importer files and the two test imports were re-pointed in the same
  commit. The lib keeps only what later PRs will dissolve (contract-2
  findings vocabulary + writer, record-root/relArtifact, CLI contract).
- **domain 90% coverage floor is live**: `bunfig.toml` scopes coverage to
  the layered domain (sensors/legacy libs/tests excluded — CLIs run as
  child processes and are covered by goldens), CI runs `bun test
  --coverage`, and the gate was red-proven (threshold 0.999 → exit 1).
  Kernel lands at 99%+ via a new exact-message unit suite — YAML rejection
  strings and schema-validator keyword messages are asserted verbatim
  because they surface in golden `detail`s and `errors[]`.
- Doctor gains the kernel canary row (`tools/kernel/domain/index.ts`); the
  e2e composed-file list asserts the nested path arrives — the first
  in-repo proof that subdirectories under `tools/` ship end-to-end.

### PR1 addendum — the CI coverage failure and its two-layer cause

CI failed on the first PR1 push with 0 test failures and a 99% coverage
table. Root causes: (1) the local "gate passes" measurement had read the
exit code of `tail` through a pipe, not bun's — the gate had in fact been
failing locally too (the ritual now measures exit codes without pipes);
(2) bun enforces `coverageThreshold` **per file**, and `yaml-subset.ts`
sat at 88.89% function coverage because bun counts the implicit
constructor of `class YamlError extends Error {}` as an uncovered
function even though every rejection test executes it. Fixed by covering
the one genuinely untested branch (a bare dash followed by a deeper
block) and making the constructor explicit (behavior unchanged, now
instrumented). Kernel lands at 100% functions / 99.7% lines.

## DDD migration PR2a — deep-spec-lib dissolved (2026-08-30, #15)

`deep-spec-lib.ts` is gone. Its remains split by ownership, verbatim:

- **refcheck/domain**: the contract-2 refcheck vocabulary (RefEntry,
  Finding, Skipped, InputEntry, RefcheckDoc/EmitResult, CATALOG_VERSION)
  and the extended 11-kind catalog order (sortFindings/sortSkipped).
  Types stay interfaces here — the VO re-modeling (a Finding that owns
  its render key order) waits for PR2b, when the construction sites in
  the sensors are reworked; today the key order lives at those sites.
- **refcheck/usecase + adapter**: `ReferenceCheckReportRepository` (the
  first port) and its Impl carrying the old emitRefcheckDoc verbatim —
  self-validation, unavailable degrade, canonical render. The findings
  schema path is INJECTED by the composition root: layered files no
  longer touch `import.meta` (the architecture rule now enforces this
  for real, since the code moved out of the exempt legacy set).
- **kernel/adapter**: parseFlags, findRecordRoot/relArtifact,
  readIfExists, and `renderVerdictLine` — the pure half of the old
  `verdictOut`; the sensors (composition roots) now own the
  `process.stdout.write` + `process.exit` themselves.
- No re-exports anywhere; every importer re-pointed in the same commit;
  the LEGACY allowlist shrank by one (12 files remain).
- The architecture rules learned to strip comments before matching —
  Japanese doc comments mentioning `process.argv` or `export *` were
  false-positives the moment real layered adapters appeared (green
  examples added alongside the fix).

### PR2a addendum — tombstones: no backward-compat residue in upgraded installs

Owner rule (2026-08-30): leave no backward-compatibility code behind.
Audit found one real residue: compose is no-clobber and the upgrade
refresh can only delete files the CURRENT dist still ships, so a retired
file (deep-spec-lib.ts) would sit orphaned in every upgraded install
forever. The installer now carries a REMOVED_PAYLOADS tombstone list —
retiring a file means adding it there in the same change — and deletes
those paths on upgrade ("upgrade cleanup"). Regression-proven in the
e2e upgrade scenario: a planted stale deep-spec-lib.ts vanishes on
re-install. The staged interfaces awaiting PR2b re-modeling are tracked
work (#15), not compatibility code — the distinction is: no second
mouth for the same purpose, no orphaned artifacts.

## DDD migration PR2b-1 — ReferenceCheckReport becomes a real aggregate (2026-08-30, #15)

Three owner rulings landed mid-flight and reshaped the repository design:

1. **The command-receipt form was rejected as a CQS violation.** PR2a's
   `save(outDir, doc, reportOnly): EmitResult` (documented then as a
   sanctioned deviation) is gone. The document is now the aggregate
   `ReferenceCheckReport`: Always-Valid at construction — canonical key
   order, schema self-validation and the unavailable degrade all happen
   inside `compose` (the sole fresh-construction entrance, infallible
   because degrading IS the spec), and the verdict predicate `passes()`
   is a query the type owns. The sensor's stdout verdict derives from
   the aggregate, so it still can never contradict the file.
2. **No per-port error types.** A repository speaks the shared kernel
   `RepositoryError` — a closed three-variant vocabulary (`not-found`,
   `io-failed`, `corrupt`), materials only. Absence is an error variant,
   not a null.
3. **A repository is the aggregate's I/O responsibility — persistence
   AND reconstitution.** The port is the pair
   `findById(aggregateId): Result<ReferenceCheckReport, RepositoryError>`
   / `save(report): Result<void, RepositoryError>`, keyed by the new
   identity VO `ReferenceCheckReportId` (directory + backend); the Impl
   derives paths from the identity alone. `reconstitute` rebuilds the
   aggregate from written truth with minimal structural checks (written
   documents were self-validated at save time).

`report-doc.ts` (RefcheckDoc/EmitResult) is deleted — no compat residue.
A contract test runs the real Impl over a tmpdir: save→findById
round-trip byte identity, not-found, corrupt, and backend-mismatch
corruption. The coverage gate's charter was re-asserted in bunfig:
per-file 90% applies to domain; adapter/usecase are verified by contract
and spawn suites, not the numeric gate. The same receipt pattern still
lives in the legacy design-lib writer — scheduled for the PR5
dissolution.

### PR2b-1 addendum — two further rulings: RepositoryError placement and the Json expulsion

- **RepositoryError lives in the use-case layer** as part of the output
  port, not in the domain. Repositories are classically a domain
  responsibility, but placing them (or their vocabulary) in the domain
  invites domain objects to reach for repositories internally — so the
  whole repository surface is kept at arm's length in `kernel/usecase`.
- **Json is not ubiquitous language.** The serialization format — the
  `Json` union, canonical JSON, the JSON-Schema validator, the
  YAML-subset and markdown parsers — is interface-adapter knowledge and
  was expelled from `kernel/domain` (which now holds only Result,
  sha256, id ordering, target sanitization, requirement-id extraction
  and name normalization). The aggregate speaks typed vocabulary only;
  a new adapter serializer owns rendering (canonical key order, irHash),
  contract conformance (`conformToContract` — degrading the aggregate
  with the frozen wording, so the verdict still derives from what is
  written) and document parsing for reconstitution. Degrade wording is
  assembled by the emitter (the adapter), per the error-handling rule;
  the domain carries it as a value.

## DDD migration PR2b-2 — the refcheck sensors become layered verticals (2026-08-30, #15)

The three refcheck sensors are now full Clean-Architecture verticals, and
the Json-expulsion ruling shaped the split: **parsing is adapter work,
checking is domain work over typed models**.

- **refcheck/adapter parsers** own every format walk: the component
  catalogue, the units edge block, contracts-table rows, spec-block
  assessment, the entities/rules models, the mermaid state-machine
  sketches, domain entities for XS, and the sibling-unit index. Each
  returns a typed outcome union (wrong-fence-count / unparseable /
  extracted …) so parse failures reach the domain as data, not strings.
- **refcheck/domain checks** (DD / CD / FD / XS) run purely over those
  models through the new **CheckFamilyLedger** — the typed replacement
  for the `detail.split(":")[0]` family recovery: the family travels as
  a field, the ledger renders the frozen `"<family>: …"` details and
  `check:<family>` skip targets itself, and derives `checked[]` from
  its own failed/skipped sets. AttrDecl maps the old raw-Json fields to
  the exact semantics the checks distinguish (declared-ness, numeric
  value, string default) — lossless by construction.
- **Use cases** are pure application orchestration: run the checks,
  record the inputs manifest under the frozen acquisition rules
  (requirements only when rules were usable; siblings only when the
  domain catalogue parsed; the own-unit entities file never recorded
  twice), and compose the aggregate. **Entries are wiring pipelines**
  (acquire → parse → execute → conform → save → verdict): 390/249/753
  lines became 82/88/~130.
- **In-process golden equivalence**: a new suite drives the full layered
  pipeline over the broken/clean fixtures without child processes and
  byte-compares against the goldens — the same bytes now have two
  independent routes (spawned CLI and in-process), and the coverage
  floor holds on real branch coverage (refcheck/domain ≥93% functions,
  100% lines on the check modules).

## Interactor ruling — use cases hold repositories, execute receives identities (2026-08-30, #16)

A standing ruling landed mid-migration: **a use case holds its
repositories via constructor injection, and `execute` receives only
identifying values (IDs, value objects), resolving aggregates internally
before invoking domain logic.** The earlier shape — the entry acquiring
and parsing everything, then handing fully-typed inputs to a "pure" use
case — put application work in the composition root and was rejected.

- The three refcheck use cases were rebuilt as interactors
  (`ctor(designRecords, reports)`, `execute({artifactPath,
  reportDirectory, reportOnly})`). The new **DesignRecord** aggregate is
  the typed snapshot of the checked artifact and its companions;
  **DesignRecordRepository** resolves it under the frozen acquisition
  rules (requirements only when rules were usable, siblings only when
  the catalogue parsed, the own-unit entities file never recorded
  twice).
- **ReferenceCheckReportRepository** gained `conformedOf` — the query
  face of "this repository never persists a non-conforming document" —
  and `save` now conforms internally; verdicts derive from the conformed
  aggregate, so stdout and the file cannot disagree.
- Entries shrank to pure wiring (flags → basename gate → Impl
  construction → execute → outcome switch on the closed **CheckOutcome**
  union), and a use-case test proves the interactor runs against the
  `tests/doubles/` InMemory repository alone.

## DDD migration PR3 — verify-smt becomes the requirements vertical (2026-08-30, #16)

The highest-byte-risk sensor (1,136 lines: tolerant IR parse, SMT-LIB
compiler, z3 child protocol, unsat-core interpretation, cross-check) is
now a layered requirements-context vertical in the interactor shape,
with the base-vs-head parity snapshot diff empty and the goldens
untouched.

- **requirements/domain** owns the meaning: `RequirementsModel`
  (aggregate over typed obligations/scenarios/attributes),
  `VerificationReport` (v1 aggregate whose `compose` applies the
  canonical finding/skip sort), the 4-kind order table (kept as its own
  VO — never unified with the 11-kind table), the degradation factories
  (ir-unreadable / version-mismatch / solver-unavailable with their
  frozen wording), `interpretSmtVerdicts` (global consistency, vacuity,
  event pairs, gaps, scenarios — every detail string verbatim), and
  `crossCheckReport` (scenario-verdict agreement over sibling reports).
- **requirements/adapter** owns the formats: the tolerant IR parser and
  irHash derivation (`FormalModelRepositoryImpl`), the SMT-LIB plan
  builder (verbatim `smtVar`/`smtName`/`enumCode`/`smtOf`, assumption
  indirection, returning format-free `SmtPlanFacts`), the z3 child
  engine (`solveSmtChild` — the frozen stdin/stdout protocol
  refinement-lib also spawns), the solver client (node-preferred spawn
  with the v1 attempt wording incl. the 200-char stderr tail, decoding
  witness models before they reach the domain), and the v1 report
  serializer/repository (`findAllByDirectory` = the cross-check
  acquisition rule).
- **The entry** wires and renders: env reads
  (`AIDLC_DEEP_SPEC_SMT_TIMEOUT_MS`, `AIDLC_DEEP_SPEC_SMT_RUNTIME`),
  self path, schema path, the four frozen verdict-line shapes (v1 NA
  carries no `skipped_count`), and exit 127 on solver unavailability.
- **Proofs**: the in-process golden suite drives the interactor over
  real Impls (real z3 child) and byte-matches `smt.json` and the
  converged `cross-check.json`; requirements/domain sits at 100%
  coverage; a live kiro-harness sandbox reproduced both the
  no-z3 degradation (dispatcher `tool-unavailable`) and the
  golden-identical verified run, with the doctor at 0 errors.
- Issue #28 (rare z3 witness nondeterminism under load) stays open by
  design: any determinization option would change golden bytes, which
  this migration is forbidden to do.

## DDD migration PR4 — verify-quint dissolves into the requirements vertical (2026-08-30, #17)

The second v1 backend loses its 1,154-line self-contained copy and joins
the requirements context in the interactor shape, deleting every
byte-identical duplicate (tolerant IR parse, canonical sort tables,
findings-doc writer, cross-check recomputation) in favor of the modules
PR3 established. The base-vs-head parity snapshot diff is empty and the
goldens are untouched.

- **Shared spine reused as-is**: `FormalModelRepository`,
  `VerificationReport` + repository (conforming save), `crossCheckReport`,
  and the 4-kind order VO. The two backend-agnostic degradations
  (ir-unreadable, version-mismatch) moved to
  `verification-degradation.ts` with an explicit `method` parameter —
  quint freezes `"simulation"` on those paths where smt freezes
  `"exhaustive"` — leaving `smt-degradation.ts` / `quint-degradation.ts`
  with only their backend-specific vocabularies (`z3 could not be
  executed` vs `quint CLI missing`, plus quint's machine-uncompilable
  all-targets compile-error document under the *detected* method).
- **requirements/domain** gains the quint meaning: `evaluateExpression`
  (tolerant pure evaluation for attribution), the decoded `TraceState`
  vocabulary (the witness union now carries `{trace}`),
  `QuintMachineFacts`, and `interpretQuintVerdicts` — the three phases
  (machine invariants incl. deadlock and violated-component attribution,
  leads-to temporals with the accumulated-skip guard, fully-bound
  scenario verdicts) with every detail string verbatim.
- **requirements/adapter** gains the quint formats: the module compiler
  (verbatim emitted text; the **CQS fix** — legacy `compileMachine`
  mutated its `skipped[]` argument, the new compiler returns its compile
  skips), the ITF decoder, and `QuintClientImpl` (probe, java/Apalache
  method detection, tmpdir orchestration, frozen seed/budget/timeout
  constants, typed verdict mapping). Env reads
  (`AIDLC_DEEP_SPEC_QUINT_BIN`, `AIDLC_DEEP_SPEC_QUINT_METHOD`,
  `APALACHE_DIST`, `HOME`) moved to the entry.
- **Deliberate non-observable deviations** (documented, verified by
  parity and by a five-lens adversarial review): temporal runs are no
  longer spawned for leads-to obligations whose from/to never compiled
  into the module (legacy ran them uselessly; output identical); the
  dead `QuintRun.ok` / `temporalIds` fields are gone; and for the
  degenerate duplicate-obligation-id / duplicate-scenario-id IR, the
  client spawns one quint run per unique id where legacy spawned one per
  IR entry — the interpretation replays the single verdict per entry,
  so the document bytes are identical in every deterministic run. The
  review also re-confirmed the ruling-approved verdict derivation from
  the conformed (written) report, and caught one real divergence that
  was fixed: the model repository now reproduces the legacy `existsSync`
  gate exactly (an unstat-able path — e.g. a permission-denied parent
  directory — resolves to not-applicable/exit 0, not an I/O error).
- **Proofs**: the in-process golden suite drives the interactor over
  real Impls (real quint CLI, seeded simulation) and byte-matches
  `quint.json` plus the converged `cross-check.json`;
  requirements/domain stays at 100% per-file coverage; the kind-rank
  proof now pins the single shared v1 table; the live sandbox reproduced
  the no-CLI degradation (dispatcher `tool-unavailable`, frozen document)
  and the golden-identical seeded run with the doctor at 0 errors; a
  five-lens adversarial review workflow compared old and new for byte
  drift before merge.

## Infrastructure ruling — language-extension foundations get their own layer (2026-08-30)

Two standing rulings landed during PR5 and were applied repo-wide
immediately:

- **`Result` is not ubiquitous language.** Technical foundations that
  extend the language (the hand-rolled `Result`/`ok`/`err`/`unreachable`)
  now live in `kernel/infrastructure` — a new innermost layer that
  depends on nothing (not even `node:*`) and that every other layer may
  reach. It is explicitly NOT the Onion outer ring: **RPC clients and
  persistence stay in the interface-adapter layer as gateway
  responsibilities** and must never move to infrastructure. The
  architecture rules enforce both directions (infrastructure imports
  nothing above it; every `node:` import inside it is a violation), with
  red examples.
- **A repository implementation must implement its port interface.**
  Every `XxxRepositoryImpl` / `XxxClientImpl` now declares
  `implements XxxRepository` / `implements XxxClient` against a
  use-case-layer port — the design context gained its
  `design/usecase` ports (`DesignModelRepository`,
  `DesignReportRepository`, `SiblingBackendClient`) the moment its Impls
  existed, not in a later PR. Ports speak domain vocabulary only: the
  sibling-backend port takes the typed lowering and returns the typed
  verdict surface, and the contract-1 serialization/ITF knowledge stays
  inside the Impl.

## DDD migration PR5 — design-lib dissolves into the design vertical (2026-08-30, #18)

The 821-line design-lib is deleted (tombstoned in the installer) and the
two design-verify sensors run on `design/{domain,usecase,adapter}`. The
`Expression` tree moved to `kernel/domain` (contract-shared vocabulary;
requirements imports rewired — no compat re-export). Base-vs-head parity
diff empty; goldens untouched.

- **design/domain** owns the meaning: `DesignModel`/`DesignUnit`
  aggregates (unit ordering as a compose invariant; `allTargets`/
  `enumValuesOf` as queries), the typed lowering (`lowerUnit` — OB/SC/BG
  numbering, synthetic vacuity/shadow tautologies, the ledger maps),
  `expressionCanonicalKey` (byte-equal to the kernel canonical JSON —
  machine-proved by test), `remapUnitDoc` (unreachable/redundancy
  conversion, mutual-subsumption collapse, deterministic:false waivers,
  OB-n detail/core rewriting — wording verbatim), the `DesignReport`
  aggregate (inputs/checked sorting as compose invariants), the 11-kind
  order VO, the design cross-check, and the degradation factories.
- **design/adapter** owns the formats: the tolerant contract-3 parser,
  the model repository (legacy `existsSync` gate reproduced), the
  lowered-document serializer, the sibling-backend client (frozen
  wrapper text and spawn contract; tools dir/cwd injected; an optional
  spawn-environment overlay for deterministic test harnesses — entries
  omit it, preserving inheritance), the sibling-verdict parser, the
  reachability probe (variant + reached decision), and the design-report
  serializer/repository.
- **Entries stay orchestrators for one more PR**: Phase 3 (refinement)
  still calls refinement-lib — legacy, entry-only, verbatim — and the
  interactor use cases for the design sensors land in PR6 together with
  the refinement dissolve. refinement-lib was bridged to the new
  `DesignUnit` class API (field access → queries) and to
  kernel/design imports; design-ir-valid inlined its two tiny design-lib
  imports.
- **Proofs**: a new in-process suite reproduces the design goldens
  (smt + quint + converged cross-check) over real v1 sibling spawns;
  design/domain holds the 90% per-file floor (mostly 100%); the
  kind-rank proof reads the design order VO; the live sandbox upgrade
  removed design-lib via the tombstone, transported the design tree, and
  reproduced the quint design golden with the doctor at 0 errors.

## DDD migration PR6 — refinement-lib dissolves; the design sensors become interactors (2026-08-30, #19)

The last shared lib (1,109 lines) is deleted (tombstoned) and the two
design-verify sensors are now full interactors. Base-vs-head parity diff
is empty; goldens untouched; the refinement E2E suite passed on the
first run of the layered pipeline.

- **refinement/domain** (a context with NO adapter — by design, its I/O
  lives behind design's ports): the `RefinementMap` aggregate with the
  closed `AttributeMapping` union (expression / enum-cases / the
  schema-unreachable `unspecified` tolerance — the one deliberate
  deviation: legacy crashed on it with a TypeError, the port now raises
  a materials-only AlphaError), `RefinementRequirements` (the
  refinement-profile view of contract 1), alpha substitution
  (`alphaExpr`/`alphaEquality`), `planUnitRefinement` (closure rule and
  every mapping-gap wording verbatim), the design event catalog, both
  backend-flavored status-skip vocabularies, `interpretRefinementVerdicts`
  (the four probe kinds with frozen texts), and the Quint extras.
- **design/usecase** gains the `Clock` port consumption (budget control
  is flow — the clock is a kernel port with a `SystemClock` adapter),
  the `RefinementContextRepository` port (record-root walking, the
  contract-4 map load with its four frozen error messages, and the
  three-artifact inputs ledger), the `RefinementSolverClient` port, and
  the two interactors `VerifyDesignSmtUseCase` /
  `VerifyDesignQuintUseCase` — phases 1-3, budgets, probes, and the
  masked-capability logic all moved out of the entries, which are now
  pure composition roots.
- **design/adapter** gains the **explicit second SMT compiler**
  (deliberately NOT unified with the v1 plan builder — the PR8 decision
  point) plus the refinement solver client with the refinement attempt
  wording (no stderr tail — a frozen profile distinct from v1's).
- **The PR8 safety net**: a characterization suite snapshots the exact
  SMT-LIB scripts of BOTH compilers (`tests/fixtures/smt-scripts/`) —
  any future unification must keep these bytes.
- **Proofs**: the in-process golden suite drives both interactors over
  real Impls (real v1 siblings, real z3 child) through phase 3 and
  byte-matches all three refinement goldens; refinement/domain holds the
  90% floor (mostly 100%); the live sandbox upgrade removed
  refinement-lib via the tombstone and reproduced all three goldens with
  the doctor at 0 errors. With this PR the LEGACY set of the
  architecture rules contains only entries — **no legacy library
  remains**.

## DDD migration PR7 — both IR validators become interactors; the duplicated kernel helpers collapse (2026-08-30, #20)

The two contract validators (ir-valid 460 lines, design-ir-valid 348) are
now composition roots over layered use cases, and the last local copies of
the kernel helpers are gone. Base-vs-head parity diff is empty; goldens
untouched.

- **The keep-both fallback was not needed.** issue #20 mandated a first
  step: diff ir-valid's local `validateSchema` against the kernel one,
  because its error strings are an observed surface (the ir-valid
  `errors[]` that intent-e2e asserts). The two are byte-identical apart
  from the `export` keyword and all 12 error templates match, so the local
  copy was deleted rather than kept. `requirementIds` is likewise
  byte-identical; `extractJsonFences` is `extractFences(md, "json")`
  mapped to bodies; the local `parseFlags` is the kernel one minus the
  unread `--report-only`.
- **`walkExpression` joins kernel/domain.** Both validators carried the
  same pre-order walk over the shared `Expression` vocabulary.
- **requirements/domain**: `modelWellFormednessErrors` (unique ids,
  resolvable references, enum membership, prime legality — every wording
  and the emission order verbatim), `FrReferenceIndex` (the frRef reverse
  index and its sorted missing-reference report), and `SourceAnchor`
  (declared vs actual digest, both frozen messages).
- **design/domain**: `designWellFormednessErrors` (per-unit id namespaces,
  the sibling-bound enum rule, machine well-formedness, BR coverage) and
  `BrReferenceIndex`.
- **The domain cannot see `Json`.** Layer direction forbids domain →
  kernel/adapter, and the ruling that serialization formats are adapter
  knowledge stands. So the tolerant walk over raw Json — every `isObject`
  / `typeof` guard deciding whether an entry is silently skipped — moved
  into the adapters, which hand the domain a typed view (`IrModelView` /
  `DesignUnitView`). The existing contract-1 parser could NOT be reused:
  it drops attributes whose `type` is malformed, while ir-valid registers
  them with `kind: ""` — a difference that changes which references
  resolve.
- **The digest stays a byte digest.** `sourceDigest` hashes the
  requirements.md *bytes*; kernel's `sha256(text)` re-encodes a string as
  UTF-8 and would diverge on a file that is not valid UTF-8. The adapter
  keeps `createHash` over the Buffer, and the reason is recorded at the
  call site.
- **Review fix (gate restoration)**: the design materials gateway
  initially built unit views — including the per-unit `existsSync` /
  rules.md reads — unconditionally, where the legacy main only ran
  `semanticErrors` when the version matched and the schema was valid.
  The gate is restored in the adapter: unit views (and their I/O) are
  built only under the legacy errors-empty condition, so a unit name
  that has not passed the schema's `^[a-z0-9][a-z0-9-]{0,63}$` constraint
  is never joined into a filesystem path (the legacy I/O profile and its
  path confinement, preserved).
- **Proofs**: a new in-process suite drives both interactors over real
  Impls and asserts the rendered verdict line is byte-identical to the one
  the real sensor writes on stdout, across every scenario (canonical, each
  planted defect, digest drift, absent requirements, fence/JSON/schema
  failures, version mismatch, pass-through); both well-formedness modules
  hold 100% line coverage; the base↔head parity snapshot `diff -r` is
  empty over 45 files; the live sandbox upgrade transported both trees and
  reproduced the canonical pass and every planted defect with the doctor
  at 0 errors.

## Repository ruling — a repository resolves its aggregate by the aggregate's own ID (2026-08-30)

An owner ruling landed during PR7 review and was applied immediately:
**a repository's lookup method takes the identity of the aggregate it
resolves — never the identity of some other artifact from which the
repository would derive it internally. The identity's value may well be
a path, but it must be typed and conceptualized as the aggregate's ID.**

- The flagged violation: `RequirementsSourceRepository.resolve(outputPath)`
  received the *formal model artifact's* path and derived the requirements
  source's identity (record root, three levels up) inside the Impl —
  resolution by another aggregate's identity.
- The fix: the new `RequirementsSourceId` value object (requirements/domain)
  carries the record root — one requirements source per intent record, so
  the record IS the identity; which phase directory physically holds
  requirements.md stays a resolution detail of the repository. The
  derivation from the verify artifact's path is path-layout knowledge and
  therefore adapter work: the materials gateway stamps `sourceId` into
  `IrValidationMaterials` during acquisition, and the use case hands that
  ID to `resolve`.
- Ports whose parameter is the resolved aggregate's own artifact path
  (`findByPath` on the formal-model and design-model repositories) already
  satisfy the value-may-be-a-path clause; typing those identities is
  follow-up alignment, tracked for the closeout.

## Repository ruling, addendum — findById is the primary lookup, and inputs carry value objects (2026-08-30)

Two further owner rulings landed right after PR7 merged, and were applied
repo-wide in one sweep:

1. **A repository's lookup is `findById(aggregateId)`.** A reverse-only
   lookup (`findByArtifact(artifactPath)`, `findByPath(modelPath)`,
   `findByModelPath`) means the aggregate's ID plays no role in the
   design — the identity was never modeled. Every lookup port now
   resolves forward by a typed aggregate ID: `DesignRecordId` (refcheck),
   `FormalModelId` (requirements), `DesignModelId` (design), and
   `RefinementContextId` (anchored 1:1 to its design model via
   `ofModel` — the anchoring is in the type). The PR7-era
   `RequirementsSourceRepository.resolve` was renamed `findById`, and the
   two validator materials gateways acquire by the model IDs.
2. **Use-case Input bodies carry value objects, never primitives.**
   `ArtifactPath.parse(raw): Result<ArtifactPath, ArtifactPathError>`
   (kernel/domain) is the boundary's single constructor: the entries
   parse `--output-path` once — the parse failure IS the old
   "--output-path is required" branch — and the value never degrades
   back to a primitive on its way through the use case. Inputs are now
   `{ modelId, verifyDirectory: ArtifactPath }` /
   `{ recordId, reportDirectory: ArtifactPath, mode }`;
   `reportOnly: boolean` became the closed vocabulary
   `CheckExecutionMode = "persist" | "report-only"`; the three report
   IDs take `ArtifactPath` for their directory half, and
   `findAllByDirectory` takes `ArtifactPath`. Primitives survive in
   exactly two places: the raw flags before the entry parses, and the
   adapters' fs boundary (`value()` at join/read/mkdir — the sanctioned
   outward crossing, marked 境界).

Proofs: the base↔head parity snapshot `diff -r` is empty against the
pre-PR7 base (45 files); 296 tests green; every new VO holds 100% line
coverage; goldens untouched.

## Domain-primitive catalog — parse/reconstitute duality; two land now, six are freeze-blocked (2026-08-30)

The owner ruled that domain primitives were not thorough: the ubiquitous
language's constrained values still flowed through aggregates as raw
strings. The catalog was audited value by value, and the aggregate idiom
was extended to DPs: **`parse` is the strict boundary constructor
(Result, materials-only error) and `reconstitute` is the verbatim
rehydration door for frozen documents** — exactly the compose /
reconstitute duality the aggregates already had, so byte-frozen tolerant
reading stays in the adapters while every parse-path is Always-Valid.

Landed now (both with real production/interpretation semantics today):

- **`ContentHash`** (kernel) — `^[0-9a-f]{64}$`; `sha256()` now returns
  it, `ofText`/`ofBytes` are the computed producers. Typed end-to-end:
  `AcquiredFormalModel`/`AcquiredDesignModel.irHash`, both report
  aggregates, `InputEntry`/`DesignInputEntry.sha256`, `SourceAnchor`'s
  actual side, `RefinementMap`'s dual anchors and the staleness
  comparisons (`equals`, no more `!==` on strings). Serializers map to
  `value()` at the rendered byte and reconstitute via the verbatim door.
- **`IrVersion`** (kernel) — semver; the strict invariant already
  existed in both model parsers (`IR lacks a semver irVersion`), so
  `RequirementsModel`/`DesignModel` hold it Always-Valid, and
  `majorVersion`/`supportsMajor` moved onto the DP where they belong.
  Report reconstitution keeps the frozen "" tolerance via `reconstitute`
  (NaN major, same as legacy).

Freeze-blocked (recorded here so PR10 lifts them deliberately): the
remaining six candidates have NO strict production path today — every
value enters through byte-frozen tolerant ingestion, so their `parse`
would be dead code and the DP pure ceremony. `UnitName` (schema pattern
`^[a-z0-9][a-z0-9-]{0,63}$` exists, but units only ever arrive via the
tolerant model parser), `RequirementId`/`BusinessRuleId` (frRefs/brRefs
arrive from documents; the extraction sets are regex-guaranteed but
compare against raw document claims), `VerificationMethod` (internally
closed to bounded/simulation but report reconstitution admits any
string), `BackendName` (sibling reconstitution derives it from file
names), `AttributePath` (expression paths are exactly what
well-formedness must REPORT on, not reject at parse). When PR10 lifts
the freeze, these convert with regenerated goldens.

A naming correction landed in the same review: `InputEntry` /
`DesignInputEntry` were not ubiquitous language ("entry" is a technical
ledger-row word). The concept is content-anchoring of an input artifact
— the same vocabulary as `SourceAnchor` — so they are now `InputAnchor`
(refcheck) and `DesignInputAnchor` (design), each context owning its
word.

Proofs: 296+12 tests green; both DPs at 100% line coverage; the parity
snapshot `diff -r` is empty against the pre-PR7 base; a live sandbox z3
run reproduced `smt.json` byte-identical to the golden.

## Aggregate-identity ruling — every entity and aggregate carries its ID (2026-08-30)

The owner ruled that ID-less entities and aggregates are unacceptable. The
audit found that PR #40's typed aggregate IDs were used to *resolve*
aggregates but the resolved aggregates did not *carry* them — a repository
answered `findById(id)` with an object that did not know its own identity.

- `RequirementsModel` now carries `FormalModelId`, `DesignModel` carries
  `DesignModelId`, `DesignRecord` carries `DesignRecordId` — injected by
  the repository from the `findById` argument (the parser knows only the
  document's content, never its identity).
- `RefinementMap` gains the new `RefinementMapId` (the contract-4 map
  artifact — one per record), and `RefinementRequirements` carries
  `FormalModelId`: a profile does not change identity, so the contract-1
  aggregate's ID is re-exported through the refinement facade (layer
  discipline: design/adapter→requirements/domain is a forbidden edge,
  design/adapter→refinement/domain is allowed).
- `DesignUnit` — the entity inside `DesignModel` — gains `id():
  DesignUnitId` (identity = the unit name; validation of the name is the
  freeze-blocked `UnitName` DP's job, not the ID's), and
  `RefinementMap.unitMapOf` now takes the typed id instead of a raw
  string.
- Interface entities (`Obligation`, `Scenario`, machines, transitions)
  already carry their `id` fields; typing those stable IDs is the
  freeze-blocked `RequirementId`/`BusinessRuleId` story.

Review round on the same PR: the stale `InputEntry` names in this
catalog's typed-through list were corrected (CodeRabbit), and
`IrVersion.parse`'s acceptance of leading zeros was confirmed as the
frozen legacy pattern `/^\d+\.\d+\.\d+$/` — tightening to strict SemVer
would reject IRs the legacy parsers accepted, so it is pinned by test and
deferred to the PR10 lift.

Proofs: 304 tests green; parity snapshot `diff -r` empty against the
pre-PR7 base; goldens untouched; all new id accessors covered above the
90% floor.

## Vocabulary-primitive ruling — non-boolean values in domain interfaces become DPs (2026-08-30)

Two more rulings landed in the same review session and were applied:

1. **Port-holding fields are named for their role.** `#designRecords` /
   `#reports` hid what they hold; every use-case field and constructor
   parameter holding a port now bears the port's name
   (`#designRecordRepository`, `#referenceCheckReportRepository`,
   `#formalModelRepository`, `#verificationReportRepository`,
   `#z3SolverClient`, `#quintClient`, `#designModelRepository`,
   `#designReportRepository`, `#siblingBackendClient`,
   `#refinementContextRepository`, `#refinementSolverClient`,
   `#irValidationMaterialsRepository`, `#requirementsSourceRepository`,
   `#designIrValidationMaterialsRepository`).
2. **Non-boolean fields of domain interfaces are domain primitives** —
   the freeze-blocked stance was overruled: the `reconstitute` door makes
   DP-ification freeze-compatible even where the strict `parse` path has
   no producer yet. Applied first to the quoted instance and its whole
   cluster: the functional-design vocabulary (`AttrDecl`, `RelDecl`,
   `EntityDecl`, `RuleDecl`, `StateMachineSketch`, `DomainEntitySketch`,
   the sibling index) now speaks `EntityName`, `AttributeName`,
   `ElementPath`, `TypeName`, `AllowedValue`, `AttributeDefault`,
   `NumericBound`, `CardinalityNotation`, `BusinessRuleId`,
   `RuleCategory`, `AppliesTo`, `SourceId`, `MachineSpec`, `StateName`,
   `ComponentName`, `ReferenceTarget` — each owning its interpretation
   vocabulary (case/underscore normalization, the BR shape, cardinality
   token folding, spec decomposition, default rendering) so the checks
   read as semantics while every frozen message stays byte-identical.
   Booleans (declaration flags) and prose (details, unsupported reasons,
   missing-key lists) stay primitive by the ruling's own carve-out;
   line/count metadata stays numeric pending an explicit ruling.

Proofs: 305+ tests green; the vocabulary file holds 100% line coverage;
goldens untouched; the parity snapshot `diff -r` stays empty against the
pre-PR7 base (the refcheck scenarios exercise these messages heavily).

## Tell-Don't-Ask ruling — domain objects are abstract data types, not data structures (2026-08-30)

The owner ruled that an anemic domain model is unacceptable: a domain
interface carrying only properties means its behavior has escaped
outside, and every caller is *asking* (pulling data out and deciding
elsewhere) instead of *telling*. Domain objects must enclose their
complex domain knowledge behind a narrow surface.

Applied first at the flagged epicenter, the functional-design cluster:
the seven property bags became behavior-bearing classes, and the escaped
predicates moved home —

- `AttrDecl` now judges its own coherence: the FD-E2 type-category
  conflicts (`declaresAllowedValuesOnNonEnumerableType`,
  `declaresBoundsOnNonNumericType`, `declaresUniqueOnCollectionType`),
  the FD-E3 range/default coherence (`boundsInverted`,
  `defaultBelowMin`/`defaultAboveMax`, `defaultOutsideAllowed`), the
  lifecycle candidacy, and the FD-S diagram diffs (`rogueDiagramStates`,
  `allowedValuesAbsentFrom`). The type-category sets moved into `TypeName`
  (`classifiesNumeric`/`Date`/`Bool`/`Collection`), the cardinality
  closed set into `CardinalityNotation.isInClosedSet`, the category set
  into `RuleCategory.isKnownCategory`.
- `EntityDecl` owns `duplicateAttrDecls`, `lifecycleAttr` (the former
  free function died into it), `attrNamed`. `DeclaredEntities` owns
  `duplicateEntityDecls`, `allRels`, `containsEntityNamed`, the FD-E6
  `resolvesReference`, the FD-R4 `resolvesAppliesTo`,
  `entityByNormalizedName`, `lifecycleEntities`. `RuleDecl` owns
  `findingTarget` (the five-fold BR-shape ternary died into it),
  `sourceIdValuesMissingFrom`, `categoryOutsideClosedSet`.
  `StateMachineSketch` owns its frozen `locationLabel`;
  `DomainEntitySketch` owns `catalogLabel` and `attributesDroppedIn`.
- The check runners are now pure coordinators: they iterate, tell the
  declarations to yield their violations, and render the frozen
  messages. Formatting stays on 境界 accessors so every message is
  byte-identical (proven by the untouched goldens and the still-empty
  parity snapshot).
- Finding-emission order changed within a family (duplicates now come
  from collection methods); this is unobservable because the report
  aggregate's compose owns canonical sorting — the goldens confirm.

## First-class-collection ruling — domain layers never handle raw arrays (2026-08-30)

The owner ruled that raw arrays must not flow through the domain layer:
collections are first-class domain objects with an immutable `add`, the
collection-owned set knowledge, and `toArray()` as the boundary-only
escape hatch. Applied at the epicenter cluster: `AttributeNames`,
`AllowedValues`, `StateNames`, `SourceIds` (vocabulary side) and
`AttrDecls`, `RelDecls`, `EntityDecls`, `ShapeErrors`, `RuleDecls`,
`StateMachineSketches`, `DomainEntitySketches`, `SiblingUnitIndex`
(declaration side). The set knowledge sank one level further into the
collections: duplicate detection (`duplicatesByName`), lifecycle
selection (`AttrDecls.lifecycleAttr`), FD-E6/FD-R4 resolution
(`EntityDecls.resolvesReference`/`resolvesAppliesTo`), the FD-S diagram
diffs (`AllowedValues.rogueAmong`/`absentFrom`), the FD-R3 reverse
verification (`SourceIds.valuesMissingFrom`), the XS traversal order
(`DomainEntitySketches.sortedDistinctByNormalizedName`) and the sibling
lookups (`SiblingUnitIndex.definersOf`/`entityDeclaredIn`). The former
`SiblingUnitEntities` type alias — a bare `Map` in the domain — died
into the index class. Terminology note recorded in the same session:
comments now say 型区分 (type category) — plain OO classification, no
functional type-class connotation intended or implemented.

Proofs: 308 tests green; goldens untouched; the parity snapshot
`diff -r` stays empty; every collection above the 90% floor.

## Accessor-naming ruling — DP accessors say the representation, not the field (2026-08-30)

The owner ruled that `value(): string` on a domain primitive exposes the
internal structure (the `#value` field) through the public face. The
accessor is a representation conversion, so it is named as one:
`asString()` for string-valued DPs and `asNumber()` for number-valued
ones (`LineNumber`, `BlockIndex`, `NumericBound`). Renamed across every
DP in all five contexts (25 declarations, ~300 call sites); role-named
accessors (`backendName()`, `fileName()`, `majorVersion()`) already
follow the principle and stay. The private `#value` field is untouched —
the ruling is about the public vocabulary. Future DPs follow `asString`/
`asNumber` from birth (recorded in the #46 ledger invariants).

Proofs: 322 tests green; goldens untouched; parity snapshot `diff -r`
stays empty; coverage floor holds.

## Domain-vocabulary completion and full layer enforcement — rulings A–D and PR10 (2026-08-31 – 09-01)

The four #46 rulings were applied across the tree and the ledger closed (PRs #54–#60).

- **Ruling A (domain primitives everywhere)**: no primitive-typed fields on
  domain objects except bool. requirements (5a) → design (5b) →
  refinement/decl bundles (5c-1/5c-2) → the trigger face (5c-3, kernel
  `TriggerName`) → the lowered payload faces (5d: `LoweredId`,
  `LoweredOriginRef`, `ObligationIds`, `BackendName` on the report
  identities). Shared vocabulary is promoted to the kernel following the
  FrRefs precedent (`AttributeBound`, `TriggerName`, `ErrorMessages`).
- **Ruling C (tell-don't-ask)**: wrapping a value means nothing while its
  knowledge (closed-set predicates, frozen orderings, coordinate
  derivations, bound comparisons, matching syntax) lives at call sites —
  the primitive or its collection owns it (#56, applied from day one to
  every new primitive since).
- **Ruling D (repository contract)**: repository methods speak persistence
  vocabulary only (findById/store); findById returns an aggregate that
  carries its id, and every writable document gets store — single-document
  aggregates retain their raw source bytes and findById∘store is
  byte-identity (atomic writes, defensive copies). Write-adjacent queries
  such as contract conformance move to separate service ports.
- **Permanent declared exclusions**: the `Expression` published language
  (closing the `op` set is rejected — lenient unknown-value passthrough is
  the contract), state tokens (references to enum declared values, whose
  vocabulary is itself material), the design `attrPath` (a joined form
  derived from the entity/attribute primitives), serializer-direct payload
  strings, and `FrRefClaim.owner` (a mixed obligation/scenario reference
  token).
- **The frozen equal→1 comparators**: normalizing to `return 0` could
  change the stable order of duplicate declarations and is rejected for
  good; duplicates are surfaced by well-formedness.

PR10 turned layer enforcement fully on:

- The LEGACY_FILES exemption is emptied. The ten flat files (nine sensors
  plus the doctor) are the **entry** role, not an exemption — the only
  place allowed to touch process.*/import.meta, carrying wiring only.
- New style rules (each with a red example): private-constructor
  discipline for domain classes (new only inside the class, Error
  subclasses exempt), no get accessors, no TS enums, no non-null
  assertions. The real tree had two violations (a public ctor on
  `CheckFamilyLedger` → `of()` factory; one `!` in the doctor), both fixed.
- Duplicate audit: beyond the already-kernel-shared helpers
  (findRecordRoot, relArtifact, validateSchema, readIfExists, isObject,
  canonicalStringify, extractFences), `strArr` (five adapters) and `eqRef`
  (the implicit-guard encoding shared by lowering and the event catalog —
  now one definition, structurally lockstep) moved to the kernel. Two
  honest exceptions remain: ① the sanitize regexes differ per meaning
  (SMT symbols `[^A-Za-z0-9_]` vs finding targets `[^A-Za-z0-9_./-]`),
  ② the SMT rendering vocabulary (`smtName`/`smtVar`) is duplicated
  between requirements and design by the PR8 outcome — an adapter may not
  import a foreign context's adapter, and the second compiler mirrors the
  v1 rendering vocabulary verbatim by contract.

Evidence: 367 tests green, goldens untouched, parity snapshot `diff -r`
empty against the pre-PR7 base, coverage floors held, 7 harness builds,
CLI z3/quint spot check BYTE-IDENTICAL.

## One-public-type-per-file ruling — every public type owns its own file (2026-09-01)

Java-style file discipline, applied to the whole layered tree. A layered
file (any layer of kernel/requirements/design/refinement/refcheck)
carries at most one public type declaration (`export
class/interface/type/enum`), and the file name equals the kebab-case of
that type name (`UseCase` is the established single word "usecase").
Subordinate non-exported types and private constants may live with their
owning public type; function-only modules carry no naming constraint.
Facades (index.ts) declare nothing and re-export explicitly; entries
declare no public types — wiring only.

- **Enforcement**: `onePublicTypePerFile` joins ALL_RULES (red/green
  examples; stripStrings preprocessing avoids string-literal false
  positives). It detects the three shapes: multi-type files, name
  mismatches, and declarations in facades/entries.
- **Shape of the migration**: 186 → 459 files. 273 extractions
  (refcheck/domain 78, design/domain 73, requirements/domain 59,
  refinement/domain 32, the rest across adapter/usecase/kernel),
  28 renames following the owning type (`lower-unit` → `lowered-unit`,
  `remap-unit-doc` → `remapped-unit`, `design-ir-decl` →
  `design-unit-decl`, the kernel adapters `fence`/`json`/`md-table`/
  `schema`/`yaml`/`names`/`target-ids`, …), the remainder import and
  facade follow-ups.
- **Shared tables follow their owning type**: KIND_RANK moved into the
  findings collections (`verification-findings`/`findings`/
  `design-findings`) and the kind-rank order-preservation test paths
  follow. Coverage pins were added for the collection faces the split
  exposed (of/add/iteration).

Evidence: tsc clean, full suite 371 pass / 1 skip / 0 fail, the per-file 90% coverage
floor held (faces the split exposed are sealed by coverage pins),
goldens and
parity untouched (no reference-output changes), the architecture suite
reports zero violations with the new rule on.

## DDD migration PR8 — the SMT-compiler unification decision point is ruled: shared kernel vocabulary, two named compilers (2026-09-01, #21)

The decision point PR6 deferred is executed. Full unification is ruled
**out**, and issue #21's fallback — a shared core under two named
compilers — lands.

- **How the issue's three known differences resolved**: "enum sibling
  resolution" is the same algorithm; the difference is only the lookup
  table. The "bare-enum-literal wording difference" is real and frozen.
  The "smtLit negatives" turned out byte-identical on both sides —
  which is exactly what let the literal renderer move.
- **Three frozen divergences reject unification**:
  ① the bare-enum wording — for a bare enum literal, v1's explicit case
  says "enum literal without a ref sibling has no resolvable encoding"
  while refinement has no case and falls through to
  'unknown operator "enum"' (carried in the alpha-failure detail). Both
  are frozen wordings reachable as compile-error skip details in
  document bytes; one function cannot serve both without a dialect
  switch.
  ② the ref resolution table is per context — v1 resolves against the
  RequirementsModel aggregate, refinement against the
  RefinementSmtContext built from the design unit's rawEntities.
  ③ a type-bound constraint-name sanitization difference (newly
  ledgered by this ruling) — v1 goes through smtName and replaces every
  non-word character, refinement replaces dots only. Identical bytes on
  ordinary paths, divergent frozen behavior on exotic ones.
- **The shared core**: the four byte-identical vocabulary faces move to
  kernel/adapter `smt-symbols` — smtVar, smtName, smtLit (also
  collapsing v1's smtNumeral and its two inline duplicates in the int
  literal and scenario bindings), and smtIntOf (the (- n) decode both
  decoders shared). One definition makes the lockstep structural (the
  eqRef precedent). The expression compilers stay two named ones —
  smtOf (requirements) and smtOfExpr (design) — with no old-name
  aliases.
- **The duplicate map updates**: PR10's honest exception ② — the SMT
  rendering vocabulary duplicated between requirements and design — is
  resolved by this ruling; the honest exceptions shrink to one, the
  meaning-distinct sanitize regexes.

Evidence: base↔head parity `diff -r` empty, AIDLC_PARITY=1 determinism
green, characterization snapshots (tests/fixtures/smt-scripts/)
untouched, goldens untouched, 371 pass / 1 skip / 0 fail with the
coverage floor, validator Errors: 0, 7 harness builds.

## DDD migration PR9 — the doctor becomes a composition root over layered use cases (2026-09-01, #22)

The last working flat file (505 lines) is layered into a doctor context's
domain / usecase / adapter, and the entry carries env reads and wiring
only.

- **The six doctor/domain concepts**: `InstallationManifest` (the 43-row
  ledger, frozen order), `VerificationStaleness` (the pure sourceDigest
  match + mtime fallback judgment — as long as an anchor exists, only
  content decides and mtime lies are ignored), `CoverageAssessment`,
  `StructuralDebt`, `UnitCoverage` (carrying refinement staleness
  separately, which is what preserves the frozen order), and
  `HealthVerdict` (a first-class collection of the checks array whose
  `document()` is the published shape).
- **Five use cases, execution order = checks order, frozen**: manifest →
  solvers → requirements coverage → structural debt → design coverage.
  Every label/fix wording is sealed in `DoctorPresenter`, freezing the
  installer's grep substrings ("no deep-spec verification", …) and the
  labels intent-e2e asserts verbatim. The Check literal's property order
  (pass, label, fix, severity) is serialized bytes.
- **RefcheckBackendClient stays a spawn**: fault isolation and the 15s
  timeout semantics are preserved. A report-only run that cannot count
  (missing tool, non-zero exit, broken verdict) returns null and is not
  counted — never confused with 0 findings.
- **Frozen behaviors preserved**: scan orders (readdir natural order for
  spaces/intents, sorted units), the interleaving that puts
  refinement-staleness rows before unit rows, hashing requirements only
  when an anchor exists, the try/catch silencing scopes, the fence regex.
- **The manifest reorganizes**: the doctor entry and its three canaries
  join the ledger (39 → 43), and intent-e2e's compose assertion list is
  synced with it (the kernel/refcheck usecase/adapter canaries join the
  e2e side too).
- **The coverage charter applies**: doctor/domain sits under the 90%
  floor (every file at 100%); doctor/{usecase,adapter} join the bunfig
  excludes — per the charter, the numeric gate is the domain layer's.

Byte proof: old and new doctor stdout compared in two environments (the
dev repo and the design fixture) — the diff is exactly the four
sanctioned manifest rows; the other 44 rows are deep-equal in preserved
order with unchanged serialization bytes. Evidence: 383 pass / 1 skip /
0 fail, base↔head parity `diff -r` empty, AIDLC_PARITY=1 determinism
green, goldens untouched, validator Errors: 0, 7 harness builds (dist
carries the doctor tree).

## Port-placement ruling — two kinds of port, gathered under usecase/port/ (2026-09-01)

Ports come in **two kinds — Repositories (persistence) and
external-system Clients (the `Z3SolverClient`/`QuintClient` shape)** —
and the usecase layer's port contracts (the interfaces plus the payload
types that make up their signatures) gather under `usecase/port/`.
Interactors and their input/outcome types stay directly in usecase/.

- **The contract-conformance service port is abolished**:
  `ReferenceCheckReportConformance` is ruled a wrong abstraction as a
  standalone port; `conformedOf` merges into
  `ReferenceCheckReportRepository`. Asking for "the shape store would
  write" without writing is part of the persistence contract, and
  report-only verdicts still derive from that return value (the
  invariant that stdout can never contradict the file stands). Ruling
  D's clause "write-shape queries such as contract conformance split
  into a separate service port" is revised by this ruling — the
  Repository carries them instead. The three interactors drop to one
  dependency and the entries lose their doubled wiring.
- **The move**: 32 contracts across five contexts (kernel 2, refcheck 2,
  requirements 9, design 11, doctor 8). Payload types that make up port
  signatures (SmtCheck/RefinementCheck/the scan materials, …) travel as
  part of the contract. Facade and interactor imports follow; the
  public surface is unchanged except the dropped Conformance export.
- **Enforcement**: `portsLiveInPortDir` joins ALL_RULES (red/green
  examples) — it flags Repository/Client interfaces left directly in
  usecase/ and classes (interactors) that stray into port/.

Evidence: tsc clean, full suite green with the per-file 90% floor, zero
architecture-suite violations, validator Errors: 0, 7 harness builds.

## The thaw — the seven gaps the migration carried byte-frozen are ruled (2026-09-01, #34 / #38)

With the migration complete (#12, PR10 #23), the #34 ledger (verify-smt,
four items) and the #38 ledger (refinement, three items) are thawed. The
outcome: **not one golden or parity byte moved** — every gap sat on
degraded paths and exotic inputs, so the fixes only add new observable
surfaces (new wordings, new skips, degradations) while the healthy-path
bytes are preserved. Both ledgers close without regenerating a single
golden.

- **#34 item 1 (smtVar collisions)**: special characters were already
  fenced by the schema's identifier pattern (`^[a-z][a-zA-Z0-9_]*$`);
  only the underscore collision (`a.b_c` vs `a_b.c` → the same
  `v_a_b_c`) was live. Both well-formedness passes (requirements /
  design) gain a collision check — new frozen wording
  `attribute paths "…" and "…" collide under the solver variable
  encoding (dots become underscores)` (with the `schema: ` prefix on
  the requirements side).
- **#34 item 2 (unvalidated sibling casts)**: found already resolved by
  the wave-4b explicit mappings — today's `parseSiblingReportDocument`
  filters every element. Locked with a regression pin.
- **#34 item 3 (the `error` verdict on event pairs)**: an evo/evj error
  now records the same timeout skip as unknown/budget (symmetric with
  the gap/scenario branches). Existing frozen wording reused; no new
  wording.
- **#34 item 4 (the safe-integer range)**: `smtLit` stays byte-identical
  in the safe range and renders out-of-range integers (1e21 and friends
  — exact as doubles) through BigInt as exact decimals — an upgrade
  over the ledger's reject-with-isSafeInteger sketch that refuses no
  exactly-representable value. Model decoding carries out-of-range
  values as exact decimal strings. The authoring surface is fenced by
  well-formedness — the new frozen wording `bounds must be safe
  integers` (both sides), the binding check moving to isSafeInteger
  (existing wording reused), and an `unsafe-bound` material on
  `AttributeBound.parse`.
- **#38 item 1 (swallowed alpha failures on the Quint path)**:
  `quintStatusSkips` attempts the substitution and records failures as
  `compile-error` skips — the detail is verbatim-paired with the SMT
  side (`alpha substitution failed: …`), and the lockstep is locked by
  a test.
- **#38 item 2 (runtime retry after ETIMEDOUT)**: a timeout breaks the
  loop (only ENOENT deserves the next runtime). The unavailable wording
  template is unchanged — the attempts list just has one entry — and
  the worst-case ~90s double burn against a 30s budget is gone.
- **#38 item 3 (a verdict-less crash on an unreadable model)**: found
  already resolved by `a858abc` (repository reads honoring the Result
  contract) — an EISDIR or permission error after the existsSync gate
  becomes io-failed → a fail verdict. Locked with regression pins on
  both validators.

Evidence: 397 pass / 1 skip / 0 fail (12 new pins, per-file 90% floor
held), goldens untouched (`git diff --exit-code tests/fixtures` clean),
base↔head parity `diff -r` empty, AIDLC_PARITY=1 determinism green,
validator Errors: 0, 7 harness builds.

## The CQS ruling — commands return nothing: store is void (2026-09-01)

Repositories returning the written aggregate from store is ruled a CQS
violation; all ten ports change to `Result<void, RepositoryError>`. A
store that reads back and returns the aggregate is forbidden. Only bulk
writes may return the count of successful writes or the set of
pre-assigned aggregate ids (no port has a bulk write today).

- **Ruling D revised (the write face)**: the "store returns the
  persisted shape" design (7f40ed0) is retired; "the shape as it would
  be written" is conformedOf's responsibility — carried by the three
  report repositories (refcheck / verification / design). Verdicts
  derive from conformedOf in every mode, and store runs the same
  conformance internally, so stdout can still never contradict the
  file. The findById∘store byte identity and the never-write-
  nonconforming invariant stand.
- **Callers follow**: the four verify and three refcheck use cases move
  to "query, then void store"; the #persist helpers return
  Result<void>. Both InMemory doubles follow the port contract
  (conformedOf included).
- **Enforcement**: `commandsReturnVoid` joins ALL_RULES (red/green
  examples) — a store under usecase/port/ returning anything but
  Result<void> flags.

Evidence: 397 pass / 1 skip / 0 fail with the per-file 90% floor,
goldens untouched, parity `diff -r` empty (neither written bytes nor
verdict values moved), validator Errors: 0, 7 harness builds.

## z3 witness determinization — the GC-driven release wobble is sealed structurally (2026-09-01, #28)

The mechanism behind the rare, load-only wobble of constraint-free
witness values (seen once during the PR1 ritual: the SM-1/TR-3/TR-4 gap
`ticket.priority` came back 0 instead of the golden 1) is identified and
sealed.

- **The mechanism**: z3-solver's high-level API issues `dec_ref` through
  a FinalizationRegistry when a JS wrapper is GC'd. Load-dependent GC
  timing perturbs z3's internal release and id/arena reuse pattern,
  shifting search order — and only **constraint-free** variables can
  change value (fully-bound witnesses cannot, matching the
  observation).
- **The fix**: the child retains every wrapper it creates (solver,
  assumptions, model, eval results, unsat core) for its whole run, so
  no `dec_ref` fires mid-run. This reproduces the light-load (no-GC)
  allocation pattern under every load, so golden bytes are unchanged by
  construction.
- **Reproducibility record**: stress at 24 iterations × 14 hogs
  (normal) plus a 64MB child heap (provoked GC) was golden-identical
  on every run both before and after the fix — the original 1-in-~15
  event did not reproduce under these stimuli. The ruling is therefore
  mechanism-sealing plus a standing net, not wait-for-repro.
- **The net**: `scripts/smt-stress.ts` (opt-in; exits 1 on divergence;
  `NODE_OPTIONS="--max-old-space-size=64"` for the provoked-GC mode)
  is permanent, and the per-PR parity harness keeps watching every
  observable surface. On recurrence, reopen #28 and move to witness
  normalization (pinning free variables to minima — a requirements-
  level decision that revises goldens).

Evidence: full suite green, goldens untouched, base↔head parity
`diff -r` empty, stress 48/48 byte-identical, validator Errors: 0,
7 harness builds.

## The no-backward-compat ruling — no path exists to rescue old artifacts (2026-09-01)

Under the owner ruling "delete backward-compatibility code", the whole
tree was audited. One deletion qualified: the doctor's **mtime
fallback** — the path that rescued pre-anchor models (no sourceDigest)
with an mtime comparison. ir-valid's `SourceAnchor` enforces
sourceDigest as mandatory, so an anchor-less model is invalid under the
current contract — that path existed solely for old artifacts. After
the deletion, **no anchor means unconditionally stale** (the
re-verification stamps the digest). `VerificationStaleness` becomes a
pure sourceDigest judgment and `VerificationTarget` drops its mtime
material.

**Ruled not backward compat** (and kept): the authored default for a
missing stage frontmatter (a degradation contract), the node→bun
runtime fallback (availability), `findingTarget(fallback)` (material
selection for malformed input), kind-rank's "order compatibility" (a
machine-proved guarantee, not code), and install.ts's tombstones (the
anti-compat machinery that *removes* legacy remnants — kept together
with its append-on-retire discipline).

Evidence: full suite green with the coverage floor, goldens untouched,
doctor stdout byte-identical on both baselines (dev repo and the design
fixture — the behavior change is confined to genuinely old artifacts),
validator Errors: 0, 7 harness builds.

## The master-servant ruling — getters are for I/O contexts; the model must be commandable (2026-09-01, #71)

A property-only interface cannot be commanded, so callers pump the data
out and judge it themselves — the master-servant inversion of the
domain-model pattern (an anemic domain model). The ruling: **getters
(property reads) belong only to contexts that do I/O with the model
(serializers / parsers / presenters / compilers — the model⇄bytes
boundary) and to construction doors (Seeds). Reading model properties
to make decisions in the domain or usecase layer is a Tell-Don't-Ask
violation.** The measured inventory — ~1,197 sites across 142 files —
is inverted in waves under the #71 ledger (class-ification with `#`
fields makes violations physically impossible at the tsc level: that is
the enforcement mechanism).

- **Wave 1 (the archetype)**: `IrAttributeDecl` and
  `DesignAttributeDecl` become commandable classes. The judgments the
  well-formedness twins used to pump out — the three bound states
  (missing / inverted / outside the safe range), binding fit, enum
  literal membership, the machine state face — are owned by the
  declaration itself; the judges own only the wordings (the frozen
  surface) and their order. The catalogues drop the interim
  `AttributeType` struct and hold the declarations; the `new
  Set(values)` film folds into `enumStates()`/`includes`.
- Wordings and emission order are verbatim — proven by untouched
  goldens and an empty base↔head parity `diff -r`. Both classes sit at
  100% under the 90% floor.

Evidence: 398 tests / 0 fail, goldens untouched, parity empty,
validator Errors: 0, 7 harness builds.

## The master-servant addendum — a getter-only type is a data model, not a domain-layer citizen (2026-09-01, #71)

A rejection ruling on the `*Seed` interfaces I (the implementer) minted
in wave 1. A domain object is getters plus domain behavior; **a
getter-only type is a data model** — and placing one in the domain
layer violates the layer's reason to exist. Wave 1's carve-out
("legitimate because it is the construction door's argument") is
withdrawn.

- **The correct shape**: a door's argument travels as the door
  signature's anonymous inline parameters, not as a named type — nobody
  calls a function's parameter list a data model, and the domain layer
  gains no getter-only citizen. Adapters pass literals structurally; no
  name is needed.
- **Applied immediately**: the four Seeds minted in waves 1–2 (the
  attribute-decl twins and the verdict twins) are dissolved into inline
  `reconstitute` signatures.
- **Rolled out**: dissolving every pre-existing `*Seed`/`*Composition`
  joins the #71 ledger as wave 7 (purging getter-only types from the
  domain layer). The only exemptions left are I/O contexts (adapters)
  and `Expression` (the permissive published language — already ruled).

Wave 2 (same PR): the verdict twins (`SmtQueryVerdict` /
`RefinementQueryVerdict`) become commandable classes — status
classification (`isSat`/`isUnsat`/`isUndecided` — the scattered
three-state enumeration was the soil of #34 item 3's triplicate bug)
and the witness material faces (`witnessModel`/`witnessTrace`/
`coreLabels`/`sortedCore`) are owned by the verdict itself. Wordings
and emission order are verbatim — proven by untouched goldens and an
empty parity diff.

## The master-servant MECE fence — a complete partition and a shrink-only ledger (2026-09-01, #71)

Fixing spots as they were pointed at, and an inventory that counted only
`export interface`, were both non-MECE — this records that rejection.
The domain layer's exported types are re-partitioned completely:
**211 behavior classes / 122 diseased (102 getter-only interfaces, 19
record unions, 1 object type alias) / 6 closed string vocabularies / 1
published (Expression)**. Record unions (`RefinementProbe`,
`VerificationWitness`, the `*Outcome` family, …) are getter-only data
models too and join the ledger as the same disease.

- **The fence**: `noDataModelsInDomain` joins ALL_RULES (red/green
  examples) — it detects getter-only interfaces, object aliases, and
  record unions in the domain layer. The full starting inventory of 122
  files is enumerated in `DATA_MODEL_DEBT` (shrink-only — growing it is
  a ruling violation, the LEGACY_FILES discipline), and every wave that
  reclaims a type deletes its entry. **New inflow is blocked by CI and
  the remaining debt is visible in the ledger** — structurally
  preventing spot-fix relapse.
- Some discriminated unions (`DesignValue`, `VerificationWitness` — the
  value/witness payload vocabularies) are candidates for the
  published-language exemption; each wave rules on them individually,
  and an exemption moves the name to the permanent list beside
  Expression (never silently off the ledger).

Evidence: 399 tests / 0 fail, goldens untouched.

Wave 3 (same PR): the obligation/scenario twins and their decls across
all three stages (`Obligation`, `Scenario`, `IrObligationDecl`,
`IrScenarioDecl`, `DesignObligation`, `DesignScenario`,
`DesignObligationDecl`, `DesignScenarioDecl`, `DesignTransitionDecl`,
`RefinementObligation`, `RefinementScenario`) become commandable
classes, and `DesignTemporalDecl` dissolves into the door signature of
`DesignObligationDecl`. 12 ledger entries are reclaimed — the
shrink-only ledger now holds 110 of the 122-file starting inventory
(the docs record the start; the ledger records what remains).

Wave 4 (this PR): the background-decl twins (`IrBackgroundDecl` /
`DesignBackgroundDecl`) become commandable — the caller no longer
decides `assert !== undefined` nor hardcodes `primesAllowed = false`;
each declaration owns its expression enumeration through
`inspectExpressions` (background assertions never allow primes, and
that invariant now lives in the declaration, not in the well-formedness
loops). 2 ledger entries reclaimed — the ledger holds 108 of 122.
`BackgroundAssumption` / `DesignBackgroundAssumption` /
`LoweredBackground` stay on the ledger: their consumers are adapters
projecting to external forms (sanctioned), pending a per-wave ruling.

Wave 5 (same PR): `AttributeMapping` owns its alpha-substitution
material (enum-comparison expansion, reference substitution, the
abstract-frame equality) and its totality checks (missing cases,
produced values outside the requirements values) — `AlphaContext`
keeps only the index and the uncovered-attribute detection, and
`UnitRefinementPlan` keeps only the gap wordings. And the compile-down
semantics of `DesignTransition` / `DesignIgnore` (implicit
`state==from` guard ∧ `state'=to` effect; ignore ⇒ explicit no-op
event) move from the two duplicated assembly sites
(`buildLowering` and `DesignEventCatalog.of`) into the types
themselves. 3 ledger entries reclaimed — the ledger holds 105 of 122.

Wave 6 (same PR): `Component` / `ComponentEntity` / `ComponentRef`
become commandable — the component declaration owns its name shape
(DD-1 PascalCase) and its self-dependency detection (DD-3, through
`ComponentRef.pointsAt`), the entity owns the identifier presence
that makes it ownable (DD-5), and the collection owns the duplicate
pairing (DD-1) and the multi-owner grouping (DD-5) that used to live
in `ComponentCheckMaterials` as a seen-map walk and an owners-map
walk. The materials keep only the frozen finding wordings.
3 ledger entries reclaimed — the ledger holds 102 of 122.

Wave 7 (same PR): `DesignFinding` / `DesignMachine` become commandable.
The finding owns the refinement reinterpretation of conflict verdicts
(a conflict whose targets reach the requirement ids ascends to
`refinement-violation` — frozen wording, frRefs and witness carried;
a conflict that misses them stays a design conflict and feeds the
masked-skip accounting) and the detail-only clone behind the
mutual-redundancy fold. The machine owns the unreachable-probe
candidate selection (declared enum values minus the initial states,
ascending — the very order the capability-skip wording enumerates)
and the deterministic:false waiver verdict (every conflict target is
this machine's own transition and nondeterminism was declared). The
quint usecase and the remap pass now tell instead of ask.
2 ledger entries reclaimed — the ledger holds 100 of 122.

Wave 8 (same PR): `QuintMachineRunVerdict` becomes commandable. The
machine-phase verdict owns the phase-2 guard the quint adapter used
to ask about (a timeout or a failed run aborts every machine target,
so the temporal phase never runs them), the per-target skips the
interpretation assembled by kind (the frozen budget wording for a
timeout, the verify/run failure wording per method for a failed run
— the CLI output tail carried verbatim, target order preserved), and
the witness material (the decoded step trace, with the empty-model
fallback for a deadlock the CLI left no ITF for) together with the
final state the invariant attribution evaluates. The adapter
reconstitutes through named factories and the interpretation tells
instead of asking.
1 ledger entry reclaimed — the ledger holds 99 of 122.

Wave 9 (same PR): two dead fields fall. `DesignIgnore` stops carrying
`reason` — the design IR keeps it as a required human-approval note on
the document (contract 3), but nothing downstream ever read it off the
domain object, so the parser stops lifting it and the type sheds the
field. `QuintMachineComponent` sheds `frRefs` — the compiler copied the
obligation's requirement refs onto every invariant component, yet the
interpretation attributes findings through `RequirementsModel.frRefsOf`
over the component ids, so the copy was never read. No ledger entry is
reclaimed — the ledger still holds 99 of 122.

Wave 10 (same PR): the target vocabulary gets its primitive. Ruling A
had left the cross-aggregate target token without one — the
`FrRefClaim.owner` carve-out let `TargetIds`, `IdOrder`, the component
ids, `machineTargets`, the skip targets and `frRefsOf` all stay raw
strings. `TargetId` lands in the kernel: `parse` checks the findings
schema's `targetId` shapes (OB/SC, BR, the design DOB/DSC/DBG/SM/TR ids,
the namespaced tokens), `reconstitute` is the verbatim door for frozen
documents and raw id materials, and the id owns its canonical order
(`compareTo`, delegating to `IdOrder`). `TargetIds` becomes a collection
of `TargetId` (`of` over primitives, `reconstitute` over raw ids,
`toStrings` at the boundary, `sortedCanonically` beside the unique
form), and the requirements verification vocabulary speaks it end to
end: `QuintMachineComponent` becomes commandable (its id is the
`ObligationId` it descends from, the attribution evaluation is its own
knowledge), `machineTargets`, the machine verdict's skips,
`VerificationSkipped.target`, `RequirementsModel.allTargets` /
`frRefsOf` (now returning `FrRefs`), the SMT interpretation, the
degraded reports and the cross-check carry `TargetId`; `QuintRuns` looks
up by `ObligationId` / `ScenarioId` and the facts hold scenario ids. The
obligation and scenario ids gain `asTargetId`. Design, refinement and
refcheck reconstitute their target lists from raw ids until their own
waves (`DesignSkipped.target`, `SiblingVerdictFinding.targets` and the
refcheck ledger's namespaced tokens stay strings, `TargetIds.safe` stays
that ledger's sanitizer). The pass surfaced that bun's `toEqual` ignores
private fields, so the touched skip expectations now compare through
`asString()`; wording, order and goldens are unchanged.
1 ledger entry reclaimed — the ledger holds 98 of 122.

Wave 11 (same PR): Ruling A gets its mechanical check. Until now the
"domain primitives everywhere" ruling was applied by hand (PRs #54–#60)
and nothing stopped a raw string from drifting back onto a domain
object — the wave-10 target vocabulary was one such drift. The
architecture suite now runs `no-primitive-fields-in-domain`: every
string / number field (scalars, arrays, sets, maps keyed by or holding
them) on a domain class or a public interface / type alias is a
violation unless the ruling excludes it — booleans, the primitive
wrapper itself (a class whose only field is `#value`), prose (`detail`,
`reason`, `message`, … and their lists), state tokens (`state`, `from`,
`to` and the declared-value / initial-state collections), the design
`attrPath`, the `Expression` published language and `FrRefClaim.owner`.
The starting inventory is a shrink-only ledger, `PRIMITIVE_FIELD_DEBT`:
68 domain files carrying 108 primitive fields, and a stale-entry guard
fails the suite as soon as an entry no longer carries one, so the
ledger can only shrink. Known limits: non-exported type aliases (Result
error materials) and index-signature records are not inspected. Open
for a ruling: index maps keyed by a primitive's string form
(`ReadonlyMap<string, …>` behind DP doors), classification strings
(`kind`, `method`, `nature`, `pattern`), the doctor rows, and the
numeric metadata the ruling deferred. DATA_MODEL_DEBT is untouched — the
ledger holds 98 of 122.
