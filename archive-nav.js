document.addEventListener('DOMContentLoaded', () => {
  if (window.TAESAN_WORKSPACE) return;
  const root = document.querySelector('main');
  if (!root) return;
  const header = document.createElement('div');
  header.className = 'archive-nav';
  header.innerHTML = '<a class="archive-brand" href="index.html">TAESAN / PERSONAL ARCHIVE</a><nav aria-label="档案分区"><a href="work.html">WORK</a><a href="self.html">SELF</a><a href="daily.html">DAILY</a><a href="admin.html">管理工作台</a></nav>';
  root.prepend(header);
});
