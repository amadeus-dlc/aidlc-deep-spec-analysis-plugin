// @bun
// src/entries/deep-spec-analysis-doctor.ts
import { join as join5 } from "path";

// src/doctor/domain/check-severity.ts
class CheckSeverity {
  #value;
  constructor(value) {
    this.#value = value;
  }
  static error() {
    return new CheckSeverity("error");
  }
  static advisory() {
    return new CheckSeverity("advisory");
  }
  blocksDoctor() {
    return this.#value === "error";
  }
  isAdvisory() {
    return this.#value === "advisory";
  }
  equals(other) {
    return this.#value === other.#value;
  }
  asString() {
    return this.#value;
  }
}
// src/doctor/domain/check.ts
class Check {
  #pass;
  #label;
  #fix;
  #severity;
  constructor(props) {
    this.#pass = props.pass;
    this.#label = props.label;
    this.#fix = props.fix;
    this.#severity = props.severity;
  }
  static reconstitute(props) {
    return new Check(props);
  }
  passes() {
    return this.#pass;
  }
  label() {
    return this.#label;
  }
  fix() {
    return this.#fix;
  }
  severity() {
    return this.#severity;
  }
  toDocument() {
    return { pass: this.#pass, label: this.#label, ...this.#fix !== undefined ? { fix: this.#fix } : {}, severity: this.#severity.asString() };
  }
}
// src/doctor/domain/health-verdict.ts
class HealthVerdict {
  #values;
  constructor(values) {
    this.#values = values;
  }
  static of(values) {
    return new HealthVerdict([...values]);
  }
  add(value) {
    return new HealthVerdict([...this.#values, value]);
  }
  *[Symbol.iterator]() {
    yield* this.#values;
  }
  document() {
    return { checks: this.#values.map((c) => c.toDocument()) };
  }
}
// src/kernel/domain/expression-tree.ts
function canonicalKeyOf(value) {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalKeyOf).join(",")}]`;
  }
  if (typeof value === "object" && value !== null) {
    const record = value;
    const keys = Object.keys(record).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalKeyOf(record[k] ?? null)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

class ExpressionTree {
  #root;
  constructor(root) {
    this.#root = root;
  }
  static of(root) {
    return new ExpressionTree(root);
  }
  asExpression() {
    return this.#root;
  }
  walk(visit) {
    const go = (e) => {
      visit(e);
      for (const a of e.args ?? [])
        go(a);
    };
    go(this.#root);
  }
  usesPrime() {
    let found = false;
    this.walk((node) => {
      if (node.op === "ref" && node.prime === true)
        found = true;
    });
    return found;
  }
  referencedPaths() {
    const refs = new Set;
    this.walk((node) => {
      if (node.op === "ref" && typeof node.path === "string")
        refs.add(node.path);
    });
    return [...refs].sort();
  }
  assignsPrimed(path) {
    let assigned = false;
    this.walk((node) => {
      if (node.op === "ref" && node.prime === true && node.path === path)
        assigned = true;
    });
    return assigned;
  }
  isCanonicallyEqual(other) {
    return canonicalKeyOf(this.#root) === canonicalKeyOf(other.#root);
  }
}
// src/kernel/domain/content-hash.ts
import { createHash } from "crypto";

// src/kernel/infrastructure/result.ts
function ok(value) {
  return { ok: true, value };
}
function err(error) {
  return { ok: false, error };
}
// src/kernel/domain/content-hash.ts
class ContentHash {
  #value;
  constructor(value) {
    this.#value = value;
  }
  static parse(raw) {
    if (!/^[0-9a-f]{64}$/.test(raw))
      return err({ kind: "not-a-sha256-hex", raw });
    return ok(new ContentHash(raw));
  }
  static reconstitute(raw) {
    return new ContentHash(raw);
  }
  static ofText(text) {
    return new ContentHash(createHash("sha256").update(text, "utf-8").digest("hex"));
  }
  static ofBytes(bytes) {
    return new ContentHash(createHash("sha256").update(bytes).digest("hex"));
  }
  equals(other) {
    return this.#value === other.#value;
  }
  asString() {
    return this.#value;
  }
}
// src/kernel/domain/ir-version.ts
class IrVersion {
  #value;
  constructor(value) {
    this.#value = value;
  }
  static parse(raw) {
    if (!/^\d+\.\d+\.\d+$/.test(raw))
      return err({ kind: "not-a-semver", raw });
    return ok(new IrVersion(raw));
  }
  static reconstitute(raw) {
    return new IrVersion(raw);
  }
  equals(other) {
    return this.#value === other.#value;
  }
  majorVersion() {
    return Number.parseInt(this.#value.split(".")[0] ?? "", 10);
  }
  supportsMajor(major) {
    return this.majorVersion() === major;
  }
  asString() {
    return this.#value;
  }
}
// src/kernel/domain/canonical-order.ts
function numSegments(id) {
  return (id.match(/[0-9]+/g) ?? []).map((s) => Number.parseInt(s, 10));
}
function compareCanonically(a, b) {
  const pa = a.replace(/[0-9.]/g, "");
  const pb = b.replace(/[0-9.]/g, "");
  if (pa !== pb)
    return pa < pb ? -1 : 1;
  const na = numSegments(a);
  const nb = numSegments(b);
  for (let i = 0;i < Math.max(na.length, nb.length); i++) {
    const da = na[i] ?? -1;
    const db = nb[i] ?? -1;
    if (da !== db)
      return da - db;
  }
  return 0;
}
function sortedUniqueCanonically(values) {
  return [...new Set(values)].sort(compareCanonically);
}

// src/kernel/domain/target-id.ts
var TARGET_ID_PATTERNS = [
  /^(OB|SC)-[0-9]+$/,
  /^BR[0-9]+\.[0-9]+$/,
  /^(DOB|DSC|DBG|SM|TR)-[0-9]+$/,
  /^(component|entity|attr|unit|contract|state|check):[A-Za-z0-9_./-]+$/
];

class TargetId {
  #value;
  constructor(value) {
    this.#value = value;
  }
  static parse(raw) {
    if (!TARGET_ID_PATTERNS.some((pattern) => pattern.test(raw)))
      return err({ kind: "malformed-target-id", raw });
    return ok(new TargetId(raw));
  }
  static reconstitute(raw) {
    return new TargetId(raw);
  }
  equals(other) {
    return this.#value === other.#value;
  }
  compareTo(other) {
    return compareCanonically(this.#value, other.#value);
  }
  asString() {
    return this.#value;
  }
}
// src/kernel/domain/target-ids.ts
class TargetIds {
  #values;
  constructor(values) {
    this.#values = values;
  }
  static of(values) {
    return new TargetIds([...values]);
  }
  static reconstitute(values) {
    return new TargetIds(values.map((v) => TargetId.reconstitute(v)));
  }
  static safe(prefix, raw) {
    const token = raw.replace(/[^A-Za-z0-9_./-]/g, "-");
    return `${prefix}:${token === "" ? "unknown" : token}`;
  }
  add(value) {
    return new TargetIds([...this.#values, value]);
  }
  *[Symbol.iterator]() {
    yield* this.#values;
  }
  count() {
    return this.#values.length;
  }
  includes(value) {
    return this.#values.some((v) => v.equals(value));
  }
  excluding(value) {
    return new TargetIds(this.#values.filter((v) => !v.equals(value)));
  }
  sortedCanonically() {
    return new TargetIds([...this.#values].sort((a, b) => a.compareTo(b)));
  }
  sortedUniqueCanonically() {
    return TargetIds.reconstitute(sortedUniqueCanonically(this.toStrings()));
  }
  joined(separator) {
    return this.toStrings().join(separator);
  }
  toArray() {
    return this.#values;
  }
  toStrings() {
    return this.#values.map((v) => v.asString());
  }
}
// src/kernel/domain/requirement-id.ts
class RequirementId {
  #value;
  constructor(value) {
    this.#value = value;
  }
  static reconstitute(raw) {
    return new RequirementId(raw);
  }
  equals(other) {
    return this.#value === other.#value;
  }
  compareTo(other) {
    return TargetId.reconstitute(this.#value).compareTo(TargetId.reconstitute(other.#value));
  }
  asString() {
    return this.#value;
  }
}

// src/kernel/domain/fr-refs.ts
class FrRefs {
  #values;
  constructor(values) {
    this.#values = values;
  }
  static of(values) {
    return new FrRefs([...values]);
  }
  static reconstitute(raws) {
    return new FrRefs(raws.map((raw) => RequirementId.reconstitute(raw)));
  }
  add(value) {
    return new FrRefs([...this.#values, value]);
  }
  *[Symbol.iterator]() {
    yield* this.#values;
  }
  isEmpty() {
    return this.#values.length === 0;
  }
  sortedUnique() {
    return FrRefs.reconstitute(sortedUniqueCanonically(this.toStrings()));
  }
  toArray() {
    return this.#values;
  }
  toStrings() {
    return this.#values.map((v) => v.asString());
  }
}
// src/kernel/domain/backend-name.ts
class BackendName {
  #value;
  constructor(value) {
    this.#value = value;
  }
  static parse(raw) {
    if (raw === "")
      return err({ kind: "empty-backend-name", raw });
    return ok(new BackendName(raw));
  }
  static reconstitute(raw) {
    return new BackendName(raw);
  }
  equals(other) {
    return this.#value === other.#value;
  }
  asString() {
    return this.#value;
  }
}
// src/kernel/domain/key-set.ts
class KeySet {
  #values;
  constructor(values) {
    this.#values = values;
  }
  static empty() {
    return new KeySet(new Map);
  }
  static of(keys) {
    const map = new Map;
    for (const key of keys)
      if (!map.has(key.asString()))
        map.set(key.asString(), key);
    return new KeySet(map);
  }
  with(key) {
    if (this.#values.has(key.asString()))
      return this;
    const map = new Map(this.#values);
    map.set(key.asString(), key);
    return new KeySet(map);
  }
  has(key) {
    return this.#values.has(key.asString());
  }
  size() {
    return this.#values.size;
  }
  isEmpty() {
    return this.#values.size === 0;
  }
  *[Symbol.iterator]() {
    yield* this.#values.values();
  }
  toArray() {
    return [...this.#values.values()];
  }
}

// src/kernel/domain/requirement-ids.ts
class RequirementIds {
  #values;
  constructor(values) {
    this.#values = values;
  }
  static extractFrom(text) {
    const ids = [];
    for (const m of text.matchAll(/\b(?:FR|NFR)-?[0-9]+(?:\.[0-9]+)*\b/g)) {
      ids.push(RequirementId.reconstitute(m[0]));
    }
    return new RequirementIds(KeySet.of(ids));
  }
  static of(values) {
    return new RequirementIds(KeySet.of(values));
  }
  static reconstitute(raws) {
    return new RequirementIds(KeySet.of(raws.map((raw) => RequirementId.reconstitute(raw))));
  }
  add(value) {
    return new RequirementIds(this.#values.with(value));
  }
  *[Symbol.iterator]() {
    yield* this.#values;
  }
  has(value) {
    return this.#values.has(value);
  }
  toArray() {
    return this.#values.toArray();
  }
  toStrings() {
    return this.#values.toArray().map((v) => v.asString());
  }
}
// src/kernel/domain/normalized-name.ts
class NormalizedName {
  #value;
  constructor(value) {
    this.#value = value;
  }
  static of(raw) {
    return new NormalizedName(raw.toLowerCase().replace(/[^a-z0-9]/g, ""));
  }
  equals(other) {
    return this.#value === other.#value;
  }
  asString() {
    return this.#value;
  }
}
// src/kernel/domain/artifact-path.ts
class ArtifactPath {
  #value;
  constructor(value) {
    this.#value = value;
  }
  static parse(raw) {
    if (raw === "")
      return err({ kind: "empty-path" });
    return ok(new ArtifactPath(raw));
  }
  static reconstitute(raw) {
    return new ArtifactPath(raw);
  }
  equals(other) {
    return this.#value === other.#value;
  }
  asString() {
    return this.#value;
  }
}
// src/kernel/domain/attribute-bound.ts
class AttributeBound {
  #value;
  constructor(value) {
    this.#value = value;
  }
  static parse(raw) {
    if (!Number.isInteger(raw))
      return err({ kind: "non-integer-bound", raw });
    if (!Number.isSafeInteger(raw))
      return err({ kind: "unsafe-bound", raw });
    return ok(new AttributeBound(raw));
  }
  static reconstitute(raw) {
    return new AttributeBound(raw);
  }
  equals(other) {
    return this.#value === other.#value;
  }
  asNumber() {
    return this.#value;
  }
  exceeds(other) {
    return this.#value > other.#value;
  }
}
// src/kernel/domain/error-messages.ts
class ErrorMessages {
  #values;
  constructor(values) {
    this.#values = values;
  }
  static of(values) {
    return new ErrorMessages([...values]);
  }
  add(value) {
    return new ErrorMessages([...this.#values, value]);
  }
  *[Symbol.iterator]() {
    yield* this.#values;
  }
  isEmpty() {
    return this.#values.length === 0;
  }
  toArray() {
    return this.#values;
  }
}
// src/kernel/domain/trigger-name.ts
class TriggerName {
  #value;
  constructor(value) {
    this.#value = value;
  }
  static parse(raw) {
    if (raw === "")
      return err({ kind: "empty-trigger-name", raw });
    return ok(new TriggerName(raw));
  }
  static reconstitute(raw) {
    return new TriggerName(raw);
  }
  equals(other) {
    return this.#value === other.#value;
  }
  asString() {
    return this.#value;
  }
  isEmpty() {
    return this.#value === "";
  }
}
// src/kernel/domain/keyed-index.ts
class KeyedIndex {
  #entries;
  constructor(entries) {
    this.#entries = entries;
  }
  static empty() {
    return new KeyedIndex(new Map);
  }
  static of(entries) {
    const map = new Map;
    for (const [key, value] of entries)
      map.set(key.asString(), [key, value]);
    return new KeyedIndex(map);
  }
  with(key, value) {
    const map = new Map(this.#entries);
    map.set(key.asString(), [key, value]);
    return new KeyedIndex(map);
  }
  get(key) {
    return this.#entries.get(key.asString())?.[1];
  }
  has(key) {
    return this.#entries.has(key.asString());
  }
  size() {
    return this.#entries.size;
  }
  isEmpty() {
    return this.#entries.size === 0;
  }
  *keys() {
    for (const [key] of this.#entries.values())
      yield key;
  }
  *values() {
    for (const [, value] of this.#entries.values())
      yield value;
  }
  *[Symbol.iterator]() {
    yield* this.#entries.values();
  }
}
// src/kernel/domain/query-label.ts
class QueryLabel {
  #value;
  constructor(value) {
    this.#value = value;
  }
  static reconstitute(raw) {
    return new QueryLabel(raw);
  }
  equals(other) {
    return this.#value === other.#value;
  }
  compareTo(other) {
    return this.#value < other.#value ? -1 : this.#value > other.#value ? 1 : 0;
  }
  asString() {
    return this.#value;
  }
}
// src/kernel/domain/attribute-path.ts
class AttributePath {
  #value;
  constructor(value) {
    this.#value = value;
  }
  static parse(raw) {
    if (raw === "")
      return err({ kind: "empty-attribute-path", raw });
    return ok(new AttributePath(raw));
  }
  static reconstitute(raw) {
    return new AttributePath(raw);
  }
  equals(other) {
    return this.#value === other.#value;
  }
  compareTo(other) {
    return TargetId.reconstitute(this.#value).compareTo(TargetId.reconstitute(other.#value));
  }
  asString() {
    return this.#value;
  }
}
// src/kernel/domain/unit-name.ts
class UnitName {
  #value;
  constructor(value) {
    this.#value = value;
  }
  static parse(raw) {
    if (raw === "")
      return err({ kind: "empty-unit-name", raw });
    return ok(new UnitName(raw));
  }
  static reconstitute(raw) {
    return new UnitName(raw);
  }
  equals(other) {
    return this.#value === other.#value;
  }
  asString() {
    return this.#value;
  }
}
// src/kernel/domain/obligation-nature.ts
class ObligationNature {
  #value;
  constructor(value) {
    this.#value = value;
  }
  static reconstitute(raw) {
    return new ObligationNature(raw);
  }
  equals(other) {
    return this.#value === other.#value;
  }
  asString() {
    return this.#value;
  }
  isInvariant() {
    return this.#value === "invariant";
  }
  isNumeric() {
    return this.#value === "numeric";
  }
  isEvent() {
    return this.#value === "event";
  }
  isStateTemporal() {
    return this.#value === "state-temporal";
  }
}
// src/kernel/domain/finding-kind.ts
var KIND_RANK = {
  conflict: 0,
  "completeness-gap": 1,
  "scenario-violation": 2,
  unreachable: 3,
  redundancy: 4,
  "refinement-violation": 5,
  "mapping-gap": 6,
  "structure-invalid": 7,
  "reference-broken": 8,
  "consistency-mismatch": 9,
  "cross-check-disagreement": 10
};
function rankOf(kind) {
  return Object.hasOwn(KIND_RANK, kind) ? KIND_RANK[kind] : 99;
}

class FindingKind {
  #value;
  constructor(value) {
    this.#value = value;
  }
  static parse(raw) {
    if (!Object.hasOwn(KIND_RANK, raw))
      return err({ kind: "unknown-finding-kind", raw });
    return ok(new FindingKind(raw));
  }
  static reconstitute(raw) {
    return new FindingKind(raw);
  }
  static canonicalOrder() {
    return Object.keys(KIND_RANK);
  }
  equals(other) {
    return this.#value === other.#value;
  }
  compareTo(other) {
    return rankOf(this.#value) - rankOf(other.#value);
  }
  isConflict() {
    return this.#value === "conflict";
  }
  asString() {
    return this.#value;
  }
}
// src/kernel/domain/verification-method.ts
class VerificationMethod {
  #value;
  constructor(value) {
    this.#value = value;
  }
  static reconstitute(raw) {
    return new VerificationMethod(raw);
  }
  equals(other) {
    return this.#value === other.#value;
  }
  asString() {
    return this.#value;
  }
}
// src/kernel/domain/attribute-kind.ts
class AttributeKind {
  #value;
  constructor(value) {
    this.#value = value;
  }
  static reconstitute(raw) {
    return new AttributeKind(raw);
  }
  equals(other) {
    return this.#value === other.#value;
  }
  isBool() {
    return this.#value === "bool";
  }
  isInt() {
    return this.#value === "int";
  }
  isEnum() {
    return this.#value === "enum";
  }
  asString() {
    return this.#value;
  }
}
// src/doctor/domain/manifest-entry.ts
class ManifestEntry {
  #rel;
  #severity;
  constructor(rel, severity) {
    this.#rel = ArtifactPath.reconstitute(rel);
    this.#severity = severity;
  }
  static error(rel) {
    return new ManifestEntry(rel, CheckSeverity.error());
  }
  rel() {
    return this.#rel.asString();
  }
  severity() {
    return this.#severity;
  }
}
// src/doctor/domain/installation-manifest.ts
var err2 = (rel) => ManifestEntry.error(rel);

class InstallationManifest {
  #entries;
  constructor(entries) {
    this.#entries = entries;
  }
  static standard() {
    return new InstallationManifest([
      err2("sensors/aidlc-deep-spec-ir-valid.md"),
      err2("sensors/aidlc-deep-spec-verify-smt.md"),
      err2("sensors/aidlc-deep-spec-verify-quint.md"),
      err2("tools/aidlc-sensor-deep-spec-ir-valid.ts"),
      err2("tools/aidlc-sensor-deep-spec-verify-smt.ts"),
      err2("tools/aidlc-sensor-deep-spec-verify-quint.ts"),
      err2("tools/data/deep-spec-ir-schema.json"),
      err2("tools/data/deep-spec-findings-schema.json"),
      err2("knowledge/aidlc-product-agent/deep-spec-ir-authoring.md"),
      err2("sensors/aidlc-deep-spec-refcheck-domain.md"),
      err2("sensors/aidlc-deep-spec-refcheck-contract.md"),
      err2("sensors/aidlc-deep-spec-refcheck-functional.md"),
      err2("tools/aidlc-sensor-deep-spec-refcheck-domain.ts"),
      err2("tools/aidlc-sensor-deep-spec-refcheck-contract.ts"),
      err2("tools/aidlc-sensor-deep-spec-refcheck-functional.ts"),
      err2("tools/deep-spec-analysis-doctor.ts"),
      err2("sensors/aidlc-deep-spec-design-ir-valid.md"),
      err2("sensors/aidlc-deep-spec-design-verify-smt.md"),
      err2("sensors/aidlc-deep-spec-design-verify-quint.md"),
      err2("tools/aidlc-sensor-deep-spec-design-ir-valid.ts"),
      err2("tools/aidlc-sensor-deep-spec-design-verify-smt.ts"),
      err2("tools/aidlc-sensor-deep-spec-design-verify-quint.ts"),
      err2("tools/data/deep-spec-design-ir-schema.json"),
      err2("knowledge/aidlc-architect-agent/deep-spec-design-ir-authoring.md"),
      err2("tools/data/deep-spec-refinement-map-schema.json"),
      err2("knowledge/aidlc-architect-agent/deep-spec-refinement-map-authoring.md")
    ]);
  }
  *[Symbol.iterator]() {
    yield* this.#entries;
  }
}
// src/doctor/domain/installed-status.ts
class InstalledStatus {
  #entry;
  #present;
  constructor(entry, present) {
    this.#entry = entry;
    this.#present = present;
  }
  static of(entry, present) {
    return new InstalledStatus(entry, present);
  }
  entry() {
    return this.#entry;
  }
  isPresent() {
    return this.#present;
  }
}
// src/doctor/domain/solver-availability.ts
class SolverAvailability {
  #z3Package;
  #nodeRuntime;
  #quintCli;
  #apalache;
  #apalacheServerStale;
  constructor(props) {
    this.#z3Package = props.z3Package;
    this.#nodeRuntime = props.nodeRuntime;
    this.#quintCli = props.quintCli;
    this.#apalache = props.apalache;
    this.#apalacheServerStale = props.apalacheServerStale;
  }
  static of(props) {
    return new SolverAvailability(props);
  }
  hasZ3Package() {
    return this.#z3Package;
  }
  hasNodeRuntime() {
    return this.#nodeRuntime;
  }
  hasQuintCli() {
    return this.#quintCli;
  }
  hasApalache() {
    return this.#apalache && !this.#apalacheServerStale;
  }
  apalacheServerIsStale() {
    return this.#apalacheServerStale;
  }
}
// src/doctor/domain/digest-anchor.ts
class DigestAnchor {
  #expected;
  #actual;
  constructor(expected, actual) {
    this.#expected = expected;
    this.#actual = actual;
  }
  static of(expected, actual) {
    return new DigestAnchor(expected, actual);
  }
  isStale() {
    return !this.#expected.equals(this.#actual);
  }
}
// src/doctor/domain/verification-staleness.ts
class VerificationStaleness {
  #anchor;
  constructor(props) {
    this.#anchor = props.anchor;
  }
  static of(props) {
    return new VerificationStaleness(props);
  }
  isStale() {
    return this.#anchor === null ? true : this.#anchor.isStale();
  }
}
// src/doctor/domain/coverage-state.ts
class CoverageState {
  #value;
  constructor(value) {
    this.#value = value;
  }
  static unverified() {
    return new CoverageState("unverified");
  }
  static stale() {
    return new CoverageState("stale");
  }
  match(handlers) {
    return this.#value === "unverified" ? handlers.unverified() : handlers.stale();
  }
  equals(other) {
    return this.#value === other.#value;
  }
}
// src/doctor/usecase/check-installation-usecase.ts
class CheckInstallationUseCase {
  #files;
  constructor(files) {
    this.#files = files;
  }
  execute() {
    const out = [];
    for (const entry of InstallationManifest.standard()) {
      out.push(InstalledStatus.of(entry, this.#files.isInstalled(entry.rel())));
    }
    return out;
  }
}
// src/doctor/usecase/check-solvers-usecase.ts
class CheckSolversUseCase {
  #probes;
  constructor(probes) {
    this.#probes = probes;
  }
  execute() {
    return this.#probes.availability();
  }
}
// src/doctor/usecase/read-model/coverage-assessment.ts
class CoverageAssessment {
  #eligible;
  #problems;
  #scopes;
  constructor(props) {
    this.#eligible = props.eligible;
    this.#problems = props.problems;
    this.#scopes = props.scopes;
  }
  static of(props) {
    return new CoverageAssessment({ eligible: props.eligible, problems: [...props.problems], scopes: [...props.scopes] });
  }
  isClean() {
    return this.#problems.length === 0;
  }
  verifiedCount() {
    return this.#eligible - this.#problems.length;
  }
  eligibleCount() {
    return this.#eligible;
  }
  problems() {
    return this.#problems;
  }
  scopes() {
    return this.#scopes;
  }
}

// src/doctor/usecase/read-model/coverage-row.ts
class CoverageRow {
  #space;
  #intent;
  #state;
  constructor(props) {
    this.#space = props.space;
    this.#intent = props.intent;
    this.#state = props.state;
  }
  static reconstitute(props) {
    return new CoverageRow(props);
  }
  intent() {
    return this.#intent;
  }
  intentLabel() {
    return `${this.#space}/${this.#intent}`;
  }
  matchState(handlers) {
    return this.#state.match(handlers);
  }
}

// src/doctor/usecase/check-verification-coverage-usecase.ts
class CheckVerificationCoverageUseCase {
  #workspace;
  constructor(workspace) {
    this.#workspace = workspace;
  }
  execute() {
    const scopes = this.#workspace.verificationScopes();
    const problems = [];
    const targets = this.#workspace.verificationTargets(scopes);
    for (const t of targets) {
      if (!t.hasModel || !t.hasFindings) {
        problems.push(CoverageRow.reconstitute({ space: t.space, intent: t.intent, state: CoverageState.unverified() }));
        continue;
      }
      const stale = VerificationStaleness.of({ anchor: t.anchor }).isStale();
      if (stale)
        problems.push(CoverageRow.reconstitute({ space: t.space, intent: t.intent, state: CoverageState.stale() }));
    }
    return CoverageAssessment.of({ eligible: targets.length, problems, scopes });
  }
}
// src/doctor/usecase/read-model/debt-row.ts
class DebtRow {
  #space;
  #intent;
  #artifact;
  #findings;
  constructor(props) {
    this.#space = props.space;
    this.#intent = props.intent;
    this.#artifact = props.artifact;
    this.#findings = props.findings;
  }
  static reconstitute(props) {
    return new DebtRow(props);
  }
  findingCount() {
    return this.#findings;
  }
  locationLabel() {
    return `${this.#space}/${this.#intent} ${this.#artifact}`;
  }
}

// src/doctor/usecase/read-model/structural-debt.ts
class StructuralDebt {
  #scanned;
  #rows;
  constructor(props) {
    this.#scanned = props.scanned;
    this.#rows = props.rows;
  }
  static of(props) {
    return new StructuralDebt({ scanned: props.scanned, rows: [...props.rows] });
  }
  hasScans() {
    return this.#scanned > 0;
  }
  scannedCount() {
    return this.#scanned;
  }
  totalFindings() {
    return this.#rows.reduce((n, r) => n + r.findingCount(), 0);
  }
  rows() {
    return this.#rows;
  }
}

// src/doctor/usecase/check-structural-debt-usecase.ts
class CheckStructuralDebtUseCase {
  #workspace;
  #backend;
  constructor(workspace, backend) {
    this.#workspace = workspace;
    this.#backend = backend;
  }
  execute() {
    const rows = [];
    let scanned = 0;
    for (const ref of this.#workspace.designArtifacts()) {
      const findings = this.#backend.reportOnlyFindings(ref.tool, ref.artifactPath);
      if (findings === null)
        continue;
      scanned += 1;
      if (findings > 0)
        rows.push(DebtRow.reconstitute({ space: ref.space, intent: ref.intent, artifact: ref.label, findings }));
    }
    return StructuralDebt.of({ scanned, rows });
  }
}
// src/doctor/usecase/read-model/refinement-stale-row.ts
class RefinementStaleRow {
  #space;
  #intent;
  constructor(space, intent) {
    this.#space = space;
    this.#intent = intent;
  }
  static reconstitute(props) {
    return new RefinementStaleRow(props.space, props.intent);
  }
  intent() {
    return this.#intent;
  }
  intentLabel() {
    return `${this.#space}/${this.#intent}`;
  }
}

// src/doctor/usecase/read-model/unit-coverage.ts
class UnitCoverage {
  #eligible;
  #problems;
  #refinementStale;
  #scopes;
  constructor(props) {
    this.#eligible = props.eligible;
    this.#problems = props.problems;
    this.#refinementStale = props.refinementStale;
    this.#scopes = props.scopes;
  }
  static of(props) {
    return new UnitCoverage({
      eligible: props.eligible,
      problems: [...props.problems],
      refinementStale: [...props.refinementStale],
      scopes: [...props.scopes]
    });
  }
  hasEligible() {
    return this.#eligible > 0;
  }
  isClean() {
    return this.#problems.length === 0;
  }
  verifiedCount() {
    return this.#eligible - this.#problems.length;
  }
  eligibleCount() {
    return this.#eligible;
  }
  problems() {
    return this.#problems;
  }
  refinementStale() {
    return this.#refinementStale;
  }
  scopes() {
    return this.#scopes;
  }
}

// src/doctor/usecase/read-model/unit-coverage-row.ts
class UnitCoverageRow {
  #space;
  #intent;
  #unit;
  #state;
  constructor(props) {
    this.#space = props.space;
    this.#intent = props.intent;
    this.#unit = props.unit;
    this.#state = props.state;
  }
  static reconstitute(props) {
    return new UnitCoverageRow(props);
  }
  intent() {
    return this.#intent;
  }
  unitLabel() {
    return `${this.#space}/${this.#intent}/${this.#unit}`;
  }
  matchState(handlers) {
    return this.#state.match(handlers);
  }
}

// src/doctor/usecase/check-functional-coverage-usecase.ts
class CheckFunctionalCoverageUseCase {
  #workspace;
  constructor(workspace) {
    this.#workspace = workspace;
  }
  execute() {
    const scopes = this.#workspace.functionalScopes();
    const problems = [];
    const refinementStale = [];
    let eligible = 0;
    for (const t of this.#workspace.functionalTargets(scopes)) {
      const modelUnits = new Set(t.modelUnits);
      const completed = new Set(t.completedUnits);
      for (const unit of t.units) {
        eligible += 1;
        if (!modelUnits.has(unit.name) || !t.hasFindings || !completed.has(unit.name)) {
          problems.push(UnitCoverageRow.reconstitute({ space: t.space, intent: t.intent, unit: unit.name, state: CoverageState.unverified() }));
          continue;
        }
        if (unit.newestArtifactMtime > t.modelMtime) {
          problems.push(UnitCoverageRow.reconstitute({ space: t.space, intent: t.intent, unit: unit.name, state: CoverageState.stale() }));
        }
      }
      if (t.modelMtime > 0 && t.hasFindings && t.requirementsModelMtime !== null && t.requirementsModelMtime > t.modelMtime) {
        refinementStale.push(RefinementStaleRow.reconstitute({ space: t.space, intent: t.intent }));
      }
    }
    return UnitCoverage.of({ eligible, problems, refinementStale, scopes });
  }
}
// src/doctor/adapter/harness-file-client-impl.ts
import { existsSync } from "fs";
import { join } from "path";

class HarnessFileClientImpl {
  #root;
  constructor(config) {
    this.#root = config.root;
  }
  isInstalled(rel) {
    return existsSync(join(this.#root, rel));
  }
}
// src/doctor/adapter/solver-probe-client-impl.ts
import { spawnSync } from "child_process";
import { existsSync as existsSync2, mkdtempSync, readdirSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join as join2 } from "path";
function listenProbe(port) {
  return `const s=require("node:net").connect(${port},"127.0.0.1");` + "s.setTimeout(300);" + 's.on("connect",()=>{s.destroy()});' + 's.on("timeout",()=>{s.destroy();throw new Error("no apalache server")});' + 's.on("error",()=>{throw new Error("no apalache server")});';
}
var PROBE_MODULE = `module probe {
  var x: int
  action init = { x' = 0 }
  action step = { x' = x + 1 }
  val inv = x >= 0
}
`;

class SolverProbeClientImpl {
  #config;
  constructor(config) {
    this.#config = config;
  }
  #probe(cmd, args) {
    const res = spawnSync(cmd, args, { encoding: "utf-8", timeout: 5000 });
    return !res.error && res.status === 0;
  }
  #apalacheServerIsListening() {
    const res = spawnSync(this.#config.runtimeBin, ["-e", listenProbe(this.#config.apalachePort)], {
      encoding: "utf-8",
      timeout: 2000
    });
    return !res.error && res.status === 0;
  }
  #apalacheServerIsStale() {
    if (!this.#apalacheServerIsListening())
      return false;
    const work = mkdtempSync(join2(tmpdir(), "deep-spec-doctor-probe-"));
    try {
      const spec = join2(work, "probe.qnt");
      writeFileSync(spec, PROBE_MODULE, "utf-8");
      const res = spawnSync(this.#config.quintBin, ["verify", spec, "--main=probe", "--invariant=inv", "--max-steps=1"], {
        encoding: "utf-8",
        timeout: 30000,
        cwd: work,
        killSignal: "SIGINT"
      });
      return Boolean(res.error) || res.status !== 0;
    } finally {
      rmSync(work, { recursive: true, force: true });
    }
  }
  availability() {
    let apalacheDist = this.#config.apalacheDistDeclared;
    if (!apalacheDist) {
      try {
        apalacheDist = readdirSync(join2(this.#config.homeDir, ".quint")).some((f) => f.startsWith("apalache-dist-"));
      } catch {
        apalacheDist = false;
      }
    }
    const quintCli = this.#probe(this.#config.quintBin, ["--version"]);
    const apalache = this.#probe("java", ["-version"]) && apalacheDist;
    return SolverAvailability.of({
      z3Package: existsSync2(join2(this.#config.projectDir, "node_modules", "z3-solver", "package.json")),
      nodeRuntime: this.#probe("node", ["--version"]),
      quintCli,
      apalache,
      apalacheServerStale: apalache && quintCli && this.#apalacheServerIsStale()
    });
  }
}
// src/doctor/adapter/refcheck-backend-client-impl.ts
import { spawnSync as spawnSync2 } from "child_process";
import { existsSync as existsSync3 } from "fs";
import { join as join3 } from "path";

class RefcheckBackendClientImpl {
  #root;
  constructor(config) {
    this.#root = config.root;
  }
  reportOnlyFindings(tool, artifactPath) {
    const script = join3(this.#root, "tools", tool);
    if (!existsSync3(script))
      return null;
    const res = spawnSync2("bun", [script, "--stage", "doctor", "--output-path", artifactPath, "--report-only"], {
      encoding: "utf-8",
      timeout: 15000
    });
    if (res.error || res.status !== 0)
      return null;
    try {
      const lines = (res.stdout ?? "").trim().split(`
`);
      const verdict = JSON.parse(lines[lines.length - 1] ?? "{}");
      return typeof verdict.findings_count === "number" ? verdict.findings_count : null;
    } catch {
      return null;
    }
  }
}
// src/doctor/adapter/doctor-workspace-client-impl.ts
import { existsSync as existsSync4, readdirSync as readdirSync2, readFileSync, statSync } from "fs";
import { join as join4 } from "path";
class DoctorWorkspaceClientImpl {
  #projectDir;
  #root;
  #refcheckToolNames;
  constructor(config) {
    this.#projectDir = config.projectDir;
    this.#root = config.root;
    this.#refcheckToolNames = config.refcheckToolNames;
  }
  static #FALLBACK_STAGE_SCOPES = ["enterprise", "feature"];
  #scopesOfStage(...stagePath) {
    const stageFile = join4(this.#root, "aidlc-common", "stages", ...stagePath);
    try {
      const frontmatter = readFileSync(stageFile, "utf-8").split(`
---`)[0];
      const m = frontmatter.match(/^scopes:\n((?:\s+- .+\n)+)/m);
      const items = m?.[1]?.match(/- (\S+)/g) ?? null;
      if (items)
        return items.map((s) => s.slice(2));
    } catch {}
    return DoctorWorkspaceClientImpl.#FALLBACK_STAGE_SCOPES;
  }
  verificationScopes() {
    return this.#scopesOfStage("inception", "deep-spec-analysis-verify.md");
  }
  functionalScopes() {
    return this.#scopesOfStage("construction", "deep-spec-analysis-functional-verify.md");
  }
  #spaces() {
    try {
      return readdirSync2(join4(this.#projectDir, "aidlc", "spaces"), { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name);
    } catch {
      return [];
    }
  }
  #intents(space) {
    try {
      return readdirSync2(join4(this.#projectDir, "aidlc", "spaces", space, "intents"), { withFileTypes: true }).filter((e) => e.isDirectory() && !e.name.startsWith(".")).map((e) => e.name);
    } catch {
      return [];
    }
  }
  #record(space, intent) {
    return join4(this.#projectDir, "aidlc", "spaces", space, "intents", intent);
  }
  #scopeOf(record) {
    let state = "";
    try {
      state = readFileSync(join4(record, "aidlc-state.md"), "utf-8");
    } catch {
      return null;
    }
    return state.match(/^- \*\*Scope\*\*: (\S+)/m)?.[1] ?? null;
  }
  verificationTargets(scopes) {
    const out = [];
    const inScope = new Set(scopes);
    for (const space of this.#spaces()) {
      for (const intent of this.#intents(space)) {
        const record = this.#record(space, intent);
        const scope = this.#scopeOf(record);
        if (!scope || !inScope.has(scope))
          continue;
        const requirements = join4(record, "inception", "requirements-analysis", "requirements.md");
        if (!existsSync4(requirements))
          continue;
        const model = join4(record, "inception", "deep-spec-analysis-verify", "deep-spec-analysis-formal-model.md");
        const verifyDir = join4(record, "inception", "deep-spec-analysis-verify", "deep-spec-verify");
        let hasFindings = false;
        try {
          hasFindings = readdirSync2(verifyDir).some((f) => f.endsWith(".json"));
        } catch {
          hasFindings = false;
        }
        const hasModel = existsSync4(model);
        if (!hasModel || !hasFindings) {
          out.push({ space, intent, hasModel, hasFindings, anchor: null });
          continue;
        }
        const anchored = readFileSync(model, "utf-8").match(/```json\n([\s\S]*?)```/)?.[1]?.match(/"sourceDigest"\s*:\s*"([0-9a-f]{64})"/)?.[1];
        out.push({
          space,
          intent,
          hasModel,
          hasFindings,
          anchor: anchored ? DigestAnchor.of(ContentHash.reconstitute(anchored), ContentHash.ofBytes(readFileSync(requirements))) : null
        });
      }
    }
    return out;
  }
  designArtifacts() {
    const out = [];
    for (const space of this.#spaces()) {
      for (const intent of this.#intents(space)) {
        const record = this.#record(space, intent);
        const ref = (tool, artifactPath, label) => {
          if (!existsSync4(artifactPath))
            return;
          out.push({ space, intent, tool, artifactPath, label });
        };
        ref(this.#refcheckToolNames.domain, join4(record, "inception", "domain-design", "components.md"), "inception/domain-design/components.md");
        ref(this.#refcheckToolNames.contract, join4(record, "inception", "contract-design", "contract-summary.md"), "inception/contract-design/contract-summary.md");
        const constructionDir = join4(record, "construction");
        let units = [];
        try {
          units = readdirSync2(constructionDir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name).sort();
        } catch {
          units = [];
        }
        for (const unit of units) {
          const fdDir = join4(constructionDir, unit, "functional-design");
          const trigger = ["entities.md", "rules.md", "functional-spec.md"].map((f) => join4(fdDir, f)).find((p) => existsSync4(p));
          if (trigger !== undefined) {
            ref(this.#refcheckToolNames.functional, trigger, `construction/${unit}/functional-design`);
          }
        }
      }
    }
    return out;
  }
  functionalTargets(scopes) {
    const out = [];
    const inScope = new Set(scopes);
    for (const space of this.#spaces()) {
      for (const intent of this.#intents(space)) {
        const record = this.#record(space, intent);
        const scope = this.#scopeOf(record);
        if (!scope || !inScope.has(scope))
          continue;
        const constructionDir = join4(record, "construction");
        let unitDirs = [];
        try {
          unitDirs = readdirSync2(constructionDir, { withFileTypes: true }).filter((e) => e.isDirectory() && existsSync4(join4(constructionDir, e.name, "functional-design"))).map((e) => e.name).sort();
        } catch {
          continue;
        }
        if (unitDirs.length === 0)
          continue;
        const stageDir = join4(constructionDir, "deep-spec-analysis-functional-verify");
        const modelPath = join4(stageDir, "deep-spec-analysis-functional-formal-model.md");
        let modelUnits = [];
        let modelMtime = 0;
        const completedUnits = new Set;
        let hasFindings = false;
        if (existsSync4(modelPath)) {
          try {
            modelMtime = statSync(modelPath).mtimeMs;
            const fence = readFileSync(modelPath, "utf-8").match(/```json\n([\s\S]*?)```/);
            const ir = fence ? JSON.parse(fence[1] ?? "{}") : {};
            for (const u of Array.isArray(ir.units) ? ir.units : []) {
              if (u && typeof u.unit === "string")
                modelUnits.push(u.unit);
            }
          } catch {
            modelUnits = [];
          }
          try {
            const verifyDir = join4(stageDir, "deep-spec-design-verify");
            for (const f of readdirSync2(verifyDir)) {
              if (!f.endsWith(".json") || f === "cross-check.json")
                continue;
              try {
                const doc = JSON.parse(readFileSync(join4(verifyDir, f), "utf-8"));
                if (doc && typeof doc === "object" && !doc.unavailable) {
                  hasFindings = true;
                  for (const t of Array.isArray(doc.checked) ? doc.checked : []) {
                    if (typeof t === "string" && t.startsWith("unit:"))
                      completedUnits.add(t.slice(5));
                  }
                }
              } catch {}
            }
          } catch {
            hasFindings = false;
          }
        }
        const units = unitDirs.map((unit) => {
          const fdDir = join4(constructionDir, unit, "functional-design");
          let newest = 0;
          for (const f of ["entities.md", "rules.md", "functional-spec.md"]) {
            const p = join4(fdDir, f);
            if (existsSync4(p))
              newest = Math.max(newest, statSync(p).mtimeMs);
          }
          return { name: unit, newestArtifactMtime: newest };
        });
        const reqModel = join4(record, "inception", "deep-spec-analysis-verify", "deep-spec-analysis-formal-model.md");
        out.push({
          space,
          intent,
          units,
          modelMtime,
          modelUnits,
          completedUnits: [...completedUnits],
          hasFindings,
          requirementsModelMtime: existsSync4(reqModel) ? statSync(reqModel).mtimeMs : null
        });
      }
    }
    return out;
  }
}
// src/doctor/adapter/doctor-presenter.ts
class DoctorPresenter {
  #harnessDir;
  constructor(config) {
    this.#harnessDir = config.harnessDir;
  }
  installation(statuses) {
    return statuses.map((s) => Check.reconstitute({
      pass: s.isPresent(),
      label: `deep-spec-analysis: ${s.entry().rel()} installed`,
      fix: `Run \`bun ${this.#harnessDir}/tools/aidlc-utility.ts plugin-sync\` (or re-run the plugin's \`hooks/compose.ts\`).`,
      severity: s.entry().severity()
    }));
  }
  solvers(availability) {
    return [
      Check.reconstitute({
        pass: availability.hasZ3Package(),
        label: "deep-spec-analysis: z3-solver package present (SMT backend)",
        fix: "Run `bun add z3-solver` in the project root. Without it the SMT backend reports `unavailable` and skips its checks.",
        severity: CheckSeverity.advisory()
      }),
      Check.reconstitute({
        pass: availability.hasNodeRuntime(),
        label: "deep-spec-analysis: node runtime on PATH (executes the z3 child process)",
        fix: "Install Node.js >= 23 (its TypeScript type-stripping runs the solver child). Without it the SMT backend falls back to bun, which currently aborts on z3's pthread build.",
        severity: CheckSeverity.advisory()
      }),
      Check.reconstitute({
        pass: availability.hasQuintCli(),
        label: "deep-spec-analysis: quint CLI on PATH (Quint backend)",
        fix: "Run `npm i -g @informalsystems/quint`. Without it the Quint backend reports `unavailable` and skips its checks.",
        severity: CheckSeverity.advisory()
      }),
      Check.reconstitute({
        pass: availability.hasApalache(),
        label: "deep-spec-analysis: Apalache available (quint verify, method: bounded)",
        fix: availability.apalacheServerIsStale() ? "An Apalache server is listening on localhost:8822 but cannot verify \u2014 typically an orphan that still holds a deleted working directory. Stop it (`lsof -nP -iTCP:8822 -sTCP:LISTEN` shows the PID, then `kill <pid>`); quint starts a fresh server on the next `quint verify`." : "Install a JDK (17+) and run any `quint verify` once so quint downloads its Apalache distribution into ~/.quint (or set APALACHE_DIST). Without it the Quint backend uses seeded simulation (method: simulation) and skips leads-to temporal obligations.",
        severity: CheckSeverity.advisory()
      })
    ];
  }
  verificationCoverage(assessment) {
    const rows = assessment.problems().map((row) => {
      const noun = row.matchState({
        unverified: () => "has requirements with no deep-spec verification",
        stale: () => "changed its requirements after the last deep-spec verification"
      });
      return Check.reconstitute({
        pass: false,
        label: `deep-spec-analysis: intent ${row.intentLabel()} ${noun}`,
        fix: `Make it the active intent (\`bun ${this.#harnessDir}/tools/aidlc-utility.ts intent ${row.intent()}\`), ` + "then run `/aidlc --stage deep-spec-analysis-verify --single` to verify its requirements without advancing the workflow.",
        severity: CheckSeverity.advisory()
      });
    });
    rows.push(Check.reconstitute({
      pass: assessment.isClean(),
      label: `deep-spec-analysis: verification coverage \u2014 ${assessment.verifiedCount()}/${assessment.eligibleCount()} ` + "eligible intents verified (scopes: " + assessment.scopes().join(", ") + ")",
      fix: "See the per-intent rows above for the exact command each unverified intent needs.",
      severity: CheckSeverity.advisory()
    }));
    return rows;
  }
  structuralDebt(debt) {
    const rows = debt.rows().map((row) => Check.reconstitute({
      pass: false,
      label: `deep-spec-analysis: ${row.locationLabel()} has ${row.findingCount()} reference-integrity finding(s)`,
      fix: "Open the artifact and fix (or record as an accepted risk) each finding; " + "the deep-spec-refcheck sensors re-check on every write and write the detail next to the artifact under deep-spec-refcheck/.",
      severity: CheckSeverity.advisory()
    }));
    if (debt.hasScans()) {
      rows.push(Check.reconstitute({
        pass: debt.totalFindings() === 0,
        label: `deep-spec-analysis: design refcheck \u2014 ${debt.totalFindings()} structural finding(s) across ${debt.scannedCount()} design artifact(s) scanned (report-only)`,
        fix: "See the per-artifact rows above.",
        severity: CheckSeverity.advisory()
      }));
    }
    return rows;
  }
  functionalCoverage(coverage) {
    const rows = coverage.refinementStale().map((row) => Check.reconstitute({
      pass: false,
      label: `deep-spec-analysis: intent ${row.intentLabel()} re-verified its requirements after the last design verification (refinement evidence is stale)`,
      fix: `Make it the active intent (\`bun ${this.#harnessDir}/tools/aidlc-utility.ts intent ${row.intent()}\`), ` + "then run `/aidlc --stage deep-spec-analysis-functional-verify --single` to re-check the design against the current requirements.",
      severity: CheckSeverity.advisory()
    }));
    for (const row of coverage.problems()) {
      const noun = row.matchState({
        unverified: () => "has functional-design artifacts with no deep-spec design verification",
        stale: () => "changed its functional-design artifacts after the last design verification"
      });
      rows.push(Check.reconstitute({
        pass: false,
        label: `deep-spec-analysis: unit ${row.unitLabel()} ${noun}`,
        fix: `Make it the active intent (\`bun ${this.#harnessDir}/tools/aidlc-utility.ts intent ${row.intent()}\`), ` + "then run `/aidlc --stage deep-spec-analysis-functional-verify --single` to verify its functional design without advancing the workflow.",
        severity: CheckSeverity.advisory()
      }));
    }
    if (coverage.hasEligible()) {
      rows.push(Check.reconstitute({
        pass: coverage.isClean(),
        label: `deep-spec-analysis: design verification coverage \u2014 ${coverage.verifiedCount()}/${coverage.eligibleCount()} ` + "eligible units verified (scopes: " + coverage.scopes().join(", ") + ")",
        fix: "See the per-unit rows above for the exact command each unverified unit needs.",
        severity: CheckSeverity.advisory()
      }));
    }
    return rows;
  }
}
// src/entries/deep-spec-analysis-doctor.ts
function main() {
  const projectDir = process.env.AIDLC_PROJECT_DIR || process.cwd();
  const harnessDir = process.env.AIDLC_HARNESS_DIR || ".claude";
  const root = join5(projectDir, harnessDir);
  const presenter = new DoctorPresenter({ harnessDir });
  const workspace = new DoctorWorkspaceClientImpl({
    projectDir,
    root,
    refcheckToolNames: {
      domain: "aidlc-sensor-deep-spec-refcheck-domain.ts",
      contract: "aidlc-sensor-deep-spec-refcheck-contract.ts",
      functional: "aidlc-sensor-deep-spec-refcheck-functional.ts"
    }
  });
  const verdict = HealthVerdict.of([
    ...presenter.installation(new CheckInstallationUseCase(new HarnessFileClientImpl({ root })).execute()),
    ...presenter.solvers(new CheckSolversUseCase(new SolverProbeClientImpl({
      projectDir,
      quintBin: process.env.AIDLC_DEEP_SPEC_QUINT_BIN || "quint",
      apalacheDistDeclared: Boolean(process.env.APALACHE_DIST),
      homeDir: process.env.HOME ?? "",
      apalachePort: 8822,
      runtimeBin: process.execPath
    })).execute()),
    ...presenter.verificationCoverage(new CheckVerificationCoverageUseCase(workspace).execute()),
    ...presenter.structuralDebt(new CheckStructuralDebtUseCase(workspace, new RefcheckBackendClientImpl({ root })).execute()),
    ...presenter.functionalCoverage(new CheckFunctionalCoverageUseCase(workspace).execute())
  ]);
  process.stdout.write(`${JSON.stringify(verdict.document())}
`);
}
main();
