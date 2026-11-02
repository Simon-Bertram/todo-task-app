export type QuadrantId = "Q1" | "Q2" | "Q3" | "Q4";

export function getQuadrant(isUrgent: number, isImportant: number): QuadrantId {
  const urgent = isUrgent >= 2;
  const important = isImportant >= 2;
  if (urgent && important) {
    return "Q1";
  }
  if (!urgent && important) {
    return "Q2";
  }
  if (urgent && !important) {
    return "Q3";
  }
  return "Q4";
}
