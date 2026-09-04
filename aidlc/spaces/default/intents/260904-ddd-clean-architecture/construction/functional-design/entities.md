# Entities — DDD／クリーンアーキテクチャ改善

## Source of Truth

```yaml
entities:
  - name: DesignReport
    description: 設計検証結果を表す既存の集約ルート。契約2の正準順と可用性を所有する。
    attributes:
      - name: id
        type: DesignReportId
        required: true
        unique: true
      - name: irVersion
        type: IrVersion
        required: true
      - name: irHash
        type: ContentHash
        required: true
      - name: method
        type: VerificationMethod
        required: true
      - name: findings
        type: DesignFindings
        required: true
      - name: skipped
        type: DesignSkips
        required: true
      - name: unavailableReason
        type: prose
    relationships:
      - to: VerificationMethod
        cardinality: 1:1
        direction: DesignReport-to-VerificationMethod
      - to: SkipReason
        cardinality: 1:N
        direction: DesignReport-to-SkipReason
  - name: VerificationMethod
    description: exhaustive、bounded、simulation、staticの閉集合を表す共有ドメインプリミティブ。
    attributes:
      - name: value
        type: string
        required: true
        unique: true
        allowed_values: [exhaustive, bounded, simulation, static]
  - name: SkipReason
    description: 契約2のskipped.reason閉集合を表す新しい共有ドメインプリミティブ。
    attributes:
      - name: value
        type: string
        required: true
        unique: true
        allowed_values: [unavailable, timeout, capability, compile-error, waived, absent-input, stale-input, ir-version-mismatch, unrecognized-format]
  - name: DesignUnit
    description: 識別された設計単位。設計宣言からlowered表現を生成する意味を所有する既存ローカルエンティティ。
    attributes:
      - name: id
        type: DesignUnitId
        required: true
        unique: true
      - name: name
        type: UnitName
        required: true
      - name: obligations
        type: DesignObligations
        required: true
      - name: machines
        type: DesignMachines
        required: true
      - name: scenarios
        type: DesignScenarios
        required: true
    relationships:
      - to: LoweredUnit
        cardinality: 1:1
        direction: DesignUnit-produces-LoweredUnit
  - name: LoweredUnit
    description: 契約3から契約1へ落としたcollectionsと帰属indexの不変条件だけを所有する既存値オブジェクト。
    attributes:
      - name: obligations
        type: LoweredObligations
        required: true
      - name: scenarios
        type: LoweredScenarios
        required: true
      - name: background
        type: LoweredBackgrounds
        required: true
      - name: index
        type: LoweringIndex
        required: true
    relationships:
      - to: LoweringIndex
        cardinality: 1:1
        direction: LoweredUnit-owns-LoweringIndex
  - name: LoweringIndex
    description: lowered idからDesign語彙への帰属を保持し、id書換えと対象解決を行う既存値オブジェクト。
    attributes:
      - name: origins
        type: KeyedIndex
        required: true
      - name: scenarioDesignIds
        type: KeyedIndex
        required: true
      - name: machinesByTransition
        type: KeyedIndex
        required: true
  - name: SiblingVerdictDocument
    description: 兄弟backend文書の判別共用体を閉じ込め、LoweringIndexを通じてDesign語彙へ解釈する既存値オブジェクト。
    attributes:
      - name: variant
        type: readable-or-unavailable-or-unreadable
        required: true
      - name: method
        type: VerificationMethod
      - name: findings
        type: SiblingVerdictFindings
      - name: skipped
        type: SiblingVerdictSkips
    relationships:
      - to: LoweringIndex
        cardinality: N:1
        direction: SiblingVerdictDocument-uses-LoweringIndex
  - name: RefinementMap
    description: 要件IRと設計IRの対応を所有する既存集約。Design domain直下へ移り、独立workspace packageではなくなる。
    attributes:
      - name: id
        type: RefinementMapId
        required: true
        unique: true
      - name: requirementsIrHash
        type: ContentHash
        required: true
      - name: designIrHash
        type: ContentHash
        required: true
      - name: unitMaps
        type: RefinementUnitMaps
        required: true
    relationships:
      - to: DesignUnit
        cardinality: 1:N
        direction: RefinementMap-maps-DesignUnit
```

## Model Summary

| Object | Classification | Ownership after refactor |
|---|---|---|
| `DesignReport` | Aggregate root | 契約2の内容と正準順。I/O transactionは所有しない |
| `VerificationMethod` | Domain primitive | 正常生成の閉集合検証と寛容な再構成を別の門で所有 |
| `SkipReason` | Domain primitive | 契約2の9種と比較・文書境界を所有 |
| `DesignUnit` | Local entity | loweringの入口と設計宣言に基づく生成判断 |
| `LoweredUnit` | Value object | lowered collectionsと`LoweringIndex`の不変条件 |
| `SiblingVerdictDocument` | Value object | 兄弟判定をDesign語彙へ変換する判断 |
| `RefinementMap` | Aggregate | Design context内のrefinement語彙。配置は`design/domain/`直下 |

`DesignReportFinalizer`、`DirectoryFinalizationLock`、zero-Unitのstage-level artifact resolverはapplication／adapter／workflow infrastructureのcollaboratorであり、domain objectとしてこの表へ追加しない。新しいdomain serviceも作らない。確認済みの上流は [`requirements.md`](../../inception/requirements-analysis/requirements.md) のFR1〜FR8である。

## Constraints

- `reconstitute`はadapterの文書hydration用として残す。正常生成は検証済みdomain primitiveだけを受け取る。
- `design/domain/refinement/`という例外階層は作らない。既存の`<context>/<layer>`配置規則を維持する。
- 値、finding文言、正準順、契約1〜4の公開形は変更しない。
