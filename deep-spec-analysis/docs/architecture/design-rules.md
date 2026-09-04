# Design Rules — DDD and Clean Architecture

English | [日本語](design-rules.ja.md)

This document was written by reading every file of `deep-spec-analysis/src/` (6 contexts, 489 files, 26,007 lines) — it records the design rules **actually in force right now**. Rather than starting from "how it should be," it first pinned down "how it is written," and extracted the norms from that.

It is written so the same shape can be used by other AI-DLC plugins. §9 covers how to port it; §8 covers the deviations still remaining in this repository.

## How to read this

Rules fall into 6 groups, each with a prefix.

| Prefix | Covers |
|---|---|
| `L` | Structure — contexts and layers, direction of dependency |
| `D` | Residents of the domain layer |
| `P` | Boundary — ports and use cases |
| `A` | Outside world — adapters and entries |
| `F` | Representation of failure |
| `N` | Names and files |

Each rule is written in this shape:

- **Rule** — written as a decidable predicate. The aim is that different readers reach the same verdict.
- **Why** — what the rule prevents.
- **In this repository** — actual code that exists in this repository. Pointed to by path and **symbol name** (line numbers are not used, since they rot).
- **Check** — the rule name of a mechanical check if one exists, otherwise "None (review)." The breakdown of all 20 checks is in [`enforcement.md`](enforcement.md).

A rule marked "Check: none" is not weak — it means it is **kept by people reading it**. There are 20 mechanical checks, and right now all of them pass green (`bun test tests/architecture.test.ts` → 38 pass / 0 fail).

---

## 0. The problem this design answers

This plugin formally verifies requirements and design documents and produces **byte-frozen findings documents**. There are 4 externally visible contracts, and the output is guaranteed to be the same bytes for the same input, every time. The solvers (z3, quint, Apalache) crash, time out, and in some environments don't even exist. The documents are hand-written by humans, so they arrive broken.

These three things — **frozen output contracts**, **untrustworthy external processes**, and **broken input** — are the reason behind almost every rule below. In a domain that does not share these properties, some of these rules become excessive. §9 tells you how to tell which.

---

## 1. Structure — contexts and layers (L)

### L1 — Cut along two axes: context × layer

**Rule**: Source lives along the two axes of `src/<context>/<layer>/`. A context is a business-level concern (in this repository: `requirements` / `design` / `refcheck` / `doctor`, plus the shared `kernel`). A layer is `domain` / `usecase` / `adapter`, plus `infrastructure`, which has no dependencies. Only composition roots sit flat, in `src/entries/`.

**Why**: Cutting by layer alone lets unrelated business concerns pile up in the same directory. Cutting by context alone makes the direction of dependency invisible to machines. Two axes together preserve both.

**In this repository**: `src/design/domain/`, `src/requirements/adapter/`, `src/kernel/infrastructure/`. Not a single file is unclassifiable (`architecture.test.ts` pins zero unclassified entries from `locationOf`).

**Check**: `one-public-type-per-file` (also judges the location of entries and data), and the assertion of zero unclassified entries from `locationOf`.

### L2 — Layers are independent packages; dependencies are declared in the manifest

**Rule**: Each `src/<context>/<layer>/` is an independent package (`@deep-spec/<context>-<layer>`) with its own `package.json`. To use another layer, declare it in `dependencies` with `"workspace:*"`. An undeclared layer cannot be imported.

**Why**: This makes package resolution — not attentiveness — enforce the direction of dependency. Remove the declaration and the import breaks, so the boundary holds at runtime.

**In this repository**: `src/kernel/infrastructure/package.json` has no `dependencies` (zero dependencies). `tests/package-boundaries.test.ts` pins, by measurement, that importing an undeclared layer produces **`Cannot find module` at runtime and `TS2307` under type checking**.

**Requirement**: bun workspaces plus `bunfig.toml`'s `[install] linker = "isolated"`. Without this, an undeclared layer resolves via the root `node_modules`, and the boundary is voided.

**Check**: `manifest-dependency-direction` (on the `package.json` side) and `layer-direction` (on the code side). The same allow-list applies to both.

### L3 — Dependencies point inward only

**Rule**: The only permitted direction is `entry → adapter → usecase → domain → kernel-domain → kernel-infrastructure`. The reverse direction, and some skips, are forbidden. An edge that crosses contexts is allowed only if it appears in an **explicit allow-list**.

**Why**: This is Clean Architecture's dependency rule itself. Keeping an allow-list leaves a record of the fact that "an exception was made."

**In this repository**: There is currently **exactly one** cross-context permission — `design/domain → requirements/domain` (design refers to requirements' vocabulary). It is written as a single entry in `SANCTIONED_CROSS_CONTEXT`.

**Check**: `layer-direction` plus `manifest-dependency-direction`.

### L4 — kernel is shared vocabulary; `kernel/infrastructure` has zero dependencies

**Rule**: Vocabulary used by more than one context lives in `kernel/domain`. `kernel/infrastructure` holds **only pure computational plumbing with no domain vocabulary**, and carries no dependency of any kind, including `node:*`.

**Why**: Tools like `Result` or canonical JSON serialization are not domain language, but the domain uses them. Placing them at the innermost layer with zero dependencies means domain can use them without breaking the direction.

**In this repository**: `src/kernel/infrastructure/` holds only `result.ts` (`Result` / `ok` / `err` / `unreachable`), `json.ts`, `schema.ts`, and `canonical-json.ts`. Zero imports of `node:`.

**Check**: `no-io-in-pure-layers` (`infrastructure` bans `node:*` outright).

### L5 — I/O and platform APIs live only in adapter and entry

**Rule**: `node:fs` / `node:child_process` / `node:os` / networking live only in adapter. `process.*` and `import.meta` live only in entry. domain and usecase hold none of these.

**Why**: This keeps domain and usecase drivable by tests. If this breaks down, exercising a domain decision requires a filesystem.

**In this repository (measured)**: The count of files importing `node:*` is: adapter 27, entries 10, usecase 0, infrastructure 0, domain 1. The one domain instance is `node:crypto` in `src/kernel/domain/content-hash.ts` (a side-effect-free computation, but a literal exception — see §8).

**Check**: `no-io-in-pure-layers`, `process-only-in-entries`.

### L6 — Composition roots are entry only, and entry does nothing but wiring

**Rule**: Only entry `new`s concrete classes and assembles dependencies. entry may touch all three layers, but does not hold a single line of business judgment. Conversely, entry must never be imported.

**Why**: This concentrates which implementation is actually in use into one file. Tests can plug in a different implementation.

**In this repository**: All 10 files under `src/entries/` share the same shape — parse flags → pass through if out of scope → assemble dependencies → run the usecase → report the verdict to stdout as a single line of JSON, and to the caller via exit code.

**Check**: `no-entry-imports` (nobody may import entry), `process-only-in-entries`.

### L7 — The public surface is only what the facade explicitly enumerates

**Rule**: The only names visible from outside a package are those explicitly enumerated by `index.ts`. Do not use `export *`. Do not import another package's internal files directly (go through the facade via a bare specifier). Within the same package, use relative imports (with the `.ts` extension).

**Why**: This keeps the public contract readable from a single file. `export *` silently widens the public surface the instant a file is added.

**In this repository**: Every `index.ts` opens with "explicit enumeration only (`export *` forbidden)," and measurement confirms zero `export *` declarations. Deep-path imports fail to resolve because `package.json`'s `exports` is only `"." : "./index.ts"`.

**Check**: `no-export-star`, `no-cross-package-relative-imports`.

---

## 2. Residents of the domain layer (D)

### D1 — Only 4 kinds of domain object, plus domain errors, belong in domain

**Rule**: What belongs in the domain layer is one of: an entity (local, or an aggregate root), a value object, a first-class collection, a domain event, or a **domain error**. If you want to place any other kind (a type that only holds data, a type that only wraps a procedure, a static-only class, a free function), **bring it to a human ruling with a measured reason attached, and place it only after the ruling.**

**Why**: If "what to build" is decided fresh each time, the design regresses back into anemic data structures plus a pile of procedures. Deciding the kinds up front converges design discussion onto "which of these is this concept."

**In this repository (measured)**: `export class` in the domain layer: design 121, requirements 65, refcheck 79, doctor 11, kernel 25 — **301 in total**. Most are value objects and first-class collections; aggregate roots are limited to those with a Repository port (design has 5). **Classes with only static methods: zero, in all 5 contexts; domain events: zero as well** (§8).

**Check**: `no-data-models-in-domain` (see D5 below) is the most effective. There is no check for the kind classification itself (review).

### D2 — Fields are `#private` only

**Rule**: Instance fields on domain classes are declared with JavaScript's `#` private fields. TypeScript's `private` / `protected` / `public` modifiers are not used (except `private constructor`). `readonly` is applied as a rule.

**Why**: TypeScript's `private` is type-checking only and passes straight through at runtime. `#` is enforced by the language. Truly guaranteeing "invisible" blocks the path of pulling the contents out and judging them from outside.

**In this repository (measured)**: Across all of `src/`, there are **zero** uses of the `private` keyword other than `private constructor`.

**Check**: `domain-fields-are-private`.

### D3 — Constructors are private; creation goes only through static factories

**Rule**: domain classes have a `private constructor` and never expose `new` to the outside. Creation goes through a named static factory.

**Why**: This lets the meaning of creation (validated or not, verbatim or not, which variant) be expressed by name. A class can have only one constructor, but it can have as many gates as it needs.

**In this repository (measured)**: Against 301 `export class` declarations in the domain layer, there are 302 `private constructor`s — zero exceptions.

**Check**: `private-constructor-in-domain`.

### D4 — Creation gates split into three

**Rule**: A creation gate — the static factory a value must pass through — is named according to its role.

| Name | Input | Validation | Return value |
|---|---|---|---|
| `of` | An already-typed value | None (the type already guarantees it) | The value itself |
| `parse` | An unvalidated raw value | **Yes** | `Result<T, E>` |
| `reconstitute` | A raw value from a **written document** | **None** (carried verbatim) | The value itself |

A branch of a closed set additionally has its own named factory per branch (e.g. `SkipReason.timeout()`).

**Why**: This is **the single most effective rule in this design**. Writing "strict creation" and "tolerant hydration" side by side, at the same location in the type, makes it obvious at a glance what happens when reading a broken document. Rejecting a broken value with `parse` means the check can no longer **report** that it's broken — so hydration carries it through verbatim, and leaves the judgment to the check.

**In this repository**: `SkipReason.parse` (a gate for a closed set of 9 values) and `SkipReason.reconstitute` (carries even unknown values verbatim) in `src/kernel/domain/skip-reason.ts`. `VerificationFinding.of` (accepts only an already-validated `FindingKind`) and `.reconstitute` (carries even an unknown kind as a string) in `src/requirements/domain/verification-finding.ts` — `src/refcheck/domain/finding.ts` has **a matching pair whose comment text is verbatim identical**.

**Measured**: In the domain layer: `of` 137, `reconstitute` 143, `parse` 48.

**Check**: None (review).

### D5 — No data models in domain

**Rule**: Do not place a public `interface` or public object type with properties (`export type X = { … }`, including discriminated unions) in the domain layer. **Adding methods does not exempt it.**

**Why**: A public data shape is an invitation to read its contents from outside and judge them there. A shape that cannot carry behavior invites a design that doesn't give it any.

**How to make an exception**: Only a published language shared with the outside world (in this repository, the verification-expression tree `Expression`) is exempted, and only by being listed in a table that spells out **its path, type name, and which layers may use it**. Adding to the table is a ruling, not a convenience.

**In this repository**: The exemption table `PUBLISHED_LANGUAGE` has **11 entries**. The only public `interface` that exists in the domain layer is `Expression` in `src/kernel/domain/expression.ts` — **exactly one** — and `architecture.test.ts` pins that fact.

**Check**: `no-data-models-in-domain`, `published-language-layers`.

### D6 — No primitives in fields

**Rule**: A domain field does not hold a bare `string` / `number` (or arrays, `Set`s, or `Map`s of them). Wrap it in a domain primitive (DP).

**There are exactly 2 exceptions**, each identified by name. ① **Prose** — free text meant for a human or an LLM to read (`detail`, `reason`, `message`, `ears`, etc.). ② **Frozen tokens** — strings whose bytes are fixed by an external contract (`state`, `from`, `to`, `attrPath`).

**Why**: `string` accepts anything, so a type system cannot catch a mix-up. But wrapping everything would force even free prose to carry a meaningless wrapper. So the exceptions are made explicit as a **table of names**.

**In this repository**: The exemption set is 19 prose names and 4 frozen-token names. A DP follows a fixed template — a single `readonly #value` field, `private constructor`, `equals`, and `asString()` (`UnitName` in `src/kernel/domain/unit-name.ts`, plus 15 others).

**Check**: `no-primitive-fields-in-domain`.

### D7 — No getters. The surface a boundary reads is a method, named with the vocabulary of conversion

**Rule**: Do not use `get x()` syntax. Expose, as methods, only the surface that an I/O boundary (Repository, serializer, presenter) needs to read, and name it with the vocabulary of conversion — a singular value is `asString()` / `asNumber()`, a collection is `toStrings()` / `toArray()`, and a document form is `toDocument()`.

**Why**: A surface that looks like a property invites "pull it out and judge it outside." Making it a method with a conversion name marks it as **a surface that exists for the boundary**.

**In this repository (measured)**: Across all of `src/`, there are **zero** `get` accessors.

**Check**: `no-get-accessors`.

### D8 — Judgment lives inside the type

**Rule**: A question a type can answer is written as a method on that type. Values are not pulled out and branched on from outside.

**Why**: Tell-Don't-Ask. When judgment is scattered, changing a rule means hunting down every call site.

**In this repository**: `AttrDecl.boundsInverted()` / `defaultBelowMin()` (a declaration answers its own inconsistency), `Components.dependencyCycles()`, `ExpressionTree.usesPrime()`.

**Deviation in this repository**: **15 places** in `design/domain` still branch outside the type (§8). The rule stands as a rule; achievement is not 100%.

**Check**: None (review).

### D9 — Collections become first-class collections

**Rule**: Do not hold a bare array or set on a field; make a type that hides it. Canonical ordering, deduplication, and lookup are methods on the collection itself.

**Why**: This lets the collection itself answer questions like "is this array already sorted" or "are there duplicates."

**In this repository**: A first-class collection (FCC) follows a fixed template — `#values: readonly T[]` plus `of` plus `Symbol.iterator` plus `toArray()` (48 in `design/domain`, 25 in `refcheck/domain`, 21 in `requirements/domain`). An index keyed by a key is wrapped in `KeyedIndex<K, V>` / `KeySet<K>` (`src/kernel/domain/`), and keys are restricted to DPs.

**Check**: `no-primitive-fields-in-domain` (partial — catches primitive arrays).

### D10 — A variant is expressed with `#kind` and named factories, and opened outward via fold

**Rule**: A value representing "one of several possible shapes" is built with a `#kind` field and a named factory per branch. Do not expose the contents via a getter for `kind`; open it either through **a single method that takes handlers for every branch** (`match<T>(handlers)`) or through a closed set of predicates. Within a single context, standardize on one or the other.

**Why**: When a branch is added, the compiler tells you about the gap. Exposing `kind` through a getter lets external `if`s multiply, and the gap stops being visible.

**In this repository**: The 7 `*Outcome` types in `refcheck/domain` use `match<T>`. `SkipReason` / `FindingKind` use named factories plus predicates.

**Deviation in this repository**: `match<T>` (refcheck) and predicate groups (requirements' `*Verdict`) coexist for the same kind of "closed variant" (§8).

**Check**: None (review).

### D11 — Aggregates protect boundary and invariant with commands, not comments

**Rule**: An aggregate root carries an identity, what it holds within its boundary, and the invariants it protects. An operation that changes state is written as **a command on the aggregate itself**, and the invariant is re-established inside that command. An optional part is held by the aggregate itself (it is not absorbed by a Repository method variant).

**Why**: "Straighten it up right before saving" lets the not-yet-straightened state leak outside. Protecting it inside the command means the aggregate is correct whenever it is looked at.

**In this repository**: `DesignVerifyDirectory` in `src/design/domain/design-verify-directory.ts` — its identity is the verify directory's path, its boundary holds a report per backend, candidates, and a cross-check, and its invariants are "at most one report per backend" and "the cross-check is either absent or derived from the current reports." Its commands are `finalizing` / `crossChecked` / `withoutCrossCheck` / `conformedTo`, and `finalizing` drops the cross-check at the same time it replaces the candidates. The mutable part is `DesignReport | null` (no `Option` type is used). `src/requirements/domain/verification-directory.ts` has the same shape.

**Check**: None (review).

### D12 — Do not build a type that wraps only a checking procedure

**Rule**: A check is written as an invariant or method of whichever side can state it — a declaration, a collection, an aggregate. Do not build a domain service that holds nothing but a checking procedure. If you judge that one is needed, bring it to a human ruling with measurement attached.

**Why**: A type that wraps a procedure makes the objects around it anemic. The moment judgment moves outside, the object degrades into "data."

**In this repository**: `AttrDecl` answers its own boundary inversion, `Components` answers dependency cycles and ownership conflicts, `DeclaredEntities` answers reference resolution. **Zero types across all 4 contexts explicitly call themselves a domain service that wraps nothing but a check.**

**Deviation in this repository**: A few types have their center of gravity in "procedure" (`DesignUnitDecl.wellFormednessErrors`, 199 lines; `UnitRefinementPlan.of`, 178 lines). Further, the comment in `src/design/domain/index.ts` (in Japanese) calls the 36 symbols it aggregates "a set of domain services" (§8).

**Check**: None (review).

---

## 3. Boundary — ports and use cases (P)

### P1 — Ports live in the usecase layer

**Rule**: Output ports (interfaces such as Repository, Client, Clock) live in `usecase/port/`. They do not live in the domain layer.

**Why**: Placing a port in domain opens a path to calling a Repository from inside a domain object. The layer blocks it.

**In this repository**: `src/kernel/usecase/` is 3 files with **zero imports** — a zero-dependency port layer holding only `RepositoryError` and `Clock`.

**Check**: `ports-live-in-port-dir`.

### P2 — A Repository's vocabulary is only "fetch" and "save"

**Rule**: The only methods a Repository interface has are **fetching** an aggregate — `findById` / `findByDirectory` — and **saving** an aggregate — `store`. The argument is the aggregate's identifier (or a path that identifies the aggregate); the return value is **the whole aggregate**. Do not build partial-update methods, conditional-save variants, or an intake for a DTO.

**Why**: A Repository is a port for moving aggregates in and out, not a place to hold business vocabulary. Growth of vocabulary here is usually a signal that **the aggregate itself is designed wrong**. If it feels like "saving needs two forms," that difference is state the aggregate itself should hold.

**In this repository (measured)**: There are 11 Repository interfaces, and **without exception** each has only the two methods `findById` (or `findByDirectory`) and `store`. The argument to `store` is always the aggregate itself.

**Deviation in this repository**: `RefinementMaterialsRepository.findById` alone returns the raw aggregate without wrapping it in `Result` (§8).

**Check**: `ports-live-in-port-dir` (naming), `commands-return-void` (`store`'s return value).

### P3 — Something outside that owns no aggregate is named a Client

**Rule**: A port that owns no aggregate, and only reads or hits the outside world, is named `*Client` and does not use Repository's vocabulary.

**Why**: The name tells the role. Repository is "our aggregate"; Client is "someone else's world."

**In this repository**: `doctor` holds **zero** Repositories, and only Clients — `DoctorWorkspaceClient` / `SolverProbeClient` / `ReleaseTagsClient`, and so on — because doctor owns no deliverable of its own; it only reads. Running a solver is likewise `Z3SolverClient` / `QuintClient`.

**Check**: `ports-live-in-port-dir`.

### P4 — Commands return no value

**Rule**: A port method that changes state returns no value on success (`Result<void, E>`).

**Why**: CQS. If a write returns a value, the caller comes to assume that value and what got saved are the same thing.

**In this repository**: Every Repository's `store` is `Result<void, RepositoryError>`.

**A deliberate exception**: A collaborator sitting above a usecase may return **a value derived from what it just wrote**, right after writing it. `DesignReportFinalizer.finalize` returns the verdict at the same time it saves — because that is "the one way to build this that guarantees the verdict printed to stdout never disagrees with what was written to the file." When you make an exception, write a comment carrying a reason at this level.

**Check**: `commands-return-void`.

### P5 — The vocabulary of failure is shared, and does not grow per port

**Rule**: A Repository's failure is expressed with one shared type. A variant **carries only material; the wording belongs to the display side**. Do not build a failure type specific to each port.

**Why**: If the failure type grows with the number of ports, the caller ends up writing the same branch over and over.

**In this repository**: `RepositoryError` (`src/kernel/usecase/port/repository-error.ts`) has only 3 variants — `not-found` (absent), `io-failed` (an I/O failure), and `corrupt` (readable, but could not be reconstituted as an aggregate). **Every Repository across all 4 contexts uses this single type; zero context-specific error types exist.**

**Check**: None (review).

### P6 — An interactor is a class, dependencies are constructor-injected, and it has one public method

**Rule**: A use case is written as a class, receives its ports through the constructor, and has exactly one public method, `execute`.

**Why**: This lines up everything a use case depends on inside the constructor. Restricting it to one public method makes it obvious the moment a class starts doing two things.

**In this repository**: All 18 `*UseCase` classes have exactly one method, `execute`. The only classes with multiple public methods are application collaborators shared by several use cases (`DesignReportFinalizer` / `VerificationReportFinalizer` / `DesignVerificationAcquirer`), and each is explicitly noted in a comment as "not a domain object."

**Check**: `ports-live-in-port-dir` (keeps interactors out of `port/`).

### P7 — A usecase's return value is a closed type of outcomes

**Rule**: `execute` does not return a `Result`; it returns **a closed union enumerating every outcome the use case can reach** (discriminated by `kind`). Success, not-applicable, and an upstream failure all become branches of the same union.

**Why**: The caller (entry) decides an exit code and output per outcome. With everything lined up in one type, the compiler catches any branch you failed to handle.

**In this repository**: `VerifyDesignOutcome` has 7 branches — `not-applicable` / `acquisition-failed` / `model-unreadable` / `version-mismatch` / `backend-unavailable` / `save-failed` / `verified`.

**Check**: None (review).

### P8 — A projection meant for display lives in usecase

**Rule**: A type assembled purely for querying or display (a read model) does not live in domain; it lives in usecase's `read-model/`. It carries no persistence method and no dependency on a port.

**Why**: Display's concerns are not domain vocabulary. Placing them in domain dilutes domain with types that carry no business meaning.

**In this repository**: The 8 types in `src/doctor/usecase/read-model/` (`CoverageAssessment`, etc.). The other 3 contexts follow a single path — "verify, build a report aggregate, save it" — so they carry no read model.

**Check**: None (review).

### P9 — Observation of the environment is injected as a port

**Rule**: Observations of the environment — the current time, whether a process is alive, randomness — are injected as a port rather than called directly.

**Why**: Calling these directly makes the function impossible to pin down in a test. This also follows from `process.*` being restricted to entry.

**In this repository**: `Clock` (`now(): number`) lives in `src/kernel/usecase/port/clock.ts`. `ProcessLiveness`, which checks whether a lock's owner is still alive, lives in `src/kernel/adapter/process-liveness.ts`, with entry injecting the implementation.

**Check**: `process-only-in-entries` (indirectly).

---

## 4. Outside world — adapter and entry (A)

### A1 — Tolerant hydration enters from adapter and chains inward through domain

**Rule**: The path that reads a written document into a domain value (`reconstitute`) starts at adapter. A domain type may call `reconstitute` in order to re-wrap its own fields into DPs. **The only place that calls the validating `parse` is the place first receiving an unvalidated raw value.**

**Why**: Hydration is the operation of "loading a document's contents onto a type exactly as written." Inserting validation partway through means a broken document can no longer be reported as "broken."

**In this repository (measured)**: Calls to `.reconstitute(` are: adapter 270, domain 201, usecase 11, entries 0. The domain-side calls take the shape of wrapping a raw `string` into a DP inside a `private constructor` or `static reconstitute` (e.g. `UnitName.reconstitute(props.unit)`).

**Check**: None (review).

### A2 — domain owns the shape of the document; adapter only paints bytes

**Rule**: The key order and structure of an output document is decided by the aggregate's `toDocument()`. adapter only receives it and turns it into a string; it never chooses key order.

**Why**: If key order is part of a frozen contract, that is domain knowledge. Placing it in adapter means multiple adapters would each hold the same contract separately.

**In this repository**: A serializer only writes `` `${JSON.stringify(doc, null, 2)}\n` ``. Conformance to a contract is likewise judged on the domain side (the `FindingsSchema` value object and the aggregate's `conformedTo`); the Repository does not read the schema.

**Check**: None (review).

### A3 — Untrusted input is checked at the adapter boundary, then passed to domain as material for judgment

**Rule**: JSON / Markdown arriving from outside is checked for syntax and schema at adapter. A failed check is **not turned into an exception**; it is returned as a `Result`, or **passed to the aggregate as a list of errors to use as material**. Domain / usecase decide the verdict itself.

**Why**: In this plugin, "broken" is a result to be reported, not a reason to abort processing.

**In this repository**: The result of a schema check reaches an aggregate as `ErrorMessages`, and the aggregate itself renders the verdict. A JSON parse failure, or a mismatched fence count, comes back at the Repository boundary as `err({kind: "corrupt", …})`.

**Check**: None (review).

### A4 — Writes are atomic, and reads and writes round-trip

**Rule**: A file write goes to a temporary file first, then is renamed. An aggregate holds the exact bytes it read as source, and writes those bytes back at save time (`findById ∘ store` is the identity).

**Why**: Even if the process dies partway through, no broken document is left behind. The round-trip property lets you guarantee that "just reading and saving" leaves the bytes unchanged — in a repository with frozen contracts, this is a first line of defense against regressions.

**In this repository**: Consolidated into `writeFileAtomically` (`src/kernel/adapter/atomic-write.ts`). An aggregate holds the source via `sourceDocument()` and returns a defensive copy.

**Check**: None (review).

### A5 — Exceptions are used only for local control flow inside adapter

**Rule**: Exceptions may be thrown only inside adapter. The exception type is **never exported**, is **caught within the same file**, and is converted into a domain value (`Result` / a result union / a skip record). No exception is ever thrown across a layer boundary.

**Why**: For a deep, recursive transformation (such as compiling an expression tree to SMT-LIB), throwing reads more naturally than threading failure back up manually at every step. But letting it leak outside means the caller can no longer read from the type what might come flying at it. Closing it locally gets both.

**In this repository (measured)**: The distribution of `catch` is: adapter 92, entries 4, domain 0, usecase 0, infrastructure 0. `CompileError` / `SmtCompileError` / `YamlError` are all unexported classes local to a single file, caught in that same file and converted into `{kind: "uncompilable"}` or a `VerificationSkipped(reason: "compile-error")`.

**Check**: None (review).

### A6 — Mapping from an exception to the vocabulary of failure is adapter's job

**Rule**: Assigning a Node exception to one of `RepositoryError`'s 3 variants is adapter's responsibility. domain and usecase see only the already-assigned vocabulary.

**In this repository**: Every Repository implementation follows the same shape — it carries the exception's `message` in `cause`, and folds it down into one of `not-found` / `corrupt` / `io-failed`.

**Check**: None (review).

### A7 — Separate an external process's configuration from its implementation

**Rule**: A Client that hits an external process or HTTP is split into a `*-client-config.ts` that carries only configuration values, and a `*-client-impl.ts` for the implementation.

**Why**: This lets a timeout or an executable path be swapped out in tests.

**In this repository**: All 8 pairs follow this shape — no exceptions.

**Check**: None (review).

---

## 5. Representation of failure (F)

### F1 — An expected failure is returned as a value

**Rule**: A failure known to be possible is returned as `Result<T, E>` or a closed result union. Exceptions are not used for ordinary control flow.

**In this repository**: Every DP's `parse` returns `Result`. A Repository returns `Result<T, RepositoryError>`. A usecase returns a result union.

**Check**: None (review).

### F2 — `throw` is used only to detect a defect, and its message begins with `defect:`

**Rule**: The only time domain or usecase may `throw` is when they detect that **a type's invariant has been broken — i.e., a defect in the program**. The message begins with `defect:`.

**Why**: Silently letting a "state that should be unreachable" through means a bug surfaces far away. Yet it is not a business failure, so making it a branch of `Result` would force every caller to write a meaningless branch. Fixing the prefix means `grep` alone tells you "this is defect detection."

**In this repository (measured)**: 7 instances in domain, 2 in usecase, **every one beginning with `defect:`**. Example: a guard for an unreachable case where `kind` is `extracted` but the payload is `null`.

**Check**: None (review). But `grep -rn 'throw new' src | grep -v defect:` finds violations mechanically (adapter's local exceptions are A5's concern).

### F3 — Let the compiler prove exhaustiveness

**Rule**: That a closed union has been fully handled is asserted with `unreachable(x: never)`. Type checking fails the moment a branch is added.

**In this repository**: `unreachable` in `src/kernel/infrastructure/result.ts`.

**Check**: None (type checking covers it).

### F4 — Split failure types into two tiers

**Rule**: A type representing failure takes a different shape depending on whether it is **a business failure** or **a failure of a creation gate**.

**(a) Domain error — a failure named in business language.** As a member of the ubiquitous language, it is written as a public class. It carries a closed variant in `#kind`, a named factory per variant, and knows for itself **how that failure appears to the outside** (frozen wording, mapping to public vocabulary). It travels as the value of a `Result`.

**(b) Failure of a creation gate — what `parse` returns.** As a discriminated union of the shape `type XxxError = { readonly kind: "…"; readonly raw: … }`, it lives inside that same file and is **never exported**. It appears only as the type parameter of the `Result` that `parse` returns; nobody outside ever refers to it by name.

**Why**: Giving these two the same shape shortchanges one of them. Turning a business failure into an anonymous `type` leaves nowhere to put its wording or its mapping to public vocabulary, and it scatters to the callers. Conversely, turning even a failure as small as "it was an empty string" into a class multiplies types that exist only to carry a name.

**In this repository**: (a) `RefinementMapDefect` in `src/design/domain/refinement-map-defect.ts` — 4 variants, 4 named factories, and the type itself carries the frozen wording and the mapping to the skip reason `compile-error`. It is exported from `index.ts`. (b) The domain layer has **46** local `type`s (`ObligationIdError`, `TokenError`, etc.). None of them are exported.

**Deviation in this repository**: The names in (b) collide — `TokenError` (`kind: "empty-token"`) is defined separately across 12 files in refcheck, and one of them, `BusinessRuleId.parse`, is actually a format check yet still returns `empty-token` (§8).

**Check**: None (review).

---

## 6. Names and files (N)

### N1 — One public type per file; the filename is the type name in kebab-case

**Rule**: A single file publishes exactly one **type** (`class` / `interface` / `enum` / `type`). The filename matches that type name in kebab-case. Functions and constants are not counted (it's fine for a matched pair of read/write functions to live together).

**Why**: This lets you look up "where is this type" without searching. You know what's inside before opening the file.

**In this repository**: `unit-name.ts` → `UnitName`, `keyed-index.ts` → `KeyedIndex`. A collection pairs with its singular by pluralizing (`finding.ts` / `findings.ts`).

**Check**: `one-public-type-per-file`.

### N2 — `index.ts` does nothing but re-export

**Rule**: `index.ts` carries no declarations. It holds only an explicit, enumerated re-export.

**Check**: `one-public-type-per-file` (a violation if `index.ts` carries a declaration), `no-export-star`.

### N3 — Production files carry a line-count ceiling

**Rule**: A file under `src/` stays under 1,000 lines.

**Why**: The value is less in the ceiling itself than in the occasion to notice "this is getting close."

**In this repository**: The actual maximum is 400 lines (`src/design/adapter/refinement-query-plan.ts`).

**Check**: `MAX_PRODUCTION_FILE_LINES` in `architecture.test.ts`.

### N4 — A handful of language-feature bans

**Rule**: Do not use `enum` (a closed set is expressed in D10's shape). Do not use the non-null assertion (`!`). Do not use `export *`. Do not place test artifacts under `src/`. Manage npm dependencies with an allow-list.

**In this repository (measured)**: Zero `enum` declarations, zero `export *` declarations. The only permitted npm package is `z3-solver`.

**Check**: `no-enums`, `no-non-null-assertions`, `no-export-star`, `no-test-payloads`, `only-sanctioned-imports`.

### N5 — Fix the vocabulary, and use the same word for the same meaning

**Rule**: A word that recurs across type names has a fixed meaning. Before adding a new word, check whether an existing word already says it.

**In this repository's vocabulary**:

| Word | Meaning |
|---|---|
| `*Decl` | A declaration **as written in a document**. Material for checking, not an already-normalized model |
| `*Outcome` | A closed union representing **the result of parsing** a document (absent / unparseable / extracted, …) |
| `*Verdict` | **The judgment** from one backend run |
| `*Plan` | A compiler's **correspondence table** (does not include the formal text itself) |
| `*Report` | An aggregate for **a document** that conforms to the output contract |
| `*Sketch` | **An incomplete picture** read from another document |
| `*Anchor` | **An identity anchor** by content hash |
| `*Materials` | **Material** for a check (not the verdict itself) |
| `*Id` | **The identifier** of an aggregate or entity |

**Deviation in this repository**: `Ref` and `Reference`, and `compareTo` and `compareBy*`, coexist inconsistently (§8).

**Check**: None (review).

---

## 7. Decision procedure for creating a new type

Apply these in order from the top, and stop at the first match.

1. **Is it a port to something outside the world?** → port (`usecase/port/`). If it moves our own aggregate in and out, it's `*Repository` (only `find*` and `store` / P2); if it only reads or hits someone else's world, it's `*Client` (P3).
2. **Is it the use case itself?** → `*UseCase` (a class, constructor injection, one `execute` / P6). If it's a procedure shared by several use cases, make it an application collaborator and note explicitly that it is "not a domain object."
3. **Is it a shape that exists only for display or query?** → a read model (`usecase/read-model/` / P8).
4. **Is it knowledge of an external format (SMT-LIB, YAML, HTTP's shape)?** → adapter. If you use an exception, don't export it — catch it within that same file (A5).
5. **Is it a unit a Repository moves in and out?** → an aggregate root. Decide its identity, boundary, and invariants, and make a state change a command (D11). The aggregate itself holds its mutable part.
6. **Is it looked up from a collection by key?** → an entity (carries an identifier).
7. **Do you want to hide an array or a set?** → a first-class collection (D9).
8. **Is it a single scalar?** → a domain primitive. Decide its `of` / `parse` / `reconstitute` gates (D4).
9. **Is it "one of several possible shapes"?** → `#kind` plus named factories plus `match<T>` or predicates (D10).
10. **Is it the immutable record of something that happened in the domain?** → a domain event.
11. **Nothing above matched** → **bring it to a human ruling before building it.** Attach the measured problem, and why the existing 4 kinds can't express it. If it looks like "a type that wraps a procedure," first try moving that judgment to whichever side can state it — a declaration, a collection, an aggregate (D12).

---

## 8. Deviations still remaining in this repository

Places where a rule is not being kept are recorded here as known. This is written both so that **the rule is not bent to fit the facts**, and so a porting target can tell "this one does not need to be copied."

### Deliberate exceptions (the reason is written in the code)

| Location | What | Reason |
|---|---|---|
| `Expression` in `src/kernel/domain/expression.ts` | The only public `interface` with properties in the domain layer | It is itself a published language shared with the outside world. Listed as one entry in the exemption table |
| `src/kernel/domain/content-hash.ts` | Imports `node:crypto` directly from domain | A side-effect-free computation. `no-io-in-pure-layers` permits `node:crypto` specifically for domain |
| `ReferenceCheckReport` in `src/refcheck/domain/reference-check-report.ts` | The **only mutable aggregate** across all 4 contexts (3 commands returning `void`) | A "no-silent-drop ledger" design that re-establishes `checked = all families − failed − skipped` after each command. 15 checking methods depend on this mutability |
| `DesignReportFinalizer.finalize` / `VerificationReportFinalizer.finalize` | Writes while returning a value (an exception to P4) | The one way to build this that guarantees stdout's verdict and the file's contents never disagree |
| The compiler group under `src/design/adapter/` and `src/requirements/adapter/` | 300–400-line compilers living inside adapter | This seals the knowledge of external formats — SMT-LIB, Quint — here, and returns to domain only the facts a verdict needs |
| Duplication of the expression compiler (`smtOfExpr` and `smtOf`) | Nearly identical logic in two places | Because each context freezes its own reference-resolution table and wording, they are deliberately not unified |

### Places that are simply inconsistent (no rationale found)

| Location | What |
|---|---|
| 15 places in `design/domain` | Pull a value out and branch on it outside the type (D8 not achieved) |
| The comment in `src/design/domain/index.ts` | Calls the 36 symbols it aggregates (in Japanese) "a set of domain services." In substance they are aggregates, value objects, and FCCs, but `UnitRefinementPlan.of` (178 lines) and `DesignUnitDecl.wellFormednessErrors` (199 lines) have their center of gravity in procedure (D12 not achieved) |
| 7 types in `refcheck/domain` | The style of holding fields bundled together under `#seed` coexists with the field-decomposed style in the same layer. The same type literal is copied out 3 times |
| `PluginVersion.parse` in `doctor/domain` | The only one of all 48 `parse`s that does not return `Result` (`PluginVersion \| null`). `doctor/domain` imports zero `kernel-infrastructure` |
| 5 `*Outcome` types in `refcheck/domain` | Handling of the same "unreachable branch" case is split — 3 types `throw`, 2 types silently fall into another branch |
| The `reason` on `VerificationSkipped` / `Skipped` | Both carry a raw `string`, even though kernel has a `SkipReason` DP (a closed set of 9 values) (D6 not achieved) |
| `RefinementMaterialsRepository.findById` | The only one of 11 Repositories that does not return `Result` (P2 not achieved) |
| `SiblingUnitIndex` | The only index that does not use `KeyedIndex`, and instead holds a raw nested `ReadonlyMap` |
| `refcheck/domain/functional-design.ts` | An orphan file with only comments (zero exports, imported from nowhere) |
| The public surface of a closed union | Split between `match<T>` (refcheck) and predicate groups (requirements' `*Verdict`) (D10 not achieved) |
| `HealthVerdict.document()` | The only conversion not named `toDocument()` |
| `Ref` and `Reference`, `compareTo` and `compareBy*` | Vocabulary drifts (N5 not achieved) |
| 17 lines in `design/domain` | Reach a file in the same package via a bare specifier (`@deep-spec/design-domain`). L7's requirement that same-package imports be relative is not achieved, concentrated in files belonging to the unified refinement family. One file (`design-event-catalog.ts`) mixes relative and bare in the same file |
| The coverage configuration in `bunfig.toml` | The comment says "domain layer only," but `kernel/usecase` and `kernel/infrastructure` are missing from the exclusion list and are, in fact, subject to the floor |

### On domain events

**Domain events number zero across all 4 contexts.** D1 lists them as a kind, but this repository has no actual instance of one. Types that call themselves an "event" exist, but every one of them is the declaration of a state-machine transition or a mapping, not the record of something that happened. There is no publish/subscribe mechanism either. If a porting target needs events, this rule set does not show a shape for them.

---

## 9. Porting to another plugin

### What ports as-is

`L1`–`L7` (structure), `D2`–`D4`, `D7`, `D9`–`D12`, `P1`–`P9`, `A5`–`A7`, `F1`–`F4`, `N1`–`N4`.

These are domain-independent. In particular, **`P2` (closing a Repository's vocabulary) and `D4` (splitting creation gates into three)** pay off from the very start, even in a small plugin.

### What to decide by looking at the domain

| Rule | Condition under which it pays off |
|---|---|
| `D5` / `D6` (ban on data models / ban on primitives) | Whether type confusion actually happens at scale. In a small plugin, wrapping every value in a DP can become a burden. If you adopt it, keep the prose and frozen-token exemptions **as a table of names from the start** |
| `A1`–`A4` (hydration, document, preserving the source) | Whether the output is frozen at the byte level. Without a frozen contract, the round-trip property on the source is unnecessary |
| `D11` (aggregate and command) | Whether the unit of persistence spans multiple files or multiple elements. For a single file's worth of reads and writes, it is excessive |
| `N3` (line-count ceiling) | A matter of preference. But once you decide a number, watch it with a machine |

### Steps for porting

1. **Copy this document and [`enforcement.md`](enforcement.md).** Rewrite §8's deviation tables for your own repository (it's fine to leave them empty — filling them in over time is normal).
2. **Decide the layers and put a `package.json` in place.** Add `[install] linker = "isolated"` to `bunfig.toml`. Without this, `L2` does not take effect.
3. **Bring in the mechanical checks.** Copy `tests/architecture/rules.ts` and replace `CONTEXTS` / `LAYERS` / `ENTRY_FILES` / the exemption tables with your own. You don't need all 20 rules at once — starting with `L2` / `L3` (layer direction), `D2` / `D3` (fields and constructors), and `N1` (one public type per file) makes it easier to keep the rules you add afterward.
4. **Always write a red/green example.** Prove with a test that "a violation can be detected." A check that can't detect anything protects nothing, green or not.
5. **Put exemptions in a table.** Don't build a name-based exclusion, or an implicit "this file is special." Listing something in the table is a ruling, not a convenience.

### What is better left unported

- **The contents of `SANCTIONED_CROSS_CONTEXT`** (in this repository, the single entry `design/domain → requirements/domain`). Port the table's mechanism; decide the contents for your own contexts.
- **The 11 entries in `PUBLISHED_LANGUAGE`.** Likewise, port only the mechanism.
- **The deviations in §8.** Do not copy these.

---

## References

- [`enforcement.md`](enforcement.md) — an inventory of the 20 mechanical checks, and how they map onto the rules
- [`../decisions.md`](../decisions.md) — the when and why behind individual rulings (this document is "the rules as they are now"; that one is "the history")
