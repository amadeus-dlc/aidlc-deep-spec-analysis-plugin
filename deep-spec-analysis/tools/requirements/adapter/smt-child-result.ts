export interface SmtChildResult {
  id: string;
  status: "sat" | "unsat" | "unknown" | "budget" | "error";
  model?: { [name: string]: string };
  core?: string[];
  error?: string;
}
