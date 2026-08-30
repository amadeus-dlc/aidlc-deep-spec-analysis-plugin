// Clock の実実装 — システム時計（Date.now）。

import type { Clock } from "../usecase/index.ts";

export class SystemClock implements Clock {
  now(): number {
    return Date.now();
  }
}
