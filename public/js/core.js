// core.js — gjendja e përbashkët, navigimi (me history/back), boot-i, header-i
const $ = id => document.getElementById(id);
let pollTimer = null, prog = null, une = null, curStep = 0, curNav = 'dashboard';

const STEPS = [
  { key:'llogaria',   label:'Llogaria' },
  { key:'pershkrimi', label:'Përshkrimi' },
  { key:'lidhja',     label:'Lidhja' },
  { key:'reklama',    label:'Reklama' }
];
const NAV = [
  { k:'dashboard', l:'Dashboard' },
  { k:'reklamat',  l:'Krijimet e reklamave' },
  { k:'analytics', l:'Analytics' }
];

function showView(v){ ['hero','wizard','profile'].forEach(x=>$('v-'+x).classList.toggle('on', x===v)); }

async function refreshProg(){
  try { prog = await (await fetch('/api/progres')).json(); }
  catch(e){ prog = { llogaria:true, pershkrimi:false, lidhja:false, reklama:false }; }
}
function nextIncomplete(){ for(let i=0;i<STEPS.length;i++){ if(!prog[STEPS[i].key]) return i; } return STEPS.length; }

// ---------- HEADER (i loguar) ----------
function setHeaderLoggedIn(){
  $('hdrLeft').innerHTML='';
  $('hdrRight').innerHTML=
    '<div class="menu"><button class="btn" onclick="toggleMenu(event)">Profili ▾</button>'+
    '<div id="menuBox" class="menuBox hide">'+
      '<button onclick="goProfile()">Profili im</button>'+
      '<button onclick="dil()">Log out</button>'+
    '</div></div>';
}
function toggleMenu(e){ e.stopPropagation(); const m=$('menuBox'); if(m) m.classList.toggle('hide'); }
document.addEventListener('click', ()=>{ const m=$('menuBox'); if(m) m.classList.add('hide'); });
function goProfile(){ nav({v:'profile'}); }

async function loadMe(){
  let r; try{ r=await fetch('/api/une'); }catch(e){ une=null; return false; }
  if(!r.ok){ une=null; return false; }
  une=await r.json(); await refreshProg(); setHeaderLoggedIn(); return true;
}

// ---------- NAVIGIMI (me shigjetën back të browser-it) ----------
function applyState(s, replace){
  if(!s){ s = une ? {v:'profile'} : {v:'hero'}; }
  if(s.v==='wizard'){ renderWizard(s.step||0); }
  else if(s.v==='profile' && une){ renderProfile(); showView('profile'); }
  else { showView('hero'); }
  if(replace) history.replaceState(s,'');
}
function nav(s){ history.pushState(s,''); applyState(s); }
window.onpopstate = e => applyState(e.state);

async function boot(){
  await loadMe();
  applyState(history.state, true);
}
