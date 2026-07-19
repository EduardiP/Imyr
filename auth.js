// auth.js — PARA LOGIN: hero, modal-i i login/register
function hapModal(k){ $('modal').classList.remove('hide'); shfaq(k); }
function mbyllModal(){ $('modal').classList.add('hide'); $('msg').textContent=''; }
document.getElementById('modal').addEventListener('click', e=>{ if(e.target.id==='modal') mbyllModal(); });

function shfaq(k){
  $('formHyr').classList.toggle('hide', k!=='hyr');
  $('formReg').classList.toggle('hide', k!=='reg');
  $('tabHyr').classList.toggle('active', k==='hyr');
  $('tabReg').classList.toggle('active', k==='reg');
  $('msg').textContent='';
}
function msg(t,ok){ const m=$('msg'); m.textContent=t; m.className='msg '+(ok?'ok':'err'); }

async function hyr(){
  $('btnHyr').disabled=true;
  try{
    const r=await(await fetch('/api/hyr',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({email:$('h_email').value.trim(),fjalekalimi:$('h_pass').value})})).json();
    if(r.error){ msg(r.error); $('btnHyr').disabled=false; return; }
    mbyllModal(); await loadMe(); nav({v:'profile'});
  }catch(e){ msg('Gabim: '+e.message); }
  $('btnHyr').disabled=false;
}
async function regjistrohu(){
  $('btnReg').disabled=true;
  try{
    const body={emri:$('r_emri').value.trim(),email:$('r_email').value.trim(),fjalekalimi:$('r_pass').value,website:$('r_web').value.trim()};
    const r=await(await fetch('/api/regjistrohu',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})).json();
    if(r.error){ msg(r.error); $('btnReg').disabled=false; return; }
    mbyllModal(); await loadMe(); openWizard(nextIncomplete());
  }catch(e){ msg('Gabim: '+e.message); }
  $('btnReg').disabled=false;
}
async function dil(){ await fetch('/api/dil',{method:'POST'}); location.reload(); }
