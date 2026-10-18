export interface SeatStudent { id: string; name: string }
export interface SeatPosition { row: number; column: number }
export interface SeatingConstraints {
  rows: number;
  columns: number;
  blocked?: SeatPosition[];
  frontStudentIds?: string[];
  separatePairs?: [string, string][];
  togetherPairs?: [string, string][];
}
export interface SeatingResult {
  ok: boolean;
  assignments: Array<SeatPosition & { studentId: string }>;
  score: number;
  explanation: string;
}

const key = (seat: SeatPosition) => `${seat.row}:${seat.column}`;
const distance = (a: SeatPosition, b: SeatPosition) =>
  Math.abs(a.row - b.row) + Math.abs(a.column - b.column);

export function areAdjacent(a: SeatPosition, b: SeatPosition): boolean {
  return distance(a, b) === 1;
}

function validHardConstraints(
  assignments: SeatingResult["assignments"],
  constraints: SeatingConstraints,
): boolean {
  const byStudent = new Map(assignments.map((item) => [item.studentId, item]));
  if ((constraints.frontStudentIds ?? []).some((id) => (byStudent.get(id)?.row ?? Infinity) > 1)) {
    return false;
  }
  return !(constraints.separatePairs ?? []).some(([a, b]) => {
    const seatA = byStudent.get(a);
    const seatB = byStudent.get(b);
    return seatA && seatB ? areAdjacent(seatA, seatB) : false;
  });
}

export function validateSeatingAssignments(
  assignments: SeatingResult["assignments"],
  constraints: SeatingConstraints,
): { valid: boolean; explanation: string } {
  const valid = validHardConstraints(assignments, constraints);
  return {
    valid,
    explanation: valid
      ? "La distribución cumple las restricciones obligatorias."
      : "El cambio incumple una separación obligatoria o una necesidad de cercanía a la pizarra.",
  };
}

function preferenceScore(
  assignments: SeatingResult["assignments"],
  constraints: SeatingConstraints,
): number {
  const byStudent = new Map(assignments.map((item) => [item.studentId, item]));
  return (constraints.togetherPairs ?? []).reduce((score, [a, b]) => {
    const seatA = byStudent.get(a);
    const seatB = byStudent.get(b);
    return score + (seatA && seatB && areAdjacent(seatA, seatB) ? 10 : 0);
  }, 0);
}

function seededShuffle<T>(items: T[], seed: number): T[] {
  const result = [...items];
  let state = seed || 1;
  const random = () => {
    state ^= state << 13; state ^= state >>> 17; state ^= state << 5;
    return (state >>> 0) / 4_294_967_296;
  };
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [result[index], result[target]] = [result[target], result[index]];
  }
  return result;
}

export function generateSeating(
  students: SeatStudent[],
  constraints: SeatingConstraints,
): SeatingResult {
  const blocked = new Set((constraints.blocked ?? []).map(key));
  const seats: SeatPosition[] = [];
  for (let row = 0; row < constraints.rows; row += 1) {
    for (let column = 0; column < constraints.columns; column += 1) {
      if (!blocked.has(key({ row, column }))) seats.push({ row, column });
    }
  }
  if (students.length > seats.length) {
    return { ok: false, assignments: [], score: 0, explanation: "No hay suficientes asientos disponibles." };
  }

  let best: SeatingResult["assignments"] | undefined;
  let bestScore = -Infinity;
  for (let attempt = 1; attempt <= 2_000; attempt += 1) {
    const ordered = seededShuffle(students, attempt * 7919);
    const front = new Set(constraints.frontStudentIds ?? []);
    ordered.sort((a, b) => Number(front.has(b.id)) - Number(front.has(a.id)));
    const assignments = ordered.map((student, index) => ({ studentId: student.id, ...seats[index] }));
    if (!validHardConstraints(assignments, constraints)) continue;
    const score = preferenceScore(assignments, constraints);
    if (score > bestScore) { best = assignments; bestScore = score; }
    if (score === (constraints.togetherPairs?.length ?? 0) * 10) break;
  }
  if (!best) {
    return {
      ok: false,
      assignments: [],
      score: 0,
      explanation: "No existe una distribución que cumpla todas las restricciones obligatorias.",
    };
  }
  return {
    ok: true,
    assignments: best,
    score: bestScore,
    explanation: "Restricciones obligatorias verificadas; preferencias maximizadas mediante búsqueda heurística reproducible.",
  };
}
