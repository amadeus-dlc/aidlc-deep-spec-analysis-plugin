import { resolve } from "node:path";
import { lintCollectionBypass } from "./lint/collection-bypass.ts";

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
  const result = await lintCollectionBypass(project);
  if (json) console.log(JSON.stringify(result, null, 2));
  else {
    for (const issue of result.diagnostics)
      console.error(`${issue.path}:${issue.line}:${issue.column} [${issue.rule}] ${issue.excerpt}`);
    console.log(`Checked ${result.checkedFiles} governed src files; ${result.diagnostics.length} violation(s).`);
  }
  if (result.diagnostics.length > 0) process.exitCode = 1;
}

if (import.meta.main) {
  main(process.argv.slice(2)).catch((error: unknown) => {
    console.error(`collection bypass lint failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 2;
  });
}
