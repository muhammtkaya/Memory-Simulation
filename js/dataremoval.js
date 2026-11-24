// ============================================================
// Modül 6: VERİ SİLME & KALINTI (Data Remanence)
// "Silme" sadece sektörü boş işaretler; veri üzerine yazılana dek kalır.
// Adli kurtarma, güvenli silme (zero-fill) gösterilir.
// ============================================================
(function () {
  const COLS = 10, ROWS = 4, N = COLS * ROWS;
  let sectors, nextFile, logLines;
  const FILES = [
    { name: 'gizli.txt', color: '#4ea1ff', size: 6 },
    { name: 'foto.jpg', color: '#7ee787', size: 8 },
    { name: 'sifreler.db', color: '#ffb454', size: 5 },
  ];

  function reset() {
    sectors = Array.from({ length: N }, () => ({ state: 'empty', data: null, file: null, color: null }));
    nextFile = 0; logLines = [];
  }
  reset();
  function log(msg, kind) { logLines.unshift({ msg, kind }); if (logLines.length > 30) logLines.pop(); }
  const rndByte = () => Math.floor(Math.random() * 256).toString(16).padStart(2, '0').toUpperCase();

  function writeFile() {
    const f = FILES[nextFile % FILES.length]; nextFile++;
    // önce boş, sonra silinmiş (üzerine yaz!) sektörleri kullan
    let need = f.size, usedDeleted = 0;
    const order = [];
    sectors.forEach((s, i) => { if (s.state === 'empty') order.push(i); });
    sectors.forEach((s, i) => { if (s.state === 'deleted') order.push(i); });
    for (const i of order) {
      if (need <= 0) break;
      if (sectors[i].state === 'deleted') usedDeleted++;
      sectors[i] = { state: 'used', data: rndByte(), file: f.name, color: f.color };
      need--;
    }
    if (need > 0) { log(`Yer yetmedi: "${f.name}" için ${need} sektör eksik. Önce bir şey sil veya güvenli sil.`, 'warn'); }
    else {
      log(`"${f.name}" yazıldı (${f.size} sektör).` + (usedDeleted ? ` ${usedDeleted} adet SİLİNMİŞ sektörün üzerine yazıldı → oradaki eski veri artık GERİ GELMEZ.` : ''), 'ok');
    }
    renderAll();
  }

  function deleteFile() {
    // en son yazılan dosyayı sil
    const names = [...new Set(sectors.filter(s => s.state === 'used').map(s => s.file))];
    if (!names.length) { log('Silinecek dosya yok.', 'warn'); return; }
    const name = names[names.length - 1];
    let cnt = 0;
    sectors.forEach(s => { if (s.state === 'used' && s.file === name) { s.state = 'deleted'; cnt++; } });
    log(`"${name}" SİLİNDİ: ${cnt} sektör "boş" işaretlendi. DİKKAT: veri baytları hâlâ diskte duruyor (sadece dizin kaydı kaldırıldı).`, 'del');
    renderAll();
  }

  function recover() {
    const recoverable = sectors.filter(s => s.state === 'deleted' && s.data !== null && s.data !== '00');
    const byFile = {};
    recoverable.forEach(s => { byFile[s.file] = (byFile[s.file] || 0) + 1; });
    if (!recoverable.length) { log('🔍 Adli tarama: kurtarılabilir veri YOK (ya hiç silinmedi ya da üzerine yazıldı / güvenli silindi).', 'ok'); }
    else {
      const parts = Object.entries(byFile).map(([f, c]) => `${f} (${c} sektör)`).join(', ');
      log(`🔍 Adli tarama: SİLİNMİŞ ama hâlâ okunabilir veri bulundu → ${parts}. Bu veri kurtarma yazılımıyla geri getirilebilir!`, 'del');
    }
    // vurgula
    sectors.forEach(s => s.flash = (s.state === 'deleted' && s.data && s.data !== '00'));
    renderAll();
    setTimeout(() => { sectors.forEach(s => s.flash = false); renderAll(); }, 1500);
  }

  function secureWipe() {
    let cnt = 0;
    sectors.forEach(s => { if (s.state === 'deleted') { s.data = '00'; s.file = null; s.color = null; s.state = 'empty'; cnt++; } });
    log(`🧹 Güvenli silme (zero-fill): ${cnt} silinmiş sektörün üzerine 0 yazıldı. Artık o veriler GERÇEKTEN gitti.`, 'ok');
    renderAll();
  }

  function render(container) {
    container.appendChild(tricky(
      '"Sildim, gitti" yanlıştır',
      'Bir dosyayı silmek, verinin kendisini değil <b>dizin (index) kaydını</b> siler — sektörler "boş" işaretlenir ama baytlar yerinde durur. ' +
      'Üzerine yeni veri yazılana kadar <b>kurtarılabilir</b> (adli bilişimin temeli). Ayrıca RAM\'de <span class="mono">free()</span> edilen bellek de sıfırlanmaz — ' +
      'ilklenmeden kullanılırsa eski veri sızabilir. SSD\'lerde wear-leveling yüzünden güvenli silme daha da zordur (TRIM gerekir).'
    ));

    const controls = h('div', { class: 'panel' }, [
      h('h3', null, 'Disk işlemleri'),
      h('div', { class: 'row' }, [
        h('button', { class: 'btn', onclick: writeFile }, 'Dosya yaz'),
        h('button', { class: 'btn ghost', onclick: deleteFile }, 'Son dosyayı sil'),
        h('button', { class: 'btn danger', onclick: recover }, '🔍 Adli kurtarma taraması'),
        h('button', { class: 'btn warn', onclick: secureWipe }, '🧹 Güvenli sil (zero-fill)'),
        h('button', { class: 'btn ghost', onclick: () => { reset(); renderAll(); } }, 'Diski sıfırla'),
      ]),
      h('p', { style: 'color:var(--muted);font-size:13px;margin:10px 0 0' },
        'Dene: birkaç dosya yaz → birini sil → "adli kurtarma" çalıştır (veri hâlâ orada!) → yeni dosya yaz (üzerine yazılır) → tekrar tara (artık yok).'),
    ]);

    const diskP = h('div', { class: 'panel' }, [h('h3', null, 'Disk sektörleri'), h('div', { id: 'drDisk' }), h('div', { id: 'drLegend', style: 'margin-top:12px' })]);
    const logP = h('div', { class: 'panel' }, [h('h3', null, 'Günlük'), h('div', { class: 'log', id: 'drLog' })]);
    container.append(controls, diskP, logP);
    renderAll();
  }

  function renderDisk() {
    const wrap = document.getElementById('drDisk'); if (!wrap) return; wrap.innerHTML = '';
    const grid = h('div', { style: `display:grid;grid-template-columns:repeat(${COLS},1fr);gap:5px` });
    sectors.forEach(s => {
      let bg = 'var(--bg)', border = 'var(--line)', txt = '', color = 'var(--muted)';
      if (s.state === 'used') { bg = 'rgba(78,161,255,.14)'; border = s.color || 'var(--accent)'; txt = s.data; color = 'var(--text)'; }
      else if (s.state === 'deleted') { bg = 'rgba(255,107,107,.10)'; border = '#5a2a2a'; txt = s.data; color = 'var(--danger)'; }
      if (s.flash) { bg = 'rgba(255,107,107,.4)'; border = 'var(--danger)'; }
      grid.appendChild(h('div', {
        class: 'mono',
        style: `border:1px solid ${border};background:${bg};color:${color};border-radius:6px;padding:8px 0;text-align:center;font-size:12px;transition:.3s`,
        title: s.state === 'deleted' ? 'SİLİNMİŞ ama veri duruyor: ' + s.data : (s.file || 'boş'),
      }, txt || '··'));
    });
    wrap.appendChild(grid);
    const used = sectors.filter(s => s.state === 'used').length;
    const del = sectors.filter(s => s.state === 'deleted').length;
    document.getElementById('drLegend').innerHTML = '';
    document.getElementById('drLegend').appendChild(h('div', { class: 'stat' }, [
      h('div', { class: 's' }, [h('b', { style: 'color:var(--accent)' }, used), h('span', null, 'dolu sektör')]),
      h('div', { class: 's' }, [h('b', { style: 'color:var(--danger)' }, del), h('span', null, 'silinmiş (veri hâlâ kurtarılabilir!)')]),
      h('div', { class: 's' }, [h('b', { style: 'color:var(--muted)' }, N - used - del), h('span', null, 'gerçekten boş')]),
    ]));
  }

  function renderLog() {
    const wrap = document.getElementById('drLog'); if (!wrap) return; wrap.innerHTML = '';
    if (!logLines.length) { wrap.appendChild(h('div', { class: 'line', style: 'color:var(--muted)' }, 'Henüz işlem yok.')); return; }
    logLines.forEach(e => {
      const color = e.kind === 'del' ? 'var(--danger)' : e.kind === 'warn' ? 'var(--warn)' : 'var(--text)';
      wrap.appendChild(h('div', { class: 'line', style: 'color:' + color }, e.msg));
    });
  }

  function renderAll() { renderDisk(); renderLog(); }

  window.Modules.dataremoval = {
    title: '6 · Veri Silme & Kalıntı (Data Remanence)',
    desc: 'Silmek veriyi yok etmez, sadece yerini "boş" işaretler. Dosya yaz, sil, adli kurtarma taraması yap ve verinin hâlâ orada olduğunu gör; ' +
      'üzerine yazınca veya güvenli silince nasıl gerçekten gittiğini izle.',
    render,
  };
})();
