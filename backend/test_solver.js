// Run: node test_solver.js   -- checks simplex against an exact greedy (fractional knapsack)
const assert = require('assert');
const { solveLPP } = require('./lpp/solver');
const { validateProblem } = require('./lpp/validation');

// Example from the brief
let r = solveLPP({ totalHours: 10, subjects: [
  { name: 'A', minHours: 2, maxHours: 5, benefitPerHour: 8, priority: 3 },
  { name: 'B', minHours: 2, maxHours: 5, benefitPerHour: 6, priority: 3 },
  { name: 'C', minHours: 1, maxHours: 4, benefitPerHour: 10, priority: 3 }]});
console.log(JSON.stringify(r.allocations.map(a => a.allocatedHours)), r.objective, r.status);
assert.deepStrictEqual(r.allocations.map(a => a.allocatedHours), [4, 2, 4]); assert.strictEqual(r.objective, 84);

// Infeasible
assert.strictEqual(solveLPP({ totalHours: 3, subjects: [{ name: 'A', minHours: 2, maxHours: 5, benefitPerHour: 1, priority: 1 },
  { name: 'B', minHours: 2, maxHours: 5, benefitPerHour: 1, priority: 1 }]}).status, 'INFEASIBLE');

// Randomised comparison with greedy
for (let t = 0; t < 2000; t++) {
  const n = 1 + Math.floor(Math.random() * 8);
  const subjects = Array.from({ length: n }, (_, i) => { const mn = Math.floor(Math.random() * 4); return {
    name: 's' + i, minHours: mn, maxHours: mn + Math.floor(Math.random() * 6), benefitPerHour: Math.floor(Math.random() * 10), priority: 1 + Math.floor(Math.random() * 5) }; });
  const H = Math.floor(Math.random() * 30) + 1, up = Math.random() < 0.5;
  const out = solveLPP({ totalHours: H, subjects, usePriority: up });
  const mins = subjects.reduce((a, s) => a + s.minHours, 0);
  if (mins > H) { assert.strictEqual(out.status, 'INFEASIBLE'); continue; }
  let R = H - mins, z = subjects.reduce((a, s) => a + s.minHours * s.benefitPerHour * (up ? s.priority : 1), 0);
  [...subjects].sort((a, b) => b.benefitPerHour * (up ? b.priority : 1) - a.benefitPerHour * (up ? a.priority : 1)).forEach(s => {
    const x = Math.min(R, s.maxHours - s.minHours); z += x * s.benefitPerHour * (up ? s.priority : 1); R -= x; });
  assert.ok(Math.abs(z - out.objective) < 1e-3, `mismatch ${z} vs ${out.objective}`);
  assert.ok(out.totalUsed <= H + 1e-6);
}
assert.ok(validateProblem({ totalHours: -1, subjects: [] }).errors.length);
console.log('All solver tests passed.');
