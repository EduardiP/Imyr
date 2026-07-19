// app.js — PAS HYRJES: dashboard/profili + wizard-i me hapa

// ---------- PROFILI / DASHBOARD ----------
function renderProfile(){
  $('p_emri').textContent = une.emri;
  $('p_email').textContent = une.email;
  $('p_kat').textContent = ''; // kategoria s'i tregohet klientit
  renderNav();
  renderMain();
}
function renderNav(){
  const el=$('snav'); el.innerHTML='';
  NAV.forEach(n=>{
    const b=document.createElement('button');
    b.textContent=n.l; if(n.k===curNav) b.className='active';
    b.onclick=()=>{ curNav=n.k; renderNav(); renderMain(); };
    el.appendChild(b);
  });
}
function renderMain(){
  const m=$('mainPanel');
  if(curNav==='dashboard') return mainDashboard(m);
  if(curNav==='reklamat')  return mainReklamat(m);
  if(curNav==='analytics') return mainAnalytics(m);
}
function mainDashboard(m){
  m.innerHTML='<h2 class="h">Hapat e konfigurimit</h2>'+
    '<p class="small" style="margin:2px 0 18px;">Përfundo hapat për ta aktivizuar plotësisht Imyr.</p>'+
    '<div class="vstep" id="vstep" style="max-width:460px;"></div>';
  renderVStep();
}
function mainReklamat(m){
  m.innerHTML='<h2 class="h">Krijimet e reklamave</h2>'+
    '<p class="small" id="rk_txt" style="margin:10px 0 16px;">…</p>'+
    '<button class="btn cta" onclick="openWizard(3)">Krijo / ndrysho reklamën</button>';
  fetch('/api/status').then(r=>r.json()).then(st=>{
    $('rk_txt').textContent = st.teksti ? ('Reklama aktuale: “'+st.teksti+'”') : "Ende s'ke krijuar reklamë.";
  }).catch(()=>{});
}
function mainAnalytics(m){
  m.innerHTML='<h2 class="h">Analytics</h2>'+
    '<p class="small" style="margin-top:10px;">Së shpejti: shikime, klikime dhe konvertime për reklamën tënde.</p>';
}
function renderVStep(){
  const nx=nextIncomplete(), el=$('vstep'); el.innerHTML='';
  STEPS.forEach((s,i)=>{
    const done=prog[s.key], isCur=(i===nx), locked=(i>nx), clickable=done||isCur;
    const d=document.createElement('div');
    d.className='vs'+(done?' done':'')+(isCur?' cur':'')+(locked?' locked':'')+(clickable?' click':'');
    d.innerHTML='<span class="vd">'+(done?'✓':(i+1))+'</span><span class="vl">'+s.label+
      (isCur?' — vazhdo':'')+(locked?' — i kyçur':'')+'</span>';
    if(clickable) d.onclick=()=>openWizard(i);
    el.appendChild(d);
  });
}

// ---------- WIZARD ----------
function startWizard(){ openWizard(une ? nextIncomplete() : 0); }
function closeWizard(){ if(pollTimer){clearInterval(pollTimer);pollTimer=null;} nav({v: une?'profile':'hero'}); }
function openWizard(i){ if(i>=STEPS.length) i=STEPS.length-1; nav({v:'wizard', step:i}); }
function renderWizard(i){
  if(!une) i=0;
  if(i>=STEPS.length) i=STEPS.length-1;
  curStep=i; showView('wizard'); renderHStep(); renderStepBody(i);
}
function renderHStep(){
  $('wizStepN').textContent='Hapi '+(curStep+1)+' nga '+STEPS.length;
  const el=$('hstep'); el.innerHTML='';
  STEPS.forEach((s,i)=>{
    const done=une&&prog[s.key], cur=(i===curStep);
    const d=document.createElement('div');
    d.className='st'+(done?' done':'')+(cur?' cur':'');
    d.innerHTML='<div class="dot">'+(done?'✓':(i+1))+'</div><div class="lbl">'+s.label+'</div>';
    el.appendChild(d);
  });
}
async function advance(){
  await refreshProg(); renderHStep();
  const nx=nextIncomplete();
  if(nx>=STEPS.length){ closeWizard(); return; }
  openWizard(nx);
}
function renderStepBody(i){
  const b=$('wizBody');
  if(i===0) return stepLlogaria(b);
  if(i===1) return stepPershkrimi(b);
  if(i===2) return stepLidhja(b);
  if(i===3) return stepReklama(b);
}

// STEP 0 — Llogaria
function stepLlogaria(b){
  if(une){
    b.innerHTML='<h2 class="h">Llogaria ✓</h2><p class="small">Llogaria u krijua për <b>'+une.emri+'</b>.</p>'+
      '<button class="primary" onclick="openWizard(1)">Vazhdo →</button>';
    return;
  }
  b.innerHTML=
    '<h2 class="h">Krijo llogarinë</h2><p class="small">Fillo me të dhënat bazë.</p>'+
    '<label>Emri i biznesit</label><input id="a_emri" placeholder="Biznesi im">'+
    '<label>Email</label><input id="a_email" type="email" placeholder="email@biznesi.com">'+
    '<label>Fjalëkalimi (min 6)</label><input id="a_pass" type="password" placeholder="••••••">'+
    '<label>Faqja / linku i SaaS-it</label><input id="a_web" placeholder="https://saasi-im.com">'+
    '<button class="primary" id="a_btn" onclick="wizKrijo()">Vazhdo →</button><div class="msg" id="a_msg"></div>';
}
async function wizKrijo(){
  const emri=$('a_emri').value.trim(),email=$('a_email').value.trim(),pass=$('a_pass').value,web=$('a_web').value.trim();
  if(!emri||!email||!pass){ $('a_msg').className='msg err'; $('a_msg').textContent='Plotëso emrin, email-in dhe fjalëkalimin.'; return; }
  if(pass.length<6){ $('a_msg').className='msg err'; $('a_msg').textContent='Fjalëkalimi min 6 shkronja.'; return; }
  $('a_btn').disabled=true;
  try{
    const r=await(await fetch('/api/regjistrohu',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({emri,email,fjalekalimi:pass,website:web})})).json();
    if(r.error){ $('a_msg').className='msg err'; $('a_msg').textContent=r.error; $('a_btn').disabled=false; return; }
    await loadMe();
    await advance();
  }catch(e){ $('a_msg').className='msg err'; $('a_msg').textContent='Gabim: '+e.message; $('a_btn').disabled=false; }
}

// STEP 1 — Përshkrimi (klientit i tregohet vetëm përmbledhja; kategoria caktohet nga AI në sfond)
function stepPershkrimi(b){
  b.innerHTML=
    '<h2 class="h">Përshkruaj biznesin</h2>'+
    '<p class="small">AI e pastron përshkrimin; ti mund ta rregullosh para se të vazhdosh.</p>'+
    '<label>Çfarë ofron biznesi yt?</label>'+
    '<textarea id="d_persh" placeholder="p.sh. Mjet email-marketing për dyqane të vogla online...">'+(une.pershkrimi||'')+'</textarea>'+
    '<label class="chk"><input type="checkbox" id="d_lejo" checked><span>Lejo që linku i SaaS-it të studiohet automatikisht për saktësi më të madhe.</span></label>'+
    '<button class="btn" id="d_btn" onclick="wizAnalizo()">Analizo me AI</button>'+
    '<div class="msg" id="d_msg"></div>'+
    '<div id="d_res" class="hide" style="margin-top:16px;">'+
      '<label>Përmbledhja (e editueshme)</label>'+
      '<textarea id="e_perm"></textarea>'+
      '<button class="primary" id="e_next" onclick="vazhdoPershkrim()">Vazhdo →</button>'+
      '<div class="msg" id="e_msg"></div>'+
    '</div>';
  if(une.permbledhje){ $('d_res').classList.remove('hide'); $('e_perm').value=une.permbledhje; }
}
async function wizAnalizo(){
  const pershkrimi=$('d_persh').value.trim(), lejo=$('d_lejo').checked;
  if(!pershkrimi){ $('d_msg').className='msg err'; $('d_msg').textContent='Shkruaj një përshkrim.'; return; }
  $('d_btn').disabled=true; $('d_msg').className='msg'; $('d_msg').innerHTML='<span class="spin"></span> Imyr po studion biznesin…';
  try{
    const r=await(await fetch('/api/analizo',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({pershkrimi,lejo})})).json();
    $('d_msg').textContent = r.ai ? '' : (r.note||'');
    $('e_perm').value = r.permbledhje || pershkrimi;
    $('d_res').classList.remove('hide');
    une.pershkrimi=pershkrimi;
  }catch(e){ $('d_msg').className='msg err'; $('d_msg').textContent='Gabim: '+e.message; }
  $('d_btn').disabled=false;
}
async function vazhdoPershkrim(){
  $('e_next').disabled=true;
  try{
    const perm=$('e_perm').value.trim();
    await fetch('/api/permbledhje',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({permbledhje:perm})});
    une.permbledhje=perm;
    await advance();
  }catch(e){ $('e_msg').className='msg err'; $('e_msg').textContent='Gabim: '+e.message; $('e_next').disabled=false; }
}

// STEP 2 — Lidhja (përdor connect.js)
function stepLidhja(b){
  b.innerHTML=
    '<h2 class="h">Lidh Imyr-in te faqja jote</h2>'+
    '<p class="small">Kopjo këtë rresht dhe vendose kudo te faqja jote (p.sh. te footer-i).</p>'+
    '<div id="connectWrap"></div>'+
    '<button class="primary hide" id="lidhNext" onclick="openWizard(3)">Vazhdo →</button>';
  window.__onLidhur = ()=>{ renderHStep(); $('lidhNext').classList.remove('hide'); setTimeout(()=>openWizard(3),900); };
  connectUI($('connectWrap'));
  if(prog.lidhja){ $('lidhNext').classList.remove('hide'); }
}

// STEP 3 — Reklama (tekst tani; ngarkim/AI më vonë)
function stepReklama(b){
  b.innerHTML=
    '<h2 class="h">Krijo reklamën</h2>'+
    '<p class="small">Për tani, një reklamë me tekst. Së shpejti: ngarkim imazhi/videoje dhe gjenerim me AI.</p>'+
    '<label>Teksti i reklamës që do të shfaqet te të tjerët</label>'+
    '<textarea id="ad_txt" placeholder="p.sh. Provo mjetin tonë falas për 14 ditë!"></textarea>'+
    '<button class="primary" id="ad_btn" onclick="ruajReklame()">Ruaj reklamën →</button>'+
    '<div class="msg" id="ad_msg"></div>';
}
async function ruajReklame(){
  const t=$('ad_txt').value.trim(); if(!t){ $('ad_msg').className='msg err'; $('ad_msg').textContent='Shkruaj tekstin.'; return; }
  $('ad_btn').disabled=true;
  try{
    const r=await(await fetch('/api/promovimi',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({teksti:t})})).json();
    if(r.error){ $('ad_msg').className='msg err'; $('ad_msg').textContent=r.error; $('ad_btn').disabled=false; return; }
    $('ad_msg').className='msg ok'; $('ad_msg').textContent='U ruajt ✓';
    await refreshProg(); renderHStep(); setTimeout(closeWizard,900);
  }catch(e){ $('ad_msg').className='msg err'; $('ad_msg').textContent='Gabim: '+e.message; $('ad_btn').disabled=false; }
}
