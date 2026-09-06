import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(process.argv[2] ?? process.cwd());
const output = resolve(process.argv[3] ?? join(import.meta.dir, "correction-evidence.json"));
const base = "5d56ef2668048a5073e903f1b00c2e65134de96e";
const git = (...args: string[]): string => execFileSync("git", args, { cwd: root, encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
const files = git("ls-tree", "-r", "--name-only", base, "deep-spec-analysis/src", "deep-spec-analysis/scripts", "deep-spec-analysis/tests")
  .trim().split("\n")
  .filter(path => path.endsWith(".ts") && !path.includes("/tests/fixtures/"));
const transpiler = new Bun.Transpiler({ loader: "ts" });
const hash = (text: string): string => createHash("sha256").update(text).digest("hex");
const changed: object[] = [];
let equal = 0;
let removedEmptyModules = 0;
let renamedTestLabels = 0;
for (const path of files) {
  const before = git("show", `${base}:${path}`);
  if (!existsSync(join(root, path))) {
    if (path !== "deep-spec-analysis/src/refcheck/domain/functional-design.ts" || transpiler.transformSync(before).trim() !== "") {
      throw new Error(`unexpected removal: ${path}`);
    }
    removedEmptyModules++;
    changed.push({ path, removedEmptyModule: true, before: hash(before) });
    continue;
  }
  const after = readFileSync(join(root, path), "utf8");
  // テストの説明文2か所は、誤った責務の説明を改めた意図的な文字列変更。
  const normalizedBefore = path === "deep-spec-analysis/tests/refcheck-report.test.ts"
    ? before
      .replace('describe("serializer (adapter owns the format knowledge)"', 'describe("serializer renders the domain report document"')
      .replace('describe("ReferenceCheckReport (domain, no serialization knowledge)"', 'describe("ReferenceCheckReport domain contract"')
    : before;
  if (normalizedBefore !== before) renamedTestLabels += 2;
  if (transpiler.transformSync(normalizedBefore) !== transpiler.transformSync(after)) {
    throw new Error(`runtime code changed: ${path}`);
  }
  equal++;
  if (before !== after) changed.push({ path, before: hash(before), after: hash(after) });
}
if (removedEmptyModules !== 1 || renamedTestLabels !== 2) throw new Error("expected correction missing");
const currentFiles = git("ls-files", "--cached", "--others", "--exclude-standard", "deep-spec-analysis/src", "deep-spec-analysis/scripts", "deep-spec-analysis/tests")
  .trim().split("\n").filter(path => path.endsWith(".ts") && !path.includes("/tests/fixtures/") && existsSync(join(root, path)));
const additions = currentFiles.filter(path => !files.includes(path));
if (additions.length > 0) throw new Error(`unexpected additions: ${additions.join(", ")}`);
const result = {
  base,
  head: git("rev-parse", "HEAD").trim(),
  comparedFiles: files.length,
  equalTranspiledCode: equal,
  renamedTestLabels,
  removedEmptyModules,
  changed,
};
writeFileSync(output, JSON.stringify(result, null, 2) + "\n");
console.log(JSON.stringify({ comparedFiles: files.length, equal, renamedTestLabels, removedEmptyModules, changedFiles: changed.length }));
