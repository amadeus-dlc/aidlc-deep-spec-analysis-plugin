# セキュリティ検証手順

このプラグインは**他プロジェクトの `.claude/tools/` に実行可能コードを配布する**。
今回の変更でその配布物が「逐語コピーした `.ts` 468 本」から「機械生成した bundle 10 本」に
変わったので、供給網（supply chain）の観点が変わった。認証・認可・ネットワーク境界は
持たないので、OWASP Top 10 の大半は当たらない。当たる面だけを検証する。

## 脅威の整理（STRIDE のうち当たるもの）

| 脅威 | この文脈での形 | 緩和 |
|---|---|---|
| **T**ampering | 生成物 `tools/` がソース `src/` と食い違ったまま配布される（意図しない挙動が利用先で走る） | `scripts/build-tools.ts --check` の drift guard。CI で typecheck 直後に実行し、差分があれば非ゼロ終了 |
| **T**ampering | bundle に意図しない外部コードが取り込まれる | `--external z3-solver` 以外の npm 依存を持たない。`only-sanctioned-imports` 規則が `node:*` / 相対 / `@deep-spec/*` / `z3-solver` 以外の import を違反にする |
| **I**nformation Disclosure | 資格情報・トークンがソースに混ざり bundle 経由で配布される | ソースに秘密情報を置かない。`grep` による確認（下記） |
| **E**levation of Privilege | 配布物が利用先で想定外のファイルを読み書きする | I/O は adapter 層に限る（`no-io-in-pure-layers`）、`process.*`／`import.meta` は entry だけ（`process-only-in-entries`）。19 本のアーキテクチャ規則が `bun test` で機械検査する |
| **D**enial of Service | ソルバーがハングして利用先の作業を止める | ディスパッチャの `timeout_seconds`（75／85）が上限。quint は `killSignal: "SIGINT"` で止め、Apalache もろとも終わらせる（issue #128） |

Spoofing と Repudiation は当たらない（認証主体もトランザクションも無い）。

## 検証コマンド

```bash
# 1. 生成物とソースの一致（Tampering）
cd deep-spec-analysis && bun scripts/build-tools.ts --check

# 2. 許可されていない依存が入っていないこと（Tampering / supply chain）
cd deep-spec-analysis && bun test tests/architecture.test.ts

# 3. 秘密情報がソースにも生成物にも無いこと（Information Disclosure）
cd deep-spec-analysis && grep -rIn -E '(api[_-]?key|secret|password|token|BEGIN [A-Z ]*PRIVATE KEY)[[:space:]]*[:=]' src/ tools/ scripts/ || echo "no hardcoded secret patterns"

# 4. 実行時依存が z3-solver だけであること
cd deep-spec-analysis && grep -c 'z3-solver' tools/aidlc-sensor-deep-spec-verify-smt.ts
cd deep-spec-analysis && cat package.json

# 5. 配布物の中身が想定どおり 14 ファイルであること（余計なものが載っていない）
cd deep-spec-analysis && bun test tests/build-tools.test.ts
```

## 依存の管理

- `@informalsystems/quint` と `z3-solver` は exact pin。Renovate は「solver backends」として
  束ね、Dependency Dashboard での承認制にしてある（`renovate.json`）。版を上げることは
  golden を更新する裁定であって定期バンプではない
- 実行時依存はこの 2 本だけ。利用先に node_modules は無い前提なので、bundle は
  外部依存を持ち込まない（`--external z3-solver` は「利用先が持っていれば使う、無ければ
  `unavailable` に縮退する」という契約 2 の実装）
- devDependencies は 4 本（quint・z3-solver・`@types/bun`・typescript）

## SAST / DAST / 依存スキャン

- **SAST**: 専用ツールは入れていない。代わりに `tests/architecture/rules.ts` の 19 規則が
  プロジェクト固有の禁止事項（I/O の層越え、`process.*` の漏れ、非公認 import、
  データモデルの domain 配置、パッケージ境界の越境）を機械検査する。これは汎用 SAST より
  この設計に特化した検出力を持つ
- **DAST**: 当たらない（走っているサービスが無い）
- **依存スキャン**: 実行時依存 2 本・開発依存 4 本という規模なので、Renovate の
  Dependency Dashboard で足りている。SBOM は生成していない
- **シークレットスキャン**: 専用ツールは入れていない。上記コマンド 3 が手動の代替

これらは現状の規模に対する判断であって、恒久的な結論ではない。配布先が増えるか
実行時依存が増えたら、依存スキャンとシークレットスキャンの自動化を裁定にかける。

## この変更で新しく増えた注意点

**`tools/<entry>.ts` は `.ts` の名を着た bundle 済み JavaScript である。**
読み手（人間もツールも）が「TypeScript ソース」と誤認すると、生成物を直接編集して
`--check` で落ちるか、最悪コミットして `src/` と食い違ったまま配布される。
`README` と各生成物のヘッダにその旨を書いてある。ファイル名が `.ts` なのは
上流ディスパッチャ（`aidlc-sensor.ts` の `resolveScriptPath`）の契約であって、
見た目の都合ではない。
