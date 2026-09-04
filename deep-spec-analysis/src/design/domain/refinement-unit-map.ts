import type { TriggerName } from "@deep-spec/kernel-domain";
import type { DesignUnitId } from "@deep-spec/design-domain";
import type { AttributeMappings } from "./attribute-mappings.ts";
import type { EventMapping } from "./event-mapping.ts";
import type { EventMappings } from "./event-mappings.ts";
import type { UnmappedDeclarations } from "./unmapped-declarations.ts";

// refinement map の 1 ユニット分——属性写像・イベント写像・unmapped 宣言。
// 計画はユニットの一致を問い、トリガのイベント写像を引く（#71 波24）。
export class RefinementUnitMap {
  readonly #unit: DesignUnitId;
  readonly #attrMap: AttributeMappings;
  readonly #eventMap: EventMappings;
  readonly #unmapped: UnmappedDeclarations;

  private constructor(props: { unit: DesignUnitId; attrMap: AttributeMappings; eventMap: EventMappings; unmapped: UnmappedDeclarations }) {
    this.#unit = props.unit;
    this.#attrMap = props.attrMap;
    this.#eventMap = props.eventMap;
    this.#unmapped = props.unmapped;
  }

  static reconstitute(props: { unit: DesignUnitId; attrMap: AttributeMappings; eventMap: EventMappings; unmapped: UnmappedDeclarations }): RefinementUnitMap {
    return new RefinementUnitMap(props);
  }

  unit(): DesignUnitId {
    return this.#unit;
  }

  isForUnit(unit: DesignUnitId): boolean {
    return this.#unit.equals(unit);
  }

  attrMap(): AttributeMappings {
    return this.#attrMap;
  }

  eventMappingOf(trigger: TriggerName): EventMapping | undefined {
    return this.#eventMap.ofTrigger(trigger);
  }

  unmapped(): UnmappedDeclarations {
    return this.#unmapped;
  }
}
