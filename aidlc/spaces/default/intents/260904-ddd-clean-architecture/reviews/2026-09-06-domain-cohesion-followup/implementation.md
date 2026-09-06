# 追加精査5項目の是正

ユーザーの選択「1」によりF1〜F5全体を是正する。

- F1：MachineSpecificationのof/parseと実パーサ→診断を公開検証境界とする。
- F2：状態機械集合の全欠落・部分欠落・全被覆を診断結果で検証する。
- F3：索引の照会／診断と入力アンカーの公開結果で不変性を検証する。
- F4：要件・設計のcrossCheckedレポートと既存goldenで比較契約を検証する。
- F5：個別宣言と集合の診断順・文言を公開結果で検証する。

既存の所有者に責務を移し、生入力を受ける互換APIは削除する。

## 実装内容

F1：MachineSpecificationがEntityName・AttributeNameを構築時に保持する。不正な見出しと状態名はStateMachineSketchのunrecognized状態として診断へ届く。

F2：StateMachineSketchesがライフサイクル実体ごとの未被覆を記録する。既存の明示属性優先規則はEntityDeclarationへ集約し、図の照合と被覆判定が同じ規則を使う。

F3：SiblingUnitIndexはKeyedIndex<UnitName, EntityDeclarations>を受け取り、内部は正規化名とEntityDeclarationで構成する。入力Mapや匿名の可変レコードを返すAPIは削除。RefinementMapAcquisitionもDesignInputAnchorsを受け取る。入力の読み直しを避け、同じスナップショットを検証・保持する。

F4：ScenarioVerdict／ScenarioComparison／ScenarioVerdictsを追加し、対象・ユニット・バックエンド・比較可否の契約を共有する。各レポートはシナリオごとに一度だけ判定を返し、シナリオが自分の不一致診断を作る。文字列化した判定表を2か所で再構築する処理を削除した。

F5：規則の必須キー・ID形式・source・applies-to・categoryの診断、属性の状態図診断、実体素描の所有元・属性診断をそれぞれの宣言へ移した。要件と設計の義務・シナリオ・背景仮定にもdiagnosticsを実装し、親が値を取り出して診断する経路と不要な公開APIを削除した。

正常入力のgolden形式は維持する。不正な機械指定・状態名、部分的な未検査、比較入力の重複・予算超過は明示した失敗へ変更する。

## 検証

最終ソース `76f83b5c71c510bc3b3f545dc0cd29fe9e617e95` で以下を確認した。

- Biome：615ファイル、エラーなし。型検査：終了0。
- ユースケース境界lint：60ファイル、違反0。配布ツール14ファイルの同期：成功。
- 全体テストを含むカバレッジ比較：head 99.89%、base 99.89%、許容差0.01、終了0。
- プラグイン検証：エラー0。compose hookはビルド時に注入する既定の警告のみ。
- claude / codex / copilot / cursor / kiro / kiro-ide / opencodeのビルド：すべて成功。

[検証記録](verification-after.json)と[カバレッジ比較出力](coverage-after.txt)を保存した。

## 行数の再計測

同じ計測器と定義で、ドメイン層の最長メソッドは86行から66行になった。100行以上は0件。単に行を分けるのではなく、親から移した診断を各宣言の公開操作として持たせた。

| メソッド | 修正前 | 修正後 |
|---|---:|---:|
| RuleDeclarations.check | 86 | 20 |
| DesignReports.crossChecked | 78 | 44 |
| DesignUnitDeclaration.diagnostics | 76 | 66 |
| VerificationReports.crossChecked | 73 | 40 |
| RefinementMaterials.prepare | 63 | 63 |
| SiblingVerdictFinding.remap | 57 | 57 |
| StateMachineSketch.check | 57 | 42 |
| SiblingVerdictDocument.#remapReadable | 54 | 54 |
| SatisfiabilityModuloTheoriesProbe.interpret | 51 | 51 |
| DomainEntitySketches.check | 49 | 9 |

全体の上位10件と計測条件は[measurement-after.json](measurement-after.json)に記録した。
