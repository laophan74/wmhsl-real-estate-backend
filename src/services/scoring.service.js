// src/services/scoring.service.js
// Named export để import rõ ràng ở service khác
export function computeScore({ interested, timeframe }) {
  let timeframe_score = 0;
  if (timeframe === "1-3 months") timeframe_score = 35;
  else if (timeframe === "3-6 months") timeframe_score = 20;
  else if (timeframe === "6+ months") timeframe_score = 10;
  else timeframe_score = 5;

  const quality_score = 5;                       // ví dụ: có email/phone hợp lệ
  const engagement_score = interested === "yes" ? 18 : 6;
  const value_score = 20;                        // placeholder, có thể tính theo suburb/median

  const total_score = timeframe_score + value_score + engagement_score + quality_score;
  const category = total_score >= 75 ? "HOT" : total_score >= 50 ? "WARM" : "COLD";

  return {
    total_score,
    category,
    factors: { timeframe_score, value_score, engagement_score, quality_score },
    score_version: "v1.0.0",
  };
}
