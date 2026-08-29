# aidlc-deep-spec-analysis-plugin

Neurosymbolic requirements verification for [AI-DLC v2](https://github.com/awslabs/aidlc-workflows), packaged as an additive plugin. An LLM formalizes `requirements.md` into a backend-neutral IR; deterministic solver backends — z3 (SMT) and [Quint](https://quint-lang.org/) — check it for contradictions, completeness gaps, and scenario violations; every finding returns to the human as a structured A/B question. Core is never modified: disable the plugin and the vanilla workflow remains.

This is the development workspace. The plugin itself lives in [`deep-spec-analysis/`](deep-spec-analysis/) — see its [README](deep-spec-analysis/README.md) for the full design.

## Highlights

- **Two solver backends from day one** — SMT (z3, exhaustive) and Quint (bounded/simulation), cross-checking each other's scenario verdicts to catch formalization defects, not just requirements defects.
- **No silent gaps** — every obligation is either checked, skipped with a reason, or reported `unavailable`; the coverage table shows exactly what was and wasn't verified.
- **Deterministic** — same IR + same environment ⇒ byte-identical sensor output (fixed seeds, canonical sorting, no timestamps), enforced by byte-exact conformance tests.
- **Graceful degradation** — missing solvers never block the stage; they become advisory findings and `/aidlc --doctor` hints.
- **Design-artifact integrity (phase 1 of the design-verification extension)** — solver-free refcheck sensors fire while `domain-design`, `contract-design`, and `functional-design` write their artifacts, catching dangling references, asymmetric or cyclic dependencies, phantom FR sources, state machines that disagree with the entity model, and entity drift between design stages ([requirements: #2](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/issues/2)).

## Quickstart

### Requirements

- [bun](https://bun.sh/)
- A target project with [AI-DLC v2](https://github.com/awslabs/aidlc-workflows) installed
- Optional, for the solver backends in the target project: node ≥ 23 (z3 child process), `@informalsystems/quint`, JDK 17+ (Apalache bounded checking) — setup in the [plugin README](deep-spec-analysis/README.md)

### Install into your AI-DLC project

```sh
git clone --recurse-submodules https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin.git
cd aidlc-deep-spec-analysis-plugin
bun deep-spec-analysis/scripts/install.ts --project <your-aidlc-project>   # --harness codex, kiro, … (default: claude)
```

The installer builds the harness projection under `deep-spec-analysis/dist/<harness>/` — a **real host plugin** (Claude Code, Codex, Copilot, Cursor, Kiro, Kiro IDE, opencode) — and composes the stage, sensors, tools, and knowledge into the project's harness tree (`.claude/`, `.codex/`, …). Store harnesses (Claude Code, Codex, Copilot, opencode) compose directly from `dist/` and nothing is copied into the project; the storeless kinds (Kiro, Kiro IDE, Cursor) first get the projection folder-dropped into the project root, as those hosts expect. Add `--dry-run` to verify the compose without touching the project. Nothing outside that project is touched; disabling the plugin recomposes the vanilla workflow. Re-running the installer is also the **upgrade path**: it refreshes the plugin's own previously composed files before composing (the compose hook itself never overwrites existing files), so a new plugin version never leaves stale schemas or tools behind. `/aidlc --doctor` reports solver availability.

> The installer is a folder-drop: it has no install-time trust gate, so only point it at a build you would run code from. For a store-mediated trust prompt, use the host plugin flows below instead.

Note: the stage declares `scopes: [enterprise, feature]`, so it only runs for intents created with those scopes — a `classic`-scope intent marks it SKIP by design.

### Adopting mid-project

You don't need to have started with this plugin. Composition is additive, so installing into a project whose AI-DLC workflow is already underway changes nothing else — and **intents that predate the install can still be verified**. Run the stage in isolation against an existing intent's requirements, without advancing its workflow:

```
/aidlc --stage deep-spec-analysis-verify --single
```

(also packaged as the composed `/deep-spec-analysis-verify` skill). The engine resolves the intent's existing `requirements.md`, the sensors write their findings under that intent's record, and the workflow's Current Stage is never touched. Intents created after the install pick the stage up automatically. The one restriction is scope: a `classic`-scope intent is refused even in single mode — move it to `feature` or `enterprise` first.

And you don't have to *remember* any of that: the installer ends with a coverage scan that lists every eligible intent whose requirements have no verification yet (with the exact command each one needs), and `/aidlc --doctor` keeps reporting that coverage afterwards — including intents whose requirements changed after their last verification. The whole late-adoption path, detection included, is regression-tested in `tests/intent-e2e.test.ts`.

### Alternative: install through the host plugin store

Build the projection first, from `deep-spec-analysis/`: `bun ../aidlc-workflows/core/tools/aidlc-plugin-build.ts . claude` (or `codex`).

In Claude Code, inside the target project:

```
/plugin marketplace add <workspace>/deep-spec-analysis/dist/claude
/plugin install aidlc-deep-spec-analysis@aidlc-plugins
```

With Codex CLI, inside the target project:

```sh
codex plugin marketplace add <workspace>/deep-spec-analysis/dist/codex
codex plugin add aidlc-deep-spec-analysis@aidlc-plugins   # approve the one-time hook trust prompt
```

On the next session start the plugin's SessionStart hook composes into `.claude/` (`.codex/` on Codex, where the hook fires lazily on the first interaction).

## Development

Setup is the Quickstart clone plus dev dependencies:

```sh
cd deep-spec-analysis
bun install        # dev dependencies only — installs nothing into any project
```

Verify changes with:

```sh
bun test                                                    # byte-exact conformance suite
bun ../aidlc-workflows/core/tools/aidlc-plugin-validate.ts .
bun ../aidlc-workflows/core/tools/aidlc-plugin-build.ts . claude   # → dist/claude/
bun ../aidlc-workflows/core/tools/aidlc-plugin-test.ts . --install <aidlc-project> --harness claude
                                # compose dry-run — verifies the merge without modifying the target
```

## Repository layout

| Path | Role |
|---|---|
| [`deep-spec-analysis/`](deep-spec-analysis/) | The plugin's authored source: stage, sensors, tools, contracts, tests |
| [`aidlc-workflows/`](https://github.com/awslabs/aidlc-workflows) | Framework checkout (submodule) — supplies the validate/build/test toolchain; never edited here |
| `deep-spec-analysis-sandbox/` | Disposable AI-DLC install used as the compose-test target (`aidlc-plugin-test.ts --install`) — gitignored |

## Documentation

- Usage guide — fresh projects and mid-project adoption, in Japanese: [docs/usage.md](docs/usage.md)
- Illustrated architecture overview, in Japanese: [docs/architecture.md](docs/architecture.md)
- Plugin design and stage walkthrough: [deep-spec-analysis/README.md](deep-spec-analysis/README.md)
- Design decisions, spike results, deviations from the draft: [deep-spec-analysis/docs/decisions.md](deep-spec-analysis/docs/decisions.md)

## Getting help

- Issues: <https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/issues>

## License

MIT. See [LICENSE](LICENSE).
