/**
 * LPP REST routes (backend/routes/lpp.js)
 *   POST /api/lpp/solve              validate + solve (nothing stored)
 *   POST /api/lpp/save               validate + solve + store problem & solution
 *   GET  /api/lpp/history/:studentId saved problems for a student
 *   GET  /api/lpp/:id                one saved problem with its latest solution
 *
 * Usage in server.js:  app.use('/api/lpp', require('./routes/lpp')(db));
 * `db` is whatever MySQL connection/pool server.js already uses
 * (callback-style mysql2 / mysql connection or pool, as in server.js).
 */
const express = require('express');
const { validateProblem } = require('../lpp/validation');
const { solveLPP } = require('../lpp/solver');

module.exports = function (db) {
  const router = express.Router();

  /**
   * Promise wrapper around the callback-style db.query() used by server.js (mysql2).
   * NOTE: never call .then() on the object db.query() returns - in mysql2's callback API
   * that object's .then() deliberately throws. We only use the callback.
   */
  const run = (sql, params = []) =>
    new Promise((resolve, reject) => {
      db.query(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
    });

  const fail = (res, e) => { console.error('[LPP]', e); res.status(500).json({ error: 'Internal server error.' }); };

  router.post('/solve', (req, res) => {
    const { errors, problem } = validateProblem(req.body);
    if (errors.length) return res.status(400).json({ error: 'Validation failed.', details: errors });
    res.json(solveLPP(problem));
  });

  router.post('/save', async (req, res) => {
    const { errors, problem } = validateProblem(req.body);
    if (errors.length) return res.status(400).json({ error: 'Validation failed.', details: errors });

    let studentId = null;
    if (req.body.studentId !== undefined && req.body.studentId !== null && req.body.studentId !== '') {
      studentId = Number(req.body.studentId);
      if (!Number.isInteger(studentId) || studentId < 1) return res.status(400).json({ error: 'Invalid studentId.' });
    }
    const title = String(req.body.title || 'Study Hour Optimization').trim().slice(0, 150);

    let problemId;
    try {
      if (studentId !== null) {
        const s = await run('SELECT id FROM students WHERE id = ?', [studentId]);
        if (!s.length) return res.status(404).json({ error: 'Student not found.' });
      }
      // Always re-solve on the server so stored results can't be tampered with.
      const solution = solveLPP(problem);

      const p = await run(
        'INSERT INTO lpp_problems (student_id, title, total_hours, use_priority) VALUES (?,?,?,?)',
        [studentId, title, problem.totalHours, problem.usePriority ? 1 : 0]);
      problemId = p.insertId;

      const subjectIds = [];
      for (let i = 0; i < problem.subjects.length; i++) {
        const s = problem.subjects[i];
        const r = await run(
          'INSERT INTO lpp_subjects (problem_id, position, name, min_hours, max_hours, benefit_per_hour, priority) VALUES (?,?,?,?,?,?,?)',
          [problemId, i + 1, s.name, s.minHours, s.maxHours, s.benefitPerHour, s.priority]);
        subjectIds.push(r.insertId);
      }
      const sol = await run(
        'INSERT INTO lpp_solutions (problem_id, status, objective_value, total_hours_used, remaining_hours) VALUES (?,?,?,?,?)',
        [problemId, solution.status, solution.objective, solution.totalUsed, solution.remaining]);
      for (let i = 0; i < solution.allocations.length; i++) {
        const a = solution.allocations[i];
        await run(
          'INSERT INTO lpp_solution_allocations (solution_id, subject_id, allocated_hours, total_benefit) VALUES (?,?,?,?)',
          [sol.insertId, subjectIds[i], a.allocatedHours, a.totalBenefit]);
      }
      res.status(201).json({ id: problemId, solution });
    } catch (e) {
      if (problemId) { try { await run('DELETE FROM lpp_problems WHERE id = ?', [problemId]); } catch (_) {} } // rollback (cascade)
      fail(res, e);
    }
  });

  // Declared before '/:id' so "history" is not treated as an id.
  router.get('/history/:studentId', async (req, res) => {
    const sid = Number(req.params.studentId);
    if (!Number.isInteger(sid) || sid < 1) return res.status(400).json({ error: 'Invalid student id.' });
    try {
      const rows = await run(
        `SELECT p.id, p.title, p.total_hours AS totalHours, p.created_at AS createdAt,
                s.status, s.objective_value AS objective, s.total_hours_used AS totalUsed
           FROM lpp_problems p
           LEFT JOIN lpp_solutions s ON s.id = (SELECT MAX(id) FROM lpp_solutions WHERE problem_id = p.id)
          WHERE p.student_id = ? ORDER BY p.created_at DESC, p.id DESC`, [sid]);
      res.json(rows);
    } catch (e) { fail(res, e); }
  });

  router.get('/:id', async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: 'Invalid id.' });
    try {
      const [p] = await run('SELECT * FROM lpp_problems WHERE id = ?', [id]);
      if (!p) return res.status(404).json({ error: 'LPP problem not found.' });
      const subs = await run('SELECT * FROM lpp_subjects WHERE problem_id = ? ORDER BY position', [id]);
      const [sol] = await run('SELECT * FROM lpp_solutions WHERE problem_id = ? ORDER BY id DESC LIMIT 1', [id]);
      const allocs = sol ? await run('SELECT * FROM lpp_solution_allocations WHERE solution_id = ?', [sol.id]) : [];
      const usePriority = !!p.use_priority;
      const subjects = subs.map((s) => ({ name: s.name, minHours: +s.min_hours, maxHours: +s.max_hours,
                                          benefitPerHour: +s.benefit_per_hour, priority: s.priority }));
      const solution = sol && {
        status: sol.status, objective: +sol.objective_value, totalUsed: +sol.total_hours_used, remaining: +sol.remaining_hours,
        allocations: subs.map((s) => {
          const a = allocs.find((x) => x.subject_id === s.id) || {};
          return { name: s.name, minHours: +s.min_hours, maxHours: +s.max_hours, benefitPerHour: +s.benefit_per_hour,
                   priority: s.priority, coefficient: +s.benefit_per_hour * (usePriority ? s.priority : 1),
                   allocatedHours: +a.allocated_hours || 0, totalBenefit: +a.total_benefit || 0 };
        }),
      };
      res.json({ id: p.id, studentId: p.student_id, title: p.title, totalHours: +p.total_hours,
                 usePriority, createdAt: p.created_at, subjects, solution });
    } catch (e) { fail(res, e); }
  });

  return router;
};