const DEADLOCK_DIAGNOSTIC_LINE = "error: reached a deadlock";

export function hasQuintDeadlockDiagnostic(stderr: string): boolean {
  return stderr.split(/\r?\n/).some((line) => line === DEADLOCK_DIAGNOSTIC_LINE);
}
