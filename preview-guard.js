(() => {
  if (!window.TAESAN_PREVIEW) return;
  const original = window.fetch.bind(window);
  const blocked = (url, method) => url.hostname.endsWith('.supabase.co') && !url.pathname.startsWith('/auth/') && !['GET','HEAD'].includes(method) && !(method === 'POST' && /^\/storage\/v1\/object\/(sign|list)\//.test(url.pathname));
  window.fetch = (input, init = {}) => {
    const request = input instanceof Request ? input : null;
    const url = new URL(request ? request.url : input, location.href);
    const method = (init.method || request?.method || 'GET').toUpperCase();
    if (blocked(url, method)) {
      return Promise.resolve(new Response(JSON.stringify({message:'预览版禁止写入生产数据',code:'PREVIEW_READ_ONLY'}), {status:403,headers:{'Content-Type':'application/json'}}));
    }
    return original(input, init);
  };
  const open = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function(method, url, ...args) {
    if (blocked(new URL(url, location.href), method.toUpperCase())) throw new Error('预览版禁止写入生产数据');
    return open.call(this, method, url, ...args);
  };
  document.addEventListener('DOMContentLoaded', () => {
    const notice = document.createElement('div');
    notice.className = 'preview-notice';
    notice.textContent = 'REVIEW PREVIEW / 生产数据只读';
    document.body.prepend(notice);
  });
})();
