import { expect, test } from "bun:test";
import { ArtifactPath } from "@deep-spec-analysis/kernel-domain";
import { IllegalArgumentException } from "@deep-spec-analysis/kernel-infrastructure";
import { parseEntitiesDocument, parseFunctionalSpecDocument } from "@deep-spec-analysis/refcheck-adapter";
import {
  CheckFamilies,
  CheckFamily,
  MachineSpecification,
  ReferenceCheckReport,
  ReferenceCheckReportIdentifier,
} from "@deep-spec-analysis/refcheck-domain";

const path = ArtifactPath.of;
const report = () =>
  ReferenceCheckReport.open(
    ReferenceCheckReportIdentifier.of(path("/review/output"), "functional-design"),
    CheckFamilies.of([CheckFamily.of("FD-S1"), CheckFamily.of("FD-S2")]),
  );
const entityDocument = "```yaml\nentities: []\n```";

const lifecycleDocument = `\`\`\`yaml
entities:
  - name: Order
    attributes:
      - name: status
        type: enum
        allowed-values: [open]
      - name: shipping
        type: enum
        allowed-values: [open]
  - name: Invoice
    attributes:
      - name: status
        type: enum
        allowed-values: [open]
\`\`\``;
const diagram = (name: string) =>
  `### State Machine: ${name}\n\n\`\`\`mermaid\nstateDiagram-v2\n[*] --> open\n\`\`\`\n`;
const checkMachines = (text: string) => {
  const output = report();
  const entities = parseEntitiesDocument(lifecycleDocument).check(output, path("entities.md"));
  parseFunctionalSpecDocument(text).check(output, path("functional-spec.md"), path("entities.md"), entities);
  return output;
};

test("一部の図を追加しても別の実体の未検査は消えない", () => {
  const output = checkMachines(diagram("Order"));
  expect(output.findingsCount()).toBe(0);
  expect(output.checked().toStrings()).toEqual([]);
  expect(
    output
      .skipped()
      .toArray()
      .map((skip) => skip.target()),
  ).toEqual(["check:FD-S1", "check:FD-S2"]);
  expect(
    output
      .skipped()
      .toArray()
      .every((skip) => skip.detail()?.includes('lifecycle entity "Invoice"')),
  ).toBe(true);
});

test("全欠落・属性を明示した全被覆・重複図で被覆の意味が変わらない", () => {
  expect(checkMachines("").skippedCount()).toBe(4);
  const complete = `${diagram("Order.status")}${diagram("Invoice.status")}`;
  for (const text of [complete, `${complete}${diagram("Order.status")}`]) {
    const output = checkMachines(text);
    expect(output.skippedCount()).toBe(0);
    expect(output.findingsCount()).toBe(0);
    expect(output.checked().toStrings()).toEqual(["check:FD-S1", "check:FD-S2"]);
  }
  const explicitAttribute = checkMachines(`${diagram("Order.shipping")}${diagram("Invoice")}`);
  expect(explicitAttribute.checked().toStrings()).toEqual(["check:FD-S1", "check:FD-S2"]);
  expect(explicitAttribute.skippedCount()).toBe(0);
  const unresolvedAttribute = checkMachines(`${diagram("Order.absent")}${diagram("Invoice")}`);
  expect(unresolvedAttribute.checked().toStrings()).toEqual([]);
  expect(
    unresolvedAttribute
      .skipped()
      .toArray()
      .some((skip) => skip.detail()?.includes('lifecycle entity "Order"')),
  ).toBe(true);
});

test("図の状態名のサイズ違反もpanicではなく未検査として報告される", () => {
  const text = diagram("Order").replace("--> open", `--> ${"s".repeat(129)}`);
  let output: ReturnType<typeof checkMachines> | undefined;
  expect(() => {
    output = checkMachines(text);
  }).not.toThrow();
  expect(output?.checked().toStrings()).toEqual([]);
  expect(
    output
      ?.skipped()
      .toArray()
      .some((skip) => skip.detail()?.includes("state-name-too-long")),
  ).toBe(true);
});

test("不正な状態機械の見出しは消えずに未検査として報告される", () => {
  for (const raw of ["", "E".repeat(129), ".state", "E".repeat(4097)]) {
    const output = report();
    const entities = parseEntitiesDocument(entityDocument).check(output, path("entities.md"));
    expect(() =>
      parseFunctionalSpecDocument(
        `### State Machine: ${raw}\n\n\`\`\`mermaid\nstateDiagram-v2\n[*] --> open\n\`\`\`\n`,
      ).check(output, path("functional-spec.md"), path("entities.md"), entities),
    ).not.toThrow();
    expect(output.checked().toStrings()).toEqual([]);
    expect(
      output
        .skipped()
        .toArray()
        .map((skip) => skip.target()),
    ).toEqual(["check:FD-S1", "check:FD-S2"]);
    expect(
      output
        .skipped()
        .toArray()
        .every((skip) => skip.reason() === "unrecognized-format"),
    ).toBe(true);
  }
});

test("状態機械の指定は構成要素を安全に照会できる場合だけ構築できる", () => {
  const valid = MachineSpecification.parse(`${"E".repeat(128)}.${"a".repeat(128)}`);
  expect(valid.ok).toBe(true);
  if (!valid.ok) throw new Error("fixture must parse");
  expect(valid.value.entityToken().asString()).toBe("E".repeat(128));
  for (const raw of [
    "E".repeat(129),
    ".state",
    "Order.",
    "Order.state.extra",
    `Order.${"a".repeat(129)}`,
    "Order\n.status",
    "Order.\ud800",
  ]) {
    expect(() => MachineSpecification.of(raw)).toThrow(IllegalArgumentException);
    const parsed = MachineSpecification.parse(raw);
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.error).not.toBeInstanceOf(Error);
  }
});
