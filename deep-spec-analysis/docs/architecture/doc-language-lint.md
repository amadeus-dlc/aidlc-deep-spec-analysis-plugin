# Document language check

English | [日本語](doc-language-lint.ja.md)

`bun run lint:doc-language` checks that the prose of a single Markdown file does not mix English and Japanese. It is wired into `bun run check` and `bun run lint`, so it also runs in CI.

The check looks only for **the presence of Japanese**; it does not detect arbitrary language mixing. Documents in this repository come as an English/Japanese pair, so those are the two languages it keeps apart.

## The discipline

Documents in this repository come in pairs: an English `<name>.md` and a Japanese `<name>.ja.md` (`docs/decisions.md` / `.ja.md`, `docs/architecture/design-rules.md` / `.ja.md`). **A single file never mixes the two.** When it does, a reader cannot tell which version to read, and a missing translation stops being visible.

| Rule | What counts as a violation |
|---|---|
| `japanese-in-english-doc` | Japanese appears in the prose of a Markdown file that is **not** `*.ja.md` |
| `no-japanese-in-ja-doc` | A `*.ja.md` contains no Japanese at all (an untranslated shell left in English) |

## What counts as prose

Fenced code blocks (both ``` and ~~~) and inline code spans (text wrapped in `` ` ``) are **not** checked. **Both rules judge this same prose** — a `*.ja.md` is also read after code removal, so a shell whose only Japanese sits inside code stays a violation.

A fence records its opening character and length, and only a fence of the same character and at least that length closes it. An inline span opened with N backticks closes on exactly N, and a span may cross lines (both are CommonMark rules).

Source comments in this repository are written in Japanese, so it is legitimate for an English document to quote one verbatim. As long as the quotation is enclosed as code, it is not a violation. Japanese written in the running text sits outside those fences and is caught.

## Detection is by kana

Japanese is detected by the presence of hiragana (U+3040–U+309F), katakana (U+30A0–U+30FF), or half-width katakana (U+FF66–U+FF9F). **Kanji is not examined.**

A kanji-only term cannot be told apart from Chinese, and may legitimately appear in an English document as a technical term or a proper noun. Japanese prose, on the other hand, always carries kana in practice, so this is enough at file granularity.

**Limit**: a line written entirely in kanji is not detected. A green example in `tests/doc-language-lint.test.ts` pins that behaviour as intended.

## Exemptions

Exemptions are a table. No implicit exclusion, and no exception by partial name match.

| Target | Reason |
|---|---|
| Anything under `tests/fixtures/` | Input data for tests, not documentation. Carrying Japanese body text as a sample requirements document is the specification itself |

Directories excluded from the walk: `node_modules`, `.git`, `tools`, `dist` (dependencies and generated output).

## Usage

```bash
bun run lint:doc-language                       # check under the package root
bun scripts/lint-doc-language.ts --json         # machine-readable list
bun scripts/lint-doc-language.ts --root <dir>   # check a different root (used by tests)
```

On a violation it exits 1 and prints `path:line [rule] excerpt` plus how to fix it, once per violation. There is no exemption list to grow and no mechanism for subtracting a pre-existing count — existing violations fail too.

## How to fix a violation

1. Move the Japanese prose into the `.ja.md` of the same name. Create it if it does not exist.
2. Write the English translation in the `.md`.
3. Put the language-switch line third in both — `English | [日本語](<name>.ja.md)` in the English file, `日本語 | [English](<name>.md)` in the Japanese one.
4. Make cross-links inside each document point at siblings of the same language.

## Implementation and tests

- Implementation: `scripts/lint/doc-language.ts` (exports `lintDocLanguage(root)` and `stripCode(markdown)`)
- CLI: `scripts/lint-doc-language.ts`
- Tests: `tests/doc-language-lint.test.ts` — carries both red examples (the check detects a violation) and green examples (it does not fire on legitimate content)

## References

- [`enforcement.md`](enforcement.md) — inventory of the mechanical checks
- [`usecase-getter-lint.md`](usecase-getter-lint.md) — the other custom linter
