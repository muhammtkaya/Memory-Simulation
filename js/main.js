// Navigasyon: tıklanan modülü content alanına render eder
(function () {
  const content = document.getElementById('content');
  const nav = document.getElementById('nav');

  function show(modName) {
    const mod = window.Modules[modName];
    content.innerHTML = '';
    if (!mod) { content.appendChild(h('p', null, 'Modül bulunamadı: ' + modName)); return; }
    modHeader(mod.title, mod.desc).forEach(n => content.appendChild(n));
    mod.render(content);
    content.scrollTo ? content.scrollTo(0, 0) : null;
    window.scrollTo(0, 0);
  }

  nav.addEventListener('click', e => {
    const btn = e.target.closest('.nav-btn');
    if (!btn) return;
    nav.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    show(btn.dataset.mod);
  });

  // ilk modül
  show('hierarchy');
})();
