import React, { useState, useEffect } from 'react';
import './App.css';
import LPPOptimization from './lpp/LPPOptimization';

const EMPTY_FORM = { name: '', roll_no: '', class: '' };

function App() {
  const [students, setStudents] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editing, setEditing] = useState(null);
  const [page, setPage] = useState('students'); // 'students' | 'lpp'
  const [query, setQuery] = useState('');

  // Theme: remembered in localStorage, otherwise follows the OS setting.
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('theme');
    if (saved) return saved;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    fetchStudents();
  }, []);

  const fetchStudents = async () => {
    const response = await fetch('http://localhost:5000/api/students');
    const data = await response.json();
    setStudents(data);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const url = editing
      ? `http://localhost:5000/api/students/${editing}`
      : 'http://localhost:5000/api/students';

    await fetch(url, {
      method: editing ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form)
    });

    setForm(EMPTY_FORM);
    setEditing(null);
    fetchStudents();
  };

  const handleEdit = (student) => {
    setForm({ name: student.name, roll_no: student.roll_no, class: student.class });
    setEditing(student.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this student?')) return;
    await fetch(`http://localhost:5000/api/students/${id}`, { method: 'DELETE' });
    fetchStudents();
  };

  const q = query.trim().toLowerCase();
  const visible = students.filter((s) =>
    [s.name, s.roll_no, s.class].some((v) => String(v).toLowerCase().includes(q))
  );
  const initials = (name) =>
    name.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  const classCount = new Set(students.map((s) => s.class)).size;

  return (
    <div className="App">
      <header className="topbar">
        <div className="topbar-inner">
          <h1 className="brand">🎓 <span>Student</span> Management</h1>
          <nav className="page-nav">
            <button className={page === 'students' ? 'active' : ''} onClick={() => setPage('students')}>Students</button>
            <button className={page === 'lpp' ? 'active' : ''} onClick={() => setPage('lpp')}>LPP Optimization</button>
          </nav>
          <button className="theme-toggle" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
            {theme === 'dark' ? '☀️ Light' : '🌙 Dark'}
          </button>
        </div>
      </header>

      <main className="container">
        {page === 'lpp' ? <LPPOptimization /> : (
          <>
            <h2 className="page-title">Students</h2>
            <p className="page-sub">Add, edit, search and remove student records.</p>

            <div className="stat-row">
              <div className="stat-card"><span>Total students</span><b>{students.length}</b></div>
              <div className="stat-card"><span>Classes</span><b>{classCount}</b></div>
            </div>

            <div className="card">
              <h3>{editing ? 'Edit student' : 'Add new student'}</h3>
              <form className="student-form" onSubmit={handleSubmit}>
                <input
                  type="text"
                  placeholder="Name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
                <input
                  type="text"
                  placeholder="Roll Number"
                  value={form.roll_no}
                  onChange={(e) => setForm({ ...form, roll_no: e.target.value })}
                  required
                />
                <input
                  type="text"
                  placeholder="Class"
                  value={form.class}
                  onChange={(e) => setForm({ ...form, class: e.target.value })}
                  required
                />
                <div className="form-actions">
                  <button type="submit">{editing ? 'Update' : 'Add'} Student</button>
                  {editing && (
                    <button type="button" className="btn-secondary" onClick={() => { setEditing(null); setForm(EMPTY_FORM); }}>
                      Cancel
                    </button>
                  )}
                </div>
              </form>
            </div>

            <div className="card">
              <div className="table-head">
                <h3>Student list ({visible.length})</h3>
                <input
                  type="text"
                  placeholder="🔍 Search by name, roll no or class"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Roll No</th>
                      <th>Class</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((student) => (
                      <tr key={student.id}>
                        <td><div className="name-cell"><span className="avatar">{initials(student.name)}</span>{student.name}</div></td>
                        <td>{student.roll_no}</td>
                        <td><span className="badge">{student.class}</span></td>
                        <td>
                          <button onClick={() => handleEdit(student)}>Edit</button>
                          <button className="btn-danger" onClick={() => handleDelete(student.id)}>Delete</button>
                        </td>
                      </tr>
                    ))}
                    {visible.length === 0 && (
                      <tr><td colSpan="4" className="empty">No students found.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

export default App;