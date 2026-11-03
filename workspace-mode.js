(() => {
  const requested = new URLSearchParams(location.search).get('workspace') === '1';
  let embedded = false;
  try { embedded = window.parent !== window && new URL(window.parent.location.href).pathname.endsWith('/admin.html'); } catch {}
  window.TAESAN_WORKSPACE = requested && embedded;
  document.documentElement.classList.add(window.TAESAN_WORKSPACE ? 'workspace-view' : 'public-view');
  if(window.TAESAN_WORKSPACE)window.addEventListener('message',event=>{
    if(event.source===window.parent&&event.origin===location.origin&&event.data?.type==='taesan:auth-changed')window.dispatchEvent(new CustomEvent('taesan-auth-changed',{detail:{admin:event.data.admin===true}}));
  });
  if ((requested && !embedded) || (!requested && location.pathname.endsWith('/journey-admin.html'))) {
    const modules = {'daily.html':'daily','tmi.html':'tmi','music.html':'music','thoughts.html':'thoughts','stage.html':'stage','short-videos.html':'shorts','journey-admin.html':'journey'};
    location.replace('admin.html?module=' + (modules[location.pathname.split('/').pop()] || 'daily'));
  }
})();
