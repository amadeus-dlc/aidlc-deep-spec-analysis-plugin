// 型付き lowering → 契約1 v1 文書（Json）の直列化。配列順（OB-n / SC-n / BG-n
// の採番順）は子バックエンドの処理順に効く凍結面。schema.entities には設計
// ユニットのエンティティ断片を逐語で埋め込む。

import type { Json } from "../../kernel/adapter/index.ts";
import { LoweredUnit } from "../domain/index.ts";
import type { DesignUnit } from "../domain/index.ts";

export function renderLoweredDocument(u: DesignUnit, low: LoweredUnit): Json {
  const obligations: Json[] = low.obligations().toArray().map((ob) => {
    const out: { [k: string]: Json } = {
      id: ob.id.asString(),
      nature: ob.nature,
      frRefs: ob.frRefs as unknown as Json,
    };
    if (ob.assert) out.assert = ob.assert as unknown as Json;
    if (ob.trigger !== undefined) out.trigger = ob.trigger;
    if (ob.guard) out.guard = ob.guard as unknown as Json;
    if (ob.effect) out.effect = ob.effect as unknown as Json;
    if (ob.temporal) out.temporal = ob.temporal as unknown as Json;
    return out;
  });
  const scenarios: Json[] = low.scenarios().toArray().map((sc) => {
    const out: { [k: string]: Json } = {
      id: sc.id.asString(),
      kind: sc.kind,
      frRefs: sc.frRefs as unknown as Json,
      bindings: sc.bindings as unknown as Json,
    };
    if (sc.event) out.event = sc.event as unknown as Json;
    if (sc.expect) out.expect = sc.expect as unknown as Json;
    return out;
  });
  const background: Json[] = low.background().toArray().map((bg) => ({ id: bg.id.asString(), assert: bg.assert as unknown as Json }));
  return {
    irVersion: "1.0.0",
    schema: { entities: u.rawEntities() as unknown as Json },
    obligations: obligations as unknown as Json,
    scenarios: scenarios as unknown as Json,
    background: background as unknown as Json,
  };
}
