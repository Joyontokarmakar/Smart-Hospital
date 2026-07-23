const express = require('express');
const cors = require('cors');
const http = require('http');
const WebSocket = require('ws');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { initDb, dbAll, dbGet, dbRun } = require('./db');

const JWT_SECRET = 'local-smart-hospital-secret-key-12345';
const PORT = process.env.PORT || 5000;

const app = express();
app.use(cors());
app.use(express.json());

// Create HTTP and WebSocket Server
const server = http.createServer(app);
const wss = new WebSocket.Server({ noServer: true });

// Setup Storage Directory
const storageDir = path.join(__dirname, 'storage');
if (!fs.existsSync(storageDir)) {
  fs.mkdirSync(storageDir);
}
const brandingDir = path.join(storageDir, 'branding');
if (!fs.existsSync(brandingDir)) {
  fs.mkdirSync(brandingDir);
}

// Multer Storage Configuration
const fileStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, brandingDir);
  },
  filename: (req, file, cb) => {
    const fileExt = file.originalname.split('.').pop();
    const fileName = `${file.fieldname}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
    cb(null, fileName);
  }
});
const upload = multer({ storage: fileStorage });

// WebSocket connection tracking
const wsClients = new Set();
wss.on('connection', (ws) => {
  wsClients.add(ws);
  ws.on('close', () => {
    wsClients.delete(ws);
  });
});

// Upgrade HTTP to WS
server.on('upgrade', (request, socket, head) => {
  const pathname = new URL(request.url, `http://${request.headers.host}`).pathname;
  if (pathname === '/ws') {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  } else {
    socket.destroy();
  }
});

// Broadcast changes
function broadcastEvent(table, event, record, old_record = null) {
  const payload = JSON.stringify({ table, event, record, old_record });
  for (const client of wsClients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  }
}

// Notification Helper: onCreateVisit
async function triggerNewVisitNotification(visit) {
  try {
    const receptionist = await dbGet('SELECT role FROM profiles WHERE id = ?', [visit.receptionist_id]);
    const doctor = await dbGet('SELECT role FROM profiles WHERE id = ?', [visit.doctor_id]);
    const patient = await dbGet('SELECT name FROM patients WHERE id = ?', [visit.patient_id]);
    const doctorProfile = await dbGet('SELECT full_name FROM profiles WHERE id = ?', [visit.doctor_id]);
    
    const creator_role = receptionist ? receptionist.role : '';
    const doctor_is_admin = doctor ? doctor.role === 'super_admin' : false;
    const doctor_name = doctorProfile ? doctorProfile.full_name : 'Unknown Doctor';
    const patient_name = patient ? patient.name : 'Unknown Patient';
    
    const message = `${patient_name} scheduled for ${doctor_name} on ${visit.visit_date}`;
    const title = 'New Patient Visit';
    
    const profiles = await dbAll('SELECT * FROM profiles');
    
    for (const p of profiles) {
      let shouldNotify = false;
      const isSuperAdminInvolved = (creator_role === 'super_admin' || doctor_is_admin);
      
      if (isSuperAdminInvolved) {
        if (p.role === 'super_admin' && p.notify_new_visits && !p.notify_own_visits_only) {
          shouldNotify = true;
        }
      } else {
        if ((p.notify_new_visits && !p.notify_own_visits_only) || 
            (p.notify_own_visits_only && p.id === visit.doctor_id)) {
          shouldNotify = true;
        }
      }
      
      if (shouldNotify) {
        const notifId = crypto.randomUUID();
        const notification = {
          id: notifId,
          user_id: p.id,
          title,
          message,
          type: 'visit',
          is_read: 0,
          related_entity_id: visit.id,
          created_at: new Date().toISOString()
        };
        
        await dbRun(
          'INSERT INTO notifications (id, user_id, title, message, type, is_read, related_entity_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [notification.id, notification.user_id, notification.title, notification.message, notification.type, notification.is_read, notification.related_entity_id, notification.created_at]
        );
        
        broadcastEvent('notifications', 'INSERT', notification);
      }
    }
  } catch (err) {
    console.error('Error triggering visit notification:', err);
  }
}

// Notification Helper: onCreateBill
async function triggerNewBillNotification(bill) {
  try {
    const receptionist = await dbGet('SELECT role FROM profiles WHERE id = ?', [bill.receptionist_id]);
    const patient = await dbGet('SELECT name FROM patients WHERE id = ?', [bill.patient_id]);
    const billItems = await dbAll('SELECT test_name FROM bill_items WHERE bill_id = ?', [bill.id]);
    
    const creator_role = receptionist ? receptionist.role : '';
    const patient_name = patient ? patient.name : 'Unknown Patient';
    const test_list = billItems.map(item => item.test_name).join(', ') || 'No Tests';
    
    const message = `${patient_name} - [${test_list}] - ৳${bill.total_amount}`;
    const title = 'New Test Billed';
    
    const profiles = await dbAll('SELECT * FROM profiles');
    const todayStr = new Date().toISOString().split('T')[0];
    
    for (const p of profiles) {
      let shouldNotify = false;
      const isReceptionistSuperAdmin = (creator_role === 'super_admin');
      
      if (isReceptionistSuperAdmin) {
        if (p.role === 'super_admin' && p.notify_new_tests && !p.notify_own_tests_only) {
          shouldNotify = true;
        }
      } else {
        if (p.notify_new_tests && !p.notify_own_tests_only) {
          shouldNotify = true;
        } else if (p.notify_own_tests_only) {
          const visitToday = await dbGet(
            'SELECT 1 FROM visits WHERE patient_id = ? AND doctor_id = ? AND visit_date = ? LIMIT 1',
            [bill.patient_id, p.id, todayStr]
          );
          if (visitToday) {
            shouldNotify = true;
          }
        }
      }
      
      if (shouldNotify) {
        const notifId = crypto.randomUUID();
        const notification = {
          id: notifId,
          user_id: p.id,
          title,
          message,
          type: 'test',
          is_read: 0,
          related_entity_id: bill.id,
          created_at: new Date().toISOString()
        };
        
        await dbRun(
          'INSERT INTO notifications (id, user_id, title, message, type, is_read, related_entity_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [notification.id, notification.user_id, notification.title, notification.message, notification.type, notification.is_read, notification.related_entity_id, notification.created_at]
        );
        
        broadcastEvent('notifications', 'INSERT', notification);
      }
    }
  } catch (err) {
    console.error('Error triggering bill notification:', err);
  }
}

// Middleware: Authenticate Local User
const authenticateUser = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader) return res.status(401).json({ message: 'Authorization header required' });
  const token = authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Token missing' });
  
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ message: 'Invalid or expired token' });
    req.user = user;
    next();
  });
};

// Auth API Router
app.post('/api/auth/register', async (req, res) => {
  const { email, password, full_name, role } = req.body;
  if (!email || !password || !full_name || !role) {
    return res.status(400).json({ message: 'All fields are required' });
  }
  
  try {
    const userExists = await dbGet('SELECT 1 FROM local_users WHERE email = ?', [email]);
    if (userExists) {
      return res.status(400).json({ message: 'User with this email already exists' });
    }
    
    const userId = crypto.randomUUID();
    const salt = bcrypt.genSaltSync(10);
    const password_hash = bcrypt.hashSync(password, salt);
    
    await dbRun(
      'INSERT INTO local_users (id, email, password_hash, role, full_name) VALUES (?, ?, ?, ?, ?)',
      [userId, email, password_hash, role, full_name]
    );
    
    // Create corresponding profile
    // Note notify columns: doctors get them enabled by default
    const isDoctor = role === 'doctor';
    await dbRun(
      'INSERT INTO profiles (id, full_name, email, role, notify_new_visits, notify_new_tests, notify_own_visits_only, notify_own_tests_only) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [userId, full_name, email, role, isDoctor ? 1 : 0, isDoctor ? 1 : 0, 0, 0]
    );
    
    // Generate JWT
    const token = jwt.sign({ id: userId, email, role }, JWT_SECRET, { expiresIn: '7d' });
    const profile = await dbGet('SELECT * FROM profiles WHERE id = ?', [userId]);
    
    res.json({
      session: {
        access_token: token,
        expires_at: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60,
        user: {
          id: userId,
          email,
          user_metadata: { role, full_name }
        }
      },
      user: { id: userId, email, role, full_name },
      profile
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Registration failed: ' + err.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password required' });
  }
  
  try {
    const user = await dbGet('SELECT * FROM local_users WHERE email = ?', [email]);
    if (!user) {
      return res.status(400).json({ message: 'Invalid email or password' });
    }
    
    const valid = bcrypt.compareSync(password, user.password_hash);
    if (!valid) {
      return res.status(400).json({ message: 'Invalid email or password' });
    }
    
    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    const profile = await dbGet('SELECT * FROM profiles WHERE id = ?', [user.id]);
    
    res.json({
      session: {
        access_token: token,
        expires_at: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60,
        user: {
          id: user.id,
          email: user.email,
          user_metadata: { role: user.role, full_name: user.full_name }
        }
      },
      user: { id: user.id, email: user.email, role: user.role, full_name: user.full_name },
      profile
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Login failed: ' + err.message });
  }
});

// Dynamic Query compiler endpoints
app.post('/api/query', async (req, res) => {
  const { action, table, select, countOption, filters, orderCol, orderDesc, limitVal, isSingle, isMaybeSingle, data } = req.body;
  
  if (!table) return res.status(400).json({ message: 'Table is required' });
  
  // Basic validation of table name to prevent SQL injection
  if (!/^[a-zA-Z0-9_]+$/.test(table)) {
    return res.status(400).json({ message: 'Invalid table name' });
  }
  
  try {
    if (action === 'select') {
      // Build SQL WHERE clause
      let whereClause = '';
      const params = [];
      
      if (filters && filters.length > 0) {
        const conds = [];
        for (const f of filters) {
          if (!/^[a-zA-Z0-9_]+$/.test(f.column)) continue;
          
          if (f.type === 'eq') {
            conds.push(`${f.column} = ?`);
            params.push(f.value);
          } else if (f.type === 'neq') {
            conds.push(`${f.column} != ?`);
            params.push(f.value);
          } else if (f.type === 'gt') {
            conds.push(`${f.column} > ?`);
            params.push(f.value);
          } else if (f.type === 'gte') {
            conds.push(`${f.column} >= ?`);
            params.push(f.value);
          } else if (f.type === 'lt') {
            conds.push(`${f.column} < ?`);
            params.push(f.value);
          } else if (f.type === 'lte') {
            conds.push(`${f.column} <= ?`);
            params.push(f.value);
          } else if (f.type === 'like') {
            conds.push(`${f.column} LIKE ?`);
            params.push(f.value);
          } else if (f.type === 'ilike') {
            conds.push(`LOWER(${f.column}) LIKE LOWER(?)`);
            params.push(f.value);
          } else if (f.type === 'in') {
            const placeholders = f.value.map(() => '?').join(', ');
            conds.push(`${f.column} IN (${placeholders})`);
            params.push(...f.value);
          }
        }
        if (conds.length > 0) {
          whereClause = 'WHERE ' + conds.join(' AND ');
        }
      }
      
      // Calculate count if required
      let count = null;
      if (countOption === 'exact') {
        const countSql = `SELECT COUNT(*) as count FROM ${table} ${whereClause}`;
        const countRes = await dbGet(countSql, params);
        count = countRes ? countRes.count : 0;
      }
      
      // Parse columns (e.g. *, name, phone)
      let columns = '*';
      if (select && select !== '*') {
        // Strip out parenthesized nested select queries for SQLite (handled in post-processing relation resolver)
        // e.g. "id, created_at, patients(name)" -> "id, created_at"
        // Let's strip any relationship nested blocks from the SQL projection
        const cleanSelect = select.replace(/[a-zA-Z0-9_!]+\([^)]*\)/g, '').split(',')
          .map(c => c.trim())
          .filter(c => c && c !== '*' && !c.includes('('))
          .join(', ');
          
        if (cleanSelect) {
          columns = cleanSelect;
        }
      }
      
      let querySql = `SELECT ${columns} FROM ${table} ${whereClause}`;
      
      if (orderCol && /^[a-zA-Z0-9_]+$/.test(orderCol)) {
        querySql += ` ORDER BY ${orderCol} ${orderDesc ? 'DESC' : 'ASC'}`;
      }
      
      if (limitVal !== null && limitVal !== undefined) {
        querySql += ` LIMIT ${Number(limitVal)}`;
      }
      
      let rows = await dbAll(querySql, params);
      
      // Post-process rows to resolve nested Supabase relations
      if (select && select.includes('(')) {
        rows = await resolveRelations(table, rows, select);
      }
      
      if (isSingle || isMaybeSingle) {
        return res.json({ data: rows[0] || null, error: null, count });
      }
      return res.json({ data: rows, error: null, count });
      
    } else if (action === 'insert') {
      if (!data) return res.status(400).json({ message: 'No data to insert' });
      
      let insertedRecords = [];
      const recordsToInsert = Array.isArray(data) ? data : [data];
      
      for (const item of recordsToInsert) {
        if (!item.id && table !== 'hospital_settings') {
          item.id = crypto.randomUUID();
        }
        
        // Remove nested/relationship fields that don't exist in SQL database schema
        const itemCopy = { ...item };
        for (const key of Object.keys(itemCopy)) {
          if (typeof itemCopy[key] === 'object' && itemCopy[key] !== null) {
            delete itemCopy[key];
          }
        }
        
        const cols = Object.keys(itemCopy).join(', ');
        const placeholders = Object.keys(itemCopy).map(() => '?').join(', ');
        const sql = `INSERT INTO ${table} (${cols}) VALUES (${placeholders})`;
        const params = Object.values(itemCopy);
        
        const result = await dbRun(sql, params);
        
        // Fetch newly inserted record
        const record = await dbGet(`SELECT * FROM ${table} WHERE rowid = ?`, [result.lastID]);
        
        // Trigger notification logic if needed
        if (table === 'visits') {
          await triggerNewVisitNotification(record);
        } else if (table === 'bills') {
          await triggerNewBillNotification(record);
        }
        
        broadcastEvent(table, 'INSERT', record);
        insertedRecords.push(record);
      }
      
      return res.json({
        data: Array.isArray(data) ? insertedRecords : insertedRecords[0],
        error: null
      });
      
    } else if (action === 'update') {
      if (!data) return res.status(400).json({ message: 'No data to update' });
      
      let whereClause = '';
      const params = [];
      
      // Remove nested/relationship fields that don't exist in SQL database schema
      const dataCopy = { ...data };
      for (const key of Object.keys(dataCopy)) {
        if (typeof dataCopy[key] === 'object' && dataCopy[key] !== null) {
          delete dataCopy[key];
        }
      }
      
      // Build set clause
      const setFields = [];
      const setValues = [];
      for (const [col, val] of Object.entries(dataCopy)) {
        if (!/^[a-zA-Z0-9_]+$/.test(col)) continue;
        setFields.push(`${col} = ?`);
        setValues.push(val);
      }
      
      if (setFields.length === 0) {
        return res.status(400).json({ message: 'No fields to update' });
      }
      
      if (filters && filters.length > 0) {
        const conds = [];
        for (const f of filters) {
          if (!/^[a-zA-Z0-9_]+$/.test(f.column)) continue;
          if (f.type === 'eq') {
            conds.push(`${f.column} = ?`);
            params.push(f.value);
          } else if (f.type === 'neq') {
            conds.push(`${f.column} != ?`);
            params.push(f.value);
          } else if (f.type === 'in') {
            const placeholders = f.value.map(() => '?').join(', ');
            conds.push(`${f.column} IN (${placeholders})`);
            params.push(...f.value);
          }
        }
        if (conds.length > 0) {
          whereClause = 'WHERE ' + conds.join(' AND ');
        }
      }
      
      // Select records before update so we can broadcast with their details
      const beforeRecords = await dbAll(`SELECT * FROM ${table} ${whereClause}`, params);
      
      const sql = `UPDATE ${table} SET ${setFields.join(', ')} ${whereClause}`;
      await dbRun(sql, [...setValues, ...params]);
      
      // Fetch updated records
      const updatedRecords = await dbAll(`SELECT * FROM ${table} ${whereClause}`, params);
      
      for (let i = 0; i < updatedRecords.length; i++) {
        broadcastEvent(table, 'UPDATE', updatedRecords[i], beforeRecords[i]);
      }
      
      return res.json({
        data: isSingle || isMaybeSingle ? (updatedRecords[0] || null) : updatedRecords,
        error: null
      });
      
    } else if (action === 'delete') {
      let whereClause = '';
      const params = [];
      
      if (filters && filters.length > 0) {
        const conds = [];
        for (const f of filters) {
          if (!/^[a-zA-Z0-9_]+$/.test(f.column)) continue;
          if (f.type === 'eq') {
            conds.push(`${f.column} = ?`);
            params.push(f.value);
          }
        }
        if (conds.length > 0) {
          whereClause = 'WHERE ' + conds.join(' AND ');
        }
      }
      
      const deletedRecords = await dbAll(`SELECT * FROM ${table} ${whereClause}`, params);
      
      const sql = `DELETE FROM ${table} ${whereClause}`;
      await dbRun(sql, params);
      
      for (const rec of deletedRecords) {
        broadcastEvent(table, 'DELETE', rec);
      }
      
      return res.json({
        data: deletedRecords,
        error: null
      });
    }
    
    res.status(400).json({ message: 'Action not supported' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
});

// Post-process nested tables logic
async function resolveRelations(table, rows, selectStr) {
  if (!rows || rows.length === 0) return rows;
  const relations = [];
  
  // Extract relations matching standard syntax e.g. table(...) or table!fk(...)
  if (selectStr.includes('patients')) {
    const match = selectStr.match(/patients\(([^)]+)\)/) || selectStr.match(/patients\(\*\)/);
    relations.push({
      key: 'patients',
      table: 'patients',
      fk: 'patient_id',
      subFields: match ? match[1] : '*',
      isMany: false
    });
  }
  
  if (selectStr.includes('profiles!doctor_id')) {
    const match = selectStr.match(/profiles!doctor_id\(([^)]+)\)/);
    relations.push({
      key: 'profiles',
      table: 'profiles',
      fk: 'doctor_id',
      subFields: match ? match[1] : '*',
      isMany: false
    });
  } else if (selectStr.includes('profiles!receptionist_id')) {
    const match = selectStr.match(/profiles!receptionist_id\(([^)]+)\)/);
    relations.push({
      key: 'profiles',
      table: 'profiles',
      fk: 'receptionist_id',
      subFields: match ? match[1] : '*',
      isMany: false
    });
  }
  
  if (selectStr.includes('bill_items')) {
    const match = selectStr.match(/bill_items\(([^)]+)\)/);
    relations.push({
      key: 'bill_items',
      table: 'bill_items',
      fk: 'bill_id',
      subFields: match ? match[1] : '*',
      isMany: true
    });
  }
  
  if (selectStr.includes('doctors_info')) {
    const match = selectStr.match(/doctors_info\(([^)]+)\)/);
    relations.push({
      key: 'doctors_info',
      table: 'doctors_info',
      fk: 'id',
      subFields: match ? match[1] : '*',
      isMany: false
    });
  }
  
  for (const row of rows) {
    for (const rel of relations) {
      if (rel.isMany) {
        const subCols = rel.subFields === '*' ? '*' : rel.subFields;
        const query = `SELECT ${subCols} FROM ${rel.table} WHERE ${rel.fk} = ?`;
        const relatedRows = await dbAll(query, [row.id]);
        row[rel.key] = relatedRows;
      } else {
        const idVal = rel.fk === 'id' ? row.id : row[rel.fk];
        if (idVal) {
          const subCols = rel.subFields === '*' ? '*' : rel.subFields;
          const query = `SELECT ${subCols} FROM ${rel.table} WHERE id = ?`;
          const relatedRow = await dbGet(query, [idVal]);
          row[rel.key] = relatedRow || null;
        } else {
          row[rel.key] = null;
        }
      }
    }
  }
  return rows;
}

// Storage API Router
app.post('/api/storage/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
  const bucket = req.body.bucket || 'branding';
  const filePath = req.body.filePath || `logo-${Date.now()}`;
  
  // Re-write to path matching user structure
  const ext = req.file.filename.split('.').pop();
  const destDir = path.join(storageDir, bucket, path.dirname(filePath));
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }
  
  const destPath = path.join(storageDir, bucket, filePath);
  fs.renameSync(req.file.path, destPath);
  
  res.json({
    path: filePath,
    message: 'File uploaded successfully'
  });
});

// Serve storage files statically
app.use('/api/storage/file/:bucket', (req, res, next) => {
  const bucket = req.params.bucket;
  // Serve files inside storage/:bucket
  const baseBucketDir = path.join(storageDir, bucket);
  express.static(baseBucketDir)(req, res, next);
});

// Serve frontend in production (compiled dist folder)
const distDir = path.join(__dirname, '../dist');
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get('*', (req, res) => {
    // Exclude API requests
    if (req.path.startsWith('/api/') || req.path.startsWith('/ws')) {
      return res.status(404).json({ message: 'Not found' });
    }
    res.sendFile(path.join(distDir, 'index.html'));
  });
}

// Start local server
initDb()
  .then(() => {
    console.log('Local SQLite Database initialized.');
    server.listen(PORT, () => {
      console.log(`Smart Hospital local server running on port ${PORT}`);
      console.log(`Offline LAN address: http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Failed to initialize local database:', err);
  });
