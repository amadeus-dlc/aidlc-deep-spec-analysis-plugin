# Installer・Tag更新の要件

## 意図の分析

利用者がこのリポジトリのcheckoutや`aidlc-workflows` submoduleを用意しなくても、公開git tagから`deep-spec-analysis`プラグインを導入・更新できるようにする。開発者向けにはlocal checkoutとbranch追従も残し、どの取得元から何を導入したかを検証可能な来歴として保存する。既存のrefresh、tombstone、compose、doctor、14ファイルの出荷形、golden、アーキテクチャ規則は維持する。`[desc]`

## 機能要件

### FR1 — Source selection and acquisition

- **FR1.1** `scripts/install.ts`は`--from <path>`、`--ref <branch>`、`--tag <tag>`、無指定のlatest tagを取得元として扱わなければならない。複数のselectorが指定された場合は`--from > --ref > --tag > latest`の順で1つを選ぶ。`[desc]`
- **FR1.2** `--from <path>`は、直下に`deep-spec-analysis/`を含むリポジトリrootだけを受け付けなければならない。指定パス自体がプラグインrootである入力は、期待する配置を示して失敗させる。`[Q2]`
- **FR1.3** `--ref`と`--tag`はGitHubの公開archiveを認証なしで取得し、一時ディレクトリ内の`deep-spec-analysis/`へ展開しなければならない。archive内のトップレベル名に依存せず、validatorが要求するplugin名とディレクトリ名の一致を満たす。`[desc]`
- **FR1.4** latest tagはGitHub APIが返すtagをSemantic Versioningで比較し、pre-releaseを除く最大のtagを選ばなければならない。tagが0件、SemVerとして有効なstable tagが0件、APIが不達の場合は、導入先を変更する前に理由を示して失敗させる。`[desc] [Q1]`
- **FR1.5** 取得したsourceの`.aidlc-plugin/plugin.json`について、plugin名が`deep-spec-analysis`であり、versionが有効なSemVerであることをbuild前に検証しなければならない。`--tag`またはlatestでは、tag `v<version>`とmanifestのversionが一致しないsourceを拒否する。`[desc]`
- **FR1.6** remote取得物の展開では絶対パス、`..`によるpath traversal、展開root外を指すsymlinkを拒否しなければならない。取得・検証・buildの失敗時には一時領域を片付け、導入先の既存payloadを変更してはならない。`[desc]`（公開archiveを入力にすることから導く安全要件）

**受け入れ条件**

- `Given` submoduleも`.git/`も持たない一時環境、`When` `--tag v0.5.0`または無指定でinstallerを実行する、`Then` 公開sourceを取得し、plugin名とversionを検証してbuildへ渡す。
- `Given` `--from`がプラグインrootを直接指す、`When` installerを実行する、`Then` 期待するリポジトリroot形を示して非0で終了し、導入先はbyte同一のまま残る。
- `Given` 悪意あるarchive entryまたは取得失敗、`When` sourceを準備する、`Then` 展開root外へ書き込まず、既存導入を変更しない。

### FR2 — Destination toolchain build and installation

- **FR2.1** installerは`<project>/<harness>/tools/aidlc-plugin-build.ts`を使用して取得sourceをbuildしなければならない。導入先にbuilderが無い場合は、AI-DLC本体の導入不足と修復方法を示し、payload変更前に停止する。`[desc]`
- **FR2.2** buildに必要なtarget定義とplugin検証ツールも導入先harnessのtoolchainから解決し、このリポジトリの`aidlc-workflows/`やsibling checkoutを参照してはならない。`[desc]`、Reverse Engineering `architecture.md`
- **FR2.3** build結果は`.aidlc-plugin/`と出荷対象だけを含み、`src/`、`tests/`、`scripts/`、`docs/`を除外しなければならない。`tools/`はbundle 10本と`data/` 4本の合計14ファイルを維持する。`[desc]`
- **FR2.4** buildと検証が成功した後にだけ、既存のrefresh、recursive tombstone、no-clobber compose、doctorをこの順で実行しなければならない。既存のplugin-owned境界外のファイルを削除または上書きしてはならない。`[desc]`
- **FR2.5** bootstrapとして`curl -fsSL <raw-install-url> | bun - --project .`を提供しなければならない。stdinから実行したinstallerは`import.meta.dir`をsource rootとみなさず、FR1のsource acquisitionを使用する。`[desc]`

**受け入れ条件**

- `Given` 利用先harnessに正式なplugin build toolchainがある、`When` installerを実行する、`Then` source checkout側のsubmoduleを参照せず、既存composeまで完了する。
- `Given` 利用先builderが無い、`When` installerを実行する、`Then` AI-DLC本体の導入手順を示して失敗し、既存payloadを変更しない。
- `Given` 導入完了、`When` 出荷形を検査する、`Then` plugin由来の`tools/`は正確に14ファイルで、既存validatorとplugin testが`CLEAN`を返す。

### FR3 — Installation provenance and update

- **FR3.1** 導入成功後、`<harness>/tools/data/deep-spec-analysis-install.json`へ`version`、`ref`、`source`、`installed_at`、`payload_sha256`を原子的に保存しなければならない。失敗した導入の来歴を書いてはならない。`[desc]`
- **FR3.2** 来歴JSONはpluginの`contributes.tools`へ含めず、refreshとtombstoneの削除対象から除外しなければならない。`[desc]`
- **FR3.3** `payload_sha256`はcompose後に存在するplugin-owned regular filesを対象とし、harness rootからの相対pathをbyte昇順に並べ、各pathとcontent bytesを区切って連結した正準入力のSHA-256としなければならない。来歴JSON自身、ディレクトリ、symlink、plugin所有外のファイルは対象外とする。`[Q5]`
- **FR3.4** `--update`は記録された取得元の意味を維持しなければならない。localは同じ`--from` path、refは同じbranchの最新commit、固定tagは同じtagのためno-op、latestは最新stable tagを再解決する。`[Q1]`
- **FR3.5** localまたはrefでは、versionが同じでも正準payload hashが変われば再導入する。解決後のversionとpayload hashが記録値と同じ場合は`Changed 0`として終了し、`installed_at`を含む来歴JSONを更新してはならない。固定tagはremote照会や再導入をせずno-opにする。`[Q1] [Q5]`
- **FR3.6** 来歴が無い状態で`--update`された場合は、通常installで使用するselectorを明示するよう案内して失敗しなければならない。記録sourceが消失または不達の場合も既存payloadと来歴を変更してはならない。`[desc]`

**受け入れ条件**

- `Given` 同一sourceを導入済み、`When` `--update`を実行する、`Then` 出力は`Changed 0`で、来歴ファイルのbytesとmtimeは変化しない。
- `Given` 同じbranchのpayloadが更新された、`When` ref由来の導入に`--update`を実行する、`Then` 同じbranchを再解決して再導入し、新しいhashと`installed_at`を原子的に保存する。
- `Given` composeまたはdoctorが失敗する、`When` 更新を実行する、`Then` 成功を示す新しい来歴を保存しない。

### FR4 — Doctor version advisory

- **FR4.1** doctorは来歴JSONを読み、記録version／ref／sourceと最新stable tagを比較するadvisory checkを既存の`checks`配列へ追加しなければならない。`[desc]`
- **FR4.2** GitHubへ接続できない場合、version checkは`pass: true`かつadvisory severityとして残し、`label`に更新確認をskipした理由を含めなければならない。`[Q3]`
- **FR4.3** 公開JSONの形`{checks:[{pass,label,fix?,severity}]}`へ新しいfieldを追加してはならない。既存checkの文言、順序、判定を意図せず変更してはならない。`[Q3]`、Reverse Engineering `api-documentation.md`

**受け入れ条件**

- `Given` 記録versionより新しいstable tagがある、`When` doctorを実行する、`Then` 更新可能であることと実行方法をadvisoryとして返す。
- `Given` ネットワーク不達、`When` doctorを実行する、`Then` exit契約と既存checksを維持し、version checkは`pass: true`でskip理由を示す。

### FR5 — Release and tag consistency

- **FR5.1** `scripts/release.ts <version>`はcleanな`main` branchだけで実行でき、target versionが有効なstable SemVerで、対応する`v<version>` tagがlocal／remoteに存在しないことを事前検証しなければならない。`[Q4]`
- **FR5.2** release scriptは`.aidlc-plugin/plugin.json`のversion更新、英語のrelease commit、`v<version>` tag作成、commitとtagのremote pushまでを一括実行しなければならない。remote反映はatomic pushを使用し、一方だけが公開される状態を避ける。`[desc] [Q4]`
- **FR5.3** 最初の配布基線として、manifest version `0.5.0`を含むcommitへ`v0.5.0` tagを作成できなければならない。その後のreleaseは同じscriptの契約を使う。`[desc]`
- **FR5.4** CIはtag pushでも実行され、tag名`v<version>`と`.aidlc-plugin/plugin.json`のversion不一致を失敗させなければならない。通常のmain push／PR検査も維持する。`[desc]`

**受け入れ条件**

- `Given` dirty tree、main以外のbranch、既存tag、不正SemVerのいずれか、`When` release scriptを実行する、`Then` commit／tag／pushを行わず具体的理由で失敗する。
- `Given` cleanなmainと未使用version、`When` release scriptを実行する、`Then` versionを含むrelease commitとtagが同じcommitを指し、atomic pushで両方がremoteへ反映される。
- `Given` tagとmanifest versionが不一致、`When` tag CIを実行する、`Then` 検査が失敗する。

### FR6 — Tests and documentation

- **FR6.1** `tests/intent-e2e.test.ts`はsubmoduleをsourceとして使わない`--from`導入と、同一sourceへの`--update`が`Changed 0`になる回帰を実行しなければならない。`[desc]`
- **FR6.2** source取得、selector precedence、invalid archive、manifest/tag不一致、来歴のatomic write、source種別ごとのupdate、doctor offline、release preflightとtag consistencyを決定論的に検査しなければならない。`[desc] [Q1] [Q2] [Q3] [Q4] [Q5]`
- **FR6.3** READMEはtag導入を既定のQuickstartとして示し、stdin bootstrap、`--tag`、`--from`、`--ref`、`--update`、来歴の場所を説明しなければならない。`--ref`は開発追従用であることを明記する。`[desc]`
- **FR6.4** 既存テスト、golden、アーキテクチャゲート、plugin validator、`aidlc-plugin-test`の`CLEAN`判定を維持しなければならない。`[desc]`

## 非機能要件

- **NFR1 — Independence**: 通常のtag／latest導入と更新は、実行環境にこのrepositoryのcheckout、`.git/`、`aidlc-workflows/` submoduleが無くても完了しなければならない。`[desc]`
- **NFR2 — Idempotency**: 同じ解決済みsourceとpayloadに対する再導入または`--update`は`Changed 0`となり、導入済みpayloadと来歴をbyte単位で変更してはならない。`[desc] [Q1] [Q5]`
- **NFR3 — Integrity**: 同一のplugin-owned file集合とbytesからは、OSや列挙順に依存せず同一の`payload_sha256`を生成しなければならない。1 byteの変更またはpathの変更は異なるhashとして検出されなければならない。`[Q5]`
- **NFR4 — Failure safety**: 取得、検証、buildまでの失敗では導入先を一切変更してはならない。compose開始後の失敗は非0終了し、成功した来歴を書かず、利用者が再実行または修復できる具体的な状態を表示しなければならない。`[desc]`
- **NFR5 — Compatibility**: plugin由来の`tools/` 14ファイル、既存sensor／doctorの公開ファイル名`.ts`、doctor JSON shape、既存goldenを維持しなければならない。全既存テストとアーキテクチャ規則が成功することを受け入れ条件とする。`[desc]`
- **NFR6 — Portability**: installer本体はBun標準機能で動作し、sourceの取得・展開・buildのためにgit checkoutやsubmoduleを要求してはならない。bootstrapの取得コマンドとしてcurlを使用できる。`[desc]`

## 制約

- npm packageとして公開しない。`[desc]`
- Release assetとしてbuild済みtarballを添付し、assetから導入する機能は本intentに含めない。`[desc]`
- `--from`はリポジトリrootのみを受け付ける。`[Q2]`
- `scripts/release.ts`はremoteへcommitとtagをpushするため、実行時に明示的な利用者操作とGitHubへの書込権限を必要とする。`[Q4]`
- AI-DLC本体の導入先toolchainを再実装せず、既存の`aidlc-plugin-build.ts`等を使用する。`[desc]`

## 前提

- latestはpre-releaseを除くstable SemVer tagの最大値を意味する。`[Q1]`
- 公開GitHub archiveとtags APIは認証なしで参照でき、認証必須のprivate forkは本intentの対象外とする。`[desc]`
- `v0.5.0`は現在のmanifest versionを含む基線commitへ付与し、それ以降はrelease scriptで版を進める。`[desc]`

## 対象外

- build済みRelease assetの生成、添付、asset URLからの導入。`[desc]`
- npm registryへの公開。`[desc]`
- AI-DLC本体のplugin build／compose toolchainの仕様変更。`[desc]`
- production deployment環境、observability、incident responseの構築。`[desc]`
- プラグインの形式検証機能、solver、golden、既存ドメインモデルの機能変更。`[desc]`

## Assumptions & Open Questions

None.

## Sources

- `[desc]` Initial description: `aidlc/spaces/default/intents/260903-installer-tag-update/project-description.json`
- `[Q1]` `--update`は取得元の意味を維持する（local path／branch／fixed tag／latest stable tag）。
- `[Q2]` `--from <path>`は`deep-spec-analysis/`を含むリポジトリrootだけを受け付ける。
- `[Q3]` doctorのoffline確認は`pass: true`のadvisory checkとしてskip理由を`label`に残す。
- `[Q4]` release scriptはclean mainからversion bump、commit、tag、atomic pushまでを一括実行する。
- `[Q5]` `payload_sha256`はcompose後のplugin-owned payloadを相対path順で正準化し、来歴JSONを除外する。
- Reverse Engineering: `aidlc/spaces/default/codekb/deep-spec-analysis/{business-overview,architecture,code-structure,api-documentation,code-quality-assessment}.md`
