// 子プロセスへ渡す 1 クエリ分の台本。プロトコル（JSON 形）は design の refinement ソルバも
// 同じ子を spawn するため凍結。
export interface SmtChildQuery {
  id: string;
  script: string;
  assumptions: string[];
  model: { name: string; sort: "Int" | "Bool" }[];
}
