// 型付き lowering → 契約1 v1 文書（Json）の直列化。配列順（OB-n / SC-n / BG-n
// の採番順）は子バックエンドの処理順に効く凍結面。schema.entities は設計
// ユニットの型付き実体宣言から描画する（裁定 2、2026-09-03——整形済み IR と
// バイト同一）。

import type { Json } from "../../kernel/adapter/index.ts";
import { LoweredUnit } from "../domain/index.ts";
import type { DesignUnit } from "../domain/index.ts";
import { renderDesignEntities } from "./design-entities-parser.ts";

export function renderLoweredDocument(u: DesignUnit, low: LoweredUnit): Json {
  const obligations: Json[] = low.obligations().toArray().map((ob) => {
    const out: { [k: string]: Json } = {
      id: ob.id().asString(),
      nature: ob.nature(),
      frRefs: ob.frRefs() as unknown as Json,
    };
    const assertion = ob.assertion();
    if (assertion) out.assert = assertion as unknown as Json;
    const trigger = ob.trigger();
    if (trigger !== undefined) out.trigger = trigger;
    const guard = ob.guard();
    if (guard) out.guard = guard as unknown as Json;
    const effect = ob.effect();
    if (effect) out.effect = effect as unknown as Json;
    const temporal = ob.temporal();
    if (temporal) out.temporal = temporal as unknown as Json;
    return out;
  });
  const scenarios: Json[] = low.scenarios().toArray().map((sc) => {
    const out: { [k: string]: Json } = {
      id: sc.id().asString(),
      kind: sc.kind(),
      frRefs: sc.frRefs() as unknown as Json,
      bindings: sc.bindings() as unknown as Json,
    };
    const event = sc.event();
    if (event) out.event = event as unknown as Json;
    const expectation = sc.expectation();
    if (expectation) out.expect = expectation as unknown as Json;
    return out;
  });
  const background: Json[] = low.background().toArray().map((bg) => ({ id: bg.id().asString(), assert: bg.assertion() as unknown as Json }));
  return {
    irVersion: "1.0.0",
    schema: { entities: renderDesignEntities(u.entities()) },
    obligations: obligations as unknown as Json,
    scenarios: scenarios as unknown as Json,
    background: background as unknown as Json,
  };
}
