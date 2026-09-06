"""同一環境で直列に測定し、各プロセスを3秒で打ち切る。"""
import json
from pathlib import Path
import subprocess

record = Path(__file__).resolve().parent
root = record.parents[6]
source = "b33e6878e14652570e111815d8daaf2e4e1bf88b"
subprocess.run(["git", "diff", "--exit-code", source, "--", "deep-spec-analysis/src"], cwd=root, check=True)
rows = []
for depth in [4, 8, 12, 16]:
    for repetition in [1, 2]:
        try:
            result = subprocess.run(["bun", str(record / "schema-cost.ts"), str(depth)], cwd=root,
                                    capture_output=True, text=True, timeout=3)
            row = {"depth": depth, "repetition": repetition, "exitCode": result.returncode,
                   "result": [json.loads(line) for line in result.stdout.splitlines()], "stderr": result.stderr}
        except subprocess.TimeoutExpired as error:
            output = error.stdout.decode() if isinstance(error.stdout, bytes) else (error.stdout or "")
            row = {"depth": depth, "repetition": repetition, "timedOutSeconds": 3,
                   "result": [json.loads(line) for line in output.splitlines()]}
        rows.append(row)
evidence = {"source": source, "command": "python3 run-schema-cost.py; per-process timeout=3 seconds", "rows": rows}
(record / "schema-cost-evidence.json").write_text(json.dumps(evidence, ensure_ascii=False, indent=2) + "\n")
print(json.dumps(evidence, ensure_ascii=False, indent=2))
