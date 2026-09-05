# ユースケースの責務監査

## 結論

3サブエージェントで全5コンテキストのusecase層を監査した。対象は81 TypeScriptファイルと5つのpackage.json、公開ユースケースは15件。内訳は、業務判断・集計の漏出10件、境界変換の残存4件、今回の観点で適合1件だった。

取得値を取り出すAPIが入口となり、ユースケースが検証の部品を組み合わせ、次の業務状態を作っている。メソッド名を変えることや、同じ処理をapplication helper・`match`のcallbackへ移すことでは解消しない。

監査基線は `e743b4e36777b38ecc3e1133673d21182e5b241c`。監査開始時の作業ブランチHEAD `53a0530` と `src/` の内容が一致することを確認した。全ファイルの種別・行数・内容ハッシュは [scope.json](scope.json) に保存した。監査に伴う本番ソースの変更はない。

## 15ユースケースの全件分類

| コンテキスト | ユースケース | 分類・内容 |
| --- | --- | --- |
| requirements | ValidateIntermediateRepresentationUseCase | 業務判断: version/schemaの判定、検査順序、逆参照とdigest照合、エラー集約、合否 |
| requirements | VerifyRequirementsQuintUseCase | 業務判断: 検証準備、降格report選択、backend結果の解体とreport組立 |
| requirements | VerifyRequirementsSatisfiabilityModuloTheoriesUseCase | 業務判断: 同上 |
| design | ValidateDesignIntermediateRepresentationUseCase | 業務判断: version/schemaの判定、意味検査の実施条件、診断順序と合否 |
| design | VerifyDesignQuintUseCase | 業務判断: refinement鮮度、lowering採番、到達性、処理打切り時の診断、結果組立 |
| design | VerifyDesignSatisfiabilityModuloTheoriesUseCase | 業務判断: refinement鮮度、backend状態による診断の採用/破棄、結果組立 |
| doctor | CheckFunctionalCoverageUseCase | 業務判断: 検証済み条件、鮮度、refinement失効、適格母数 |
| doctor | CheckVerificationCoverageUseCase | 業務判断: 証拠の充足、未検証/陳腐化の査定と集計 |
| doctor | CheckStructuralDebtUseCase | 業務判断: 取得不能と0件の区別、負債の計上、集計 |
| doctor | CheckVersionAdvisoryUseCase | 業務判断: 安定版選別、最新版選択、更新査定 |
| doctor | CheckInstallationUseCase | 境界変換: ManifestEntryからパス文字列を取り出してportへ渡す |
| refcheck | CheckDomainComponentsUseCase | 境界変換: 適合済みreportをbool/numberのDTOへ分解 |
| refcheck | CheckContractSummaryUseCase | 境界変換: 同上 |
| refcheck | CheckFunctionalDesignUseCase | 境界変換: 同上 |
| doctor | CheckSolversUseCase | 適合: Clientへ依頼しSolverAvailabilityをそのまま返す |

業務判断に分類した検証ユースケースにも出力変換が残る。上表は主な責務で排他的に分類している。境界変換4件を、合否計算を再実装した件数へ加算してはいない。

## 根拠と横展開先

- [requirements監査](requirements.md): RQ-1〜6。3ユースケース・Finalizer・backend結果契約・outcomeまで追跡。
- [design監査](design.md): D1〜9。3ユースケース・Acquirer・Finalizer・rawプロセス結果のportまで追跡。
- [doctor/refcheck監査](doctor-refcheck.md): 7指摘。9ユースケースとread-model8型まで追跡。

特に先に責務を定める必要があるものは以下である。

1. 検証材料の集約が、version/schema/意味検査と診断の順序を所有する。
2. 取得したモデル・backend結果が検証準備とreport形成を所有し、modelとそのhashを別引数で渡させない。
3. `RefinementMaterials` / `RefinementMapAcquisition`が、欠落・鮮度・適用可否とunitの検証計画を所有する。
4. `LoweredUnit`が、追加不変量の採番と帰属索引を一緒に更新する。`ReachabilityVerdict`等がfinding/skipへの意味付けを所有する。
5. doctorの観測結果とそのコレクションが、検証カバレッジ・構造負債・最新版の査定を所有する。表示文字列の作成はpresenterへ置く。

`acquired`へ仕事を依頼する方向は妥当である。現状の `FormalModelRepository.findById()` は、メソッドを持たない `Result<RequirementsModel, RepositoryError>` を返す。呼出側が `.value` からモデルを取り出して部品を組み立てる公開契約を変える必要がある。汎用Result自体に検証固有の業務知識を持たせず、取得結果の操作からドメイン固有の検証準備・検証結果へ依頼できる契約にする。

I/Oの起動・失敗伝播・保存順序はapplicationに残す。domainにRepositoryやClientを渡す形へは変更しない。時刻を読み次のI/Oを起動するか決めることと、時間不足をどの対象のどの診断にするかを区別する。

Finalizer2種類には、最終化済みcandidateが欠けるという契約違反を`io-failed`に丸める経路もある。実際に欠落が発生したとの報告ではなく、集約の存在保証がnullableのまま外へ漏れ、applicationが架空のI/O失敗へ変換している設計上の指摘である。

## 規律文書と検査の不足

現在のユーザー指示は「ユースケースはフロー制御のみ」である。既存文書には、それと矛盾する記述が残る。

- [設計規則P8](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/e743b4e36777b38ecc3e1133673d21182e5b241c/deep-spec-analysis/docs/architecture/design-rules.ja.md#L350): 表示投影を`usecase/read-model`へ置くことを求める。CQS採用・CQRS非採用という裁定と併せ、表示変換をadapterへ整理する必要がある。
- [設計規則A3](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/e743b4e36777b38ecc3e1133673d21182e5b241c/deep-spec-analysis/docs/architecture/design-rules.ja.md#L394): 合否をdomain/usecaseが決めると記している。英語版にも同じ記述がある。
- [refinement材料Repositoryのコメント](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/e743b4e36777b38ecc3e1133673d21182e5b241c/deep-spec-analysis/src/design/usecase/port/refinement-materials-repository.ts#L11): 陳腐化判定をユースケースのフロー制御としている。

既存のアーキテクチャテストは今回も47件成功した。しかし、[ALL_RULES](https://github.com/amadeus-dlc/aidlc-deep-spec-analysis-plugin/blob/e743b4e36777b38ecc3e1133673d21182e5b241c/deep-spec-analysis/tests/architecture/rules.ts#L1054)の層依存・型形状等の検査は、業務判断の所有者まで検証していない。既存テスト成功を、この責務監査の合格とは扱えない。

## 先行するカスタムリンター

追加指示に従い、getter呼出しの検査を修正より先に用意した。[検出範囲・実行方法](../../../../../../../deep-spec-analysis/docs/architecture/usecase-getter-lint.md)を参照。

`bun run lint:usecase-getters` と `bun run check` は、既存違反を含めて失敗する。減算用のbaselineや免除リストは置かない。検出箇所の一覧とこの手動監査を併用し、getter使用数だけを減らして業務判断を別のapplication helperへ隠す修正を防ぐ。

現行81 TypeScriptファイルに対する検出は、getter/表現取得157件、Result成功値の取り出し28件、分類保留6件の計191件。[機械検出一覧](getter-findings.json)に呼出行と定義行を保存した。分類保留はgetter違反の断定ではなく、静的に確定できなかったため検査を失敗させるものである。

リンターの独立レビューで型消去・代入・loop・generator・fallback・計算されたキー等の回避経路とarrow関数の誤検出を再現し、回帰テストへ反映した。検出/正常例・CLI終了コードを含む24テストが成功。汎用getter禁止だけで捕捉できない業務判断は、上記の3監査報告に残している。

最終検証は、Biome586ファイル指摘なし、TypeScript型検査成功、`bun test --coverage` が **897成功・1スキップ・0失敗、終了コード0**。`bun run check` は既存の185検出と6分類保留により **終了コード1** となることを確認した。リンク135件は全て実在した。先行リンターが失敗する状態を隠さず、次の本体是正で解消する。
