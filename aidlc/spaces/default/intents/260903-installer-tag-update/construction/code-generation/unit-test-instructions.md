# Unit Test Instructions

## Testing Contract

- **Methodology**: test-after
- **Ordering**: 各レイヤーを実装した直後に対応テストを追加し、対象テストを通してから次のレイヤーへ進む
- **Test Strategy**: Minimal
- **Coverage floor**: 要件ごとのunit testを最低1件、各コンポーネントにhappy pathを最低1件、既存suiteをgreenに保つ
- **Plan profile**:
  - Repository/data access: source、archive、filesystem、provenance
  - Business logic: selector、SemVer、update、digest、release preflight
  - API/endpoint: installer／release CLI、doctor JSON

## 0. PreToolUse hook

- Happy path: hookが`updatedInput`を返すとき、同じ応答に`permissionDecision: "allow"`がありCodex schema検証を通る。
- Edge 1: 入力変更が無いときは不要な`updatedInput`を返さない。
- Edge 2: deny時は`updatedInput`を混在させず、拒否理由とdeny decisionだけを返す。
- Regression: Code Generation計画中の読み取り専用commandがworkspace mutationとして拒否されない。

## 1. Source selector／GitHub client／archive

- Happy path: `--from > --ref > --tag > latest`の優先順とlatest stable SemVerを決定する。
- Edge 1: plugin rootを直接渡した`--from`を、repo root要件の説明付きで拒否する。
- Edge 2: tag／manifest不一致、tag 0件、invalid SemVerを`Result`の失敗として返す。
- Security: `..`、絶対path、root外symlinkを含むarchiveを展開前に拒否する。
- Failure safety: HTTP失敗、破損archive、manifest不正で導入先bytesが変わらない。
- Networkは実通信せず、固定responseと失敗を返す決定論的client doubleを使う。

## 2. Destination toolchain／installer transaction

- Happy path: 導入先builderでbuildし、refresh → recursive tombstone → compose → doctorを完了する。
- Edge 1: builder／target定義／plugin testの欠落を導入先変更前に拒否する。
- Edge 2: compose失敗時に成功provenanceを書かない。
- Compatibility: `tools/`がbundle 10本＋`data/` 4本、公開`.ts`名、plugin-owned境界を維持する。
- E2E: submoduleも`.git/`も無いfixtureから`--from`導入でき、plugin testが`CLEAN`になる。

## 3. Provenance／payload digest／update

- Happy path: 成功後に5 fieldの来歴JSONをatomic renameで保存する。
- Edge 1: 同一source／digestでは`Changed 0`となり、来歴bytesとmtimeを変更しない。
- Edge 2: 同じversionでもlocal／refのpayloadが変われば再導入する。fixed tagはno-opにする。
- Integrity: file列挙順を変えても同じhash、pathまたは1 byteを変えると異なるhashになる。
- Boundary: 来歴JSON、directory、symlink、plugin所有外fileをdigestから除外する。

## 4. Doctor version advisory

- Happy path: newer stable tagを検出し、更新commandをadvisoryで示す。
- Edge 1: GitHub不達時に`pass: true`でskip理由を`label`へ出す。
- Edge 2: 来歴欠落／malformed時に既存doctor checksを壊さず修復方法を示す。
- Compatibility: `{checks:[{pass,label,fix?,severity}]}`以外のfieldを追加せず、既存checkの意味と順序を維持する。

## 5. Release／CI

- Happy path: cleanな`main`でmanifest更新、英語commit、`v<version>` tag、atomic pushの順に実行する。
- Edge 1: dirty tree、main以外、不正SemVerをlocal mutation前に拒否する。
- Edge 2: local／remote既存tag、atomic push失敗を明示し、片側だけをremoteへ公開しない。
- CI: tagとmanifest version一致はgreen、不一致はred。既存main／PR jobは不変。
- Git操作は実remoteを使わず、command runnerまたは一時bare repositoryで決定論的に検証する。

## 6. Documentation／全体回帰

- Quickstartがtag-firstのstdin bootstrapを示し、`--from`／`--ref`／`--tag`／`--update`と来歴pathを説明する。
- `--ref`が開発追従用、npmとrelease assetが対象外と読めることを検査する。
- 全既存テスト、golden、architecture rules、bundle drift、plugin validate、7 harness buildを実行する。
- `aidlc-plugin-test`の`CLEAN`、`Changed 0`、`tools/` 14ファイルを最終確認する。

## 実行順

1. hook adapterの対象テスト
2. source selector／archiveのunit tests
3. destination toolchain／transactionのunit・integration tests
4. provenance／updateのunit・integration tests
5. doctor tests
6. release／CI tests
7. intent E2E
8. typecheck、coverage、architecture、golden、bundle、plugin、7 harnessの全検証

## 失敗時の扱い

- 新規failureはそのレイヤー内で修正してから次へ進む。
- baseline由来の既知failureは出力と再現commandを分けて記録する。
- coverageや既存規則を弱めてgreenにしない。
- debug instrumentation、temporary repository、fixture生成物は検証後に削除する。
