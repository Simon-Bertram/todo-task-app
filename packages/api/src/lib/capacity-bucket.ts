export type CapacityBucket = "major" | "medium" | "quick" | "other";

export function getCapacityBucket(estimatedMinutes: number): CapacityBucket {
  if (estimatedMinutes >= 60 && estimatedMinutes <= 120) {
    return "major";
  }
  if (estimatedMinutes >= 30 && estimatedMinutes < 60) {
    return "medium";
  }
  if (estimatedMinutes > 0 && estimatedMinutes < 15) {
    return "quick";
  }
  if (estimatedMinutes <= 15) {
    return "quick";
  }
  if (estimatedMinutes < 60) {
    return "medium";
  }
  return "major";
}
