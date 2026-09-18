(()=>{
  'use strict';

  // Passwords must never be persisted in Web Storage. Authentication is cookie-based.
  try{
    sessionStorage.removeItem('clinical_ops_auth');
    const nativeSet=Storage.prototype.setItem;
    const nativeGet=Storage.prototype.getItem;
    Storage.prototype.setItem=function(key,value){
      if(this===sessionStorage&&key==='clinical_ops_auth')return;
      return nativeSet.call(this,key,value);
    };
    Storage.prototype.getItem=function(key){
      if(this===sessionStorage&&key==='clinical_ops_auth')return '';
      return nativeGet.call(this,key);
    };
  }catch{}

  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  let snapshotTimer=null,authCheckBusy=false,authVerified=false;

  function enhanceLogin(){
    const form=document.querySelector('#loginForm');
    if(!form||form.dataset.enhanced==='1')return;
    authVerified=false;
    form.dataset.enhanced='1';
    const login=form.querySelector('input[name="login"]');
    const initials=form.querySelector('input[name="initials"]');
    if(!login)return;
    const loginLabel=login.closest('label');
    if(loginLabel){loginLabel.classList.add('raw-login-field');loginLabel.hidden=true;}
    const initialsLabel=initials?.closest('label');
    if(initialsLabel){initialsLabel.classList.add('staff-initials-field');initialsLabel.querySelector('small')?.remove();if(initialsLabel.childNodes[0])initialsLabel.childNodes[0].textContent='Your initials ';}

    const tabs=document.createElement('div');
    tabs.className='login-role-tabs';
    tabs.innerHTML='<button type="button" data-role="milana"><b>Milana</b><span>Admin · AI · security audit</span></button><button type="button" data-role="staff"><b>Staff</b><span>Daily operational workspace</span></button>';
    form.insertBefore(tabs,loginLabel||form.querySelector('label'));
    const hint=document.createElement('div');
    hint.className='login-role-hint';
    tabs.after(hint);

    const setRole=role=>{
      const staff=role==='staff';
      login.value=staff?'clinical-ops':'milana';
      tabs.querySelectorAll('button').forEach(b=>b.classList.toggle('active',b.dataset.role===role));
      if(initialsLabel){initialsLabel.hidden=!staff;initials.style.display=staff?'':'none';initials.required=staff;if(!staff)initials.value='';}
      hint.textContent=staff?'Staff must enter their own initials. They are bound to the signed session and audit trail.':'Milana account includes AI/operator and security-audit controls.';
      try{localStorage.setItem('clinical_ops_login_role',role);}catch{}
    };
    tabs.addEventListener('click',e=>{const b=e.target.closest('button[data-role]');if(b)setRole(b.dataset.role);});
    let preferred='milana';try{preferred=localStorage.getItem('clinical_ops_login_role')||'milana';}catch{}
    setRole(preferred==='staff'?'staff':'milana');

    form.addEventListener('submit',e=>{
      if(login.value==='clinical-ops'){
        const value=String(initials?.value||'').trim();
        if(value.length<2){
          e.preventDefault();e.stopImmediatePropagation();
          const error=form.querySelector('#loginError');if(error)error.textContent='Staff initials are required for the security audit.';
          initials?.focus();
        }
      }
    },true);
  }

  async function verifyServerSession(){
    if(authVerified||authCheckBusy||!document.body.className.match(/role-(milana|staff)/))return;
    authCheckBusy=true;
    try{
      const r=await fetch('/api/auth',{credentials:'same-origin',cache:'no-store'}),j=await r.json().catch(()=>({}));
      if(!r.ok||!j.authenticated){
        document.body.className='login-page';
        location.reload();
        return;
      }
      authVerified=true;
    }catch{
      document.body.className='login-page';
      location.reload();
    }finally{authCheckBusy=false;}
  }

  async function injectSecurityAudit(){
    if(!document.body.classList.contains('role-milana'))return;
    const view=document.querySelector('#view');
    if(!view||!view.textContent.includes('Semyon AI Operator')||document.querySelector('#securityAudit'))return;
    const section=document.createElement('section');
    section.id='securityAudit';section.className='card security-audit-card';
    section.innerHTML='<div class="card-head"><div><span class="eyebrow">SECURITY</span><h2>User access audit</h2></div><span class="security-mode">Loading…</span></div><div class="security-audit-list"><div class="empty">Loading sign-in history…</div></div>';
    view.appendChild(section);
    try{
      const r=await fetch('/api/auth?action=audit',{credentials:'same-origin',cache:'no-store'}),j=await r.json();
      const mode=section.querySelector('.security-mode');
      if(mode)mode.textContent=j.securityMode==='test-only-no-db'?'Test mode · no shared DB':j.securityMode==='database-derived'?'DB-secured session':'Secure session';
      const list=section.querySelector('.security-audit-list');
      if(!j.enabled){list.innerHTML='<div class="empty">Connect the OnReza PostgreSQL database to enable persistent access audit.</div>';return;}
      list.innerHTML=(j.events||[]).slice(0,100).map(x=>{
        const when=x.created_at?new Date(x.created_at).toLocaleString():'—';
        const who=x.role==='staff'?`${x.initials||'NO INITIALS'} · Staff`:(x.login||'Milana');
        const tone=x.success?'ok':'fail';
        return `<div class="security-event ${tone}"><span>${esc(when)}</span><strong>${esc(who)}</strong><b>${esc(x.event||'login')}${x.success?'':' failed'}</b><small>${esc((x.user_agent||'').slice(0,90))}</small></div>`;
      }).join('')||'<div class="empty">No access events yet.</div>';
    }catch{
      section.querySelector('.security-audit-list').innerHTML='<div class="empty">Could not load access audit.</div>';
    }
  }

  function ensureSecurityNav(){
    if(!document.body.classList.contains('role-milana'))return;
    const nav=document.querySelector('.sidebar nav');
    if(!nav||nav.querySelector('#securityAuditNav'))return;
    const button=document.createElement('button');
    button.id='securityAuditNav';button.className='nav-item';button.type='button';
    button.innerHTML='<span>⛨</span>Security';
    button.addEventListener('click',()=>{
      document.querySelector('.nav-item[data-page="ai"]')?.click();
      setTimeout(async()=>{await injectSecurityAudit();document.querySelector('#securityAudit')?.scrollIntoView({behavior:'smooth',block:'start'});},120);
    });
    nav.appendChild(button);
  }

  function polishLabels(){
    const btn=document.querySelector('#printLabels');
    if(btn&&btn.textContent!=='Print sheet (A4)')btn.textContent='Print sheet (A4)';
  }

  function scheduleSnapshot(){
    clearTimeout(snapshotTimer);
    snapshotTimer=setTimeout(()=>{
      const publish=document.querySelector('#publishSnapshot');
      if(publish&&!publish.disabled)publish.click();
    },900);
  }

  document.addEventListener('click',e=>{
    const logout=e.target.closest?.('#logoutBtn');
    if(logout){
      e.preventDefault();e.stopImmediatePropagation();
      authVerified=false;
      fetch('/api/auth?action=logout',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:'{}'})
        .catch(()=>{})
        .finally(()=>location.reload());
      return;
    }
    if(e.target.closest?.('[data-apply-import],#applyAllImports'))scheduleSnapshot();
  },true);

  const nativePrint=window.print.bind(window);
  window.print=()=>{
    const root=document.querySelector('#printRoot');
    const labels=root?.querySelector('.print-label');
    if(labels)root.classList.add('label-sheet-print');
    try{return nativePrint();}
    finally{setTimeout(()=>root?.classList.remove('label-sheet-print'),1200);}
  };

  let scheduled=false;
  const refreshEnhancements=()=>{
    if(scheduled)return;scheduled=true;
    requestAnimationFrame(()=>{
      scheduled=false;
      enhanceLogin();
      polishLabels();
      verifyServerSession();
      ensureSecurityNav();
      injectSecurityAudit();
    });
  };
  const observer=new MutationObserver(refreshEnhancements);
  observer.observe(document.documentElement,{childList:true,subtree:true});
  refreshEnhancements();
})();
