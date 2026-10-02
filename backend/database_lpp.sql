-- LPP module tables. Run AFTER the existing students table exists.
-- Does not modify the students table.
USE student_db;

CREATE TABLE IF NOT EXISTS lpp_problems (
  id INT AUTO_INCREMENT PRIMARY KEY,
  student_id INT NULL,                       -- optional link to a student
  title VARCHAR(150) NOT NULL,
  total_hours DECIMAL(8,2) NOT NULL,
  use_priority TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE SET NULL
);

-- One row per decision variable xi
CREATE TABLE IF NOT EXISTS lpp_subjects (
  id INT AUTO_INCREMENT PRIMARY KEY,
  problem_id INT NOT NULL,
  position INT NOT NULL,                     -- i in xi
  name VARCHAR(100) NOT NULL,
  min_hours DECIMAL(8,2) NOT NULL,
  max_hours DECIMAL(8,2) NOT NULL,
  benefit_per_hour DECIMAL(8,2) NOT NULL,
  priority TINYINT NOT NULL DEFAULT 3,
  FOREIGN KEY (problem_id) REFERENCES lpp_problems(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS lpp_solutions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  problem_id INT NOT NULL,
  status VARCHAR(20) NOT NULL,
  objective_value DECIMAL(12,4) NOT NULL,
  total_hours_used DECIMAL(8,2) NOT NULL,
  remaining_hours DECIMAL(8,2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (problem_id) REFERENCES lpp_problems(id) ON DELETE CASCADE
);

-- Optimal value of each xi
CREATE TABLE IF NOT EXISTS lpp_solution_allocations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  solution_id INT NOT NULL,
  subject_id INT NOT NULL,
  allocated_hours DECIMAL(8,2) NOT NULL,
  total_benefit DECIMAL(12,4) NOT NULL,
  FOREIGN KEY (solution_id) REFERENCES lpp_solutions(id) ON DELETE CASCADE,
  FOREIGN KEY (subject_id) REFERENCES lpp_subjects(id) ON DELETE CASCADE
);
