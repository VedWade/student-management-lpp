/**
 * Builds the mathematical formulation text from the current form values.
 * Pure functions (no React) so they can be reused/tested.
 */
const fmt = (n) => String(Math.round(Number(n) * 10000) / 10000);

/** Objective coefficient: benefit/hour, multiplied by priority when weighting is on. */
export const coefficient = (s, usePriority) =>
  (Number(s.benefitPerHour) || 0) * (usePriority ? Number(s.priority) || 1 : 1);

export function buildFormulation({ totalHours, subjects, usePriority }, solution) {
  const n = subjects.length;
  const H = fmt(Number(totalHours) || 0);

  // Decision variables: xi = hours allocated to subject i
  const variables = subjects.map((s, i) => `x${i + 1} = study hours allocated to ${s.name || `Subject ${i + 1}`}`);

  // Objective: Maximize Z = c1x1 + c2x2 + ...
  const terms = subjects.map((s, i) => `${fmt(coefficient(s, usePriority))}x${i + 1}`);
  const objective = `Z = ${terms.join(' + ') || '0'}`;

  // Constraints: total-hours budget + bounds for every variable
  const constraints = [
    `${subjects.map((_, i) => `x${i + 1}`).join(' + ') || '0'} <= ${H}`,
    ...subjects.map((s, i) => `${fmt(Number(s.minHours) || 0)} <= x${i + 1} <= ${fmt(Number(s.maxHours) || 0)}`),
  ];

  let optimal = null;
  if (solution && solution.status === 'OPTIMAL') {
    optimal = [...solution.allocations.map((a, i) => `x${i + 1} = ${fmt(a.allocatedHours)}  (${a.name})`),
               `Z(max) = ${fmt(solution.objective)}`];
  }
  return { n, variables, objective, constraints, optimal };
}
