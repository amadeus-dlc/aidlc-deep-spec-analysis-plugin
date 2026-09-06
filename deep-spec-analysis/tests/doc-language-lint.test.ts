import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { lintDocLanguage, stripCode } from "../scripts/lint/doc-language.ts";

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function sandbox(files: Readonly<Record<string, string>>): string {
  const root = mkdtempSync(join(tmpdir(), "doc-language-"));
  roots.push(root);
  for (const [relativePath, contents] of Object.entries(files)) {
    const absolute = join(root, relativePath);
    mkdirSync(dirname(absolute), { recursive: true });
    writeFileSync(absolute, contents);
  }
  return root;
}

describe("doc language lint — red examples (the check must detect these)", () => {
  test("Japanese prose in an English-named document is a violation, and the first line is named", () => {
    const report = lintDocLanguage(
      sandbox({ "README.md": "# Title\n\nEnglish line.\n日本語の散文がここにある。\nMore English.\n" }),
    );
    expect(report.diagnostics).toHaveLength(1);
    expect(report.diagnostics[0]?.rule).toBe("japanese-in-english-doc");
    expect(report.diagnostics[0]?.path).toBe("README.md");
    expect(report.diagnostics[0]?.line).toBe(4);
    expect(report.diagnostics[0]?.excerpt).toBe("日本語の散文がここにある。");
  });

  test("katakana alone is a violation — it does not take a full sentence", () => {
    const report = lintDocLanguage(sandbox({ "docs/guide.md": "# Guide\n\nSee the リンター output.\n" }));
    expect(report.diagnostics.map((d) => d.rule)).toEqual(["japanese-in-english-doc"]);
  });

  test("a .ja.md carrying no Japanese is a violation — an untranslated shell is caught", () => {
    const report = lintDocLanguage(sandbox({ "docs/guide.ja.md": "# Guide\n\nStill English.\n" }));
    expect(report.diagnostics).toHaveLength(1);
    expect(report.diagnostics[0]?.rule).toBe("no-japanese-in-ja-doc");
    expect(report.diagnostics[0]?.path).toBe("docs/guide.ja.md");
    expect(report.diagnostics[0]?.line).toBe(0);
  });

  test("every violating file is reported, not just the first", () => {
    const report = lintDocLanguage(
      sandbox({
        "a.md": "これは日本語。\n",
        "b.md": "これも日本語。\n",
        "c.ja.md": "English only\n",
        "ok.md": "English\n",
      }),
    );
    expect(report.diagnostics.map((d) => d.path).sort()).toEqual(["a.md", "b.md", "c.ja.md"]);
    expect(report.checkedFiles).toBe(4);
  });
});

describe("doc language lint — green examples (the check must not fire on these)", () => {
  test("an English document that quotes Japanese inside code is clean", () => {
    const root = sandbox({
      "docs/rules.md": [
        "# Rules",
        "",
        "The source comment reads as follows.",
        "",
        "```ts",
        "// 種別規律の裁定——ドメインサービスは作らない",
        'const kind = "invariant";',
        "```",
        "",
        "An inline span such as `ドメインサービス` is a quotation too.",
        "",
        "~~~text",
        "日本語のブロックも同じ",
        "~~~",
        "",
        "That is all.",
        "",
      ].join("\n"),
    });
    expect(lintDocLanguage(root).diagnostics).toEqual([]);
  });

  test("a .ja.md written in Japanese is clean, and English inside it is fine", () => {
    const report = lintDocLanguage(
      sandbox({ "docs/rules.ja.md": "# 規則\n\n`Result<T, E>` を返す。The identifier stays English.\n" }),
    );
    expect(report.diagnostics).toEqual([]);
    expect(report.checkedFiles).toBe(1);
  });

  test("kanji without kana does not fire — it cannot be told apart from a technical term", () => {
    expect(lintDocLanguage(sandbox({ "docs/x.md": "# Design\n\nThe token 設計 appears here.\n" })).diagnostics).toEqual(
      [],
    );
  });

  test("test fixtures are exempt: they are input data, not documentation", () => {
    const report = lintDocLanguage(
      sandbox({ "tests/fixtures/intent/requirements.md": "# 要件\n\n日本語の要件文書。\n", "README.md": "English\n" }),
    );
    expect(report.diagnostics).toEqual([]);
    expect(report.checkedFiles).toBe(1);
  });

  test("generated and vendored trees are not walked", () => {
    const report = lintDocLanguage(
      sandbox({
        "tools/generated.md": "これは日本語。\n",
        "node_modules/pkg/readme.md": "これも日本語。\n",
        "ok.md": "English\n",
      }),
    );
    expect(report.diagnostics).toEqual([]);
    expect(report.checkedFiles).toBe(1);
  });
});

describe("stripCode", () => {
  test("blanks fenced blocks and inline spans while keeping the line numbering", () => {
    const stripped = stripCode(["one", "```", "日本語", "```", "five `日本語` after", ""].join("\n"));
    expect(stripped.split("\n")).toEqual(["one", "", "", "", "five  after", ""]);
  });

  test("a tilde fence is not closed by a backtick fence", () => {
    const stripped = stripCode(["~~~", "日本語", "```", "まだ中", "~~~", "outside"].join("\n"));
    expect(stripped.split("\n").at(-1)).toBe("outside");
    expect(stripped).not.toContain("まだ中");
  });

  test("a longer fence is not closed by a shorter one — the opening length is kept", () => {
    const stripped = stripCode(["````", "```", "かな", "```", "````", "outside"].join("\n"));
    expect(stripped).not.toContain("かな");
    expect(stripped.split("\n").at(-1)).toBe("outside");
  });

  test("a span opened with several backticks closes only on the same count", () => {
    const stripped = stripCode("before ``かな ` かな`` after");
    expect(stripped).toBe("before  after");
  });

  test("a span may cross lines, and the newlines it spans are kept", () => {
    const stripped = stripCode(["a `かな", "かな` b", "c"].join("\n"));
    expect(stripped.split("\n")).toEqual(["a ", " b", "c"]);
  });

  test("an unclosed backtick is prose, not a span that swallows the rest", () => {
    const stripped = stripCode(["a ` b", "かなの散文"].join("\n"));
    expect(stripped).toContain("かなの散文");
  });
});

describe("doc language lint — the two rules judge the same prose", () => {
  test("a .ja.md whose only Japanese sits inside code is still an untranslated shell", () => {
    const report = lintDocLanguage(
      sandbox({
        "docs/guide.ja.md": ["# Guide", "", "English prose only.", "", "```ts", "// かなのコメント", "```", ""].join(
          "\n",
        ),
      }),
    );
    expect(report.diagnostics.map((d) => d.rule)).toEqual(["no-japanese-in-ja-doc"]);
  });

  test("a .ja.md whose only Japanese sits in an inline span is likewise a shell", () => {
    const report = lintDocLanguage(sandbox({ "docs/guide.ja.md": "# Guide\n\nSee `かな` here.\n" }));
    expect(report.diagnostics.map((d) => d.rule)).toEqual(["no-japanese-in-ja-doc"]);
  });

  test("half-width katakana is Japanese too", () => {
    const report = lintDocLanguage(sandbox({ "docs/x.md": "# Title\n\nSee ｶﾀｶﾅ here.\n" }));
    expect(report.diagnostics.map((d) => d.rule)).toEqual(["japanese-in-english-doc"]);
  });

  test("half-width katakana satisfies the .ja.md rule as well", () => {
    expect(lintDocLanguage(sandbox({ "docs/x.ja.md": "# Title\n\nｶﾀｶﾅ\n" })).diagnostics).toEqual([]);
  });
});
