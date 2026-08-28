# aidlc-deep-spec-analysis-plugin

Neurosymbolic requirements verification for [AI-DLC v2](https://github.com/awslabs/aidlc-workflows), packaged as an additive plugin. An LLM formalizes `requirements.md` into a backend-neutral IR; deterministic solver backends — z3 (SMT) and [Quint](https://quint-lang.org/) — check it for contradictions, completeness gaps, and scenario violations; every finding returns to the human as a structured A/B question. Core is never modified: disable the plugin and the vanilla workflow remains.

This is the development workspace. The plugin itself lives in [`deep-spec-analysis/`](deep-spec-analysis/) — see its [README](deep-spec-analysis/README.md) for the full design.

## Highlights

- **Two solver backends from day one** — SMT (z3, exhaustive) and Quint (bounded/simulation), cross-checking each other's scenario verdicts to catch formalization defects, not just requirements defects.
- **No silent gaps** — every obligation is either checked, skipped with a reason, or reported `unavailable`; the coverage table shows exactly what was and wasn't verified.
- **Deterministic** — same IR + same environment ⇒ byte-identical sensor output (fixed seeds, canonical sorting, no timestamps), enforced by byte-exact conformance tests.
- **Graceful degradation** — missing solvers never block the stage; they become advisory findings and `/aidlc --doctor` hints.

## Quickstart

The build emits a **real host plugin** per harness under `deep-spec-analysis/dist/<harness>/` (Claude Code, Codex, Copilot, Cursor, Kiro, Kiro IDE, opencode). Claude Code is shown here.

### Requirements

- [bun](https://bun.sh/)
- A target project with [AI-DLC v2](https://github.com/awslabs/aidlc-workflows) installed
- Optional, for the solver backends in the target project: node ≥ 23 (z3 child process), `@informalsystems/quint`, JDK 17+ (Apalache bounded checking) — setup in the [plugin README](deep-spec-analysis/README.md)

### Build

```sh
git clone --recurse-submodules https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin.git
cd aidlc-deep-spec-analysis-plugin/deep-spec-analysis
bun install
bun ../aidlc-workflows/core/tools/aidlc-plugin-build.ts . claude   # → dist/claude/   (codex, cursor, … for other harnesses)
```

### Install into your AI-DLC project

In Claude Code, inside the target project:

```
/plugin marketplace add <workspace>/deep-spec-analysis/dist/claude
/plugin install aidlc-deep-spec-analysis@aidlc-plugins
```

With Codex CLI (build with `codex` instead of `claude`), inside the target project:

```sh
codex plugin marketplace add <workspace>/deep-spec-analysis/dist/codex
codex plugin add aidlc-deep-spec-analysis@aidlc-plugins   # approve the one-time hook trust prompt
```

On the next session start the plugin's hook composes the stage, sensors, tools, and knowledge into the project's harness tree (`.claude/`; `.codex/` on Codex, where the hook fires lazily on the first interaction). Nothing outside that project is touched; disabling the plugin recomposes the vanilla workflow. `/aidlc --doctor` reports solver availability.

## Development

The clone + `bun install` above is also the full development setup — it fetches this package's dev dependencies only and installs nothing into any project. Verify changes with:

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

- Illustrated architecture overview, in Japanese: [docs/architecture.md](docs/architecture.md)
- Plugin design and stage walkthrough: [deep-spec-analysis/README.md](deep-spec-analysis/README.md)
- Design decisions, spike results, deviations from the draft: [deep-spec-analysis/docs/decisions.md](deep-spec-analysis/docs/decisions.md)

## Getting help

- Issues: <https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/issues>

## License

MIT. See [LICENSE](LICENSE).
