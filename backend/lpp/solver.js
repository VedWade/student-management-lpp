/**
 * LPP SOLVER  (backend/lpp/solver.js)
 * -----------------------------------------------------------------------------
 * Problem:   Maximize  Z = c1x1 + ... + cnxn
 *            s.t.      x1 + ... + xn <= H              (total study hours)
 *                      min_i <= xi <= max_i            (per-subject bounds)
 *
 * Step 1 - Shift variables so every variable is >= 0:
 *            xi = min_i + yi,   0 <= yi <= (max_i - min_i)
 *          The budget becomes  y1 + ... + yn <= H - sum(min_i)  =: R
 *          If R < 0 the minimum hours alone exceed the budget -> INFEASIBLE.
 *
 * Step 2 - All constraints are now "<=" with non-negative right-hand sides,
 *          so the origin (all yi = 0) is a feasible starting vertex. This lets
 *          us run the plain Simplex method (no Phase-1 needed).
 *
 * Step 3 - Convert back: xi = min_i + yi,  Z = sum(ci*xi).
 */

const EPS = 1e-9;

/**
 * Generic Simplex (tableau form) for:  max c.y  s.t.  A y <= b, y >= 0, b >= 0.
 * Uses Bland's rule (lowest index) so it can never cycle.
 */
function simplexMax(c, A, b) {
  const n = c.length;      // decision variables
  const m = A.length;      // constraints (one slack variable each)
  const width = n + m + 1; // columns: variables | slacks | RHS

  // Build tableau rows: [A | I | b]
  const T = A.map((row, i) => {
    const r = new Array(width).fill(0);
    row.forEach((v, j) => (r[j] = v));
    r[n + i] = 1;
    r[width - 1] = b[i];
    return r;
  });
  // Objective row holds -c (we look for negative entries to improve Z)
  const z = new Array(width).fill(0);
  c.forEach((v, j) => (z[j] = -v));
  const basis = Array.from({ length: m }, (_, i) => n + i); // slacks start in basis

  for (let iter = 0; iter < 10000; iter++) {
    // Entering variable: first column with negative reduced cost (Bland)
    let col = -1;
    for (let j = 0; j < width - 1; j++) if (z[j] < -EPS) { col = j; break; }
    if (col === -1) break; // optimal

    // Leaving variable: minimum ratio test (ties -> lowest basis index)
    let row = -1, best = Infinity;
    for (let i = 0; i < m; i++) {
      if (T[i][col] > EPS) {
        const ratio = T[i][width - 1] / T[i][col];
        if (ratio < best - EPS || (Math.abs(ratio - best) <= EPS && basis[i] < basis[row])) {
          best = ratio; row = i;
        }
      }
    }
    if (row === -1) return { status: 'UNBOUNDED' };

    // Pivot
    const p = T[row][col];
    for (let j = 0; j < width; j++) T[row][j] /= p;
    for (let i = 0; i < m; i++) {
      if (i !== row && Math.abs(T[i][col]) > EPS) {
        const f = T[i][col];
        for (let j = 0; j < width; j++) T[i][j] -= f * T[row][j];
      }
    }
    const f = z[col];
    for (let j = 0; j < width; j++) z[j] -= f * T[row][j];
    basis[row] = col;
  }

  const y = new Array(n).fill(0);
  basis.forEach((v, i) => { if (v < n) y[v] = T[i][width - 1]; });
  return { status: 'OPTIMAL', y, objective: z[width - 1] };
}

const round = (v) => Math.round((v + Number.EPSILON) * 10000) / 10000;

/**
 * Solve the study-hour allocation LPP.
 * @param {{totalHours:number, usePriority?:boolean, subjects:Array}} problem (already validated)
 */
function solveLPP({ totalHours, subjects, usePriority = false }) {
  const n = subjects.length;
  // Objective coefficient ci. With priority weighting: ci = benefit * priority.
  const c = subjects.map((s) => s.benefitPerHour * (usePriority ? s.priority : 1));
  const minSum = subjects.reduce((a, s) => a + s.minHours, 0);
  const R = totalHours - minSum;

  if (R < -EPS) {
    return {
      status: 'INFEASIBLE',
      message: `Minimum hours required (${round(minSum)}) exceed the available hours (${totalHours}).`,
      allocations: [], objective: 0, totalUsed: 0, remaining: totalHours,
    };
  }

  // Constraint matrix: row i (i<n):  yi <= max_i - min_i ;  last row: sum(yi) <= R
  const A = [], b = [];
  for (let i = 0; i < n; i++) {
    const row = new Array(n).fill(0); row[i] = 1;
    A.push(row); b.push(subjects[i].maxHours - subjects[i].minHours);
  }
  A.push(new Array(n).fill(1)); b.push(Math.max(R, 0));

  const res = simplexMax(c, A, b);
  if (res.status !== 'OPTIMAL') {
    return { status: res.status, message: 'Solver could not find a bounded optimum.',
             allocations: [], objective: 0, totalUsed: 0, remaining: totalHours };
  }

  const allocations = subjects.map((s, i) => {
    const hours = s.minHours + res.y[i];
    return { name: s.name, minHours: s.minHours, maxHours: s.maxHours,
             benefitPerHour: s.benefitPerHour, priority: s.priority,
             coefficient: c[i], allocatedHours: round(hours),
             totalBenefit: round(hours * c[i]) };
  });
  const totalUsed = round(allocations.reduce((a, s) => a + s.allocatedHours, 0));
  return {
    status: 'OPTIMAL',
    allocations,
    objective: round(allocations.reduce((a, s) => a + s.totalBenefit, 0)),
    totalUsed,
    remaining: round(totalHours - totalUsed),
  };
}

module.exports = { solveLPP, simplexMax };
