const LAST_SQUARE = 36;
const SCORE_PER_MOVE = 5;

export function getCurrentSquare(totalScore: number) {
  const safeScore = Math.max(0, totalScore);
  return Math.min(LAST_SQUARE, Math.floor(safeScore / SCORE_PER_MOVE) + 1);
}

export function getPointsToNextSquare(totalScore: number) {
  if (getCurrentSquare(totalScore) === LAST_SQUARE) {
    return 0;
  }

  const remainder = Math.max(0, totalScore) % SCORE_PER_MOVE;
  return remainder === 0 ? SCORE_PER_MOVE : SCORE_PER_MOVE - remainder;
}
