(() => {
  const p = new URLSearchParams(location.search), hash = location.hash.slice(1);
  const tab = p.get('tab') || hash;
  if (tab === 'manage') location.replace('admin.html');
  else if (['daily','monthly','dm','photos','yearly'].includes(tab)) location.replace('daily.html?tab='+encodeURIComponent(tab));
  else if (tab === 'music') location.replace('music.html?section=playlist');
  else if (['work','self'].includes(tab)) location.replace(tab+'.html');
  else location.replace('daily.html');
})();
