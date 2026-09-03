# 結合テスト手順

Test Strategy は **Minimal** であるため新しい結合テストスイートは追加しない。ただし今回の変更は installer、導入先 toolchain、doctor、release CLI の境界を変更するため、Code Generation で追加済みの既存テストを統合確認として実行する。

## 実行コマンド

```bash
cd deep-spec-analysis
bun test tests/installer.test.ts tests/doctor-version-advisory.test.ts tests/release.test.ts tests/intent-e2e.test.ts
```

Codex PreToolUse 境界はワークスペースルートから検査する。

```bash
bun test ./.codex/hooks/aidlc-codex-adapter.test.ts
```

## 検証する境界

- local／branch／tag／latest source → manifest 検証 → 導入先 builder
- 安全な archive 展開 → refresh → tombstone → compose → doctor → provenance
- 同一 source update → `Changed 0` と provenance bytes／mtime 不変
- doctor provenance → GitHub tags client →既存 JSON shape の advisory
- release preflight → commit → tag → atomic push
- Codex PreToolUse core hook output → Codex 固有 envelope

## テストデータ

- GitHub と remote git は固定 response／runner double を使い、実ネットワークや実 push を行わない
- 一時リポジトリと一時導入先は各テストが所有し、終了後に削除する
- 悪意ある tar entry、tag不一致、offline、compose失敗を明示 fixture として使う

## 合格条件

全テストが exit 0、失敗0件であること。skip は opt-in parity テスト1件だけを許容する。

