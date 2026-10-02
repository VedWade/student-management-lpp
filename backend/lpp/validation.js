/** Input validation for LPP requests (backend/lpp/validation.js) */
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

/** Returns { errors: string[], problem } where problem is a cleaned copy. */
function validateProblem(body) {
  const errors = [];
  const b = body || {};
  const totalHours = Number(b.totalHours);
  if (!isNum(totalHours) || totalHours <= 0) errors.push('Total available study hours must be a number greater than 0.');

  if (!Array.isArray(b.subjects) || b.subjects.length === 0) {
    errors.push('At least one subject is required.');
    return { errors, problem: null };
  }
  if (b.subjects.length > 50) errors.push('A maximum of 50 subjects is supported.');

  const subjects = b.subjects.map((s, i) => {
    const label = `Subject ${i + 1}`;
    const name = String(s && s.name != null ? s.name : '').trim();
    const minHours = Number(s && s.minHours);
    const maxHours = Number(s && s.maxHours);
    const benefitPerHour = Number(s && s.benefitPerHour);
    const priority = s && s.priority !== undefined && s.priority !== '' ? Number(s.priority) : 3;
    if (!name) errors.push(`${label}: name is required.`);
    if (name.length > 100) errors.push(`${label}: name is too long (max 100).`);
    if (!isNum(minHours) || minHours < 0) errors.push(`${label}: minimum hours must be >= 0.`);
    if (!isNum(maxHours) || maxHours <= 0) errors.push(`${label}: maximum hours must be > 0.`);
    if (isNum(minHours) && isNum(maxHours) && minHours > maxHours) errors.push(`${label}: minimum hours cannot exceed maximum hours.`);
    if (!isNum(benefitPerHour) || benefitPerHour < 0) errors.push(`${label}: benefit per hour must be >= 0.`);
    if (!Number.isInteger(priority) || priority < 1 || priority > 5) errors.push(`${label}: priority must be an integer from 1 to 5.`);
    return { name, minHours, maxHours, benefitPerHour, priority };
  });

  return { errors, problem: errors.length ? null : { totalHours, subjects, usePriority: !!b.usePriority } };
}

module.exports = { validateProblem };
