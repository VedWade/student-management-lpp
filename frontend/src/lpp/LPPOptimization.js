import React, { useEffect, useMemo, useState } from 'react';
import { solveLpp, saveLpp, getLppHistory, getLpp, getStudents } from './lppApi';
import { buildFormulation, coefficient } from './lppFormulation';
import './LPPOptimization.css';

let uid = 0;
const newSubject = (over = {}) => ({ id: ++uid, name: '', minHours: 1, maxHours: 4, benefitPerHour: 5, priority: 3, ...over });

/** Simple responsive SVG bar chart: allocated hours per subject. */
function BarChart({ rows }) {
  const max = Math.max(1, ...rows.map((r) => r.allocatedHours));
  const W = 100, rowH = 10;
  return (
    <svg className="lpp-chart" viewBox={`0 0 ${W} ${rows.length * rowH + 2}`} role="img" aria-label="Allocated hours per subject">
      {rows.map((r, i) => {
        const w = (r.allocatedHours / max) * 52;
        return (
          <g key={i} transform={`translate(0 ${i * rowH + 1})`}>
            <text x="0" y="6" fontSize="3.2">{r.name.length > 14 ? r.name.slice(0, 13) + '…' : r.name}</text>
            <rect x="30" y="1.5" width={Math.max(w, 0.5)} height="6" rx="1" className="lpp-bar" />
            <text x={31 + w} y="6" fontSize="3.2">{r.allocatedHours} h</text>
          </g>
        );
      })}
    </svg>
  );
}

export default function LPPOptimization() {
  const [title, setTitle] = useState('Exam Preparation Plan');
  const [totalHours, setTotalHours] = useState(10);
  const [usePriority, setUsePriority] = useState(false);
  const [subjects, setSubjects] = useState([
    newSubject({ name: 'Mathematics', minHours: 2, maxHours: 5, benefitPerHour: 8, priority: 4 }),
    newSubject({ name: 'Physics', minHours: 2, maxHours: 5, benefitPerHour: 6, priority: 3 }),
    newSubject({ name: 'Chemistry', minHours: 1, maxHours: 4, benefitPerHour: 10, priority: 5 }),
  ]);
  const [students, setStudents] = useState([]);
  const [studentId, setStudentId] = useState('');
  const [history, setHistory] = useState([]);
  const [result, setResult] = useState(null);   // solution returned by backend
  const [errors, setErrors] = useState([]);
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);

  // Load students (read-only use of the existing API); module still works if this fails.
  useEffect(() => { getStudents().then(setStudents).catch(() => setStudents([])); }, []);

  const loadHistory = (sid) => {
    if (!sid) return setHistory([]);
    getLppHistory(sid).then(setHistory).catch(() => setHistory([]));
  };
  useEffect(() => { loadHistory(studentId); }, [studentId]);

  const problem = { totalHours: Number(totalHours), usePriority,
    subjects: subjects.map(({ id, ...s }) => ({ ...s, minHours: Number(s.minHours), maxHours: Number(s.maxHours),
                                                benefitPerHour: Number(s.benefitPerHour), priority: Number(s.priority) })) };

  // Formulation is rebuilt on every render from the live form values.
  const formulation = useMemo(() => buildFormulation({ totalHours, subjects, usePriority }, result),
    [totalHours, subjects, usePriority, result]);

  const update = (id, field, value) => {
    setSubjects((list) => list.map((s) => (s.id === id ? { ...s, [field]: value } : s)));
    setResult(null);
  };
  const addSubject = () => { setSubjects((l) => [...l, newSubject({ name: `Subject ${l.length + 1}` })]); setResult(null); };
  const removeSubject = () => { setSubjects((l) => l.slice(0, -1)); setResult(null); };
  const removeAt = (id) => { setSubjects((l) => l.filter((s) => s.id !== id)); setResult(null); };

  const handle = async (fn) => {
    setBusy(true); setErrors([]); setInfo('');
    try { await fn(); } catch (e) { setErrors(e.details && e.details.length ? e.details : [e.message]); }
    setBusy(false);
  };

  const onSolve = () => handle(async () => { setResult(await solveLpp(problem)); });
  const onSave = () => handle(async () => {
    const saved = await saveLpp({ ...problem, title, studentId: studentId || null });
    setResult(saved.solution);
    setInfo(`Saved as LPP problem #${saved.id}.`);
    loadHistory(studentId);
  });
  const onLoad = (id) => handle(async () => {
    const p = await getLpp(id);
    setTitle(p.title); setTotalHours(p.totalHours); setUsePriority(p.usePriority);
    setSubjects(p.subjects.map((s) => newSubject(s)));
    setResult(p.solution || null);
    setInfo(`Loaded saved problem #${p.id}.`);
  });

  const solved = result && result.status === 'OPTIMAL';

  return (
    <div className="lpp-page">
      <h2>Academic Resource Optimization using LPP</h2>
      <p className="lpp-sub">Allocate limited study hours across subjects to maximize the expected marks.</p>

      {/* ---------- Input ---------- */}
      <section className="lpp-card">
        <div className="lpp-grid">
          <label>Problem title
            <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={150} />
          </label>
          <label>Total available study hours
            <input type="number" min="0" step="0.5" value={totalHours}
                   onChange={(e) => { setTotalHours(e.target.value); setResult(null); }} />
          </label>
          <label>Student (optional)
            <select value={studentId} onChange={(e) => setStudentId(e.target.value)}>
              <option value="">— Not linked —</option>
              {students.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.roll_no})</option>)}
            </select>
          </label>
          <label className="lpp-check">
            <input type="checkbox" checked={usePriority} onChange={(e) => { setUsePriority(e.target.checked); setResult(null); }} />
            Weight benefit by priority (c = benefit × priority)
          </label>
        </div>

        <div className="lpp-table-wrap">
          <table className="lpp-table">
            <thead><tr><th>#</th><th>Subject</th><th>Min hours</th><th>Max hours</th><th>Benefit / hour</th><th>Priority (1-5)</th><th></th></tr></thead>
            <tbody>
              {subjects.map((s, i) => (
                <tr key={s.id}>
                  <td>x{i + 1}</td>
                  <td><input value={s.name} placeholder="Subject name" onChange={(e) => update(s.id, 'name', e.target.value)} /></td>
                  <td><input type="number" min="0" step="0.5" value={s.minHours} onChange={(e) => update(s.id, 'minHours', e.target.value)} /></td>
                  <td><input type="number" min="0" step="0.5" value={s.maxHours} onChange={(e) => update(s.id, 'maxHours', e.target.value)} /></td>
                  <td><input type="number" min="0" step="0.5" value={s.benefitPerHour} onChange={(e) => update(s.id, 'benefitPerHour', e.target.value)} /></td>
                  <td><input type="number" min="1" max="5" step="1" value={s.priority} onChange={(e) => update(s.id, 'priority', e.target.value)} /></td>
                  <td><button className="lpp-btn lpp-btn-x" onClick={() => removeAt(s.id)} disabled={subjects.length <= 1} title="Remove this subject">×</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="lpp-actions">
          <button className="lpp-btn" onClick={addSubject}>+ Add Subject</button>
          <button className="lpp-btn" onClick={removeSubject} disabled={subjects.length <= 1}>− Remove Subject</button>
          <button className="lpp-btn lpp-btn-primary" onClick={onSolve} disabled={busy}>Solve LPP</button>
          <button className="lpp-btn" onClick={onSave} disabled={busy}>Save Problem</button>
        </div>

        {errors.length > 0 && <ul className="lpp-errors">{errors.map((e, i) => <li key={i}>{e}</li>)}</ul>}
        {info && <p className="lpp-info">{info}</p>}
      </section>

      {/* ---------- Formulation ---------- */}
      <section className="lpp-card">
        <h3>LPP Explanation (generated from your inputs)</h3>
        <div className="lpp-formulation">
          <h4>Decision variables</h4>
          <ul>{formulation.variables.map((v, i) => <li key={i}>{v}</li>)}</ul>
          <h4>Objective function</h4>
          <pre>Maximize{'\n'}{formulation.objective}</pre>
          <h4>Constraints</h4>
          <pre>Subject to:{'\n'}{formulation.constraints.join('\n')}{'\n'}x1, …, x{formulation.n} ≥ 0</pre>
          <h4>Optimal solution</h4>
          {formulation.optimal ? <pre>{formulation.optimal.join('\n')}</pre> : <p className="lpp-muted">Click “Solve LPP” to compute it.</p>}
        </div>
      </section>

      {/* ---------- Results ---------- */}
      {result && (
        <section className="lpp-card">
          <h3>Results <span className={`lpp-status lpp-${result.status}`}>{result.status}</span></h3>
          {!solved && <p className="lpp-errors">{result.message}</p>}
          {solved && (<>
            <div className="lpp-stats">
              <div><span>Maximum objective (Z)</span><b>{result.objective}</b></div>
              <div><span>Total hours allocated</span><b>{result.totalUsed}</b></div>
              <div><span>Remaining hours</span><b>{result.remaining}</b></div>
            </div>
            <div className="lpp-table-wrap">
              <table className="lpp-table lpp-results">
                <thead><tr><th>Subject</th><th>Minimum Hours</th><th>Maximum Hours</th><th>Allocated Hours</th><th>Benefit/Hour</th><th>Total Benefit</th></tr></thead>
                <tbody>
                  {result.allocations.map((a, i) => (
                    <tr key={i}>
                      <td>{a.name}</td><td>{a.minHours}</td><td>{a.maxHours}</td>
                      <td><b>{a.allocatedHours}</b></td>
                      <td>{usePriority ? `${a.benefitPerHour} × ${a.priority} = ${a.coefficient}` : a.benefitPerHour}</td>
                      <td>{a.totalBenefit}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <h4>Allocated hours by subject</h4>
            <BarChart rows={result.allocations} />
          </>)}
        </section>
      )}

      {/* ---------- History ---------- */}
      {studentId && (
        <section className="lpp-card">
          <h3>Saved optimizations for this student</h3>
          {history.length === 0 ? <p className="lpp-muted">None saved yet.</p> : (
            <ul className="lpp-history">
              {history.map((h) => (
                <li key={h.id}>
                  <span><b>{h.title}</b> — {h.totalHours} h budget, Z = {h.objective ?? '–'} ({h.status || 'n/a'}) · {new Date(h.createdAt).toLocaleString()}</span>
                  <button className="lpp-btn" onClick={() => onLoad(h.id)}>Open</button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
