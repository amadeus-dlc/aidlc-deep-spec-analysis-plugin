# Architecture Documentation

English | [日本語](README.ja.md)

Design rules for DDD and Clean Architecture in `deep-spec-analysis/src/`, written **so they can be carried as-is into another AI-DLC plugin**.

| Document | Content |
|---|---|
| [`design-rules.md`](design-rules.md) | The rules themselves. 35 rules across 6 groups (structure, domain, boundaries, the outside world, failure, naming), each written as rule / why / example / check. Includes the decision procedure for creating a new type, and the deviations that remain in this repository |
| [`enforcement.md`](enforcement.md) | An inventory of the 20 mechanical checks. A mapping of which rules are mechanically enforced and which rely on human review. Also the exemption table and the checks' known limitations |

## Where this document sits

- **This is "the current rules"** — what to follow.
- [`../decisions.md`](../decisions.md) **is "the record"** — which ruling was made when and why. If a rule changed, the reason is over there.
- The `## Mandated` section of `aidlc/spaces/default/memory/project.md` is a **one-line summary of each ruling**. The workflow reads it automatically.

When something conflicts, this document and the code are authoritative (this document was written by reading the code).

## How this was written

Every one of the 489 files and 26,007 lines under `src/` was read in full, **fixing "this is how it's actually written" first and extracting the norms from that**. The existing design documents were deliberately not consulted — to take the code's reality rather than the documents' claims.

Because of that, places where a rule is not followed are **recorded as-is** in [`design-rules.md` §8](design-rules.md#8-deviations-still-remaining-in-this-repository). The rules were not bent to make things fit. This is also so that a porting target can tell "this doesn't need to be copied."

## Using this in another plugin

Short version:

1. Copy `design-rules.md` and `enforcement.md`, and replace the deviations table in §8 with your own repository's (it's fine to start empty).
2. Decide on layers, put a `package.json` in each layer, and add `[install] linker = "isolated"` to `bunfig.toml`. Without this, layer boundaries have no effect at runtime.
3. Copy `tests/architecture/rules.ts` and swap in your own context, layers, entries, and exemption table. You don't need to bring in all 20 rules at once — start with layer direction, fields-and-constructor, and one-public-type-per-file.
4. Every check must have both a red example (it detects the violation) and a green example.

Which rules are domain-dependent and which aren't is in [`design-rules.md` §9](design-rules.md#9-porting-to-another-plugin).

## What is currently upheld (measured)

| Item | Value |
|---|---|
| Mechanical checks | 20 rules, all with red/green examples. `bun test tests/architecture.test.ts` → 38 pass / 0 fail |
| `export class` / `private constructor` in domain | 301 / 302 (zero exceptions) |
| TS `private` keyword (outside constructors) | 0 occurrences |
| `get` accessors | 0 occurrences |
| `enum` declarations / `export *` declarations | 0 / 0 |
| Files importing `node:*` | adapter 27, entries 10, domain 1, usecase 0, infrastructure 0 |
| `catch` | adapter 92, entries 4, domain 0, usecase 0, infrastructure 0 |
| Repository ports | 11, all with exactly the two methods `find*` and `store` |
| Max lines per `production` file | 400 (ceiling 1,000) |
