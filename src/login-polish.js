function enhanceLogin(){
  const form=document.querySelector('#loginForm');
  if(!form||form.dataset.mobilePolished==='1')return;
  const login=form.elements?.login;
  const initials=form.elements?.initials;
  const label=initials?.closest('label');
  if(!login||!initials||!label)return;

  form.dataset.mobilePolished='1';
  label.classList.add('staff-initials-field');

  const update=()=>{
    const isStaff=String(login.value||'').trim().toLowerCase()==='clinical-ops';
    label.hidden=!isStaff;
    initials.disabled=!isStaff;
    if(!isStaff) initials.value='';
  };

  login.addEventListener('input',update);
  login.addEventListener('change',update);
  update();
}

const observer=new MutationObserver(enhanceLogin);
observer.observe(document.documentElement,{childList:true,subtree:true});
enhanceLogin();
