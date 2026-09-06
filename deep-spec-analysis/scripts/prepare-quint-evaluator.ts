// Linux CIでQuintの固定評価器を先に取得し、テスト中の遅延ダウンロードをなくす。
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { rustEvaluatorDir } from "@informalsystems/quint/dist/src/config.js";
import { QUINT_EVALUATOR_VERSION } from "@informalsystems/quint/dist/src/rust/binaryManager.js";

const version = "v0.6.0";
const checksum = "61755a09d5052d93a4e75e840059edfd0d3674aeda164b9d2464be3d6e21b1c2";
if (QUINT_EVALUATOR_VERSION !== version)
  throw new Error("Update the pinned evaluator asset and checksum for this Quint version");
if (process.platform !== "linux" || process.arch !== "x64")
  throw new Error("This bootstrap targets the Linux x64 CI runner");
const destination = rustEvaluatorDir(version);
const executable = join(destination, "quint_evaluator");
const receipt = join(destination, ".archive-sha256");
if (!existsSync(executable) || !existsSync(receipt) || readFileSync(receipt, "utf8") !== checksum) {
  mkdirSync(dirname(destination), { recursive: true });
  const temporary = mkdtempSync(join(dirname(destination), ".quint-install-"));
  try {
    const archive = join(temporary, "evaluator.tar.gz");
    execFileSync(
      "curl",
      [
        "--fail",
        "--location",
        "--retry",
        "3",
        "--retry-all-errors",
        "--connect-timeout",
        "15",
        "--max-time",
        "120",
        `https://github.com/quint-co/quint/releases/download/evaluator/${version}/quint_evaluator-x86_64-unknown-linux-gnu.tar.gz`,
        "--output",
        archive,
      ],
      { stdio: "inherit" },
    );
    if (createHash("sha256").update(readFileSync(archive)).digest("hex") !== checksum)
      throw new Error("Quint evaluator archive checksum mismatch");
    execFileSync("tar", ["-xzf", archive, "-C", temporary], { stdio: "inherit" });
    chmodSync(join(temporary, "quint_evaluator"), 0o755);
    mkdirSync(destination, { recursive: true });
    renameSync(join(temporary, "quint_evaluator"), executable);
    writeFileSync(receipt, checksum);
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
}
console.log(`Quint Rust evaluator ${version} is ready`);
