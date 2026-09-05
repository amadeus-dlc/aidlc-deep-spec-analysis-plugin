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
The starting inventory is a shrink-only ledger, `PRIMITIVE_FIELD_DEBT`,
kept field by field (a descriptor `name: type` per file): 68 domain
files carrying 107 distinct primitive fields. A new primitive field in
a ledgered file is a violation, and a stale-entry guard fails the suite
as soon as a ledgered descriptor is no longer detected, so the ledger
can only shrink (the file-level first cut and the initializer blind
spot `#x: string = …` were review findings, fixed in the same PR; a
second round added the unindented, definite-assignment `#x!: T` and
untyped-initializer `#x = 0` forms, and a frozen descriptor ceiling,
`PRIMITIVE_FIELD_DEBT_CEILING`, that turns any addition to the ledger
into a visible edit — lower it when the ledger shrinks, never raise it). Known limits: non-exported type aliases (Result
error materials) and index-signature records are not inspected. Open
for a ruling: index maps keyed by a primitive's string form
(`ReadonlyMap<string, …>` behind DP doors), classification strings
(`kind`, `method`, `nature`, `pattern`), the doctor rows, and the
numeric metadata the ruling deferred. DATA_MODEL_DEBT is untouched — the
ledger holds 98 of 122.

Wave 12 (same PR): the design and refinement skip vocabulary speaks
`TargetId`. `DesignSkipped.target`, `DesignUnit.allTargets` and
`RefinementRequirements.allTargetIds` carry the primitive (the design
machine id gains `asTargetId`; the requirement ids already had it), the
design skips sort through `compareTo`, the degraded design reports, the
cross-check, the quint / SMT design use cases, the refinement plan and
solver facts tell instead of assembling strings, and the serializer
reconstitutes. `SiblingVerdictFinding` carries `FrRefs` and lowered ids
(`LoweredId[]`) instead of raw arrays, so the remap pass maps through
`asString()` at the one boundary where the lowering index is still
keyed by strings. Three primitive-field descriptors leave the ledger
(104 remain); DATA_MODEL_DEBT is untouched at 98 of 122.

Wave 13 (same PR): the design IR declarations stop being data models.
`DesignEntityDecl`, `DesignIgnoreDecl`, `DesignMachineDecl` and
`DesignUnitDecl` — the well-formedness materials the adapter's tolerant
parse hands to the judge — become commandable classes with private
constructors and `reconstitute` doors, and the judgements the judge used
to make by reading their fields move onto them: the entity walks its
attributes with the coordinate and the duplicate flag
(`inspectAttributes`), the ignore knows whether its state belongs to the
machine's state set and its transition cell key (`isStateAmong`,
`cellKey`), the machine selects the initial states outside the state set
in declaration order (`initialStatesOutside`), and the unit owns the
construction-directory judgement (`lacksConstructionDirectory`). The
judge keeps only the frozen wordings and their order; the adapter and
the tests reconstitute. 4 ledger entries reclaimed — the ledger holds 94
of 122.

Wave 14 (same PR): the last declaration-shaped data models fall.
`IrEntityDecl` (requirements) walks its attributes with the coordinate
and the duplicate flag, exactly as its design twin does, and the model
well-formedness judge tells it instead of reading `name` and
`attributes`; `IrTemporalDecl` owns the assert → from → to expression
walk (primes forbidden) that `IrObligationDecl.inspectExpressions` used
to spell out over its fields; the refcheck `UnitDecl` owns the CD-3
edge selection (`declaredDependencies`: the depends_on names in value
order, dangling edges dropped as units-generation's problem), so the
contract materials iterate a told list instead of filtering. The
adapters and the tests reconstitute. 3 ledger entries reclaimed — the
ledger holds 91 of 122, and no `*-decl.ts` remains on it.

Wave 15 (same PR): the seeds dissolve. Every remaining `*Seed`
interface — twenty-five across design, refcheck, refinement and
requirements — was a getter-only shape whose only reader was the
aggregate it seeded. Following the wave-2 precedent, each one dissolves
into the anonymous inline signature of its door (`private constructor`
and `of` / `reconstitute` spell the props type themselves), the seed
file and its facade export go, and the four outside references (the
formal-model parser, the design-record repository, and two pipeline
tests) name the door's parameter type instead. Seven of the seeds also
carried ledgered primitive fields, so `PRIMITIVE_FIELD_DEBT` sheds their
descriptors (ceiling 104 → 93). 25 ledger entries reclaimed — the ledger
holds 66 of 122.

Wave 16 (same PR): the single-reader shapes dissolve the same way. The
three `Interpreted*Verdicts` return types, the two report
`*Composition` door types, `DesignModelComposition` and `RemappedUnit`
each had exactly one reader in their own layer; each becomes the inline
signature of that reader (the interpretation's return type, the
`compose` door, the remap's return type), the design-model parser and
its pipeline test name `DesignModel.compose`'s parameter type, and the
files and facade exports go. Three of them carried a ledgered `method`
string, so `PRIMITIVE_FIELD_DEBT` sheds those descriptors (ceiling 93 →
90). 7 ledger entries reclaimed — the ledger holds 59 of 122. What
remains on it is record-shaped and multi-reader (findings, skips,
witnesses, anchors, rows, outcomes, verdict unions), the material for
commandable waves rather than dissolution.

Wave 17 (same PR): the skip records become commandable. `VerificationSkipped`
(requirements), `DesignSkipped` (design) and `Skipped` (refcheck) invert
from getter-only interfaces into classes with private constructors and
`reconstitute` doors; each owns its canonical order (`compareTo` — target
then reason, the design one unit first — so the three skip collections
sort by delegation instead of reading fields) and the requirement and
design records own "is this skip for that target" (`isFor`), which the
quint interpretation and the degraded SMT report used to spell out with
`target.equals`. Every producer — the quint / SMT compilers and
interpretations, the machine verdict's skips, the degraded reports, the
design use cases, the refinement plan and solver facts, the refcheck
ledger — reconstitutes; the serializers read through the accessors and
reconstitute on parse; the tests compare through `asString()` and the
accessors. The refcheck target stays the namespaced string token (its
own ledger material). 3 ledger entries reclaimed — the ledger holds 56 of
122; `PRIMITIVE_FIELD_DEBT` keeps its total (the two ledgered `unit`
fields merely change shape).

Wave 18 (same PR): the finding records join `DesignFinding`.
`VerificationFinding` (requirements) and `Finding` (refcheck) invert
into commandable classes; each owns the material of its canonical
order (`compareWithin` — the kind rank stays with the collection that
owns the rank table, the record supplies the joined-targets and detail
tie-breaks), the requirement finding owns `isKind` and `implicates`
(the cross-check used to read `kind` and `targets.includes`), and the
refcheck finding carries its witness refs behind `witnessRefs`. The
quint / SMT interpretations, the cross-check and the refcheck ledger
reconstitute; the serializers read through the accessors and
reconstitute on parse. The tests project findings to plain records
before comparing (bun's `toEqual` ignores `#private` fields), which
also makes the frozen-wording assertions real rather than vacuous.
2 ledger entries reclaimed — the ledger holds 54 of 122;
`PRIMITIVE_FIELD_DEBT` keeps its total (three ledgered `kind` / `unit`
fields change shape).

Wave 19 (same PR): the small payload records become commandable.
`WitnessRef` (refcheck) owns its evidence coordinate (`pointsAt`);
`InputAnchor` (refcheck) and `DesignInputAnchor` (design) own the
artifact order of `inputs[]` (`compareByArtifact`, the collections sort
by delegation); `CrossCheckedEntry` (requirements) and
`DesignCrossCheckedEntry` (design) own the backend order of
`crossChecked[]` (`compareByBackend`). The refcheck materials' `ref`
helpers, the record and refinement-materials repositories, the reports
and the serializers reconstitute; the serializers read through the
accessors. 5 ledger entries reclaimed — the ledger holds 49 of 122;
`PRIMITIVE_FIELD_DEBT` keeps its total (the ledgered `artifact` /
`element` / `value` strings change shape — they remain record-relative
artifact names and element paths, candidates for their own primitives).

Wave 20 (same PR): the lowered v1 payload stops being data models.
`LoweredObligation`, `LoweredScenario`, `LoweredBackground` and
`LoweredOrigin` (design) invert into commandable classes: the obligation
knows whether it is an event, the scenario knows accept from reject,
and the origin owns what the remap used to ask by reading `kind` and
`pair` — whether it is a synthetic vacuity probe (`isSyntheticProbe`,
`isKind`) and the pair a shadow probe stands for (`pairRefs`, a lone
origin pairing with itself, the frozen fallback). The lowering, the
lowering index, the quint use case's refinement pass and the lowered
document serializer reconstitute and read through accessors; the
rendered v1 document is byte-identical. 4 ledger entries reclaimed — the
ledger holds 45 of 122; `PRIMITIVE_FIELD_DEBT` drops to 88 (two
descriptors that lived inside nested record types disappear with the
shape change).

Wave 21 (same PR): the quint temporal and scenario verdicts join the
machine verdict. `QuintTemporalVerdict` (timeout / violation / clean) and
`QuintScenarioVerdict` (timeout / run-failed / evaluated) become
commandable abstract data types with named factories: each owns the skip
the interpretation used to assemble by kind (`skipFor` — the frozen
budget wording, the run-failure wording with the CLI output tail
verbatim) and its verdict face (`isViolation` with the trace witness;
`isViolated`, true only for an evaluated verdict). The quint adapter
constructs through the factories and `QuintMachineFacts.interpret` tells
instead of branching on `kind`. 2 ledger entries reclaimed — the ledger
holds 43 of 122.

Wave 22 (same PR): the refinement plan's statuses and probes, and the
sibling-verdict skips, own their judgements. `RefinementStatus`
(checkable / waived / gap / capability) replaces the status union: the
plan asks `isCheckable`, reads a gap through `gapDetail`, and orders the
status to produce its own skip (`skipFor` — the waived reason and the
capability wording, verbatim) instead of switching on `kind` at three
sites. `RefinementProbe` (invariant / enabledness / simulation /
scenario) replaces the pending-question union: the solver facts
interpret a verdict through `match`, and only the simulation handler is
handed the design transition — the type carries the pair the old union
left optional. `SiblingVerdictSkip` becomes a class so the verdict remap
asks it for target, reason and detail. 3 ledger entries reclaimed — the
ledger holds 40 of 122.

Wave 23 (same PR): the sibling backend's answer and the refinement map's
acquisition own their interpretation. `SiblingVerdictDocument`
(unreadable / unavailable / readable) replaces the document union: the
verdict remap interprets it through `match`, and the two verify use cases
ask `unavailableReason` instead of reading `kind` and `reason`.
`SiblingVerdictFinding` becomes a class that answers `isKind` and remaps
its own unsat-core witness (`witnessWithCoreRemapped`), so the remap no
longer inspects the witness shape. `RefinementMapAcquisition` (absent /
loaded) replaces the acquisition union: both use cases interpret it
through `match`, and the loaded map's artifact travels as an
`ArtifactPath` instead of a string — one primitive field leaves the
field ledger. 3 ledger entries reclaimed — the ledger holds 37 of 122;
the primitive-field ceiling drops to 87.

Wave 24 (same PR): the refinement map's records own their judgements.
`RefinementUnitMap` answers `isForUnit` and hands the plan the event
mapping of a trigger (`eventMappingOf`); `EventMapping` answers
`isForTrigger` and `waiverReason` in place of the optional `waived`
record the plan used to test; `UnmappedTarget` answers `isFor` so the
declaration set no longer compares raw tokens; `RefinementAttribute`
answers `isAt`, `isEnum` and `declaredValues` — its `min` / `max`, parsed
but never read, are dropped. `DesignEvent` hands the SMT compiler its
guard and the assigned right-hand side of an attribute
(`assignedRhsOf`), and `RefinementQuintInvariant` names its target and
builds the lowered invariant obligation the quint pass ships
(`loweredAs`), so the use case no longer assembles it. The
`RefTokenCarrier` alias dissolves into the declaration set's door
signatures. 7 ledger entries reclaimed — the ledger holds 30 of 122.

Wave 25 (same PR): the requirements model's declarations own their
judgements. `AttributeDeclaration` (bool / int / enum) hands the SMT and
quint compilers the material of its kind through `match` — the bounds of
an int, the declared values of an enum — instead of the compilers
switching on `kind` and testing optional fields; `isBool`, `isInt`,
`isEnum`, `isAt` and the bound accessors serve the remaining reads.
`BackgroundAssumption` and `DesignBackgroundAssumption` answer `id` and
`assertion`; the design one orders itself canonically (`compareTo`).
`FrRefClaim` registers its owner into the reverse index (`claimInto`),
so the index no longer reads owner and refs. `SmtEventPairProbe` pulls
its own overlap and joint verdicts from the results and names its two
targets, so the plan facts no longer read query ids. 5 ledger entries
reclaimed — the ledger holds 25 of 122.

Wave 26 (same PR): the refcheck outcomes and rows own their
interpretation. The seven parse outcomes (`ComponentCatalogOutcome`,
`ContractsTableOutcome`, `DeclaredUnitsOutcome`, `DomainEntitiesOutcome`,
`EntitiesOutcome`, `FunctionalSpecOutcome`, `RulesOutcome`) become
commandable classes with named factories: the check materials interpret
each through `match` — the absent, wrong-fence-count, unparseable and
extracted branches keep their frozen skip and finding wording, and the
extracted material now arrives as a handler argument instead of a field
read behind a `kind` test. A parse line travels as a `LineNumber`, so
three primitive fields leave the field ledger. `SpecBlockAssessment`
names its own block id and location label and interprets its issue
through `matchIssue`; `ContractRow` answers `connects` for the DAG edge
check and builds its own location label; `ShapeError`,
`ComponentShapeError` and `EntityReference` become classes the checks
ask. 12 ledger entries reclaimed — the ledger holds 13 of 122; the
primitive-field ceiling drops to 84.

Wave 27 (same PR): the doctor's rows own their judgements. `Check`
becomes a class that answers `passes`, `label`, `fix` and `severity`
and writes its own document row (`toDocument`, the frozen property
order), so the health verdict no longer exposes the raw records. The
coverage rows (`CoverageRow`, `UnitCoverageRow`, `RefinementStaleRow`)
interpret their state through `matchState` and build their own intent
and unit labels; `DebtRow` answers `findingCount` and its location
label; `DigestAnchor` decides `isStale` itself; `ManifestEntry` is
minted through `error(rel)`; `InstalledStatus` and `SolverAvailability`
answer presence questions. The presenter keeps every frozen label and
fix but no longer reads fields. 9 ledger entries reclaimed — the ledger
holds 4 of 122: the JSON value shapes (`DesignValue`, `DecodedValue`,
`TraceState`, `VerificationWitness`), ruled on in the next wave.

Wave 28 (same PR): the ledger closes. `VerificationWitness` — the
contract-2 witness (unsat core / decoded model / per-backend verdicts /
step trace) — becomes a class with one factory per face and a single
document door (`toDocument`, verbatim; `fromDocument` keeps the frozen
blind cast with the empty-core default), so the quint verdicts, the
SMT plan facts and the cross-check mint witnesses instead of assembling
records and the serializer asks the witness for its document. The three
remaining entries are ruled on rather than converted: `DesignValue` and
`DecodedValue` are the recursive JSON value type itself and `TraceState`
is the `witness.trace[i]` map (attribute path → decoded value); none of
them has a getter or can carry behaviour, because the findings schema
fixes their shape. They join `Expression` under a named permanent
exclusion, `PUBLISHED_VALUE_SHAPES`, which the data-model rule skips —
unlike the ledger, it is not a debt to shrink. `DATA_MODEL_DEBT` is now
empty (122 → 0) and stays shrink-only, so any new record in the domain
fails the rule outright. The primitive-field ceiling drops to 83.

## Domain-object taxonomy ruling — entities, value objects, first-class collections and domain events; everything else by human ruling (2026-09-02)

The owner ruled the closed set of domain-object kinds that may live in
`tools/*/domain` without a further ruling:

- **Entities** — either a *local entity* (identity inside its aggregate)
  or an *aggregate root* (the global entity a repository port finds by
  id: `DesignModel`, `DesignRecord`, `RequirementsModel`,
  `RequirementsSource`, `RefinementMap`, `RefinementMaterials`,
  `IrValidationMaterials`, `DesignIrValidationMaterials`, and the
  report aggregates).
- **Value objects** — domain primitives, records with behaviour, and the
  commandable abstract data types (verdicts, outcomes, statuses).
- **First-class collections** — the wrappers that hide an array, a set
  or a map behind collection knowledge.
- **Domain events** — the immutable records of something that happened
  in the domain, named in the past tense and raised by an aggregate.
  The baseline audit found none in the current domain layers (the
  `*Event` names there — `DesignEvent`, the event obligations — are the
  IR's vocabulary for guarded transitions, i.e. value objects).

Everything else is not implemented on the agent's own judgement:

- A **domain service** (a stateless operation that belongs to no entity
  or value object) is admitted only by an explicit human ruling, case by
  case.
- **Any other kind of domain object** — a "facts", "materials",
  "context", "ledger" or "plan" object, a companion (static-only) class,
  a free function, an exception type, a generic record — is brought to
  the owner with a *measured* problem (numbers from the codebase) and the
  proposed countermeasure, and is implemented only after the ruling.

The wave ritual reports every domain file that cannot be classified as
one of the four kinds. The baseline audit of 2026-09-02 (296 exported
classes, 1 free function, 11 type aliases under `tools/*/domain`) found
the following citizens outside the four kinds; each awaits the owner's
ruling and none is changed by this entry:

- Companion (static-only) classes, i.e. domain services in class form:
  `IdOrder`, `Expressions`, `Names` (kernel), `ExpressionCanonicalKey`
  (design), `ExpressionEvaluation` (requirements). Their comments cite an
  "OOUI ruling" that has no written entry in this file.
- A free function: `designWellFormednessErrors` (design).
- Object-form services and interpreters: `SmtPlanFacts`,
  `QuintMachineFacts` (verdict interpretation), `UnitRefinementPlan`
  (planning), `AlphaContext` (substitution), `ComponentCheckMaterials`,
  `ContractCheckMaterials`, `FunctionalCheckMaterials` (check runners).
- A mutable accumulator with commands and queries but no identity:
  `CheckFamilyLedger` (refcheck).
- An exception type in the domain: `AlphaError` (refinement).
- A getter-only generic record that escapes the data-model rule because
  the rule's interface pattern does not accept a type parameter:
  `LoadedDocument<Outcome>` (refcheck) — a rule gap as well as a citizen
  to rule on.
- Classification string aliases already listed as pending under the
  primitive-field ledger: `LoweringKind`, `CheckSeverity`,
  `CoverageState`, `CheckExecutionMode`, `RefinementQueryStatus`,
  `SmtQueryStatus`.

Indexes over maps (`LoweringIndex`, `BrReferenceIndex`,
`FrReferenceIndex`, `SiblingUnitIndex`, `DesignEventCatalog`) are read as
first-class collections and need no ruling.

## Domain-object taxonomy — the 22 rulings on the baseline audit (2026-09-02)

The owner ruled on every citizen the baseline audit found outside the
four kinds, one at a time, each against the measured facts. Five
disciplines emerged with the rulings and bind future work:

- **Invariants**: consistency is guarded by entities and value objects
  as their own invariants; a domain service that merely packages a
  check procedure is not made.
- **Identity**: an element a collection looks up by key needs identity
  and is therefore an entity (`AttributeMapping`, keyed by its
  requirements attribute path, is a local entity); value objects are
  only for what cannot be identified.
- **Naming**: the word *facts* is reserved for domain events — things
  that happened. A compiler's lookup table is a *plan*.
- **Domain errors**: a domain error type is a domain-layer model, so its
  type and variants must map to the ubiquitous language; an expected
  failure is returned as a `Result` value, not thrown.
- **Read models**: a CQRS read model — a projection folded from the
  write side for presentation or query — is not a domain-layer citizen
  and lives on the query side (`usecase`).

The rulings, in queue order (implementation follows in waves; nothing
in the code changes with this entry):

1. `IdOrder` — dissolve into the value objects: a private kernel helper
   behind the DPs' `compareTo` and the collections' canonical sorts.
2. `Expressions` — dissolve into a kernel value object `ExpressionTree`
   (walk, prime detection, reference enumeration); `eqRef` moves to the
   equality builders (`DesignTransition`, `DesignIgnore`).
3. `Names` — dissolve into a kernel domain primitive `NormalizedName`;
   the refcheck name DPs return it and `MachineSpec.entityToken` returns
   an `EntityName`.
4. `ExpressionCanonicalKey` — dissolve into
   `ExpressionTree.isCanonicallyEqual`.
5. `ExpressionEvaluation` — dissolve into the value object
   `QuintMachineComponent.isViolatedIn` (evaluator private to it).
6. `designWellFormednessErrors` — dissolve: each `Design*Decl` judges
   its own consistency as an invariant, `DesignUnitDecls` gathers the
   cross-unit part; wording and order stay frozen.
7. `SmtPlanFacts` — a value object, renamed `SmtVerificationPlan`.
8. `QuintMachineFacts` → `QuintMachinePlan`, and the same-shaped
   `RefinementSolverFacts` → `RefinementSolverPlan` (naming rule).
9. `UnitRefinementPlan` — classified a value object; unchanged.
10. `AlphaContext` — dissolve into the first-class collection
    `AttributeMappings` (lookup by requirements path, `substitute` and
    `equalityFor` delegating to the element); `AttributeMapping` is an
    entity.
11. `ComponentCheckMaterials` — dissolve: DD-0..DD-7 become invariants
    of `ComponentCatalogOutcome` / `Components` / `Component`, and the
    aggregate `DesignRecord.checkComponents(ledger)` writes them.
12. `ContractCheckMaterials` — dissolve likewise (CD-1/CD-3 between
    `ContractRow` and `UnitDecls`, CD-2 on `SpecBlockAssessment`);
    `DesignRecord.checkContracts(ledger)`.
13. `FunctionalCheckMaterials` — dissolve likewise (FD-E / FD-R / FD-S /
    XS onto the declarations); `DesignRecord.checkFunctionalDesign`.
14. `CheckFamilyLedger` — dissolve into the aggregate root
    `ReferenceCheckReport`: `open(id, families, unit)`, `finding` and
    `skip` as the report's commands, checked-targets derivation as its
    invariant. It is the write side, not a read model.
15. `AlphaError` — dissolve into an abstract data type named in the
    ubiquitous language, `RefinementMapDefect` (uncovered attribute,
    enum mapping outside equality, unspecified mapping, effect not an
    assignment conjunction), returned through `Result`; each variant
    renders its frozen wording and knows its `compile-error` skip.
16. `LoadedDocument<Outcome>` — dissolve into the aggregate
    `DesignRecord`, which keeps anchor and outcome inside and records
    its own inputs; the `functional()` / `declaredUnits()` record doors
    go with it. The data-model rule is corrected to catch generic
    interfaces.
17. `LoweringKind` — closed into `LoweredOrigin`'s private
    representation.
18. `CheckSeverity` — a domain primitive shared by `Check` and
    `ManifestEntry` (`blocksDoctor`, `asString` for the document).
19. `CoverageState` — a domain primitive shared by the two coverage
    rows.
20. `CheckExecutionMode` — not a domain object; moved to the usecase
    input side.
21. `SmtQueryStatus` / `RefinementQueryStatus` — closed into the two
    verdict value objects' private representation; no cross-context
    sharing.
22. The doctor's `CoverageAssessment`, `UnitCoverage`, `StructuralDebt`
    and their rows — read models, moved to `doctor/usecase`; the pure
    value objects (`Check`, `CheckSeverity`, `ManifestEntry`,
    `DigestAnchor`) stay in the domain.

Wave 29 (same PR): ruling 1 lands — `IdOrder` dissolves into the value
objects. The canonical order (letter skeleton, then numeric segments)
becomes a kernel-private helper that no facade exports; the public
doors are the id value objects' `compareTo` (`TargetId`, and through
it `ObligationId`, the design ids, `TransitionRef`, `AttributePath`,
`ComponentName`) and the collections' canonical sorts (`TargetIds`,
`FrRefs.sortedUnique`, `ReqAttributeValues.sortedUniqueCanonically`).
The 25 callers that stripped a DP to a string to compare it now tell
the DP to compare itself; every collection sorts its own elements.
Goldens stay byte-identical.

Wave 30 (same PR): rulings 2, 4 and 5 land — the expression companions
dissolve into value objects. `ExpressionTree` (kernel) wraps the
published `Expression` and owns the walk, prime detection, referenced
paths, primed-assignment detection and canonical equality (the
canonical key moved in from the design layer, still byte-equal to the
kernel's canonical JSON, now proven pairwise); `asExpression` is its
only door back to the published form. The state equality the lowering
builds (`attrPath == enum(state)`) belongs to `DesignTransition` and
`DesignIgnore`, and the evaluator that decides whether an invariant
component holds in a trace state is private to
`QuintMachineComponent.isViolatedIn`. `Expressions`,
`ExpressionCanonicalKey` and `ExpressionEvaluation` are gone; the two
compilers ask the tree instead of the companion. Goldens stay
byte-identical.

Wave 31 (same PR): ruling 3 lands — `Names` dissolves into the domain
primitive `NormalizedName` (kernel). The cross-artifact matching rule
(lower-case, alphanumerics only) and equality belong to the primitive;
the four refcheck name primitives return it from `normalized()`,
comparisons ask `equals`, indexes key on `asString`, and
`MachineSpec.entityToken` returns an `EntityName` so the functional
check no longer normalizes a raw string. Goldens stay byte-identical.

Wave 32 (same PR): ruling 6 lands — the design IR's semantic
well-formedness is an invariant of the declarations. The free function
`designWellFormednessErrors` is gone: `DesignUnitDecl.wellFormednessErrors`
judges one unit (its attribute catalogue, references, enum literals,
prime legality, id uniqueness across kinds, machine coherence, brRefs
reverse verification and BR coverage, each part already answering for
itself), and `DesignUnitDecls.wellFormednessErrors` gathers the units in
declaration order behind the cross-unit invariant (no duplicate unit
name). The validate use case asks the declarations. Wording and order
stay frozen; goldens stay byte-identical.

Wave 33 (same PR): rulings 7 and 8 land — the three compiler lookup
tables stop calling themselves facts. `SmtPlanFacts` is
`SmtVerificationPlan`, `QuintMachineFacts` is `QuintMachinePlan`,
`RefinementSolverFacts` is `RefinementSolverPlan`; the ports and clients
that carried them as `facts` carry them as `plan`, and the doctor's
per-unit scan record `FunctionalUnitFacts` is `FunctionalUnitScan`. The
word *facts* is now free for domain events. Classification: value
objects; goldens stay byte-identical.

Wave 34 (same PR): ruling 10 lands — `AlphaContext` dissolves into the
first-class collection `AttributeMappings`. The collection now owns the
lookup by requirements attribute path (last declaration wins, the
frozen index behaviour), `covers`, the alpha substitution (`substitute`,
delegating expansion and reference substitution to the element) and the
abstract frame equality (`equalityFor`). `AttributeMapping` is the keyed
element and therefore a local entity (`isFor`); the plan hands the
compiler `attributeMappings()` instead of a context. One indexed field
leaves the field ledger (ceiling 82); goldens stay byte-identical.

Wave 35 (same PR): ruling 15 lands — `AlphaError` becomes the domain
error type `RefinementMapDefect`, named in the ubiquitous language and
carried as a `Result` value. Its four variants are the map's defects the
authoring guide already speaks of: an uncovered attribute, an enum
mapping used outside an equality, an unspecified mapping, and an effect
that is not a conjunction of primed assignments. Each variant renders
its frozen message and knows its public face (`asCompileErrorSkip`, the
`compile-error` skip with the frozen wording). `AttributeMappings.
substitute`, `AttributeMapping.substituteForReference` and
`EffectAssignments.ofEffect` return the defect instead of throwing; the
plan, the event catalogue and the query builder branch on `ok`, and the
builder keeps its try/catch only for the SMT compiler's own failures.
Goldens stay byte-identical.

Wave 36 (same PR): rulings 17 to 21 land — the classification string
aliases stop being domain-layer citizens. `LoweringKind` is the private
representation of `LoweredOrigin` (the tests project it through
`isKind`); `SmtQueryStatus` and `RefinementQueryStatus` are the private
representation of the two query verdicts, one per context, no sharing.
`CheckSeverity` becomes a domain primitive shared by `Check` and
`ManifestEntry` (`blocksDoctor`, `isAdvisory`, `asString` for the
document) and `CoverageState` a domain primitive shared by the two
coverage rows (`match`). `CheckExecutionMode` was never a domain object
and moves to the refcheck use-case inputs. The doctor's JSON stays
byte-identical.

Wave 37 (same PR): ruling 22 lands — the doctor's read models leave the
domain layer. `CoverageAssessment`, `UnitCoverage`, `StructuralDebt` and
their rows (`CoverageRow`, `UnitCoverageRow`, `RefinementStaleRow`,
`DebtRow`) are CQRS projections folded from the workspace for the
presenter, so they now live under `doctor/usecase/read-model/` and are
exported by the use-case facade; the pure value objects (`Check`,
`CheckSeverity`, `CoverageState`, `ManifestEntry`, `DigestAnchor`,
`VerificationStaleness`, `SolverAvailability`, `InstalledStatus`) stay in
the domain. Sixteen primitive-field descriptors leave the domain ledger
with them (ceiling 66); the doctor's JSON stays byte-identical.

Wave 38 (same PR): ruling 14 lands — `CheckFamilyLedger` dissolves into
the aggregate root `ReferenceCheckReport`. The report is the write side:
`open(id, families, unit)` opens an empty document with every family
checked, and `finding`, `skip` and `input` are its commands. The
invariant `checked = every family − failed − skipped` is kept by the
commands themselves (each finding or skip removes its family from
`checked`), and so is the canonical order (inputs by artifact, checked
unique and id-ordered, findings and skips in catalogue order) — there is
no `compose` step left to forget. The three check materials run against
the report (`runChecks(report)`), the use cases open the report, run the
checks and record the inputs, `CheckFamilies.checkTargets` replaces the
ledger's set arithmetic, and `TargetIds.excluding` is the kernel's
contribution. Goldens stay byte-identical; the field ledger is unchanged
(ceiling 66).

Wave 39 (same PR): ruling 16 lands — the design record owns its
documents and its checks. `LoadedDocument<Outcome>`, the generic record
that slipped past the data-model rule, dissolves: a loaded document is an
(anchor, outcome) pair that lives only inside `DesignRecord`, and the
rule now catches type-parameterised interfaces too. The record's view
getters (`componentCatalog`, `contractsTable`, `specBlocks`,
`declaredUnits`, `functional`) are gone; what remains readable from the
outside is the id and the source bytes for `store`. In their place the
aggregate has three gates — `checkComponents`, `checkContracts`,
`checkFunctionalDesign` — each taking the report directory: the gate
opens the `ReferenceCheckReport` itself (the check families and the
unit are the record's knowledge, which is why the report is opened
there rather than handed in), runs the checks, records every document
it read as an input, and returns the open report; a gate that does not
match the record's document answers `not-applicable` through `Result`,
the expected branch the sensor maps to its own `not-applicable`. The use
cases shrink to: resolve the record, open the gate, conform, store.
Goldens stay byte-identical; the field ledger is unchanged (ceiling 66).

Wave 40 (same PR): rulings 11, 12 and 13 land — the checks become the
declarations' own invariants, and the three `*CheckMaterials` (786
lines) are gone. Each parse outcome judges its own shape and writes the
blocked skips (`ComponentCatalogOutcome.check` for DD-0, `EntitiesOutcome`
and `RulesOutcome` for FD-E1 and FD-R1, `DeclaredUnitsOutcome` and
`ContractsTableOutcome` for the CD-1/CD-3 preconditions,
`FunctionalSpecOutcome` and `DomainEntitiesOutcome` for FD-S and XS) and
hands the content to the object that owns it: `Components.check` writes
DD-1..DD-7, `ContractRow.checkPartiesDeclared` CD-1 against `UnitDecls`,
`SpecBlockAssessment.check` CD-2, `UnitDecls.checkEdgesCovered` CD-3
against `ContractRows`, `DeclaredEntities.check` FD-E1..E6,
`RuleDecls.check` FD-R1..R5, `StateMachineSketch.check` FD-S1/S2 and
`DomainEntitySketches.check` XS-1..3. The check families live in three
small vocabulary files, `WitnessRef.at` is the door to a witness
coordinate, and the `DesignRecord` gates only call the outcomes in the
frozen order and record the inputs. Three contract-row getters nothing
read any more are deleted. Goldens stay byte-identical; the field ledger
is unchanged (ceiling 66).

With this wave every one of the 22 rulings of 2026-09-02 is implemented,
and the domain-object taxonomy programme under #71 is complete: the
domain layer holds entities, value objects, first-class collections and
domain events, and nothing else.

## Domain-object taxonomy — the residual queue is ruled, and two standing disciplines (2026-09-03)

With the 22 rulings implemented, the owner ruled the residual queue one
question at a time. Two standing disciplines came out of the session
first; the eight rulings follow. The implementation runs in five units
(not waves — the owner ruled on 2026-09-03 that the wave count stops
growing and that work closes in meaningful units): 0 this record; 1
ruling 2; 2 rulings 3-1 to 3-4; 3 ruling 4; 4 ruling 5.

**Discipline: external specifications never change.** Everything an LLM
or a human reads — the requirements IR (contract 1), the design IR
(contract 3), the refinement map, the findings documents (contract 2),
the doctor's output — is a published contract. "The tool does not read
it" is never a reason to drop a document item, nor the domain field that
carries it: `Obligation.ears` is the EARS-normalized requirement text
the authoring guide makes the LLM write and later steps make it read,
so it stays. What may be deleted is an in-memory field or getter that
corresponds to no document item and has no reader in I/O or in the
domain. The deletions of waves 22, 24 and 40 were all of that kind: none
of those commits touched a schema, an authoring guide, a stage or an
expected document, and the goldens stayed byte-identical.

**Discipline: getters are for I/O readers.** A getter stays when a
repository, serializer or presenter reads it to persist or render; it
goes when no reader is left in I/O or in the domain. Domain logic never
pulls data out through a getter to decide outside the object — that
decision is the object's own behaviour. An entity keeps its `id()`.
Removing every getter is the ideal only where nothing outside needs the
data; a getter an I/O boundary reads is not forced out.

1. **Dead in-memory fields (waves 22 and 24) — confirmed.**
   `RefinementAttribute.min` / `max` (the refinement vertical's copy of
   the IR attribute bounds, which no refinement check read; the IR keeps
   them and `IrAttributeDecl` still uses them), `DesignAssignments.count`
   and the `RefinementProbe.reqId` accessor stay deleted; whatever needs
   them later brings them back with that need.
2. **The published value shapes leak domain logic — they become value
   objects.** The audit the owner asked for found the semantics of
   `DesignValue` / `DecodedValue` / `TraceState` computed outside the
   types: `QuintMachineComponent.evaluate` decides truth (`v === true`),
   coerces numbers (`typeof v === "number"`) and compares by
   `JSON.stringify`; `DesignUnit.declaredEnumValuesOf` / `enumValuesOf`
   walk `#rawEntities` — the design IR's entity declarations held as raw
   JSON — structurally (`Array.isArray`, `attr.type.kind`, `attr.type.
   values`), which is not a witness value at all but a data model read
   from outside, hidden behind the exclusion; `LoweredUnit.remapCore`
   and `SiblingVerdictFinding.witnessWithCoreRemapped` judge the witness
   shape (`"core" in witness`) and rebuild it. Ruling: (a) `DesignUnit`
   answers enum values from its typed declarations and expels
   `rawEntities`, giving the serializer and the refinement query plan a
   typed projection; (b) `TraceState` becomes a class (`valueAt`,
   `toDocument`) over `TraceValue` (`isTrue`, `asNumber`, `equals`,
   `toDocument`), which absorbs the evaluator's helpers; (c) the design
   side's witness becomes `DesignWitness` (core / model / trace,
   `remapCore`), so no shape test remains. The three aliases survive
   only at the adapters' decode/render doors, or vanish. Goldens stay
   byte-identical.
3. **The primitive-field ledger (66 descriptors) is factored, not
   excused.**
   - 3-1, index and collection representations (33): a `Map<string, …>`,
     `Set<string>` or `readonly string[]` behind a domain door is not
     excluded — it is factored. The key is a domain primitive, the value
     a domain primitive or domain object, the table a named first-class
     collection (`SmtVerificationPlan.#compiled: CompiledObligations`,
     `isCompiled(id: ObligationId)`), and its inside is `KeyedIndex<K, V>`
     or `KeySet<K>` — two kernel representation primitives that own the
     one string-keyed map, admitted by the same reasoning as a domain
     primitive's single `#value`. Arrays of strings become arrays of
     domain primitives (`FrRefs`, `BrRefs`, `CheckedUnits`, the lowered
     records' `frRefs`, the two unsat-core label lists).
   - 3-2, classification strings (9): `FindingKind` (the schema's closed
     set of 11 with its rank order; `parse` is closed, `reconstitute`
     verbatim so the conformance degrade test keeps working; `compareTo`,
     `isConflict`), `VerificationMethod` (4) and `AttributeKind`
     (`isBool` / `isInt` / `isEnum`, `label`) are kernel domain
     primitives shared across contexts, because each is the vocabulary
     of a single published contract; the five copies of the kind rank
     table collapse to one. `Obligation.#ears` is prose (see the first
     discipline) and leaves the rule's scope as such.
   - 3-3, vocabulary strings (20): existing domain primitives are applied
     — `UnitName` (promoted to the kernel, five fields), `ArtifactPath`
     (the anchors' artifact and `ManifestEntry.rel`), `ElementPath`,
     `TargetId` (`Skipped.target`), `ObligationNature` and `TriggerName`
     (promoted to the kernel for the lowered obligation), `ContentHash`
     (four digests) — plus one new `QueryLabel` for the SMT query ids.
     `WitnessRef.#value` is the verbatim raw token kept for humans, so it
     is prose, not vocabulary.
   - 3-4, numeric metadata (3): `FenceCount` (`of`, `asNumber`) for the
     three outcomes' fence counts; the frozen wording renders through it.
   The four groups add up to 65; the 66th descriptor is `Obligation.#ears`,
   which leaves the rule's scope as prose. After 3-1 to 3-4 the ledger is
   empty.
4. **The Quint machine phase runs without invariant obligations.** Today
   `hasInvariantComponents` skips the machine run for a model with only
   background constraints and event obligations, the plan then emits
   neither findings nor skips for the machine targets, and the
   requirements report carries no `checked` list — the event obligations
   are silent and deadlocks go undetected, although the compiler already
   emits `val invAll = true`. Ruling: remove the gate. Existing goldens
   do not change (every fixture has an invariant); a background-and-events
   fixture with its golden pins the new behaviour. This is a behaviour
   change and ships in its own unit.
5. **#80, the final architecture gate, is the closing unit.** Once the
   ledgers are empty: delete `DATA_MODEL_DEBT` and `PRIMITIVE_FIELD_DEBT`
   with their ceilings and staleness guards; tighten the data-model rule
   so that any exported interface or object type with properties in the
   domain is a data model (with the `readonly a: string` + `judge()` red
   example) — the only exemption being the entries of the published-language
   table, each carried with its reason and its allowed layers (`Expression`
   today, and the representation primitives `KeyedIndex` / `KeySet`); add a rule that domain class fields are `#private`; replace
   the two name-based exclusion lists with one published-language table
   of path, reason and allowed layers, enforced on imports. Then #80
   closes.

Unit 1 (same PR): ruling 2 lands — the values own their semantics.
`TraceValue` (`isTrue`, `asNumber`, `equals`, `toDocument`) and the
`TraceState` class (`valueAt`, `toDocument`, keyed by `AttributePath`
through the new kernel `KeyedIndex`) replace the `DecodedValue` /
`TraceState` aliases; `QuintMachineComponent.evaluate` now asks the
values instead of testing `v === true`, `typeof v === "number"` and
`JSON.stringify`. `DesignWitness` (core / model / verdicts / trace /
refs, `fromDocument` / `toDocument`, `remapCore`) replaces the
`DesignValue` witness on `DesignFinding` and `SiblingVerdictFinding`;
the lowered unit hands it a label rewrite and the `"core" in witness`
test lives inside the value. `DesignUnit` holds `DesignEntityDecls`
instead of `rawEntities`, derives its attribute coordinates from them and
answers `declaredEnumValuesOf` / `enumValuesOf` from the declarations;
the adapter's `parseDesignEntities` / `renderDesignEntities` (shared by
the model parser and the validation materials) give the lowered
document and the refinement SMT context a typed projection, and
`design-pipeline.test.ts` pins that the projection reproduces every
fixture's `schema.entities` byte for byte — descriptions on entities and
attributes, int bounds and enum values included — and invents nothing.
`RefinementQueryVerdict` carries scalar decoded models. The
`PUBLISHED_VALUE_SHAPES` exemption is deleted with the three aliases;
`kernel/domain/keyed-index.ts` joins the representation exclusions.
Goldens stay byte-identical; the field ledger is unchanged (ceiling 66).

Unit 2 (same PR): rulings 3-1 to 3-4 land — the primitive-field ledger
is empty (107 → 0; the ceiling is 0 and the constant itself waits for
#80). Nothing was excused: every descriptor was factored. Two kernel
representation primitives, `KeyedIndex<K, V>` and `KeySet<K>`, own the
only string-keyed maps in the domain and join the exclusions on the
same reasoning as a domain primitive's single `#value`; every index and
set in the domain now keys by a domain primitive — `LoweringIndex`
(`LoweredId`, `DesignTransitionId`, `DesignMachineId`), `QuintRuns` and
`UnitRefinementPlan` (`ObligationId`, `ScenarioId`), the two query
verdict collections and `RefinementSolverPlan` (`QueryLabel`),
`SmtVerificationPlan` (`ObligationId`, `QueryLabel` → `TargetId`,
`TriggerName` → `TargetIds`, `ScenarioId` → `QueryLabel`),
`AttributeDeclarations`, `DesignAssignments` and `EffectAssignments`
(`AttributePath`), `DesignEventCatalog` (`TargetId`), `FrReferenceIndex`
(`RequirementId` → `TargetIds`), `RequirementIds`, `UnformalizedTargets`,
`BrReferenceIndex` and the entity-name set. The string arrays became
arrays of primitives: `FrRefs` over the new kernel `RequirementId`
(shared by the declared ids and the references — one vocabulary),
`BrRefs` over `BrRef`, `CheckedUnits` over `UnitName`, the lowered
records' `frRefs`, and the unsat cores over `QueryLabel`. The
classification strings became kernel primitives — `FindingKind` (one
rank table where five copies stood; the kind-rank test now proves the
single table's order), `VerificationMethod`, `AttributeKind` — and the
vocabulary strings took their existing primitives: `UnitName`,
`AttributePath` and `ObligationNature` were promoted to the kernel,
`ArtifactPath` anchors the inputs and the manifest entry, `ElementPath`
and `ArtifactPath` the witness coordinate, `TargetId` the refcheck skip,
`TriggerName` the lowered obligation, `ContentHash` the four digests,
`QueryLabel` the event-pair probe, and `FenceCount` the three fence
counts. `Obligation.ears` and `WitnessRef.value` are prose. The raw-string
doors are now `reconstitute`, the primitive doors `of`, and the boundary
readers `toStrings`. Goldens stay byte-identical.

Unit 3 (same PR): ruling 4 lands — the Quint machine phase runs without
invariant obligations. The `hasInvariantComponents` gate in the Quint
client is gone (and so is the method), so a model with only background
constraints and event obligations gets its event machine simulated: the
compiler already folded the background constraints and the type bounds
into `invAll`, and the phase now catches a state the events can reach
that breaks them. The new conformance fixture
`conformance/background-events` (three events, one background
constraint, no invariant) has a refund event with no floor; the frozen
golden shows the conflict over the three event obligations with the
six-step trace that drives the amount below zero — a defect the gated
phase could not see. One honest limit: Quint 0.32's `run` does not
report deadlocks (a disabled `step` just ends the trace with "no
violation"), so the deadlock branch of the plan only fires where the CLI
says so — bounded mode; in simulation what the phase newly detects is
the reachable violation of background constraints and type bounds. The
existing goldens are unchanged (every fixture carries an invariant); the
new golden is deterministic under the fixed seed.

Unit 4 (same PR): ruling 5 lands — #80, the final architecture gate,
closes. The shrink-only ledgers are gone: `DATA_MODEL_DEBT`,
`PRIMITIVE_FIELD_DEBT` and its ceiling are deleted with their staleness
guard, and so are the name-based exclusion lists (`PRIMITIVE_FIELD_EXCLUSIONS`
and, since unit 1, `PUBLISHED_VALUE_SHAPES`). What remains is one table,
`PUBLISHED_LANGUAGE`: eleven entries, each a path, the exported name, the
reason it is not a domain object (the published expression tree, the two
representation primitives `KeyedIndex` / `KeySet`, the prose collection
`ErrorMessages`, the state-token collections of declared values, initial
states and attribute paths, and `FrRefClaim` with its mixed owner token)
and the layers allowed to use it (`domain` and `adapter`; `AttrPaths`
only `domain`). Three rules make the gate: `no-data-models-in-domain`
now treats any exported interface or object type with a property as a
data model — a method beside the property is no alibi (the red example
`readonly a: string` + `judge()` is pinned) — and exempts only the table
entry at its own path; `domain-fields-are-private` flags every non-`#`
field of a domain class (public, protected, TypeScript `private`, static,
readonly — the scanner tracks brace and parenthesis depth so door
signatures and multi-line parameter lists are not fields); and
`published-language-layers` flags any file outside an entry's layers that
uses its name (use cases and entries never touch the published language
directly). The real tree passes all three with no exception. Adding a
table entry is a ruling, not a convenience.

With unit 4 every ruling of 2026-09-03 is implemented and #80 closes.

## The orphaned Apalache server — quint's cleanup runs on SIGINT, and the doctor learns to notice (2026-09-03, #128)

A bounded verification that exceeds its budget used to poison every
verification after it. The mechanism, measured end to end: quint 0.32
starts an Apalache server when none is listening on 8822 and installs
its shutdown handler on `exit`, `SIGINT`, `SIGUSR1`, `SIGUSR2` and
`uncaughtException` — **not** on `SIGTERM`, which is exactly the signal
`spawnSync`'s timeout sends by default. So the budget expired, quint died
without running the handler, and the Apalache server survived as an orphan
whose working directory was the per-run temporary directory the client
deletes in its `finally`. From then on every `quint verify` connected to
that orphan and failed with
`<deleted cwd>/_apalache-out/server/<start>/log0.smt (No such file or
directory)`; the sensor degraded its obligations to
`skipped[].reason="unavailable"`, which is the correct degradation, while
the doctor's `Apalache available` row stayed green because it only asked
whether `java -version` runs and whether a distribution sits in `~/.quint`.
A row that says "available" about a solver that cannot verify a single
line is worse than no row.

Two changes, one at the cause and one at the diagnosis.

**The client stops the server it started.** `QuintClientImpl` now passes
`killSignal: "SIGINT"` on every quint invocation, so a budget overrun
runs quint's own cleanup path and the Apalache child dies with it. The
process-group route (`detached: true` plus a negative-pid kill) was
measured and rejected: bun's `spawnSync` ignores `detached` — the child
keeps the parent's process group, so there is no group to signal — while
node's honours it, and the sensors run under bun. Timeout detection moved
with the signal: a quint that handles SIGINT exits by itself, so the run
comes back with `status: 0` and `signal: null`, and the old
`signal === "SIGTERM"` test would have read an aborted verification as a
clean one. The evidence is now `error.code === "ETIMEDOUT"`, which both
runtimes set whatever the child does, with the signal test kept as a
fallback. Measured A/B against the real quint and the real Apalache, same
spec and same 5s budget: with SIGTERM the server is still listening on
8822 after the working directory is deleted; with SIGINT the port is
free. Residual risk, stated plainly: quint's handler kills Apalache and
waits for it, so a JVM that ignored SIGTERM would leave `spawnSync`
blocked where SIGTERM would have returned. The exchange is a rare hang
against a routine, permanent breakage of the bounded backend.

**The doctor asks whether Apalache can verify, not whether it is
installed.** The `Apalache available` row still carries its frozen label,
but it is now measured: if the static check passes and something is
listening on 8822, the probe writes a four-line spec to a temporary
directory and verifies it. A non-zero exit means the server cannot
verify, `hasApalache()` turns false, and the row's fix says how to stop
the orphan (`lsof -nP -iTCP:8822 -sTCP:LISTEN`, then `kill`) instead of
how to install a JDK. The frozen install wording is untouched for every
other case. The listening test is what keeps this cheap: nothing on the
port means no probe and no JVM, so the common run costs nothing —
measured at 0.23s with the port free and 0.43s against a live server, and
`quint verify` is never spawned when nothing is listening. The port
(8822, quint's default) and the runtime that evaluates the connect probe
are injected by the entry, since only a composition root may read
`process.*`. This changes what the row means: `Apalache available` now
asserts that a bounded verification would actually run.

## The src/tools distribution split — tools/ becomes a generated bundle, src/ is the only place anyone edits (2026-09-03)

`tools/` had doubled as both the development source and the shipped
artifact, and the dependency direction between layers was enforced
only by the test-time `layer-direction` rule in
`tests/architecture/rules.ts`. This split makes `src/` the sole
editing target and turns `tools/` into a build artifact holding
nothing but bundles machine-generated from `src/entries/` — the goal
is to enforce dependency direction structurally, rather than leave
test-time detection as the only line of defense.

- **Layers become packages.** The seventeen `src/<ctx>/<layer>/`
  directories, `src/entries/`, and `tests` all became members of a
  bun workspace. Each package's `package.json` narrows `exports` to
  `"."` → `"./index.ts"` only, and declares in `dependencies` exactly
  the edges it actually imports, each as `workspace:*`. Paired with
  `bunfig.toml`'s `[install] linker = "isolated"`, an undeclared
  layer is unresolvable both at runtime and under `tsc`.
- **Making `tests` a workspace member — a ruling from measurement.**
  The original plan listed every layer in root `package.json`'s
  `dependencies`. Measured against it: an `@deep-spec/*` package
  placed at root let an import from an *undeclared* layer resolve
  anyway, via upward `node_modules` lookup to the root — and `tsc`
  stopped emitting `TS2307` for it, silently disabling the whole
  boundary check. Making `tests` a workspace member instead means
  `@deep-spec/*` is linked only under `tests/node_modules/`; an
  import from a zero-dependency layer now fails with
  `Cannot find module`.
- **A new rule closes the relative-import escape.** A bare specifier
  alone still leaves a `../` path across package boundaries, so
  `tests/architecture/rules.ts` gained
  `no-cross-package-relative-imports` (eighteen rules → nineteen).
  `locationOf` is now rooted at `src/`, and `layer-direction` judges
  direction across bare-specifier edges too. No existing rule lost
  detection power.
- **The generator and its drift guard.** `scripts/build-tools.ts`
  bundles each entry individually with
  `bun build --target=bun --external z3-solver --sourcemap=none` — no
  code splitting, no minify, to avoid the manifest and doctor
  destabilizing on chunk-name drift. `--check` regenerates into a
  temp directory, compares byte for byte, and exits non-zero naming
  the differing files. CI runs it immediately after typecheck — the
  same shape as upstream's `aidlc-runner-gen check`. Measured:
  generation takes 106ms, is byte-identical from the same source, and
  is invariant to the output path (source paths are embedded
  cwd-relative, so the generator pins its own cwd to the package
  root).
- **Shipped filenames stay `.ts` — a ruling.** The plan had been to
  ship `.js`; it turned out the upstream dispatch path requires
  `.ts`. `aidlc-workflows/core/tools/aidlc-sensor.ts`'s
  `resolveScriptPath` looks in the manifest's `command` for a token
  ending `.ts` and calls `dispatchError` if none exists, and
  `aidlc-utility.ts`'s doctor check hardcodes `<plugin>-doctor.ts`.
  The distribution path — `aidlc-plugin-validate` /
  `aidlc-plugin-build` / compose — checks no extension at all. Given
  the constraint of not touching the upstream contract, keeping
  shipped filenames `.ts` is the only compatible answer: bun executes
  the bundled JS underneath regardless of the name, and node 24's
  type-stripping passes it through unchanged (verified on the
  `--smt-child` subprocess path, exit 0). The findings JSON and
  verdict line came back byte-identical to a `.js`-named run, and
  `smt.json` matched the frozen golden. The requirement had been
  written without checking the execution path; the reverse-engineered
  code knowledge base's claim that nothing checks extensions was
  correct, but only for projection, validate, and compose.
- **Contract schemas stay next to their entry.** Each entry resolves
  `data/` relative to `dirname(fileURLToPath(import.meta.url))`. In
  the shipped tree `tools/<entry>.ts` and `tools/data/` sit at the
  same level, so this resolves; originals living at `src/data/` would
  not resolve from the source tree. Keeping the originals under
  `src/entries/data/`, alongside their entry, keeps the relative rule
  identical in both the source tree and the shipped tree — and
  `bun src/entries/<entry>.ts` still runs directly.
- **The bundle-size ceiling moved to 512 KiB — a ruling.** The
  original "300 KB or less" figure came from measuring only the
  requirements-family entries; it did not account for the three
  design-family entries, which bundle 241 modules each and land at
  291–300 KB (300,296 bytes at the largest). That made the gate
  fragile enough to fail on a 189-byte difference depending on which
  unit you read it in — rather than pick units to make the number
  pass, the ceiling itself was revised. The point of the gate is
  catching abnormal bloat, not a specific figure.
- **The installer tombstone now handles directories.**
  `REMOVED_PAYLOADS` covers both files and directories and
  recursively deletes the six context layer directories
  (`tools/{kernel,requirements,design,refinement,refcheck,doctor}/`).
  The ten old entry files keep their filenames, so the existing
  upgrade refresh replaces them in place. Measured: an
  already-installed sandbox's `.claude/tools/` went from 616 to 85
  files (the plugin's own share: ten bundles plus four schema files),
  and the six layer directories disappeared.
- **One, and only one, external-contract change.** Doctor's
  installation manifest loses the seventeen layer-facade canary
  lines — unavoidable once layers stop shipping, and exactly the
  point of the change. Entry rows keep their `.ts` labels unchanged.
  The IR, findings JSON, cross-check, refcheck reports, verdict
  lines, and exit-code meanings are all untouched.

Evidence: `bunx tsc --noEmit` exit 0; `bun test --coverage` 496 pass /
1 skip / 0 fail with the 0.9 coverage floor held; `aidlc-plugin-validate`
VALID; all 7 harness builds succeed with `dist/claude/tools` at 14
files; `aidlc-plugin-test` CLEAN (`Changed files (0)` / `Drops: 0` /
`Idempotent second compose: true`); doctor 31 checks, 0 fail. A real
dispatch against a real sandbox (the `260829-feature` fixture) came
back ir-valid pass / SMT 5 findings, 2 skipped, exhaustive / Quint 2
findings, 3 skipped, bounded (real Apalache) / cross-check SC-3, SC-5
with 0 disagreement — all three output files byte-identical to the
pre-migration baseline. Golden and parity snapshots are unchanged.

## Repository vocabulary and the verify-directory aggregate — conformance leaves the repository, the cross-check becomes an Option on the aggregate, and strict creation splits from tolerant hydration (2026-09-04)

Three report repositories (`design`, `requirements`, `refcheck`) had
grown a query, `conformedOf(report)`, that returned "the shape `store`
would write" so that the verdict printed to stdout could be derived
from the same object that landed on disk. During this intent the design
port briefly gained two more variants — `storeConformed(report, model)`
and `storeConformedWithoutCrossCheck(report)` — to carry the directory
lock and the cross-check rebuild. The owner ruled all of it out:

> A repository's responsibility is I/O of an aggregate. Its only
> vocabulary is store, find, get and delete, and its interface may
> depend on nothing but that vocabulary. If you want an interface with
> any other vocabulary, redesign the aggregate. An aggregate is one
> piece; a variable part is modelled on the aggregate itself, like
> `employeeAggregate.deptIdOpt: Option<DeptId>` — the repository does
> not absorb it.

This reverses the 2026-09-01 ruling that kept `conformedOf` on the
repository boundary, and the functional-design decision that
preserved it. What replaced it:

- **The repository port is `find` + `store(aggregate)` and nothing
  else.** `DesignVerifyDirectoryRepository` and
  `VerificationDirectoryRepository` expose
  `findByDirectory(directory)` and `store(aggregate)`;
  `ReferenceCheckReportRepository` exposes `findById(id)` and
  `store(report)`. `conformedOf`, `findAllByDirectory`, the
  `storeConformed*` variants and the schema-path constructor
  argument are gone from all three. `RepositoryError` keeps its three
  variants; a store-time conflict is carried as `io-failed` with a
  typed `cause`.
- **The verify directory is the aggregate.** `DesignVerifyDirectory`
  and `VerificationDirectory` are identified by the directory and hold
  the backend reports (a first-class collection keyed by backend), the
  `candidate` this run places, and **`crossCheck: Report | null`** —
  absent when it cannot be derived (the IR was unreadable), present
  when `crossChecked(model, irHash)` derived it from the current
  reports. `finalizing(report)` replaces the same-backend sibling in
  canonical filename order (the adapter's `withCandidate` moved into
  the aggregate). `withoutCrossCheck()` is the aggregate saying "no
  cross-check", not a repository method saying it.
- **Conformance is the aggregate's own behaviour.** `FindingsSchema`
  is a value object in `kernel/domain` wrapping contract 2's JSON
  Schema, with an `unreadable(cause)` variant and
  `degradationReasonFor(document)` returning the frozen texts
  (`findings schema unreadable: <cause>`, `self-validation against
  deep-spec-findings-schema.json failed: <first error>`). Each report
  gained `toDocument()` (the serializer's `orderedDocument`, moved
  verbatim — canonical order is contract-2 knowledge and belongs to
  the domain) and `conformedTo(schema)`. The pure pieces that made
  this possible — `Json`, `isObject`, `validateSchema`,
  `canonicalStringify` — moved from `kernel/adapter` to the innermost
  `kernel/infrastructure`; the adapter keeps only the I/O
  (`readContractSchema`). The composition root reads the schema once
  and injects the value object into the use case; the repository never
  sees it. A degraded candidate is conformed *before* the cross-check
  is derived, exactly as the old flow did, so the cross-check bytes
  are unchanged.
- **`store(aggregate)` hides the whole finalization protocol.** Inside
  the adapter, and invisible to the port: take the directory lock
  (owner token, PID, 30-second lease, single non-waiting exclusive
  create, recovery only after lease expiry *and* definite owner
  absence, token fencing before every public rename, owner-specific
  stale/cleanup paths, never a canonical-path delete); re-read the
  siblings under the lock and refuse with `conflict: sibling set
  changed since load` if any non-candidate report differs from what
  the aggregate was loaded from; render; move the public
  `cross-check.json` to a non-`*.json` stale name first; publish the
  candidate with the canonical atomic-write helper; publish the new
  cross-check the same way or leave it absent; clean up in `finally`.
  Read-side, a broken sibling is a typed failure, never silently
  dropped; the derived `cross-check.json` alone is read tolerantly.
  `DirectoryFinalizationLock` lives in `kernel/adapter` and is shared;
  each context injects its own lock basename.
- **The silent success is gone.** Both design use cases and both
  requirements use cases carried `if (!siblings.ok) return
  ok(undefined);` — a sibling directory that could not be read made
  the cross-check update "succeed". A `DesignReportFinalizer` /
  `VerificationReportFinalizer` now owns `find → finalizing →
  conformedTo → crossChecked | withoutCrossCheck → conformedTo →
  store` in one place and returns `verified` only after `store`
  succeeds, deriving pass and counts from the aggregate it stored.
  `DesignVerificationAcquirer` owns model acquisition, the three
  failure classifications and the IR version check with a closed
  `ready | terminal` result and a compile-time `never` check.
- **Strict creation and tolerant hydration are separate doors.**
  `VerificationMethod.parse`, the new `SkipReason` (contract 2's nine
  values, a shared domain primitive replacing a bare `string` on
  `DesignSkipped`), and `FindingKind.parse` are the strict doors; each
  closed set exposes named static factories so no call site carries a
  string literal; `reconstitute` remains for adapter hydration only,
  and unknown kinds still sort after known ones and degrade through
  conformance. `DesignFinding`, `VerificationFinding` and the refcheck
  `Finding` gained `of(...)` taking a validated `FindingKind`; the
  refcheck aggregate's `finding(...)` command is typed the same way.
- **Refinement is a Design subdomain, flat.** The 36 classes of
  `@deep-spec/refinement-domain` moved to `src/design/domain/` (no
  `refinement/` subdirectory), the package and its four sanctioned
  cross-context edges were deleted with no shim, and
  `design/domain → requirements/domain` is the one edge that remains
  sanctioned. `refinement` stays in the architecture rules' `CONTEXTS`
  list on purpose: removing it would make a resurrected
  `@deep-spec/refinement-domain` import fall outside layer discipline
  instead of being rejected.
- **Lowering and verdict interpretation moved to their owners.**
  `buildLowering`, a 161-line module-scope function, became
  `DesignUnit.lowered()` plus `loweredAs` on the declaration objects;
  the 119-line `#remapReadable` became
  `SiblingVerdictDocument.remapVerdicts(unit, index)`; `LoweredUnit`
  keeps only the collections, the `LoweringIndex` and `extendedWith`.

Alternatives rejected: a separate conformance port (still vocabulary
the aggregate should own); keeping `conformedOf` because the
double-observation could be fixed with a snapshot alone (the ruling
is about the port's vocabulary, not the cache); repository method
variants for "with" and "without" a cross-check (the variable part
belongs on the aggregate); rebuilding the cross-check inside the
repository (a repository computes nothing); reading the siblings only
inside the lock with no conflict check (an aggregate loaded outside
the lock needs the check, and the check is a persistence concern).

Consequences worth naming: the IR-unreadable path now loads the
directory too, so a corrupt sibling fails it instead of being ignored;
a cross-check that cannot be derived is absent, never stale; the
requirements and refcheck contexts, which the requirements document
had placed out of scope, were aligned in the same intent at the
owner's direction; `kernel/adapter` now depends on `kernel-domain`
(downward) for `ArtifactPath` in the shared lock.

Evidence: `bunx tsc --noEmit` exit 0; `bun test --coverage` 577 pass /
1 skip / 0 fail (3,218 assertions, 32 files, up from the 527-pass
baseline) with 99.83% function / 99.94% line coverage and the 0.9 floor
held; `bun scripts/build-tools.ts --check` 14 files up to date, largest
bundle 321,855 bytes; `aidlc-plugin-validate` 0 errors (the one warning,
the absent vendored compose hook, predates this change); all 7 harness
projection builds succeed; the golden fixtures under `tests/fixtures/`
are byte-unchanged. A live sandbox exercise with real Apalache (quint
`bounded`) installed the pre-change plugin from a HEAD worktree into
sandbox A and the post-change plugin into sandbox B, minted the same
feature intent, and fired all ten entries from the installed dispatcher:
every verdict line, exit code and output file — requirements and design
`smt.json` / `quint.json` / `cross-check.json`, the three refcheck
reports, ir-valid, doctor's 41 checks — was byte-identical across A, B
and A upgraded in place with `--update` (299 → 299 files, 11 bundles
changed, contract schemas untouched). A second SMT→Quint firing
converged byte-identically and left no lock, temp or stale file;
`aidlc-plugin-test` reported CLEAN (`Changed files (0)` / `Drops: 0` /
`Idempotent second compose: true`). Breaking a sibling `quint.json`
made the SMT sensor exit 1 with the sibling named on stderr and
published nothing; an unreadable design IR produced the frozen degraded
`smt.json`, removed the stale `cross-check.json`, and a re-fire after
restoring the IR reproduced all three files byte for byte. The
requirements had also folded a zero-Unit fix for the AI-DLC engine
(`aidlc-workflows/`) into this intent; the owner ruled during Build and
Test that `aidlc-workflows/` is not a development target of this
repository and must not be modified, so that work was reverted to the
engine's HEAD and is not part of this record.

## Boundary information loss and aggregate invariants — six audit fixes (2026-09-05)

The owner selected implementation of all six audit findings. Normal contract
1–4 formats and golden outputs are preserved; the affected failure paths are:

- `SiblingVerdictDocument.reachabilityOf` owns reachability. A final-state
  witness proves reachability in any mode; only a completed bounded search
  can establish non-reachability. Timeouts, compilation failures and missing
  evidence remain undecided.
- `RefinementQuintInvariants.interpret` maps findings and skips together,
  retaining unverified additional requirements instead of letting the use
  case collect only conflicts.
- `decodeFindingsDocument` shares structural decoding across adapters.
  Missing or malformed fields produce `corrupt`, never empty successful
  results. Unknown vocabulary is preserved verbatim; conformance remains
  domain-owned.
- `Expression` is recursively readonly. Domain objects own deeply copied,
  frozen trees through `ExpressionTree`. Inputs, accessors and visitors
  cannot change the model while leaving its hash unchanged. Traversals that
  index nodes by reference share one immutable tree.
- `RefinementMaterialsRepository` returns
  `Result<RefinementMaterials, RepositoryError>`. Only absence is inapplicable;
  corrupt existing input and I/O failures are explicit. Use cases save the
  already completed design checks before returning acquisition failure.
  Requirements and map provenance hashes use the bytes already read.
- Both verify-directory aggregates expose `finalizedWith`, which conforms
  the candidate and derives its cross-check in one operation. Individual
  `conformedTo` calls also invalidate the old cross-check when changing the
  candidate. The finalizer no longer compensates for an unsafe call order.

Regression coverage is in `tests/verification-boundaries.test.ts`. Tests
that required expression reference identity now require equal values and
separate references. The previous malformed-document test now requires an
explicit failure instead of filtering away invalid records.
