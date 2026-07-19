// connect.js — mekanizmi i lidhjes së snippet-it (i ndarë; thirret nga wizard-i dhe kudo tjetër)
function snippetKod(){
  return '<script src="'+location.origin+'/imyr.js" data-key="'+((une&&une.celes)||'')+'"></'+'script>';
}

// Ndërton UI-në e lidhjes brenda një elementi të dhënë (mund të përdoret kudo)
function connectUI(el){
  el.innerHTML=
    '<textarea class="kod" id="kodBox" readonly>'+snippetKod().replace(/</g,'&lt;')+'</textarea>'+
    '<div class="rowbtn"><button class="btn cta" id="cbtn" onclick="kopjo()">Kopjo</button></div>'+
    '<div id="afterCopy" class="hide">'+
      '<div class="small" style="margin-top:12px;">Pasi ta ruash te faqja jote, shkruaj URL-në ku e vendose dhe hape për të konfirmuar lidhjen.</div>'+
      '<label>URL-ja e faqes</label><input id="hapUrl" value="'+(((une&&une.website)||'')).replace(/"/g,"&quot;")+'" placeholder="https://faqja-ime.com">'+
      '<button class="primary" id="hbtn" onclick="hapDheVerifiko()">Hap faqen dhe konfirmo →</button>'+
      '<div class="status wait hide" id="statusLine"></div>'+
    '</div>';
  if(prog && prog.lidhja){
    $('afterCopy').classList.remove('hide');
    $('statusLine').classList.remove('hide'); $('statusLine').textContent='✓ E lidhur.';
  }
}

function kopjo(){
  const t=$('kodBox'); t.select(); t.setSelectionRange(0,99999);
  try{document.execCommand('copy');}catch(e){}
  $('cbtn').textContent='U kopjua ✓'; setTimeout(()=>$('cbtn').textContent='Kopjo',1500);
  $('afterCopy').classList.remove('hide');
}
function hapDheVerifiko(){
  let url=($('hapUrl').value||'').trim(); if(!url){ $('hapUrl').focus(); return; }
  if(!/^https?:\/\//i.test(url)) url='https://'+url;
  window.open(url,'_blank');
  $('statusLine').classList.remove('hide'); $('statusLine').innerHTML='⏳ Po pres sinjalin e lidhjes…';
  startPolling(window.__onLidhur);
}
function startPolling(onLidhur){
  if(pollTimer) clearInterval(pollTimer);
  const tick=async()=>{
    try{
      const st=await(await fetch('/api/kontrollo')).json();
      if(st.active){
        clearInterval(pollTimer); pollTimer=null;
        if($('statusLine')){ $('statusLine').className='status'; $('statusLine').innerHTML='✓ U lidh me sukses!'; }
        await refreshProg();
        if(typeof onLidhur==='function') onLidhur();
      }
    }catch(e){}
  };
  tick(); pollTimer=setInterval(tick,6000);
}
