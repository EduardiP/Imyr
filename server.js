// Imyr — server (Faza 1 + fillimi i Fazes 2)
// Rrjet cross-promotion per biznese.
// Faza 1: server + databaza + login i sigurt (regjistrim/hyrje).
// Faza 2 (fillim): snippet-i (widget.js), /ad, /track, ruajtja e promovimit, statusi i lidhjes.

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
      celes TEXT UNIQUE                -- celesi unik per snippet-in
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

  // --- Faza 2: kolona shtese per lidhjen/gjurmimin (shtohen vetem nese s'ekzistojne) ---
  await pool.query(`ALTER TABLE bizneset ADD COLUMN IF NOT EXISTS snippet_active BOOLEAN DEFAULT false`);
  await pool.query(`ALTER TABLE bizneset ADD COLUMN IF NOT EXISTS first_seen_at TIMESTAMPTZ`);
  await pool.query(`ALTER TABLE bizneset ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ`);
  await pool.query(`ALTER TABLE bizneset ADD COLUMN IF NOT EXISTS origjina TEXT`);

  // Ngjarjet (shfaqje/klikime) — per gjurmimin
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ngjarjet (
      id SERIAL PRIMARY KEY,
      created_at TIMESTAMPTZ DEFAULT now(),
      biznes_id INT REFERENCES bizneset(id) ON DELETE CASCADE,
      lloji TEXT,        -- 'view' | 'click'
      origjina TEXT
    );
  `);

  console.log('DB gati.');
}

// --- Ndihmes: krijo nje celes unik ---
function beCeles() {
  return 'imyr_' + crypto.randomBytes(12).toString('hex');
}

// --- Ndihmes: CORS per endpoint-et publike (thirren nga dyqane te tjera) ---
function cors(res) {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
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

// --- RUAJ PROMOVIMIN (teksti qe do shfaqet ne snippet) ---
app.post('/api/promovimi', iLoguar, async (req, res) => {
  const teksti = (req.body.teksti || '').trim();
  if (!teksti) return res.status(400).json({ error: 'Shkruaj tekstin e promovimit.' });
  try {
    // per tani: nje promovim aktiv per biznes
    await pool.query('DELETE FROM promovimet WHERE biznes_id=$1', [req.biznesId]);
    await pool.query(
      'INSERT INTO promovimet (biznes_id, teksti, aktiv) VALUES ($1,$2,true)',
      [req.biznesId, teksti]
    );
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- STATUSI (a u lidh snippet-i te dyqani) ---
// Dritarja e "gjalle": nese e kemi pare snippet-in brenda kesaj kohe, quhet aktiv tani.
const DRITARJA_LIVE_MS = 10 * 60 * 1000; // 10 minuta
app.get('/api/status', iLoguar, async (req, res) => {
  try {
    const b = await pool.query(
      'SELECT snippet_active, origjina, last_seen_at FROM bizneset WHERE id=$1', [req.biznesId]);
    const p = await pool.query('SELECT teksti FROM promovimet WHERE biznes_id=$1 ORDER BY id DESC LIMIT 1', [req.biznesId]);
    const row = b.rows[0] || {};
    const lastSeen = row.last_seen_at ? new Date(row.last_seen_at).getTime() : 0;
    const live = lastSeen > 0 && (Date.now() - lastSeen) < DRITARJA_LIVE_MS;
    res.json({
      active: !!row.snippet_active,             // a u lidh ndonjehere (kerkese reale, jo preview)
      live: live,                               // a po e shohim tani (i fresket)
      origjina: row.origjina || null,
      last_seen_at: row.last_seen_at || null,
      teksti: p.rows.length ? p.rows[0].teksti : null
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- WIDGET.JS (snippet-i qe vendoset te dyqani) ---
app.get('/widget.js', (req, res) => {
  res.type('application/javascript');
  res.send(`(function(){
  var s = document.currentScript;
  var key = s ? s.getAttribute('data-key') : null;
  var base = s ? new URL(s.src).origin : '';
  // Preview i Shopify (editori): shfaqe reklamen, por MOS e numero si lidhje reale.
  var preview = !!(window.Shopify && window.Shopify.designMode);
  var pq = preview ? '&preview=1' : '';
  function esc(t){ var d=document.createElement('div'); d.textContent=t; return d.innerHTML; }
  function run(){
    var slot = document.getElementById('imyr-slot');
    if(!slot || !key) return;
    fetch(base + '/ad?key=' + encodeURIComponent(key) + pq)
      .then(function(r){ return r.json(); })
      .then(function(d){
        if(d && d.teksti){
          slot.innerHTML = '<div style="border:1px solid #e2c68a;background:#fbf6ea;color:#5a4a24;'
            + 'padding:12px 14px;border-radius:10px;font:14px/1.5 system-ui,sans-serif;cursor:pointer;">'
            + esc(d.teksti) + '</div>';
          if(!preview){
            try {
              var u = base + '/track?key=' + encodeURIComponent(key) + '&event=view';
              navigator.sendBeacon ? navigator.sendBeacon(u) : fetch(u);
            } catch(e){}
          }
          slot.addEventListener('click', function(){
            if(preview) return;
            try { fetch(base + '/track?key=' + encodeURIComponent(key) + '&event=click'); } catch(e){}
          });
        }
      })
      .catch(function(){});
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
  else run();
})();`);
});

// --- AD (kthen permbajtjen + shenon lidhjen ne kerkesen e pare) ---
app.get('/ad', async (req, res) => {
  cors(res);
  const key = req.query.key;
  if (!key) return res.json({ teksti: null });
  const preview = req.query.preview === '1';
  try {
    const b = await pool.query('SELECT id, snippet_active FROM bizneset WHERE celes=$1', [key]);
    if (!b.rows.length) return res.json({ teksti: null });
    const bizId = b.rows[0].id;
    const origin = req.headers.origin || req.headers.referer || null;

    // VETEM per kerkesa reale (jo preview i Shopify): sheno lidhjen + heartbeat.
    if (!preview) {
      if (!b.rows[0].snippet_active) {
        // kerkesa e pare reale: shenim i lidhjes
        await pool.query(
          'UPDATE bizneset SET snippet_active=true, first_seen_at=now(), last_seen_at=now(), origjina=$2 WHERE id=$1',
          [bizId, origin]
        );
      } else {
        // heartbeat: e pame perseri tani (per statusin "live")
        await pool.query('UPDATE bizneset SET last_seen_at=now() WHERE id=$1', [bizId]);
      }
    }

    // Per tani: shfaq tekstin e vet biznesit (per testim).
    // Me vone: kjo zevendesohet nga selector-i qe zgjedh promovimin e nje biznesi TJETER.
    const p = await pool.query(
      'SELECT teksti FROM promovimet WHERE biznes_id=$1 AND aktiv=true ORDER BY id DESC LIMIT 1', [bizId]);
    res.json({ teksti: p.rows.length ? p.rows[0].teksti : null });
  } catch (e) {
    res.json({ teksti: null });
  }
});

// --- TRACK (shfaqje/klikime) ---
app.get('/track', async (req, res) => {
  cors(res);
  if (req.query.preview === '1') return res.status(204).end(); // injoro preview-in
  const key = req.query.key;
  const lloji = req.query.event === 'click' ? 'click' : 'view';
  try {
    const b = await pool.query('SELECT id FROM bizneset WHERE celes=$1', [key]);
    if (b.rows.length) {
      await pool.query(
        'INSERT INTO ngjarjet (biznes_id, lloji, origjina) VALUES ($1,$2,$3)',
        [b.rows[0].id, lloji, req.headers.origin || req.headers.referer || null]
      );
    }
  } catch (e) {}
  res.status(204).end();
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
