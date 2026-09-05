# 予期された失敗はResult、契約違反はpanic

移植元: [amadeus-ngの同名規則](https://github.com/amadeus-dlc/amadeus-ng/blob/537c4e56a838a4cb28f6564d4c0add1d4adfe915/aidlc/spaces/default/knowledge/aidlc-shared/coding-rules/error-handling.md)。2026-09-05にTypeScriptと当該の裁定へ適用し直した版。

## 規則

- 入力不正・取得失敗など、呼び出し側が処理すべき失敗は`Result<T, E>`または既存の閉じた結果型で返す。
- エラーは業務上の区別を型で表す。全失敗を文字列や汎用の例外へ潰さない。
- Repositoryの失敗は既存の`RepositoryError`を使う。不在・I/O失敗・破損を区別し、業務判断をRepositoryへ移さない。
- コンストラクタの事前条件違反は`IllegalArgumentException`とする。`of`から出た例外はpanicであり、回復可能な業務エラーとして捕捉しない。
- 不正が起こりうる値は各DPの`parse`へ渡す。`parse`だけが、自分のコンストラクタから出る契約違反をResultへ変換する。想定外の例外は伝播させる。
- I/Oのcatchにドメインの生成や描画を含めない。コンパイラなども、処理対象の例外の種類を限定する。
- panic時の後始末には`finally`を使う。後始末のためにpanicを成功値や業務エラーへ変換しない。

## 文言と診断

パス・ID・原因など、失敗を判断・追跡できる材料を残す。利用者向け文言の所有は、このリポジトリの出力契約に従う。findingsの意味・正準順・凍結された文言をドメインが所有する既存の裁定を、移植元のRustの`Display`規則で上書きしない。

関連: [生成規則](factory-naming.md)、[外部契約](upstream-contracts.md)。
適用範囲と優先関係は[共有規則の入口](README.md)を参照。
