// SolverProbeClientImpl の契約テスト（issue #128）。
//
// 静的検査（JDK ＋ 配布物）が通っても、8822 番の Apalache サーバが消えた作業
// ディレクトリを掴んだ孤児なら verify は必ず落ちる。プローブの 3 分岐を固定
// する: 待ち受けあり × verify 失敗 = 陳腐化、待ち受けあり × verify 成功 =
// 健全、待ち受けなし = プローブを払わない（doctor に JVM 起動コストを持ち
// 込まない）。
//
// 実 quint / 実 JDK には触らない。プローブが要求するのは「`--version` が
// 成功する CLI」だけなので、その役は system の実行ファイルで足りる:
//   - verify が失敗する quint = このランタイム自身（`bun --version` は 0、
//     `bun verify …` は `verify` というファイルを探して非ゼロ）
//   - verify が成功する quint = `true`（何を渡しても 0）
//   - JDK = PATH の先頭に置いた `java` → `true` のシンボリックリンク
// 偽スクリプトを書き下ろさないのは、新規実行ファイルの生成を避けて
// どの環境でも同じに走らせるため。

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, rmSync, symlinkSync } from "node:fs";
import { createServer, type Server } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SolverProbeClientImpl } from "@deep-spec/doctor-adapter";

const TRUE_BIN = ["/usr/bin/true", "/bin/true"].find((path) => existsSync(path));
const unsupported = process.platform === "win32" || TRUE_BIN === undefined;

function listenOnFreePort(): Promise<{ server: Server; port: number }> {
  return new Promise((resolve) => {
    const server = createServer(() => {});
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      resolve({ server, port: typeof address === "object" && address !== null ? address.port : 0 });
    });
  });
}

function close(server: Server): Promise<void> {
  return new Promise((resolve) => server.close(() => resolve()));
}

describe.skipIf(unsupported)("the solver probe measures whether Apalache can actually verify", () => {
  const work = mkdtempSync(join(tmpdir(), "deep-spec-solver-probe-"));
  const binDir = join(work, "bin");
  const originalPath = process.env.PATH;
  // verify が非ゼロで返る quint 役／ゼロで返る quint 役。
  const failingQuint = process.execPath;
  const passingQuint = TRUE_BIN ?? "";

  beforeAll(() => {
    mkdirSync(binDir, { recursive: true });
    symlinkSync(passingQuint, join(binDir, "java"));
    process.env.PATH = `${binDir}:${originalPath ?? ""}`;
  });

  afterAll(() => {
    process.env.PATH = originalPath;
    rmSync(work, { recursive: true, force: true });
  });

  function client(quintBin: string, port: number): SolverProbeClientImpl {
    return new SolverProbeClientImpl({
      projectDir: work,
      quintBin,
      apalacheDistDeclared: true,
      homeDir: work,
      apalachePort: port,
      runtimeBin: process.execPath,
    });
  }

  test("a listening server that cannot verify is reported stale, and the Apalache row fails", async () => {
    const { server, port } = await listenOnFreePort();
    try {
      const availability = client(failingQuint, port).availability();
      expect(availability.hasQuintCli()).toBe(true);
      expect(availability.apalacheServerIsStale()).toBe(true);
      expect(availability.hasApalache()).toBe(false);
    } finally {
      await close(server);
    }
  }, 60_000);

  test("a listening server that verifies cleanly is healthy", async () => {
    const { server, port } = await listenOnFreePort();
    try {
      const availability = client(passingQuint, port).availability();
      expect(availability.hasQuintCli()).toBe(true);
      expect(availability.apalacheServerIsStale()).toBe(false);
      expect(availability.hasApalache()).toBe(true);
    } finally {
      await close(server);
    }
  }, 60_000);

  test("with nothing listening the probe is never paid — the failing quint is never asked to verify", async () => {
    // 一度掴んで即座に閉じたポート＝誰も待ち受けていないポート。verify を
    // 打っていれば必ず陳腐化と出る quint を渡しているので、stale=false は
    // 「プローブを払わなかった」ことの観測になる。
    const { server, port } = await listenOnFreePort();
    await close(server);
    const availability = client(failingQuint, port).availability();
    expect(availability.hasQuintCli()).toBe(true);
    expect(availability.apalacheServerIsStale()).toBe(false);
    expect(availability.hasApalache()).toBe(true);
  }, 60_000);

  test("a missing quint CLI leaves staleness unmeasured rather than guessed", () => {
    const availability = client(join(work, "no-such-quint"), 1).availability();
    expect(availability.hasQuintCli()).toBe(false);
    expect(availability.apalacheServerIsStale()).toBe(false);
    expect(availability.hasApalache()).toBe(true);
  }, 60_000);
});
