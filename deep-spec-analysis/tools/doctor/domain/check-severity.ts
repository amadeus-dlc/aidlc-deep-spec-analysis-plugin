// doctor 検査行の深刻度 — "error" は /aidlc --doctor を失敗させ、"advisory" は
// 表示のみ（FR11 / NFR3：ソルバ欠如は検証を劣化させるが、ワークフローを
// 止めない）。
export type CheckSeverity = "error" | "advisory";
