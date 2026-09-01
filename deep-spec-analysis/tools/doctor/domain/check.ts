import type { CheckSeverity } from "./check-severity.ts";

// doctor 文書の公開契約行（docs/reference/18-plugin-mechanism.md）——
// stdout の {"checks":[...]} に載る published language。プロパティの挿入順
// （pass, label, fix, severity）が直列化バイトに現れるため、presenter は
// この順でリテラルを組む。
export interface Check {
  pass: boolean;
  label: string;
  fix?: string;
  severity: CheckSeverity;
}
