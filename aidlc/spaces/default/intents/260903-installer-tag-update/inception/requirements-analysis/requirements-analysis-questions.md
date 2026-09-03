# Requirements Analysis Questions

初期記述と Reverse Engineering の結果から、実装契約を確定するために必要な判断だけを残しています。

## Q1. `--update` は、インストール時に記録された取得元ごとにどう動作させますか？

`--from`、`--ref`、`--tag`、無指定のlatest tagでは「同じ取得元を再解決する」と「最新tagへ更新する」が一致しない場合があります。

- A. 取得元の意味を維持する。`--from`は同じローカルパス、`--ref`は同じbranchの最新、`--tag`は固定tagなのでno-op、latestは最新stable tagへ進める
- B. 取得元に関係なく、常に最新stable tagへ更新する
- C. `--from`と`--ref`は同じ取得元を追従し、`--tag`とlatestは最新stable tagへ進める
- D. `--update`はlatestで導入した場合だけ許可し、その他は明示的な再インストールを要求する
- E. 記録された取得元を表示するだけにして、自動更新は行わない
- X. Other (please specify)

[Answer]: A

## Q2. `--from <path>` が受け付けるローカルパスの形をどうしますか？

このリポジトリではプラグイン本体が `deep-spec-analysis/` に入っていますが、tarball展開後と単体プラグインcheckoutでは起点が異なり得ます。

- A. リポジトリrootとプラグインrootの両方を受け付け、manifestを使って一意に判定する
- B. `deep-spec-analysis/` 自体を指すプラグインrootだけを受け付ける
- C. `deep-spec-analysis/` を含むリポジトリrootだけを受け付ける
- D. 明示オプションでpath shapeを指定させ、自動判定しない
- E. リポジトリrootを既定にし、見つからない場合だけプラグインrootとして扱う
- X. Other (please specify)

[Answer]: C

## Q3. doctorがGitHubへ接続できない場合、既存の `{checks:[{pass,label,fix?,severity}]}` 契約上でどう表現しますか？

現在の公開JSONには`skip`や`status`がなく、新しいfieldを加えると既存consumerへ影響します。

- A. `pass: true`のadvisory checkとして残し、`label`に「更新確認をskipした理由」を明記する
- B. 更新確認のcheck自体を出力しない
- C. `pass: false`のadvisory checkとして出力する
- D. `status: skipped`を公開JSONへ追加し、consumerも更新する
- E. ネットワーク不可時はdoctor全体を失敗させる
- X. Other (please specify)

[Answer]: A

## Q4. `scripts/release.ts` はversion bumpからtag/pushまでをどの単位で自動化しますか？

manifestを書き換えただけではtagが新versionを含むcommitを指さないため、commitの所有者を決める必要があります。

- A. cleanな`main`を要求し、manifest更新、release commit、`v<version>` tag、commitとtagのpushまで一括実行する
- B. manifest更新とrelease commitまで行い、tagとpushは利用者が実行する
- C. manifest更新だけ行い、commit、tag、pushは利用者が実行する
- D. 既にversion更新済みのcleanなcommitだけを受け付け、tagとpushだけ行う
- E. tagだけ作成し、pushは利用者が実行する
- X. Other (please specify)

[Answer]: A

## Q5. `payload_sha256` は、どのデータを正準化して計算しますか？

取得archive、build直後のprojection、compose後の実ファイルではhashの意味が異なります。来歴JSON自身は循環参照を避けるため対象外にする必要があります。

- A. compose後に導入されたplugin-owned payloadを、repo相対path順のpath＋content bytesで正準化し、来歴JSONを除外して計算する
- B. compose前のbuild済みprojectionを、相対path順のpath＋content bytesで正準化して計算する
- C. GitHubから取得したarchive bytesまたはローカルcheckoutのarchive相当を計算する
- D. manifestが列挙するtoolsだけを対象に計算する
- E. source取得物とcompose後payloadの2種類のhashを記録する
- X. Other (please specify)

[Answer]: A

## Consolidated Summary Confirmation

- `--update` は導入時の取得元の意味を維持する。`--from` は同じローカルパス、`--ref` は同じbranchの最新、固定 `--tag` はno-op、latest導入は最新stable tagへ進める
- `--from <path>` は `deep-spec-analysis/` を含むリポジトリrootだけを受け付け、プラグインroot単体は受け付けない
- doctorがGitHubへ接続できない場合は、`pass: true` のadvisory checkを残し、`label`に更新確認をskipした理由を明記する
- `scripts/release.ts` はcleanな`main`を要求し、manifest更新、release commit、`v<version>` tag、commitとtagのpushまでを一括実行する
- `payload_sha256` はcompose後に導入されたplugin-owned payloadを、相対path順のpathとcontent bytesで正準化して計算し、来歴JSON自身は除外する

Does this all look correct before I generate the requirements artifact?

- Looks correct
- Request changes

[Answer]: Looks correct
