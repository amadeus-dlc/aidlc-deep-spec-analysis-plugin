import assert from 'node:assert/strict';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

// リポジトリルートで bun <このファイル> を実行する。変更は一時領域に限定する。
const plugin = resolve(process.argv[2] ?? 'deep-spec-analysis');
const K = await import(join(plugin, 'src/kernel/domain/index.ts'));
const R = await import(join(plugin, 'src/requirements/domain/index.ts'));
const RA = await import(join(plugin, 'src/requirements/adapter/index.ts'));
const RU = await import(join(plugin, 'src/requirements/usecase/index.ts'));
const D = await import(join(plugin, 'src/design/domain/index.ts'));
const DA = await import(join(plugin, 'src/design/adapter/index.ts'));
const DU = await import(join(plugin, 'src/design/usecase/index.ts'));
const data = join(plugin, 'src/entries/data');
const schema = K.FindingsSchema.of(JSON.parse(readFileSync(join(data, 'deep-spec-findings-schema.json'), 'utf8')));
const ap = (s) => K.ArtifactPath.reconstitute(s);
const root = mkdtempSync(join(tmpdir(), 'deep-spec-ddd-audit-'));
const out = (name, value) => console.log(JSON.stringify({ name, ...value }));
const acquired = new RA.FormalModelRepositoryImpl().findById(R.FormalModelId.of(ap(join(plugin, 'tests/fixtures/conformance/deep-spec-analysis-formal-model.md'))));
assert(acquired.ok);
const model = acquired.value;
const hash = model.irHash();
const report = (dir, backend, method = 'exhaustive') => R.VerificationReport.compose({
  id: R.VerificationReportId.of(ap(dir), backend), irVersion: model.irVersion(), irHash: hash,
  method, findings: R.VerificationFindings.of([]), skipped: R.VerificationSkips.of([]),
});
try {
  // 1. 公開の式を変更すると、集約の内容だけが変わりハッシュと原文は変わらない。
  const mutationCopy = new RA.FormalModelRepositoryImpl().findById(model.id());
  assert(mutationCopy.ok);
  const mutableModel = mutationCopy.value;
  const ob = mutableModel.obligations().toArray().find((o) => o.assertion() !== undefined);
  assert(ob);
  const expr = ob.assertion();
  const before = JSON.stringify(expr);
  const bytes = mutableModel.sourceDocument();
  expr.op = 'bool';
  expr.value = false;
  delete expr.args;
  assert.notEqual(JSON.stringify(ob.assertion()), before);
  assert(mutableModel.irHash().equals(hash));
  assert.deepEqual(mutableModel.sourceDocument(), bytes);
  out('mutable-expression', { expressionChanged: true, hashUnchanged: true, sourceUnchanged: true });

  // 2. 不正な兄弟文書を Repository が正常な比較対象／不在に変換する。
  const badDir = join(root, 'bad-sibling');
  mkdirSync(badDir);
  writeFileSync(join(badDir, 'smt.json'), RA.renderVerificationReportBytes(report(badDir, 'smt')));
  writeFileSync(join(badDir, 'quint.json'), JSON.stringify({ irHash: hash.asString(), findings: null, skipped: null }));
  const repo = new RA.VerificationDirectoryRepositoryImpl();
  const loadedBad = repo.findByDirectory(ap(badDir));
  assert(loadedBad.ok);
  const crossedBad = loadedBad.value.crossChecked(model, hash).crossCheck().toDocument();
  assert.equal(crossedBad.findings.length, 0);
  assert.equal(crossedBad.crossChecked.length, 2);
  const publishedBad = new RU.VerificationReportFinalizer(repo, schema).finalize(report(badDir, 'smt'), model);
  assert(publishedBad.ok);
  const persistedBad = JSON.parse(readFileSync(join(badDir, 'cross-check.json'), 'utf8'));
  assert.equal(persistedBad.crossChecked.length, 2);
  assert.equal(persistedBad.findings.length, 0);
  writeFileSync(join(badDir, 'quint.json'), '[]');
  const loadedArray = repo.findByDirectory(ap(badDir));
  assert(loadedArray.ok);
  assert.equal(loadedArray.value.reports().toArray().length, 1);
  out('corrupt-sibling', { malformedObjectAccepted: true, comparedBackends: crossedBad.crossChecked.map((r) => r.backend), invalidComparisonPersisted: true, nonObjectSilentlyDropped: true });

  // 3. 公開メソッドの順序次第で、降格済み候補が cross-check に残る。
  const aggregate = R.VerificationDirectory.of(ap(badDir), R.VerificationReports.of([report(badDir, 'smt')]), null)
    .finalizing(report(badDir, 'quint', 'invalid-method'))
    .crossChecked(model, hash)
    .conformedTo(schema);
  assert(aggregate.candidate().isUnavailable());
  const stale = aggregate.crossCheck().toDocument().crossChecked.length;
  const fresh = aggregate.crossChecked(model, hash).crossCheck().toDocument().crossChecked.length;
  assert.equal(stale, 2);
  assert.equal(fresh, 0);
  out('aggregate-order-dependency', { candidateUnavailable: true, storedComparisonBackends: stale, correctComparisonBackends: fresh });

  const record = join(root, 'record');
  cpSync(join(plugin, 'tests/fixtures/refinement/record'), record, { recursive: true });
  const modelPath = join(record, 'construction/deep-spec-analysis-functional-verify/deep-spec-analysis-functional-formal-model.md');
  const modelId = D.DesignModelId.of(ap(modelPath));
  const designModels = new DA.DesignModelRepositoryImpl();
  const designResult = designModels.findById(modelId);
  assert(designResult.ok);
  const designModel = designResult.value;
  const unit = designModel.units().toArray()[0];
  const materials = new DA.RefinementMaterialsRepositoryImpl(join(data, 'deep-spec-refinement-map-schema.json'));

  // 4. refinement の実行結果に含まれる timeout skip が usecase で消失する。
  let calls = 0;
  let skippedLoweredIds = [];
  const sibling = {
    runLowered(_backend, _unit, lowered) {
      calls++;
      const skips = calls === 1 ? [] : lowered.obligations().toArray().map((o) => D.SiblingVerdictSkip.reconstitute({ target: o.id(), reason: 'timeout', detail: 'audit simulated timeout' }));
      if (calls > 1) skippedLoweredIds = skips.map((s) => s.target().asString());
      return { exit: 0, note: '', doc: D.SiblingVerdictDocument.readable('simulation', D.SiblingVerdictFindings.of([]), D.SiblingVerdictSkips.of(skips)) };
    },
    probeState() { return { kind: 'failed' }; },
  };
  let saved;
  const reports = {
    findByDirectory(dir) { return { ok: true, value: D.DesignVerifyDirectory.of(dir, D.DesignReports.of([]), null) }; },
    store(value) { saved = value; return { ok: true, value: undefined }; },
  };
  const outcome = new DU.VerifyDesignQuintUseCase(designModels, reports, schema, sibling, materials, { now: () => 0 }, 0)
    .execute({ modelId, verifyDirectory: ap(join(root, 'design-verify')) });
  assert.equal(outcome.kind, 'verified');
  assert.equal(calls, 2);
  const published = saved.candidate().toDocument();
  const lost = !published.skipped.some((s) => s.target === 'OB-1');
  assert(lost);
  out('refinement-timeout-lost', { backendCalls: calls, skippedLoweredIds, requirementOB1MissingFromSkips: lost, outcome: outcome.kind });

  // 5. 到達性 probe の timeout 文書（exit 0）が「到達しなかった」に化ける。
  const fakeTool = join(root, 'fake-probe.ts');
  writeFileSync(fakeTool, `import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
const modelPath = process.argv[process.argv.indexOf('--output-path') + 1];
const dir = join(dirname(modelPath), 'deep-spec-verify');
mkdirSync(dir, { recursive: true });
writeFileSync(join(dir, 'quint.json'), JSON.stringify({ backend: 'quint', irVersion: '1.0.0', irHash: '${hash.asString()}', method: 'bounded', findings: [], skipped: [{target:'OB-9999', reason:'timeout'}] }));
`);
  const realSibling = new DA.SiblingBackendClientImpl({ siblingToolPaths: { smt: fakeTool, quint: fakeTool }, workingDirectory: plugin });
  const probe = realSibling.probeState(unit, unit.lowered({ synthetics: false }), 'ticket.phase', 'closed', 5000);
  assert.deepEqual(probe, { kind: 'probed', reached: false });
  const boundedSibling = {
    runLowered() { return { exit: 0, note: '', doc: D.SiblingVerdictDocument.readable('bounded', D.SiblingVerdictFindings.of([]), D.SiblingVerdictSkips.of([])) }; },
    probeState(...args) { return realSibling.probeState(...args); },
  };
  const boundedOutcome = new DU.VerifyDesignQuintUseCase(designModels, reports, schema, boundedSibling,
    { findById(id) { return D.RefinementMaterials.inactive(id); } }, { now: () => 0 }, 2)
    .execute({ modelId, verifyDirectory: ap(join(root, 'probe-verify')) });
  assert.equal(boundedOutcome.kind, 'verified');
  const falseUnreachables = saved.candidate().toDocument().findings.filter((f) => f.kind === 'unreachable').length;
  assert(falseUnreachables > 0);
  out('timeout-becomes-unreachable', { probe, falseUnreachableFindings: falseUnreachables });

  // 6. Repository port に表れない I/O 例外。欠損／不正 JSON も inactive に潰れる。
  const reqPath = join(record, 'inception/deep-spec-analysis-verify/deep-spec-analysis-formal-model.md');
  writeFileSync(reqPath, '# broken\n```json\n{invalid\n```\n');
  const inactive = materials.findById(D.RefinementMaterialsId.ofModel(modelId));
  assert.equal(inactive.isActive(), false);
  rmSync(reqPath);
  mkdirSync(reqPath);
  let thrown = null;
  try { materials.findById(D.RefinementMaterialsId.ofModel(modelId)); } catch (error) { thrown = error.code; }
  assert.equal(thrown, 'EISDIR');
  out('materials-port-failure', { corruptInputBecomesInactive: true, thrownCode: thrown });
} finally {
  rmSync(root, { recursive: true, force: true });
}
