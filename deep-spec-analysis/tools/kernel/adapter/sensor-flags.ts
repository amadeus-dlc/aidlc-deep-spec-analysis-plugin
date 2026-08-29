// センサー CLI フラグ解釈。deep-spec-lib.ts からの逐語移動。
// process.argv を触るのは合成ルート（entry）で、ここは配列を受けるだけ。
// PR 後続で SensorFlags.parse への再モデル化予定。

export function parseFlags(argv: string[]): { stage: string; outputPath: string; reportOnly: boolean } {
  let stage = "";
  let outputPath = "";
  let reportOnly = false;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--stage") stage = argv[i + 1] ?? "";
    if (argv[i] === "--output-path") outputPath = argv[i + 1] ?? "";
    if (argv[i] === "--report-only") reportOnly = true;
  }
  return { stage, outputPath, reportOnly };
}
