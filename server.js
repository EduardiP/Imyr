// Imyr — server bazë (Faza 1)
// Rrjet cross-promotion per biznese.
// Faza 1: server + databaza + login i sigurt (regjistrim/hyrje).

const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const cookieParser = require('cookie-parser');
const crypto = require('crypto');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// --- Krijimi i tabelave ---
async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS bizneset (
      id SERIAL PRIMARY KEY,
      created_at TIMESTAMPTZ DEFAULT now(),
      emri TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      fjalekalimi TEXT NOT NULL,       -- i hash-uar (bcrypt)
      kategoria TEXT,                  -- kategoria e biznesit
      plani TEXT DEFAULT 'falas',      -- falas | plan1 | plan2 ...
      website TEXT,                    -- faqja e biznesit
      celes TEXT UNIQUE                -- celesi unik per snippet-in (Faza 2)
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS promovimet (
      id SERIAL PRIMARY KEY,
      created_at TIMESTAMPTZ DEFAULT now(),
      biznes_id INT REFERENCES bizneset(id) ON DELETE CASCADE,
      titulli TEXT,
      teksti TEXT,
      imazh_url TEXT,
      link TEXT,
      aktiv BOOLEAN DEFAULT true
    );
  `);
  // Seanca (per te mbajtur perdoruesin te loguar)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS seancat (
      token TEXT PRIMARY KEY,
      biznes_id INT REFERENCES bizneset(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ DEFAULT now()
    );
  `);
  console.log('DB gati.');
}

// --- Ndihmes: krijo nje celes unik ---
function beCeles() {
  return 'imyr_' + crypto.randomBytes(12).toString('hex');
}

// --- Middleware: kontrollo a eshte i loguar ---
async function iLoguar(req, res, next) {
  const token = req.cookies.imyr_session;
  if (!token) return res.status(401).json({ error: 'Nuk je i loguar.' });
  try {
    const r = await pool.query('SELECT biznes_id FROM seancat WHERE token=$1', [token]);
    if (!r.rows.length) return res.status(401).json({ error: 'Seanca e pavlefshme.' });
    req.biznesId = r.rows[0].biznes_id;
    next();
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

// --- REGJISTRIM ---
app.post('/api/regjistrohu', async (req, res) => {
  const { emri, email, fjalekalimi, kategoria, website } = req.body;
  if (!emri || !email || !fjalekalimi) {
    return res.status(400).json({ error: 'Emri, email dhe fjalekalimi jane te detyrueshem.' });
  }
  if (String(fjalekalimi).length < 6) {
    return res.status(400).json({ error: 'Fjalekalimi duhet te kete te pakten 6 shkronja.' });
  }
  try {
    const hash = await bcrypt.hash(fjalekalimi, 10);
    const celes = beCeles();
    const r = await pool.query(
      `INSERT INTO bizneset (emri, email, fjalekalimi, kategoria, website, celes)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      [emri, email.toLowerCase().trim(), hash, kategoria || null, website || null, celes]
    );
    // krijo seance (login automatik pas regjistrimit)
    const token = crypto.randomBytes(24).toString('hex');
    await pool.query('INSERT INTO seancat (token, biznes_id) VALUES ($1,$2)', [token, r.rows[0].id]);
    res.cookie('imyr_session', token, { httpOnly: true, sameSite: 'lax', maxAge: 30*24*60*60*1000 });
    res.json({ ok: true, biznes_id: r.rows[0].id });
  } catch (e) {
    if (e.code === '23505') return res.status(400).json({ error: 'Ky email eshte i regjistruar tashme.' });
    res.status(500).json({ error: e.message });
  }
});

// --- HYRJE (login) ---
app.post('/api/hyr', async (req, res) => {
  const { email, fjalekalimi } = req.body;
  if (!email || !fjalekalimi) return res.status(400).json({ error: 'Email dhe fjalekalimi jane te detyrueshem.' });
  try {
    const r = await pool.query('SELECT id, fjalekalimi FROM bizneset WHERE email=$1', [email.toLowerCase().trim()]);
    if (!r.rows.length) return res.status(400).json({ error: 'Email ose fjalekalim i gabuar.' });
    const ok = await bcrypt.compare(fjalekalimi, r.rows[0].fjalekalimi);
    if (!ok) return res.status(400).json({ error: 'Email ose fjalekalim i gabuar.' });
    const token = crypto.randomBytes(24).toString('hex');
    await pool.query('INSERT INTO seancat (token, biznes_id) VALUES ($1,$2)', [token, r.rows[0].id]);
    res.cookie('imyr_session', token, { httpOnly: true, sameSite: 'lax', maxAge: 30*24*60*60*1000 });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --- DIL (logout) ---
app.post('/api/dil', async (req, res) => {
  const token = req.cookies.imyr_session;
  if (token) await pool.query('DELETE FROM seancat WHERE token=$1', [token]).catch(()=>{});
  res.clearCookie('imyr_session');
  res.json({ ok: true });
});

// --- INFO IME (kush jam) ---
app.get('/api/une', iLoguar, async (req, res) => {
  try {
    const r = await pool.query(
      'SELECT id, emri, email, kategoria, plani, website, celes FROM bizneset WHERE id=$1', [req.biznesId]);
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- Faqet ---
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

// health check
app.get('/health', (req, res) => res.json({ ok: true, koha: new Date().toISOString() }));

const PORT = process.env.PORT || 3000;
initDB()
  .then(() => app.listen(PORT, () => console.log('Imyr po punon ne portin ' + PORT)))
  .catch(e => {
    console.error('Gabim init DB:', e.message);
    // Nis serverin gjithsesi qe health check te punoje
    app.listen(PORT, () => console.log('Imyr (pa DB) ne portin ' + PORT));
  });
