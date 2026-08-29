// 存在すれば読む fs プリミティブ。deep-spec-lib.ts からの逐語移動。

import { existsSync, readFileSync } from "node:fs";

export function readIfExists(path: string): string | null {
  return existsSync(path) ? readFileSync(path, "utf-8") : null;
}
