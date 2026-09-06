# Usecase getter checks

English | [日本語](usecase-getter-lint.ja.md)

The usecase layer holds flow control; judgment, manipulation, and
computation on a fetched model's data is delegated to the domain type that
owns that state. Extracting values for display or protocol purposes
belongs to the adapter. To let this discipline be checked even mid-fix, a
linter was built that fails on existing violations too.

## Running it

Run it from `deep-spec-analysis/`.

```sh
bun run lint:usecase-getters
bun run lint:usecase-getters --json
bun run check
```

- `lint:usecase-getters`: prints the call site, the rule name, the
  callee's type/method, and the declaration site.
- `--json`: prints the same diagnostics as JSON. Use
  `--project <tsconfig.json>` to specify what to scan.
- `check`: runs this check after Biome succeeds. CI uses the same command.
- Exit code: 0 with no violations, 1 with violations or items needing
  review, 2 for an error that blocks configuration or type resolution.
- `check:biome` checks only formatting and ordinary lint. `check:fix`
  applies only Biome's safe fixes.

It was introduced before production code was remediated, to record
existing violations, and those were then cleared by relocating
responsibility. There is still no grandfathered-count subtraction, no
per-file exemption, and no suppression comment — a violation fails the
check.

## Classification

| Rule | Target |
| --- | --- |
| `usecase-domain-getter` | A method that returns a value the domain holds, a copy/conversion of its representation, relaying that, or a reference to a public data attribute |
| `usecase-result-unwrapping` | A reference to or destructuring of the shared `ResultSuccess.value`. Handled as a separate rule, being the entry point that unpacks a success value |
| `unclassified-domain-access` | A reference into the domain that can't be classified as a getter-style public surface, due to a cycle, a bodyless declaration, or similar |
| `unclassified-usecase-call` | A call/reference whose callee implementation can't be pinned down — erased to `any`, projected onto a structural type, etc. Distinguished from a port's contract |

Callees are resolved with the installed TypeScript 7.0.2's asynchronous
Compiler API. Naming such as `get`/`as` or argument count is never used as
the disqualifying condition. Beyond a method that directly returns a
private field, it also examines access through a local variable, relaying
a getter, turning a value into an array, defensive copies, and deriving a
count or a string representation. A getter is still flagged even when its
return value is a VO.

Aliased imports, inheritance, bracket access, optional chaining, function
aliases, destructuring, and `call`/`apply`/`bind` are all detected by
examining the callee's declaration and member reference. A same-named
port method or an unrelated object is not in scope.

A comparison/predicate, an immutable conversion of a domain value,
interpreting a result, and dispatching to a callback are distinguished
from a plain getter. `supportsMajor()`, `passes()`, `lowered()`, and
`interpret()` are not rejected on name alone. Branching flow on
success/failure via `Result.ok` is not prohibited by this check.

The scan target is the whole of `src/<context>/usecase/**/*.ts` included
in tsconfig. This covers not only `*UseCase` but also Finalizer,
Acquirer, and read-model. A conversion inside the adapter or domain
itself is outside this caller-side constraint.

## Limits and remediation judgment

This check is a static analysis that finds usage sites reaching a
getter's declaration; it does not prove the correctness of business
judgment in general. For example, code that runs numeric operations on a
port's raw data to decide a diagnosis can be written without calling a
domain getter at all. Moving business judgment inside a `match` callback
doesn't amount to relocating responsibility, either.

It detects projection onto a structural type, `any`, and an unresolvable
call, and never passes without confirming the implementation. It does
not prove the complete data flow through a mutable local variable, an
array built in a loop, or a helper reached via destructuring or an
argument; anything that can't be pinned down as retrieval or manipulation
fails as unclassified. There are also regression tests for generators,
fallbacks, Boolean conversion, computed destructuring, and union-key
usage.

Holding a domain type's input result as-is, and accumulating a result
whose initial value and every assignment are immutable domain
operations, are both distinguished from a getter. Provenance also
propagates through a helper's arguments, so wrapping the internal value
in `identity(this.#privateValue)` to extract it is not an allowed
workaround.

Being unclassified is not a determination that it's a getter violation.
Rather than erasing the type or moving the getter into a
differently-named helper just to make a needs-review diagnostic
disappear, cross-check it with a manual audit. This is not a check that
detects arbitrary reflection, dynamic code generation, or business
judgment in general.

Backend-specific logic such as Quint's does not belong in the generic
Result. Keep the contract that handles retrieval success/failure
separate from the operations of the domain type that owns verification
preparation and verification results; the usecase only orchestrates the
order of retrieve, delegate, and store.

The linter itself lives under `scripts/lint/`, its CLI is
`scripts/lint-usecase-getters.ts`, and the tests for detection examples,
clean examples, and CLI exit codes live in
`tests/usecase-getter-lint.test.ts`. Because the Compiler API is an
unstable public surface, always run these tests and the real-source
check again on a TypeScript upgrade.
