// Clock の実実装 — システム時計（Date.now）。

import type { Clock } from "@deep-spec/kernel-usecase";

export class SystemClock implements Clock {
  now(): number {
    return Date.now();
  }
}
