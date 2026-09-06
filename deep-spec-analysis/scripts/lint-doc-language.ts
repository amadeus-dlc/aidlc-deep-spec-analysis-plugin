import { resolve } from "node:path";
import { lintDocLanguage } from "./lint/doc-language.ts";

function main(args: readonly string[]): void {
  let root = resolve(import.meta.dir, "..");
  let json = false;
  for (let index = 0; index < args.length; index++) {
    const argument = args[index];
    if (argument === "--json") json = true;
    else if (argument === "--root" && args[index + 1] !== undefined && !args[index + 1].startsWith("--"))
      root = resolve(args[++index]);
    else throw new Error(`Unknown or incomplete argument: ${argument}`);
  }

  const result = lintDocLanguage(root);
  if (json) console.log(JSON.stringify(result, null, 2));
  else {
    for (const issue of result.diagnostics) {
      if (issue.rule === "japanese-in-english-doc") {
        console.error(`${issue.path}:${issue.line} [${issue.rule}] ${issue.excerpt}`);
        console.error("  日本語の散文は同名の .ja.md へ移し、このファイルには英訳を書いてください。");
      } else {
        console.error(`${issue.path} [${issue.rule}]`);
        console.error("  .ja.md に日本語がありません。日本語版を書くか、ファイルを削除してください。");
      }
    }
    console.log(`Checked ${result.checkedFiles} markdown files; ${result.diagnostics.length} violation(s).`);
  }
  if (result.diagnostics.length > 0) process.exitCode = 1;
}

if (import.meta.main) {
  try {
    main(process.argv.slice(2));
  } catch (error: unknown) {
    console.error(`doc language lint failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}
