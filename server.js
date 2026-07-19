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
const https = require('https');
const http = require('http');

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
  await pool.query(`ALTER TABLE bizneset ADD COLUMN IF NOT EXISTS kandidat_url TEXT`);
  // Analiza AI (kategorizimi + permbledhja per algoritmin)
  await pool.query(`ALTER TABLE bizneset ADD COLUMN IF NOT EXISTS pershkrimi TEXT`);
  await pool.query(`ALTER TABLE bizneset ADD COLUMN IF NOT EXISTS lejo_analize BOOLEAN DEFAULT false`);
  await pool.query(`ALTER TABLE bizneset ADD COLUMN IF NOT EXISTS kategoria_kryesore TEXT`);
  await pool.query(`ALTER TABLE bizneset ADD COLUMN IF NOT EXISTS nenkategorite TEXT`);
  await pool.query(`ALTER TABLE bizneset ADD COLUMN IF NOT EXISTS permbledhje TEXT`);

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
      `SELECT id, emri, email, kategoria, plani, website, celes,
              kategoria_kryesore, nenkategorite, permbledhje, pershkrimi
       FROM bizneset WHERE id=$1`, [req.biznesId]);
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- PROGRESI (cilat hapa jane plotesuar) ---
app.get('/api/progres', iLoguar, async (req, res) => {
  try {
    const b = await pool.query(
      'SELECT permbledhje, pershkrimi, snippet_active FROM bizneset WHERE id=$1', [req.biznesId]);
    const p = await pool.query('SELECT 1 FROM promovimet WHERE biznes_id=$1 AND aktiv=true LIMIT 1', [req.biznesId]);
    const row = b.rows[0] || {};
    res.json({
      llogaria: true,                                   // i loguar => llogaria gati
      pershkrimi: !!(row.permbledhje || row.pershkrimi),// pershkrimi/AI u dha
      lidhja: !!row.snippet_active,                     // snippet-i u lidh
      reklama: p.rows.length > 0                         // reklama u krijua
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- RUAJ PERMBLEDHJEN (klienti editon vetem permbledhjen; kategoria mbetet nga AI) ---
app.post('/api/permbledhje', iLoguar, async (req, res) => {
  const perm = (req.body.permbledhje || '').trim() || null;
  try {
    await pool.query('UPDATE bizneset SET permbledhje=$2 WHERE id=$1', [req.biznesId, perm]);
    res.json({ ok: true });
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

// --- Ndihmes: merr HTML-in e nje faqeje (server-ane, pa varesi shtese) ---
function merrFaqen(url, thellesia = 0) {
  return new Promise((resolve, reject) => {
    if (thellesia > 4) return reject(new Error('shume ridrejtime'));
    const lib = url.startsWith('https') ? https : http;
    const opts = { headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml'
    } };
    const kerkesa = lib.get(url, opts, resp => {
      if ([301,302,303,307,308].includes(resp.statusCode) && resp.headers.location) {
        resp.resume();
        return resolve(merrFaqen(new URL(resp.headers.location, url).toString(), thellesia + 1));
      }
      const status = resp.statusCode;
      let data = '';
      resp.on('data', c => { data += c; if (data.length > 2000000) resp.destroy(); });
      resp.on('end', () => resolve({ status, body: data }));
    });
    kerkesa.on('error', reject);
    kerkesa.setTimeout(8000, () => kerkesa.destroy(new Error('koha skadoi')));
  });
}

// --- VERIFIKO (server-ane): a eshte kodi i vendosur te faqja? (pa vizitore) ---
app.post('/api/verifiko', iLoguar, async (req, res) => {
  try {
    const biz = await pool.query('SELECT celes, website FROM bizneset WHERE id=$1', [req.biznesId]);
    if (!biz.rows.length) return res.status(400).json({ error: 'Biznes i panjohur.' });
    const celes = biz.rows[0].celes;
    let url = (req.body.url || biz.rows[0].website || '').trim();
    if (!url) return res.status(400).json({ error: 'Jep URL-ne e faqes ku e vendose kodin.' });
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url;

    let faqja;
    try { faqja = await merrFaqen(url); }
    catch (e) { return res.json({ found: false, error: "S'u arrit faqja: " + e.message, url }); }

    const found = faqja.body.includes(celes); // celes-i shfaqet te data-key i snippet-it
    if (found) {
      await pool.query(
        `UPDATE bizneset SET snippet_active=true,
           first_seen_at=COALESCE(first_seen_at, now()),
           last_seen_at=now(), origjina=$2 WHERE id=$1`,
        [req.biznesId, url]
      );
      return res.json({ found: true, url });
    }
    // Diagnostike me e qarte kur s'gjendet
    let error;
    if (faqja.status >= 400) {
      error = 'Faqja u përgjigj me status ' + faqja.status + ' — ndoshta është me fjalëkalim ose e paarritshme publikisht.';
    } else {
      error = 'Faqja u arrit (status ' + faqja.status + ') por kodi s\'u gjet aty. Ndoshta tema është draft/e papublikuar, ose kodi s\'u ruajt te kjo faqe.';
    }
    res.json({ found: false, url, status: faqja.status, error });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- KONTROLLO (auto): kontrollon vete faqen e regjistruar, pa vizitore ---
const kontrolliFundit = new Map(); // biznes_id -> timestamp (throttle)
app.get('/api/kontrollo', iLoguar, async (req, res) => {
  try {
    const b = await pool.query(
      'SELECT celes, website, kandidat_url, snippet_active, origjina, last_seen_at FROM bizneset WHERE id=$1', [req.biznesId]);
    if (!b.rows.length) return res.status(400).json({ error: 'Biznes i panjohur.' });
    const row = b.rows[0];
    const lastSeen = row.last_seen_at ? new Date(row.last_seen_at).getTime() : 0;
    const live = lastSeen > 0 && (Date.now() - lastSeen) < DRITARJA_LIVE_MS;

    // Nese eshte tashme i lidhur, kthe statusin (mos e ngarko faqen kot).
    if (row.snippet_active) {
      return res.json({ active: true, live, origjina: row.origjina || null });
    }

    // URL per kontroll: fillimisht ajo qe u kap vete (kandidat), pastaj website-i i regjistruar.
    let url = (row.kandidat_url || row.website || '').trim();
    if (!url) return res.json({ active: false, live: false, siteMissing: true });
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url;

    // Throttle: nje ngarkim faqeje cdo 5s per biznes (edhe nese frontend-i pyet me shpesh).
    const tani = Date.now();
    if (tani - (kontrolliFundit.get(req.biznesId) || 0) >= 5000) {
      kontrolliFundit.set(req.biznesId, tani);
      try {
        const faqja = await merrFaqen(url);
        if (faqja.body.includes(row.celes)) {
          await pool.query(
            `UPDATE bizneset SET snippet_active=true,
               first_seen_at=COALESCE(first_seen_at, now()),
               last_seen_at=now(), origjina=$2 WHERE id=$1`,
            [req.biznesId, url]);
          return res.json({ active: true, live: true, origjina: url });
        }
      } catch (e) { /* faqja s'u arrit — ende pa lidhur */ }
    }
    res.json({ active: false, live: false, url });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- TAG.JS (tag i vogel vetem per LIDHJE — firon nga cdo faqe, s'ka nevoje per slot) ---
app.get('/tag.js', (req, res) => {
  res.type('application/javascript');
  res.send(`(function(){
  var s = document.currentScript;
  var key = s ? s.getAttribute('data-key') : null;
  var base = s ? new URL(s.src).origin : '';
  if(!key) return;
  if(window.Shopify && window.Shopify.designMode) return; // mos numero preview-in e Shopify
  function njofto(){
    try {
      var u = base + '/lidh?key=' + encodeURIComponent(key);
      navigator.sendBeacon ? navigator.sendBeacon(u) : fetch(u, {mode:'no-cors'});
    } catch(e){}
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', njofto);
  else njofto();
})();`);
});

// --- LIDH (sinjali i tag-ut: shenon lidhjen + URL-en, pa lidhje me slot-in) ---
app.get('/lidh', async (req, res) => {
  cors(res);
  const key = req.query.key;
  if (!key) return res.status(204).end();
  try {
    const b = await pool.query('SELECT id, snippet_active FROM bizneset WHERE celes=$1', [key]);
    if (b.rows.length) {
      const bizId = b.rows[0].id;
      const faqja = req.headers.referer || req.headers.origin || null;
      if (!b.rows[0].snippet_active) {
        await pool.query(
          `UPDATE bizneset SET snippet_active=true, first_seen_at=now(), last_seen_at=now(),
             origjina=$2, kandidat_url=COALESCE(kandidat_url,$2) WHERE id=$1`,
          [bizId, faqja]);
      } else {
        await pool.query('UPDATE bizneset SET last_seen_at=now() WHERE id=$1', [bizId]);
      }
    }
  } catch (e) {}
  res.status(204).end();
});

// --- IMYR.JS (gjithcka ne nje rresht: lidhje + hapesire + reklame + gjurmim) ---
app.get('/imyr.js', (req, res) => {
  res.type('application/javascript');
  res.send(`(function(){
  var s = document.currentScript;
  var key = s ? s.getAttribute('data-key') : null;
  var base = s ? new URL(s.src).origin : '';
  if(!key) return;
  var preview = !!(window.Shopify && window.Shopify.designMode);

  // 1) Sinjali i lidhjes (firon nga cdo faqe; jo ne preview)
  if(!preview){
    try { var u = base + '/lidh?key=' + encodeURIComponent(key);
      navigator.sendBeacon ? navigator.sendBeacon(u) : fetch(u,{mode:'no-cors'}); } catch(e){}
  }

  function esc(t){ var d=document.createElement('div'); d.textContent=t; return d.innerHTML; }
  function slotEl(){
    var el = document.getElementById('imyr-slot');
    if(el) return el;
    el = document.createElement('div'); el.id = 'imyr-slot';
    if(s && s.parentNode) s.parentNode.insertBefore(el, s.nextSibling);
    else if(document.body) document.body.appendChild(el);
    return el;
  }
  function run(){
    var slot = slotEl(); if(!slot) return;
    fetch(base + '/ad?key=' + encodeURIComponent(key) + (preview?'&preview=1':''))
      .then(function(r){ return r.json(); })
      .then(function(d){
        if(d && d.teksti){
          slot.innerHTML = '<div style="border:1px solid #e2c68a;background:#fbf6ea;color:#5a4a24;'
            + 'padding:12px 14px;border-radius:10px;font:14px/1.5 system-ui,sans-serif;cursor:pointer;">'
            + esc(d.teksti) + '</div>';
          if(!preview){ try { var v = base + '/track?key=' + encodeURIComponent(key) + '&event=view';
            navigator.sendBeacon ? navigator.sendBeacon(v) : fetch(v); } catch(e){} }
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
    // URL e plote e faqes ku u ngarkua widget-i (per te kontrolluar pikerisht ate faqe, jo vetem homepage-in)
    const faqjaPlote = req.headers.referer || req.headers.origin || null;

    // Kap faqen ku ndodhet kodi (edhe ne preview) — PA e shenuar te lidhur.
    // Ruajme URL-en e plote me te fundit ku u pa widget-i; kjo perdoret per kontrollin server-ane.
    if (faqjaPlote) {
      await pool.query('UPDATE bizneset SET kandidat_url=$2 WHERE id=$1', [bizId, faqjaPlote]);
    }

    // VETEM per kerkesa reale (jo preview i Shopify): sheno lidhjen + heartbeat.
    if (!preview) {
      if (!b.rows[0].snippet_active) {
        // ngarkim real (faqe e ruajtur/live): shenim i lidhjes
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

// --- Ndihmes: pastro HTML-in ne tekst te thjeshte ---
function pastroHtml(html) {
  return (html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Kategorite kryesore (korniza; AI zgjedh SAKTESISHT nje prej tyre)
const KATEGORITE = [
  'Marketing & Growth', 'Sales & CRM', 'Finance & Accounting', 'HR & Recruiting',
  'Productivity & Collaboration', 'Developer Tools & Infrastructure', 'Design & Creative',
  'Customer Support & Success', 'Analytics & Data', 'E-commerce Tools',
  'Security & Compliance', 'AI/ML Tools'
];

// --- ANALIZO (AI): kategori kryesore + nenkategori + permbledhje per algoritmin ---
app.post('/api/analizo', iLoguar, async (req, res) => {
  const pershkrimi = (req.body.pershkrimi || '').trim();
  const lejo = !!req.body.lejo;
  try {
    await pool.query('UPDATE bizneset SET pershkrimi=$2, lejo_analize=$3 WHERE id=$1',
      [req.biznesId, pershkrimi || null, lejo]);

    // nese lejohet, merr tekstin e faqes se biznesit
    let webTekst = '';
    if (lejo) {
      const b = await pool.query('SELECT website FROM bizneset WHERE id=$1', [req.biznesId]);
      let url = (b.rows[0] && b.rows[0].website || '').trim();
      if (url) {
        if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
        try { const f = await merrFaqen(url); webTekst = pastroHtml(f.body).slice(0, 4000); } catch (e) {}
      }
    }

    const key = process.env.OPENAI_API_KEY;
    if (!key) {
      // Pa AI: ruaj pershkrimin, kthe njoftim (kategorizimi behet me vone)
      return res.json({ ok: true, ai: false, note: "AI s'është konfiguruar ende (mungon OPENAI_API_KEY)." });
    }

    const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
    const sys = 'Je analist qe klasifikon biznese SaaS per nje rrjet cross-promotion. Kthe VETEM JSON, pa asnje tekst tjeter.';
    const user =
      'Zgjidh SAKTESISHT nje kategori kryesore nga kjo liste: ' + KATEGORITE.join('; ') + '.\n\n' +
      'Pershkrimi i dhene nga biznesi: ' + (pershkrimi || '(pa pershkrim)') + '\n\n' +
      (webTekst ? ('Teksti i nxjerre nga faqja e biznesit:\n' + webTekst + '\n\n') : '') +
      'Kthe JSON me keto fusha:\n' +
      '{"kategoria_kryesore": string (SAKTESISHT nje nga lista), ' +
      '"nenkategorite": string[] (2-4 nenkategori specifike), ' +
      '"permbledhje": string (1-3 fjali te qarta qe tregojne cfare ofron biznesi dhe audiencen e tij, ' +
      'te shkruara ashtu qe nje algoritem te gjeje me cilat sherbime plotesuese (jo konkurrente) mund te cohet)}';

    let parsed = {};
    try {
      const r = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
        body: JSON.stringify({
          model, temperature: 0, response_format: { type: 'json_object' },
          messages: [{ role: 'system', content: sys }, { role: 'user', content: user }]
        })
      });
      const data = await r.json();
      if (data.error) return res.json({ ok: true, ai: false, note: 'AI: ' + data.error.message });
      parsed = JSON.parse(data.choices[0].message.content);
    } catch (e) {
      return res.json({ ok: true, ai: false, note: 'Analiza AI dështoi: ' + e.message });
    }

    const kk = parsed.kategoria_kryesore || null;
    const nk = Array.isArray(parsed.nenkategorite) ? parsed.nenkategorite.join(', ') : (parsed.nenkategorite || null);
    const perm = parsed.permbledhje || null;

    await pool.query(
      'UPDATE bizneset SET kategoria_kryesore=$2, nenkategorite=$3, permbledhje=$4, kategoria=$2 WHERE id=$1',
      [req.biznesId, kk, nk, perm]);

    res.json({ ok: true, ai: true, kategoria_kryesore: kk, nenkategorite: nk, permbledhje: perm });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- Faqet ---
app.use(express.static(path.join(__dirname, 'public')));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/test', (req, res) => res.sendFile(path.join(__dirname, 'index-test-saas.html')));

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
