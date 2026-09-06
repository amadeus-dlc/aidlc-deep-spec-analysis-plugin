import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
const cwd = process.cwd();
const { API } = await import(resolve(cwd, 'node_modules/typescript/dist/api/async/api.js'));
const ast = await import(resolve(cwd, 'node_modules/typescript/dist/ast/index.js'));
const record = resolve(cwd, '../aidlc/spaces/default/intents/260904-ddd-clean-architecture/reviews/2026-09-06-collection-operations');
const before = await Bun.file(resolve(record, 'inventory-before.json')).json();
const api = new API({ cwd });
try {
 const config = resolve(cwd, 'tsconfig.json');
 const project = (await api.updateSnapshot({openProjects:[config]})).getProject(config);
 const checker = project.checker;
 const rows = [];
 const paths = (await Array.fromAsync(new Bun.Glob('src/*/domain/*.ts').scan(cwd))).sort();
 const fingerprint = createHash('sha256');
 const found = new Set();
 for (const path of paths) {
  const text = await Bun.file(resolve(cwd,path)).text();
  fingerprint.update(path).update('\0').update(text).update('\0');
  const file = await project.program.getSourceFile(resolve(cwd,path));
  const classes = [];
  file.forEachChild(node => { if (ast.isClassDeclaration(node) && node.name) classes.push(node); });
  for (const node of classes) {
   const name = node.name.getText();
   const prior = before.entries.find(entry => entry.path === path && entry.name === name);
   if (!prior && name !== 'ImmutableFirstClassCollection') continue;
   const symbol = await checker.getSymbolAtLocation(node.name);
   const type = await checker.getDeclaredTypeOfSymbol(symbol);
   const props = await checker.getPropertiesOfType(type);
   const signatures = {};
   for (const method of ['at','head','tail','include','exists','filter','map','isEmpty']) {
    const property = props.find(p => p.name === method);
    if (!property) continue;
    signatures[method] = await checker.typeToString(await checker.getTypeOfSymbol(property));
   }
   const required = ['at','head','tail','include','exists','filter','map'];
   const nonEmpty = prior?.nonEmpty ?? false;
   if (!nonEmpty) required.push('isEmpty');
   const missing = required.filter(name => !(name in signatures));
   const iterator = props.some(p => p.name.startsWith('__@iterator'));
   if (!iterator) missing.push('[Symbol.iterator]');
   if (nonEmpty && 'isEmpty' in signatures) missing.push('unexpected isEmpty');
   const head = props.find(p => p.name === 'head');
   let elementType = null;
   if (head) {
    const headType = await checker.getTypeOfSymbol(head);
    const sig = (await checker.getSignaturesOfType(headType, 0))[0];
    elementType = await checker.typeToString(await checker.getReturnTypeOfSignature(sig));
   }
   const staticProperties = await checker.getPropertiesOfType(await checker.getTypeOfSymbol(symbol));
   const factories = {};
   for (const factory of ['of','parse','standard']) {
    const property = staticProperties.find(p => p.name === factory);
    if (property) factories[factory] = await checker.typeToString(await checker.getTypeOfSymbol(property));
   }
   found.add(name);
   rows.push({name,path,nonEmpty,elementType,iterator,signatures,factories,missing});
  }
 }
 const absent = before.entries.filter(e => !found.has(e.name)).map(e=>e.name);
 const report = {generatedAt:new Date().toISOString(),sourceDomainFingerprint:fingerprint.digest('hex'),method:'TypeScript 7 checker.getDeclaredTypeOfSymbol/getPropertiesOfType: inherited operation signatures and element return types',baselineCount:before.entries.length,currentCount:rows.length,absent,failures:rows.filter(row=>row.missing.length>0),entries:rows};
 await Bun.write(resolve(record,'implementation-audit.json'),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({baselineCount:report.baselineCount,currentCount:report.currentCount,absent,failures:report.failures}));
 if (absent.length || report.failures.length) process.exitCode = 1;
} finally { await api.close(); }
