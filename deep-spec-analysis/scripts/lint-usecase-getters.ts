import { resolve } from "node:path";
import { lintUsecaseGetters } from "./lint/usecase-getters.ts";

async function main(args: readonly string[]): Promise<void> {
  let project = resolve(import.meta.dir, "..", "tsconfig.json");
  let json = false;
  for (let index = 0; index < args.length; index++) {
    const argument = args[index];
    if (argument === "--json") json = true;
    else if (argument === "--project" && args[index + 1] !== undefined && !args[index + 1].startsWith("--"))
      project = resolve(args[++index]);
    else throw new Error(`Unknown or incomplete argument: ${argument}`);
  }
  const result = await lintUsecaseGetters(project);
  if (json) console.log(JSON.stringify(result, null, 2));
  else {
    for (const issue of result.diagnostics) {
      console.error(`${issue.path}:${issue.line}:${issue.column} [${issue.rule}] ${issue.member}`);
      console.error(
        `  defined at ${issue.declaration}:${issue.declarationLine}; 判断は所有する型へ、表現変換はadapterへ委譲してください。`,
      );
    }
    console.log(`Checked ${result.checkedFiles} usecase files; ${result.diagnostics.length} violation(s).`);
  }
  if (result.diagnostics.length > 0) process.exitCode = 1;
}

if (import.meta.main) {
  main(process.argv.slice(2)).catch((error: unknown) => {
    console.error(`usecase getter lint failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 2;
  });
}
