import { execFileSync, spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const root = resolve(process.argv[2] ?? process.cwd());
const output = resolve(process.argv[3] ?? join(import.meta.dir, "runtime-evidence.json"));
const plugin = join(root, "deep-spec-analysis");
const moduleAt = (path: string) => import(pathToFileURL(join(plugin, "src", path)).href);
const infrastructure = await moduleAt("kernel/infrastructure/index.ts");
const kernel = await moduleAt("kernel/domain/index.ts");
const reference = await moduleAt("refcheck/domain/index.ts");
const doctor = await moduleAt("doctor/domain/index.ts");
const maps = await moduleAt("design/adapter/refinement-materials-repository-implementation.ts");
const design = await moduleAt("design/domain/index.ts");
const evidence: object[] = [];
const record = (id: string, data: object): void => { evidence.push({id,...data}); };

let thrown = "none";
try { kernel.ContentHash.of("invalid"); }
catch (error) { thrown = error instanceof infrastructure.IllegalArgumentException ? "IllegalArgumentException" : String(error); }
const parsed = kernel.ContentHash.parse("invalid");
if (thrown !== "IllegalArgumentException" || parsed.ok) throw new Error("construction contract probe failed");
record("C01", {of:thrown,parse:parsed});

const exported = ["compareCanonically","sortedUniqueCanonically"].filter(name => typeof infrastructure[name] === "function");
if (exported.length !== 2) throw new Error("canonical helper export probe failed");
record("C02", {runtimeExports:exported,comparison:infrastructure.compareCanonically("OB-2","OB-10")});

const report = reference.ReferenceCheckReport.open(
  reference.ReferenceCheckReportIdentifier.of(kernel.ArtifactPath.of("/audit"),"components"),
  reference.CheckFamilies.of([]),
);
const conformed = report.conformedTo(kernel.FindingsSchema.unreadable("audit-probe"));
if (!conformed.isUnavailable() || conformed.unavailableReason() !== "findings schema unreadable: audit-probe") throw new Error("domain conformance probe failed");
record("C03", {originalPass:report.passes(),conformedPass:conformed.passes(),domainReason:conformed.unavailableReason(),documentKeys:Object.keys(conformed.toDocument())});

const temporary = mkdtempSync(join(tmpdir(), "comment-cli-probe-"));
try {
  for (const [sensor, relative] of [
    ["domain", "inception/domain-design/components.md"],
    ["contract", "inception/contract-design/contract-summary.md"],
    ["functional", "construction/u1-orders/functional-design/entities.md"],
  ]) {
    const folder = join(temporary,sensor);
    cpSync(join(plugin,"tests/fixtures/refcheck/clean"),folder,{recursive:true});
    const artifact = join(folder,relative);
    // 正当な入力は存在し、保存先だけを通常ファイルで占有する。
    writeFileSync(join(dirname(artifact),"deep-spec-refcheck"),"occupied");
    const stage = sensor === "domain" ? "domain-design" : sensor === "contract" ? "contract-design" : "functional-design";
    const run = spawnSync("bun",[join(plugin,`src/entries/aidlc-sensor-deep-spec-refcheck-${sensor}.ts`),"--stage",stage,"--output-path",artifact],{encoding:"utf8",timeout:30_000});
    if (run.status !== 1 || !run.stderr.includes("failed to write")) throw new Error(`CLI probe failed: ${sensor}: ${run.status}: ${run.stderr}`);
    record("C04",{sensor,exit:run.status,stdout:run.stdout,stderr:run.stderr.replaceAll(temporary,"<temporary>").trim()});
  }
} finally { rmSync(temporary,{recursive:true,force:true}); }

const current = kernel.ContentHash.ofText("current");
const old = kernel.ContentHash.ofText("old");
const location = doctor.IntentLocation.of(kernel.ArtifactPath.of("default"),kernel.ArtifactPath.of("i1"));
const states: Record<string,string> = {};
for (const [name,anchor] of [["matching",doctor.DigestAnchor.of(current,current)],["changed",doctor.DigestAnchor.of(old,current)],["absent-anchor",null]]) {
  const observation = doctor.VerificationObservation.of({location,hasModel:true,hasFindings:true,anchor});
  const problem = observation.problemState();
  states[String(name)] = problem === null ? "verified" : problem.match({unverified:()=>"unverified",stale:()=>"stale"});
}
if (states.matching !== "verified" || states.changed !== "stale" || states["absent-anchor"] !== "stale") throw new Error("presence-only probe failed");
record("C05",{samePresence:{hasModel:true,hasFindings:true},states});

const parsedMap = maps.parseRefinementMapDocument(new TextEncoder().encode("no fence"),design.RefinementMapIdentifier.of(kernel.ArtifactPath.of("/audit/map.md")),"/unused-schema-path");
const parseTypeModule = await moduleAt("design/adapter/refinement-map-parse.ts");
if (parsedMap.kind !== "malformed") throw new Error("map parser probe failed");
record("C06",{typeFileRuntimeExports:Object.keys(parseTypeModule),actualParser:"design/adapter/refinement-materials-repository-implementation.ts:parseRefinementMapDocument",result:parsedMap});

const orphanPath = join(plugin,"src/refcheck/domain/functional-design.ts");
if (existsSync(orphanPath)) {
  const orphan = await moduleAt("refcheck/domain/functional-design.ts");
  record("C10",{runtimeExports:Object.keys(orphan),file:readFileSync(orphanPath,"utf8")});
} else {
  record("C10",{present:false});
}

let reads = 0;
const volatile = {get value() { reads++; return reads === 1 ? "checked" : "changed"; }};
const copied = infrastructure.boundedValueSnapshot(volatile,{string:32,total:64,nodes:4,depth:4});
if (reads !== 1 || copied.value !== "checked") throw new Error("single-read snapshot probe failed");
record("KEEP",{singleReadSnapshot:{reads,value:copied.value}});

writeFileSync(output,JSON.stringify({head:execFileSync("git",["rev-parse","HEAD"],{cwd:root,encoding:"utf8"}).trim(),evidence},null,2)+"\n");
console.log(JSON.stringify(evidence));
