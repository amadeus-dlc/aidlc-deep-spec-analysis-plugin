import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

interface Measurement {
  path: string;
  throws: number;
  illegalArgumentThrows: number;
  statements: number;
  functions: number;
  imports: {line: number; text: string}[];
}
interface Inventory {
  head: string;
  files: Measurement[];
  comments: {path: string; text: string; start: number; end: number}[];
}

const root = resolve(process.argv[2] ?? process.cwd());
const inventory: Inventory = JSON.parse(readFileSync(join(import.meta.dir,"inventory.json"),"utf8"));
const consumers = inventory.files.filter(file => file.path.startsWith("src/")).map(file => ({
  path:file.path,
  imports:file.imports.filter(item => /\b(compareCanonically|sortedUniqueCanonically)\b/.test(item.text)),
})).filter(file => file.imports.length > 0);
const throwFiles = inventory.files.filter(file => file.path.includes("/domain/") && file.throws > 0);
const attributePath = "src/refcheck/domain/attribute-declaration.ts";
const attribute = execFileSync("git",["show",`${inventory.head}:deep-spec-analysis/${attributePath}`],{cwd:root,encoding:"utf8"}).split("");
for (const comment of inventory.comments.filter(comment => comment.path === attributePath)) {
  for (let position=comment.start;position<comment.end;position++) attribute[position]=" ";
}
const tree = execFileSync("git",["ls-tree","-r","--name-only",inventory.head,"deep-spec-analysis/src"],{cwd:root,encoding:"utf8"}).trim().split("\n");
const noiseCandidates: Record<string,{commentTokens:number;files:number}> = {};
for (const [name,pattern] of [["legacy-wording",/旧|逐語|移設/],["history-markers",/PR\s*\d|issue\s*#?\d|#\d|波\d|裁定/]] as const) {
  const matches=inventory.comments.filter(comment=>comment.path.startsWith("src/")&&pattern.test(comment.text));
  noiseCandidates[name]={commentTokens:matches.length,files:new Set(matches.map(comment=>comment.path)).size};
}
const result = {
  head:inventory.head,
  sourceDomainThrows:throwFiles.reduce((total,file)=>total+file.throws,0),
  sourceDomainIllegalArgumentThrows:throwFiles.reduce((total,file)=>total+file.illegalArgumentThrows,0),
  domainFilesWithThrows:throwFiles.length,
  canonicalConsumers:consumers,
  canonicalForeignConsumers:consumers.filter(file=>!file.path.startsWith("src/kernel/")),
  attributeDeclarationJsonIdentifiers:[...attribute.join("").matchAll(/\bJson\b/g)].length,
  attributeDeclarationPrivateFields:[...attribute.join("").matchAll(/readonly\s+#\w+\s*:/g)].length,
  layerManifests:tree.filter(path=>/^deep-spec-analysis\/src\/[^/]+\/[^/]+\/package.json$/.test(path)),
  designAdapterFiles:inventory.files.filter(file=>file.path.startsWith("src/design/adapter/")).map(file=>file.path),
  emptySourceFiles:inventory.files.filter(file=>file.path.startsWith("src/")&&file.statements===0).map(file=>file.path),
  parserTypeFile:inventory.files.filter(file=>file.path==="src/design/adapter/refinement-map-parse.ts"),
  orphanStaticImports:inventory.files.flatMap(file=>file.imports.filter(item=>/["'/]functional-design\.ts["']/.test(item.text)).map(item=>({path:file.path,import:item}))),
  noiseCandidates,
};
writeFileSync(join(import.meta.dir,"static-evidence.json"),JSON.stringify(result,null,2)+"\n");
console.log(JSON.stringify({head:result.head,domainThrows:result.sourceDomainThrows,canonicalConsumers:consumers.length,layerPackages:result.layerManifests.length}));
