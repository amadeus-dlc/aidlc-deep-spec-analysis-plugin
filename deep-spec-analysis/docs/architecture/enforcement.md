# Inventory of mechanical checks

English | [日本語](enforcement.ja.md)

Maps each rule in [`design-rules.md`](design-rules.md) to whether it is enforced mechanically or held only by human review.

The checks themselves live in `tests/architecture/rules.ts` (879 lines) and `tests/architecture.test.ts` (520 lines). `bun test tests/architecture.test.ts` currently reports **38 pass / 0 fail**.

## How the count works

- **19 rules** are in `ALL_RULES` and apply to every `.ts` file under `src/`.
- **1 rule** (`manifest-dependency-direction`) runs through a separate path and applies to the 16 layer `package.json` files.
- **20 rules** in total. **Every rule has a red example and a green example** — the tests prove, on their own, that the check can actually detect a violation. A check that can't detect anything protects nothing even while green, which makes this as important as the rules themselves.

The foundation for classification is `locationOf`, which splits a relative path into four kinds: `entry` / `data` / `{context, layer}` / unclassified. `architecture.test.ts` also pins down that **unclassified count is 0**.

Lexical analysis uses a lightweight, hand-rolled tokenizer (`stripComments` / `stripStrings`) that avoids misdetecting `//` inside strings or comments. A known limitation: it cannot handle `//` inside a regex literal.

---

## 1. Rule-to-mechanical-check mapping

### Structure (L)

| Rule | Mechanical check | What counts as a violation |
|---|---|---|
| L1 Split by context × layer | `one-public-type-per-file` + the assertion that `locationOf` unclassified is zero | A file sits somewhere that cannot be classified |
| L2 A layer is a package; dependencies are declared | **`manifest-dependency-direction`** | `package.json`'s `name` is not `@deep-spec/<context>-<layer>` / a `dependencies` version is not `"workspace:*"` / a self-dependency is declared / an edge outside the allowed set is declared |
| L3 Dependencies point inward only | **`layer-direction`** | The imported layer is absent from the allow table `ALLOWED_LAYER_TARGETS` and also does not match the cross-context allow table `SANCTIONED_CROSS_CONTEXT` |
| L4 kernel/infrastructure has zero dependencies | **`no-io-in-pure-layers`** (partial) | `infrastructure` imports `node:*` |
| L5 I/O is confined to adapter and entry | **`no-io-in-pure-layers`** + **`process-only-in-entries`** | `domain` imports a `node:*` module other than `node:crypto` / `usecase` imports `node:fs`, `node:child_process`, or `node:os` / a layer file references `process.` or `import.meta` |
| L6 The composition root is entry only | **`no-entry-imports`** + `process-only-in-entries` | A relative import resolves to one of the 10 entry files |
| L7 The public surface is an explicit facade enumeration | **`no-export-star`** + **`no-cross-package-relative-imports`** | An `export *` declaration exists / a relative import escapes its own package |

### Domain layer (D)

| Rule | Mechanical check | What counts as a violation |
|---|---|---|
| D1 Residents are the 4 kinds plus domain errors | **none (review)** | The kind itself cannot be judged mechanically. D5 is the closest substitute |
| D2 Fields are `#private` only | **`domain-fields-are-private`** | A field declaration directly inside the body (brace depth 1) of a domain `export class` does not start with `#` |
| D3 Constructors are private | **`private-constructor-in-domain`** | The body of a domain `export class` has no `private constructor` (classes extending `Error` are excluded) |
| D4 There are three creation gates | **none (review)** | The mapping between name and role cannot be judged mechanically |
| D5 No data models | **`no-data-models-in-domain`** + **`published-language-layers`** | A public domain `interface` has properties / a public `type`'s right-hand side is an object shape or a discriminated-union shape. The only exemptions are the 11 entries (path + type-name pairs) in `PUBLISHED_LANGUAGE` |
| D6 No primitives | **`no-primitive-fields-in-domain`** | A domain class's `#` field, or a public type's property, is `string` / `number` (or an array/`Set`/`Map` of them). Exemptions: the 19 prose field names, the 4 frozen-token field names, `PUBLISHED_LANGUAGE` files, and the structural exemption for a single `#value` field |
| D7 No getters | **`no-get-accessors`** | A `get <identifier>(` declaration exists (checked across every file) |
| D8 Judgment stays inside the type | **none (review)** | — |
| D9 Collections are First-Class Collections | **`no-primitive-fields-in-domain`** (partial) | Arrays of primitives are caught, but raw arrays of domain types are not |
| D10 Variants are `#kind` plus fold | **none (review)** | — |
| D11 Aggregates are guarded by commands | **none (review)** | — |
| D12 Don't create check-only types | **none (review)** | — |

### Boundary (P)

| Rule | Mechanical check | What counts as a violation |
|---|---|---|
| P1 Ports live in usecase | **`ports-live-in-port-dir`** | An `export class` is declared inside `usecase/port/` (an interactor placed in port) / an `export interface` ending in `Repository` or `Client` is declared outside `usecase/port/` |
| P2 Close the Repository vocabulary | **`commands-return-void`** (partial) + `ports-live-in-port-dir` (naming) | `store`'s return type is not `Result<void, …>`. **No check restricts method names to `find*` and `store`** (review) |
| P3 Name it Client | `ports-live-in-port-dir` (part of naming) | — |
| P4 Commands return no value | **`commands-return-void`** | Inside a path containing `/usecase/port/`, `store(...)`'s return type is anything other than `Result<void, …>`. **Only looks at methods named `store`** |
| P5 Share the failure vocabulary | **none (review)** | — |
| P6 An interactor has exactly one `execute` | `ports-live-in-port-dir` (placement only) | No check counts public methods |
| P7 Return values are a closed union | **none (review)** | — |
| P8 Read models live in usecase | **none (review)** | — |
| P9 Environment observation is injected via a port | `process-only-in-entries` (indirect) | — |

### Outside world (A) / Failure (F)

| Rule | Mechanical check | Notes |
|---|---|---|
| A1–A4, A6, A7 | **none (review)** | — |
| A5 Exceptions are confined to adapter | **none (review)** | A listing can be obtained with `grep -rn 'throw new' src \| grep -v defect:` |
| F1 Expected failures are returned as values | **none (review)** | — |
| F2 `throw` only for `defect:` | **none (review)** | Mechanically confirmable with the same grep as above |
| F3 Exhaustiveness is `unreachable` | **carried by type checking** | `tsc --noEmit` |
| F4 Error types are not exported | **none (review)** | — |

### Names and files (N)

| Rule | Mechanical check | What counts as a violation |
|---|---|---|
| N1 One public type per file | **`one-public-type-per-file`** | There are 2 or more public **types** (`class`/`interface`/`enum`/`type`) / when there is exactly one, the filename doesn't match the kebab-case of the type name / `index.ts` has a declaration other than a re-export / entry or data declares a public type. **Functions and constants are not counted** |
| N2 `index.ts` holds only re-exports | `one-public-type-per-file` + `no-export-star` | Same as above |
| N3 Line-count ceiling | **`MAX_PRODUCTION_FILE_LINES`** (`architecture.test.ts`) | A file under `src/` is 1,000 lines or more |
| N4 Prohibited language features | **`no-enums`** / **`no-non-null-assertions`** / **`no-export-star`** / **`no-test-payloads`** / **`only-sanctioned-imports`** | An `enum` declaration / a non-null assertion (`!`) / `export *` / a test artifact under `src/` / an npm import outside the allowed set (only `z3-solver` is allowed), plus a dynamic `import()` that isn't a string literal |
| N5 Fix the vocabulary | **none (review)** | — |

---

## 2. The layer boundary is enforced three times over

`L2` / `L3` are not held by a single check — they're guarded by three independent paths. This is what sets them apart from the other rules.

| Path | Mechanism | Effect of importing an undeclared layer |
|---|---|---|
| **Declaration** | Listed as `"workspace:*"` in the `dependencies` of `src/<context>/<layer>/package.json` | `manifest-dependency-direction` fails |
| **Runtime** | `bunfig.toml`'s `[install] linker = "isolated"` links only the declared layers into the `node_modules` directly under each package | Exits non-zero with `Cannot find module '@deep-spec/…'` |
| **Type checking** | tsc sees the same `node_modules` | `TS2307` (module not found) |

`tests/package-boundaries.test.ts` **pins the behavior of these three paths with measured evidence** — it builds a fixture in a temp directory containing nothing but symlinks to the real packages, and runs the three cases (declared / undeclared / deep-path) through both execution and type checking.

Each layer's `package.json` sets `exports` to only `{ ".": "./index.ts" }`, so a deep-path import that bypasses the facade also fails to resolve (the runtime backing for `L7`).

**Note when porting this**: without `linker = "isolated"`, an undeclared layer resolves from the root `node_modules`, and both `L2` and `L3` become inert at runtime (the check still exists, but the code runs anyway).

---

## 3. Exemption tables

The point of this check suite is that exemptions are kept as **tables**, not as implicit exceptions. An entry gets onto a table by ruling, not by convenience.

| Table | Count | Contents | Rules that use it |
|---|---|---|---|
| `PUBLISHED_LANGUAGE` | **11** | path, exported name, reason it isn't a domain object, and the layers allowed to use it | D5, D6 |
| `SANCTIONED_CROSS_CONTEXT` | **1** | The one allowed cross-context edge (`design/domain → requirements/domain`) | L3 |
| `ALLOWED_LAYER_TARGETS` | 4 | Allowed targets per layer | L3 |
| `PROSE_FIELD_NAMES` | **19** | Free-text field names (`detail`, `reason`, `message`, `ears`, etc.) | D6 |
| `STATE_TOKEN_FIELD_NAMES` | **4** | Frozen-token field names (`state`, `from`, `to`, `attrPath`) | D6 |
| `ALLOWED_NPM` | **1** | Allowed npm package (`z3-solver`) | N4 |
| `ENTRY_FILES` | **10** | Composition-root files | L6, N1 |

`architecture.test.ts` also pins the **table counts themselves** (`PUBLISHED_LANGUAGE` at 11, `ENTRY_FILES` at 10, layer manifests at 16). A table can never grow silently.

For each `PUBLISHED_LANGUAGE` row, it further cross-validates that the target file actually exists, that its layer is `domain`, that the reason and allowed layers aren't empty, and — **that the file actually declares a type with that exact name**. The table can never drift from reality.

---

## 4. Adjacent mechanical checks (not design rules, but the same character)

| Test | What it pins down |
|---|---|
| `tests/package-boundaries.test.ts` | The three paths from §2 above |
| `tests/build-tools.test.ts` | The drift guard on the generated `tools/` tree (regenerate and byte-compare), generation determinism (byte-identical across two generations), the fixed shipped-file count (10 bundles + 4 `data/` files = 14 files), the 512 KiB bundle-size ceiling, and the extension discipline of never placing a `.js` file |
| `tests/coverage-gate.test.ts` | CI's coverage gate (an absolute 90%, relative to base, with a 0.01 tolerance) |
| `tests/kind-rank.test.ts` | Freezing the domain type's output contract (the 11-kind canonical order of `FindingKind`) |

The rest of the tests under `tests/` are golden comparisons, domain unit tests, persistence contracts, and solver consistency — none of them check design discipline. **Checks that look at naming, line counts, or public-type counts exist only in `architecture.test.ts`.**

---

## 5. Coverage floor

`bunfig.toml`:

- `coverageThreshold = 0.9`
- Excluded: `tests/**`, `scripts/**`, the entry sensors and doctor, `src/entries/data/**`, and **all `adapter` layers across the 5 contexts** plus **`usecase` across 4 contexts**.
- So the floor applies to each context's `domain` layer, plus `kernel/usecase` and `kernel/infrastructure`.

**Known discrepancy**: the comment at the top of the file states that "only the domain layer is measured," but because `kernel/usecase` and `kernel/infrastructure` are absent from the exclusion list, both are in fact also subject to the floor. Since both hold only pure types and functions, no real harm has resulted, but the comment and the configuration disagree.

---

## 6. Known limitations of the checks

These are drawn from what's explicitly stated in `rules.ts`'s comments, plus what can be read off the code. **Written down so no one trusts these checks further than they actually reach.**

| Check | Limitation |
|---|---|
| `commands-return-void` | Only looks at methods **named** `store`. Write methods under any other name go unchecked |
| `no-primitive-fields-in-domain` | Does not look at private `type` aliases or index-signature types (`{ [k: string]: … }`) (a comment explicitly states this is deliberate) |
| `private-constructor-in-domain` | Extracts the class body via a simple search up to the next `export`, without tracking brace matching |
| `stripComments` / `stripStrings` | Does not handle `//` inside a regex literal. If such source exists, the following lines can be treated as a comment and slip past the check |
| Overall | Lexical scanning, not an AST. Does not fully understand TypeScript syntax |

Read these not as "there's a check, so it's safe" but as "this is as far as the check looks." Beyond these limits, a rule is treated the same as "none (review)" in §1.

---

## 7. When adding a new rule

1. **Write it as a decidable predicate.** "Write it cleanly" cannot become a check.
2. **Write the red example first.** Write code that violates the rule and confirm the check fails on it. A check that never fails protects nothing, even while green.
3. **Write the green example too.** Confirm the check doesn't fail on correct code. A false positive teaches people to ignore the rule.
4. **If an exemption is needed, put it in a table.** Don't create an implicit filename exclusion or an exception based on partial name matching.
5. **Don't remove an existing check.** When adding a new condition, keep the old one alongside it. Double-detection is fine.
6. **Add a count assertion to `architecture.test.ts`.** Once an exemption table exists, pin its count too, so it can never grow silently.

---

## References

- [`design-rules.md`](design-rules.md) — the rules themselves
- `tests/architecture/rules.ts` — the check implementations
- `tests/architecture.test.ts` — red/green examples and the count assertions
