import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(process.argv[2] ?? "deep-spec-analysis");
const record = dirname(fileURLToPath(import.meta.url));
const require = createRequire(join(root, "package.json"));
const ast = await import(pathToFileURL(require.resolve("typescript/unstable/ast")).href);
const { API } = await import(pathToFileURL(require.resolve("typescript/unstable/async")).href);
const baseline = JSON.parse(readFileSync(join(record, "inventory.json"), "utf8"));
const api = new API({ cwd: root });
try {
  const project = (await api.updateSnapshot({ openProjects: [join(root, "tsconfig.json")] })).getProject(join(root, "tsconfig.json"));
  const classes = new Map();
  const fingerprint = createHash("sha256");
  const domainFiles = (await project.program.getSourceFileNames()).filter((path: string) => /^src\/[^/]+\/domain\/[^/]+\.ts$/.test(relative(root, path))).sort();
  for (const path of domainFiles) {
    const source = await project.program.getSourceFile(path);
    fingerprint.update(relative(root, path)).update("\0").update(readFileSync(path)).update("\0");
    const visit = (node: any): void => {
      if (ast.isClassDeclaration(node) && node.name) {
        classes.set(node.name.text, {
          path: relative(root, path),
          contracts: (node.heritageClauses ?? []).flatMap((clause: any) => clause.token === ast.SyntaxKind.ImplementsKeyword ? clause.types.map((type: any) => type.expression.getText()) : []),
          hasIsEmpty: node.members.some((member: any) => member.name?.getText() === "isEmpty"),
          factories: node.members.filter((member: any) => ast.isMethodDeclaration(member) && member.modifiers?.some((modifier: any) => modifier.kind === ast.SyntaxKind.StaticKeyword)).map((member: any) => ({name: member.name.getText(), parameters: member.parameters.map((parameter: any) => parameter.getText())})),
        });
      }
      node.forEachChild(visit);
    };
    visit(source);
  }
  const typeFiles = ["kernel-requirements", "design", "refcheck-doctor"].flatMap((group) => [`tests/collection-contracts-${group}.types.ts`, `tests/collection-contracts-${group}.test.ts`]);
  const factoryContracts = new Set(typeFiles.flatMap((path) => [...readFileSync(join(root, path), "utf8").matchAll(/(?:\w+\.)?(\w+)\s+satisfies\s/g)].map((match) => match[1])));
  const entries = baseline.entries.filter((entry: any) => entry.classification === "first-class-collection").map((entry: any) => ({name: entry.name, path: entry.path, nonEmpty: entry.name === "InstallationManifest", iterable: entry.iterable}));
  entries.push({name: "FindingTargets", path: "src/kernel/domain/finding-targets.ts", nonEmpty: true, iterable: true});
  const findings: string[] = [];
  const applied = entries.map((entry: any) => {
    const actual = classes.get(entry.name);
    if (!actual) findings.push(`${entry.name}: class missing`);
    if (!entry.nonEmpty && !actual?.contracts.includes("FirstClassCollection")) findings.push(`${entry.name}: empty contract missing`);
    if (entry.iterable && !actual?.contracts.includes("IterableFirstClassCollection")) findings.push(`${entry.name}: iterable contract missing`);
    if (entry.nonEmpty && actual?.hasIsEmpty) findings.push(`${entry.name}: nonempty exposes isEmpty`);
    if (!factoryContracts.has(entry.name)) findings.push(`${entry.name}: factory type check missing`);
    return {...entry, ...actual, factoryContractChecked: factoryContracts.has(entry.name)};
  });
  const output = {domainFiles: domainFiles.length, classes: classes.size, sourceFingerprint: fingerprint.digest("hex"), collectionCount: applied.length, emptyAllowed: applied.filter((entry: any) => !entry.nonEmpty).length, nonEmpty: applied.filter((entry: any) => entry.nonEmpty).length, iterable: applied.filter((entry: any) => entry.iterable).length, findings, applied};
  writeFileSync(join(record, "implementation-audit.json"), JSON.stringify(output, null, 2) + "\n");
  console.log(JSON.stringify({...output, applied: undefined}));
  if (findings.length) process.exitCode = 1;
} finally {await api.close();}
