// refinement 証拠の失効 1 行——要件が設計検証の後に再検証され、refinement
// 証拠が現在の要件を語らなくなった intent。
export interface RefinementStaleRow {
  space: string;
  intent: string;
}
