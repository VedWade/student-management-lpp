/** All HTTP calls for the LPP module live here (keeps UI code clean). */
const BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000';

async function request(path, options) {
  const res = await fetch(`${BASE}/api/lpp${path}`, {
    headers: { 'Content-Type': 'application/json' }, ...options });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || 'Request failed');
    err.details = data.details || [];
    throw err;
  }
  return data;
}

export const solveLpp = (problem) => request('/solve', { method: 'POST', body: JSON.stringify(problem) });
export const saveLpp = (problem) => request('/save', { method: 'POST', body: JSON.stringify(problem) });
export const getLppHistory = (studentId) => request(`/history/${studentId}`);
export const getLpp = (id) => request(`/${id}`);

/** Existing endpoint, only read from. */
export async function getStudents() {
  const res = await fetch(`${BASE}/api/students`);
  if (!res.ok) throw new Error('Could not load students');
  return res.json();
}
