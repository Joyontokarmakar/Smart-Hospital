const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');

const dbPath = path.join(__dirname, 'hospital.db');
const db = new sqlite3.Database(dbPath);

const dbRun = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
};

const dbAll = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

const dbGet = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

// Initialize database schema
async function initDb() {
  // Enable foreign keys
  await dbRun('PRAGMA foreign_keys = ON;');

  // 1. Profiles Table
  await dbRun(`
    CREATE TABLE IF NOT EXISTS profiles (
      id TEXT PRIMARY KEY,
      full_name TEXT NOT NULL,
      email TEXT,
      role TEXT NOT NULL,
      status TEXT DEFAULT 'active',
      max_discount REAL DEFAULT 0.00,
      notify_new_visits INTEGER DEFAULT 0,
      notify_new_tests INTEGER DEFAULT 0,
      notify_own_visits_only INTEGER DEFAULT 0,
      notify_own_tests_only INTEGER DEFAULT 0,
      phone TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 2. Doctors Info Table
  await dbRun(`
    CREATE TABLE IF NOT EXISTS doctors_info (
      id TEXT PRIMARY KEY,
      degrees TEXT NOT NULL,
      specialization TEXT NOT NULL,
      current_job_title TEXT NOT NULL,
      institution TEXT NOT NULL,
      phone_number TEXT,
      bmdc_number TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (id) REFERENCES profiles(id) ON DELETE CASCADE
    );
  `);

  // 3. Tests Table
  await dbRun(`
    CREATE TABLE IF NOT EXISTS tests (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      price REAL NOT NULL,
      discount_percentage REAL DEFAULT 0.00,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 4. Patients Table
  await dbRun(`
    CREATE TABLE IF NOT EXISTS patients (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT UNIQUE NOT NULL,
      age INTEGER,
      gender TEXT,
      blood_group TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 5. Visits Table
  await dbRun(`
    CREATE TABLE IF NOT EXISTS visits (
      id TEXT PRIMARY KEY,
      patient_id TEXT,
      doctor_id TEXT,
      receptionist_id TEXT,
      status TEXT DEFAULT 'queued',
      visit_date TEXT NOT NULL,
      serial_number INTEGER,
      session TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
      FOREIGN KEY (doctor_id) REFERENCES profiles(id) ON DELETE SET NULL,
      FOREIGN KEY (receptionist_id) REFERENCES profiles(id) ON DELETE SET NULL
    );
  `);

  // 6. Bills Table
  await dbRun(`
    CREATE TABLE IF NOT EXISTS bills (
      id TEXT PRIMARY KEY,
      patient_id TEXT,
      receptionist_id TEXT,
      subtotal REAL NOT NULL,
      total_discount REAL DEFAULT 0.00,
      total_amount REAL NOT NULL,
      amount_paid REAL NOT NULL DEFAULT 0.00,
      amount_due REAL NOT NULL DEFAULT 0.00,
      estimate_delivery_date TEXT,
      status TEXT DEFAULT 'paid',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
      FOREIGN KEY (receptionist_id) REFERENCES profiles(id) ON DELETE SET NULL
    );
  `);

  // 7. Bill Items Table
  await dbRun(`
    CREATE TABLE IF NOT EXISTS bill_items (
      id TEXT PRIMARY KEY,
      bill_id TEXT,
      test_id TEXT,
      test_name TEXT NOT NULL,
      price REAL NOT NULL,
      discount REAL DEFAULT 0.00,
      final_price REAL NOT NULL,
      expected_delivery TEXT,
      report_status TEXT DEFAULT 'Pending',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (bill_id) REFERENCES bills(id) ON DELETE CASCADE,
      FOREIGN KEY (test_id) REFERENCES tests(id) ON DELETE SET NULL
    );
  `);

  // 8. Receptionist Logs Table
  await dbRun(`
    CREATE TABLE IF NOT EXISTS receptionist_logs (
      id TEXT PRIMARY KEY,
      receptionist_id TEXT,
      login_time TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      logout_time TEXT,
      date TEXT NOT NULL,
      FOREIGN KEY (receptionist_id) REFERENCES profiles(id) ON DELETE CASCADE
    );
  `);

  // 9. Notifications Table
  await dbRun(`
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      type TEXT NOT NULL,
      is_read INTEGER DEFAULT 0,
      related_entity_id TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE
    );
  `);

  // 10. Hospital Settings Table
  await dbRun(`
    CREATE TABLE IF NOT EXISTS hospital_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      name TEXT NOT NULL DEFAULT 'Smart Hospital',
      address TEXT NOT NULL DEFAULT '123 Health Ave, Medical District',
      contact_info TEXT NOT NULL DEFAULT 'Phone: +880-1234-567890 | Email: contact@smarthospital.com',
      logo_url TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 11. Auth Users Table (Simulating auth.users)
  await dbRun(`
    CREATE TABLE IF NOT EXISTS local_users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL,
      full_name TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Seed default settings row if empty
  const settingsCount = await dbGet('SELECT COUNT(*) as count FROM hospital_settings');
  if (settingsCount.count === 0) {
    await dbRun(`
      INSERT INTO hospital_settings (id, name, address, contact_info)
      VALUES (1, 'Smart Hospital', '123 Health Ave, Medical District', 'Phone: +880-1234-567890 | Email: contact@smarthospital.com')
    `);
  }

  // Seed default Admin User if not exist
  const defaultEmail = 'joyonto.karmakar.std@gmail.com';
  const adminExists = await dbGet('SELECT COUNT(*) as count FROM local_users WHERE email = ?', [defaultEmail]);
  if (adminExists.count === 0) {
    const adminId = 'd861614a-1111-4444-8888-999999999999'; // Fixed admin UUID
    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync('SuperAdmin@1234', salt);

    await dbRun(
      'INSERT INTO local_users (id, email, password_hash, role, full_name) VALUES (?, ?, ?, ?, ?)',
      [adminId, defaultEmail, hash, 'super_admin', 'Super Admin']
    );

    // Also insert profile
    await dbRun(
      'INSERT INTO profiles (id, full_name, email, role, status, notify_new_visits, notify_new_tests, notify_own_visits_only, notify_own_tests_only) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [adminId, 'Super Admin', defaultEmail, 'super_admin', 'active', 0, 0, 0, 0]
    );
  }
}

module.exports = {
  db,
  dbRun,
  dbAll,
  dbGet,
  initDb
};
