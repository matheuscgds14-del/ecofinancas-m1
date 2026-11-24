require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = Number(process.env.PORT || 3000);
const SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');
if (!process.env.JWT_SECRET) console.warn('AVISO: JWT_SECRET temporario. Configure .env para manter os logins entre reinicializacoes.');
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '30kb' }));
app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: 'draft-7', legacyHeaders: false }));
app.use(express.static(path.join(__dirname, 'public')));
const dbPath = path.join(__dirname, 'data', 'ecofinancas.sqlite');
let db;
function save() { const tmp = dbPath + '.tmp'; fs.writeFileSync(tmp, Buffer.from(db.export())); fs.renameSync(tmp, dbPath); }
function run(sql, params = []) { db.run(sql, params); save(); }
function all(sql, params = []) { const stmt = db.prepare(sql); stmt.bind(params); const rows = []; while (stmt.step()) rows.push(stmt.getAsObject()); stmt.free(); return rows; }
function one(sql, params = []) { return all(sql, params)[0] || null; }
function auth(req, res, next) { const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, ''); try { req.user = jwt.verify(token, SECRET); next(); } catch { return res.status(401).json({ error: 'Sessão expirada. Entre novamente.' }); } }
function fail(res, msg, status = 400) { return res.status(status).json({ error: msg }); }
function validMoney(v) { return typeof v === 'number' && Number.isFinite(v) && v > 0 && v <= 1e9 && Math.abs(Math.round(v * 100) - v * 100) < 1e-7; }
function validDate(s) { if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false; const d = new Date(s + 'T12:00:00Z'); return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s; }
function validText(v, max = 100) { return typeof v === 'string' && v.trim().length > 0 && v.trim().length <= max; }
app.post('/api/auth/register', (req, res) => { const { name, email, password } = req.body || {}; if (!validText(name, 80) || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 180 || typeof password !== 'string' || password.length < 8 || password.length > 72) return fail(res, 'Informe nome, e-mail válido e senha de 8 a 72 caracteres.'); const normalized = email.trim().toLowerCase(); if (one('SELECT id FROM users WHERE email=?', [normalized])) return fail(res, 'E-mail já cadastrado.', 409); const hash = bcrypt.hashSync(password, 12); run('INSERT INTO users(name,email,password_hash) VALUES(?,?,?)', [name.trim(), normalized, hash]); const u = one('SELECT id,name,email FROM users WHERE email=?', [normalized]); return res.status(201).json({ user: u, token: jwt.sign({ id: u.id }, SECRET, { expiresIn: '12h' }) }); });
app.post('/api/auth/login', (req, res) => { const { email, password } = req.body || {}; const u = typeof email === 'string' ? one('SELECT * FROM users WHERE email=?', [email.trim().toLowerCase()]) : null; if (!u || typeof password !== 'string' || !bcrypt.compareSync(password, u.password_hash)) return fail(res, 'E-mail ou senha incorretos.', 401); res.json({ user: { id: u.id, name: u.name, email: u.email }, token: jwt.sign({ id: u.id }, SECRET, { expiresIn: '12h' }) }); });
app.get('/api/me', auth, (req, res) => { const u = one('SELECT id,name,email FROM users WHERE id=?', [req.user.id]); if (!u) return fail(res, 'Usuário não encontrado.', 401); res.json(u); });
app.get('/api/transactions', auth, (req, res) => { const month = String(req.query.month || ''); if (month && !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return fail(res, 'Mês inválido.'); const params = [req.user.id]; let sql = 'SELECT * FROM transactions WHERE user_id=?'; if (month) { sql += ' AND substr(date,1,7)=?'; params.push(month); } sql += ' ORDER BY date DESC,id DESC'; res.json(all(sql, params)); });
function transactionBody(b) { if (!b || !['income', 'expense'].includes(b.type) || !validMoney(b.amount) || !validText(b.description, 120) || !validText(b.category, 50) || !validDate(b.date)) return null; return [b.type, Math.round(b.amount * 100), b.description.trim(), b.category.trim(), b.date]; }
app.post('/api/transactions', auth, (req, res) => { const v = transactionBody(req.body); if (!v) return fail(res, 'Dados inválidos. Valor positivo com até 2 casas decimais.'); run('INSERT INTO transactions(user_id,type,amount_cents,description,category,date) VALUES(?,?,?,?,?,?)', [req.user.id, v[0], v[1], v[2], v[3], v[4]]); res.status(201).json({ ok: true }); });
app.put('/api/transactions/:id', auth, (req, res) => { const v = transactionBody(req.body); if (!v) return fail(res, 'Dados inválidos.'); if (!one('SELECT id FROM transactions WHERE id=? AND user_id=?', [req.params.id, req.user.id])) return fail(res, 'Lançamento não encontrado.', 404); run('UPDATE transactions SET type=?,amount_cents=?,description=?,category=?,date=? WHERE id=? AND user_id=?', [...v, req.params.id, req.user.id]); res.json({ ok: true }); });
app.delete('/api/transactions/:id', auth, (req, res) => { if (!one('SELECT id FROM transactions WHERE id=? AND user_id=?', [req.params.id, req.user.id])) return fail(res, 'Lançamento não encontrado.', 404); run('DELETE FROM transactions WHERE id=? AND user_id=?', [req.params.id, req.user.id]); res.json({ ok: true }); });
app.get('/api/goals', auth, (req, res) => res.json(all('SELECT * FROM goals WHERE user_id=? ORDER BY id DESC', [req.user.id])));
function goalBody(b) { if (!b || !validText(b.title, 100) || !validMoney(b.target) || typeof b.saved !== 'number' || !Number.isFinite(b.saved) || b.saved < 0 || Math.abs(Math.round(b.saved * 100) - b.saved * 100) > 1e-7 || b.saved > 1e9) return null; return [b.title.trim(), Math.round(b.target * 100), Math.round(b.saved * 100)]; }
app.post('/api/goals', auth, (req, res) => { const v = goalBody(req.body); if (!v) return fail(res, 'Meta inválida.'); run('INSERT INTO goals(user_id,title,target_cents,saved_cents) VALUES(?,?,?,?)', [req.user.id, ...v]); res.status(201).json({ ok: true }); });
app.put('/api/goals/:id', auth, (req, res) => { const v = goalBody(req.body); if (!v) return fail(res, 'Meta inválida.'); if (!one('SELECT id FROM goals WHERE id=? AND user_id=?', [req.params.id, req.user.id])) return fail(res, 'Meta não encontrada.', 404); run('UPDATE goals SET title=?,target_cents=?,saved_cents=? WHERE id=? AND user_id=?', [...v, req.params.id, req.user.id]); res.json({ ok: true }); });
app.delete('/api/goals/:id', auth, (req, res) => { if (!one('SELECT id FROM goals WHERE id=? AND user_id=?', [req.params.id, req.user.id])) return fail(res, 'Meta não encontrada.', 404); run('DELETE FROM goals WHERE id=? AND user_id=?', [req.params.id, req.user.id]); res.json({ ok: true }); });
app.get('/api/summary', auth, (req, res) => { const month = String(req.query.month || ''); if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return fail(res, 'Mês inválido.'); const rows = all('SELECT type,category,amount_cents FROM transactions WHERE user_id=? AND substr(date,1,7)=?', [req.user.id, month]); let income = 0, expense = 0; const categories = {}; for (const r of rows) { if (r.type === 'income') income += r.amount_cents; else { expense += r.amount_cents; categories[r.category] = (categories[r.category] || 0) + r.amount_cents; } } res.json({ income, expense, balance: income - expense, savingsRate: income > 0 ? Math.round((income - expense) / income * 100) : null, categories }); });
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.use((err, req, res, next) => { console.error(err); res.status(500).json({ error: 'Erro interno no servidor.' }); });
(async () => { const SQL = await initSqlJs(); fs.mkdirSync(path.dirname(dbPath), { recursive: true }); db = fs.existsSync(dbPath) ? new SQL.Database(fs.readFileSync(dbPath)) : new SQL.Database(); db.run(`CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL,email TEXT NOT NULL UNIQUE,password_hash TEXT NOT NULL);CREATE TABLE IF NOT EXISTS transactions(id INTEGER PRIMARY KEY AUTOINCREMENT,user_id INTEGER NOT NULL,type TEXT NOT NULL CHECK(type IN ('income','expense')),amount_cents INTEGER NOT NULL,description TEXT NOT NULL,category TEXT NOT NULL,date TEXT NOT NULL,FOREIGN KEY(user_id) REFERENCES users(id));CREATE TABLE IF NOT EXISTS goals(id INTEGER PRIMARY KEY AUTOINCREMENT,user_id INTEGER NOT NULL,title TEXT NOT NULL,target_cents INTEGER NOT NULL,saved_cents INTEGER NOT NULL DEFAULT 0,FOREIGN KEY(user_id) REFERENCES users(id));CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON transactions(user_id,date);`); save(); app.listen(PORT, () => console.log(`EcoFinanças disponível em http://localhost:${PORT}`)); })().catch(e => { console.error(e); process.exit(1); });
