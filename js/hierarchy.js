// ============================================================
// Modül 1: BELLEK HİYERARŞİSİ
// Bir bellek erişiminin L1 -> L2 -> L3 -> RAM -> Disk zincirinde
// nasıl çözüldüğünü, set-associative cache + LRU + page fault ile,
// gerçekçi gecikme değerleriyle gösterir.
// ============================================================
(function () {
  // --- Yapılandırma (gerçek CPU'lara yakın oranlar) ---
  const CFG = {
    blockSize: 64,     // cache line = 64 bayt (endüstri standardı)
    pageSize: 4096,    // sayfa = 4 KB
    levels: [
      { key: 'L1', name: 'L1 Cache', sets: 2, ways: 2, lat: 1 },    // ~1 ns
      { key: 'L2', name: 'L2 Cache', sets: 4, ways: 2, lat: 4 },    // ~4 ns
      { key: 'L3', name: 'L3 Cache', sets: 4, ways: 4, lat: 14 },   // ~14 ns
    ],
    ramPages: 4, ramLat: 90,       // RAM ~90 ns
    diskLat: 100000,               // SSD page fault ~100 µs = 100000 ns
  };

  // --- Durum ---
  let caches, ram, stats, logLines;

  function reset() {
    caches = {};
    CFG.levels.forEach(l => {
      caches[l.key] = Array.from({ length: l.sets }, () => []); // her set: {block} dizisi (LRU: baş=en eski)
    });
    ram = []; // resident page listesi (LRU: baş=en eski)
    stats = { L1: 0, L2: 0, L3: 0, RAM: 0, FAULT: 0, total: 0, totalLat: 0 };
    logLines = [];
  }
  reset();

  function lvl(key) { return CFG.levels.find(l => l.key === key); }

  // set-associative arama; bulursa LRU günceller
  function cacheHit(key, block) {
    const L = lvl(key); const set = caches[key][block % L.sets];
    const i = set.indexOf(block);
    if (i === -1) return false;
    set.splice(i, 1); set.push(block); // MRU'ya taşı
    return true;
  }
  function cacheInsert(key, block) {
    const L = lvl(key); const set = caches[key][block % L.sets];
    if (set.includes(block)) return;
    if (set.length >= L.ways) set.shift(); // LRU çıkar
    set.push(block);
  }
  function ramHas(page) { return ram.includes(page); }
  function ramInsert(page) {
    if (ram.includes(page)) { ram.splice(ram.indexOf(page), 1); ram.push(page); return; }
    if (ram.length >= CFG.ramPages) ram.shift();
    ram.push(page);
  }

  // --- Erişim mantığı ---
  async function access(addr, ui) {
    const block = Math.floor(addr / CFG.blockSize);
    const page = Math.floor(addr / CFG.pageSize);
    let lat = 0, where = null;

    // Cache seviyelerini sırayla kontrol et
    for (const L of CFG.levels) {
      await ui.highlight(L.key);
      lat += L.lat;
      if (cacheHit(L.key, block)) { where = L.key; break; }
    }

    if (!where) {
      // RAM
      await ui.highlight('RAM');
      lat += CFG.ramLat;
      if (ramHas(page)) {
        where = 'RAM';
        ramInsert(page); // MRU
      } else {
        // PAGE FAULT -> disk
        await ui.highlight('DISK');
        lat += CFG.diskLat;
        where = 'FAULT';
        ramInsert(page); // sayfayı RAM'e yükle
      }
    }

    // Bloğu üst seviyelere getir (inclusive hiyerarşi)
    CFG.levels.forEach(L => cacheInsert(L.key, block));

    // İstatistik
    stats.total++; stats.totalLat += lat;
    if (where === 'FAULT') stats.FAULT++; else stats[where]++;

    const label = where === 'FAULT' ? 'PAGE FAULT (disk)' : where + ' hit';
    logLines.unshift({ addr, block, page, where, lat, label });
    if (logLines.length > 60) logLines.pop();
    ui.renderAll(block);
    return { where, lat };
  }

  // --- Render ---
  function render(container) {
    container.appendChild(tricky(
      'Cache ≠ RAM ≠ Page Table',
      'Üçü üç ayrı mekanizmadır: cache donanımda <i>blokları</i> tutar, RAM sayfaları tutar, page table ise sanal→fiziksel eşlemeyi tutar. ' +
      'Ayrıca <b>veri aşağıdan yukarı taşınır</b>: bir blok L3\'te bulunsa bile otomatik olarak L2 ve L1\'e kopyalanır (inclusive), bir daha ki erişim L1 hit olur — <i>temporal locality</i>. ' +
      'Bitişik adresler aynı 64 baytlık blokta olduğundan ikincisi direkt hit olur — <i>spatial locality</i>.'
    ));

    const controls = h('div', { class: 'panel' }, [
      h('h3', null, 'Bellek Erişimi'),
      h('div', { class: 'row top' }, [
        h('label', { class: 'ctl' }, ['Adres (ondalık veya 0x..)',
          h('input', { type: 'text', id: 'hierAddr', value: '0', style: 'width:140px' })]),
        h('button', { class: 'btn', onclick: () => doAccess() }, 'Eriş'),
        h('button', { class: 'btn ghost', onclick: () => seqAccess() }, 'Ardışık eriş (spatial)'),
        h('button', { class: 'btn ghost', onclick: () => repeatAccess() }, 'Aynı adrese tekrar (temporal)'),
        h('button', { class: 'btn ghost', onclick: () => randomAccess() }, 'Rastgele 8 erişim'),
        h('button', { class: 'btn warn', onclick: () => { reset(); renderAll(); } }, 'Sıfırla'),
      ]),
      h('p', { class: 'mono', style: 'color:var(--muted);font-size:12px;margin:10px 0 0' },
        `blok=${CFG.blockSize}B · sayfa=${CFG.pageSize}B · RAM kapasitesi=${CFG.ramPages} sayfa`),
    ]);

    const hier = h('div', { class: 'panel' }, [h('h3', null, 'Hiyerarşi (erişim bu zincirde aşağı iner)'), h('div', { class: 'hier', id: 'hierLevels' })]);
    const cacheP = h('div', { class: 'panel' }, [h('h3', null, 'Cache içeriği (hücrede tutulan blok numarası)'), h('div', { id: 'hierCaches' })]);
    const statsP = h('div', { class: 'panel' }, [h('h3', null, 'İstatistik'), h('div', { class: 'stat', id: 'hierStats' })]);
    const logP = h('div', { class: 'panel' }, [h('h3', null, 'Erişim günlüğü'), h('div', { class: 'log', id: 'hierLog' })]);

    container.append(controls, hier, cacheP, statsP, logP);
    renderAll();
  }

  // UI yardımcıları
  const ui = {
    async highlight(key) {
      const node = document.querySelector(`#hierLevels .level[data-k="${key}"]`);
      if (!node) return;
      document.querySelectorAll('#hierLevels .level').forEach(n => n.classList.remove('active', 'found'));
      node.classList.add('active');
      await sleep(240);
    },
    renderAll(justBlock) { renderAll(justBlock); },
  };

  function renderLevels(justBlock) {
    const wrap = document.getElementById('hierLevels'); if (!wrap) return;
    wrap.innerHTML = '';
    const maxLat = CFG.diskLat;
    const rows = [
      ...CFG.levels.map(L => ({ k: L.key, name: L.name, lat: L.lat, cap: L.sets * L.ways + ' blok' })),
      { k: 'RAM', name: 'RAM (Ana Bellek)', lat: CFG.ramLat, cap: CFG.ramPages + ' sayfa' },
      { k: 'DISK', name: 'Disk / SSD', lat: CFG.diskLat, cap: '∞ (page fault)' },
    ];
    rows.forEach(r => {
      const bar = h('div', { class: 'lbar' }, [h('span', { style: `width:${Math.min(100, (Math.log10(r.lat + 1) / Math.log10(maxLat + 1)) * 100)}%` })]);
      wrap.appendChild(h('div', { class: 'level', 'data-k': r.k }, [
        h('div', { class: 'lname' }, r.name),
        h('div', { class: 'lmeta', style: 'width:110px' }, r.lat + ' ns'),
        h('div', { class: 'lmeta', style: 'width:110px' }, r.cap),
        bar,
      ]));
    });
  }

  function renderCaches(justBlock) {
    const wrap = document.getElementById('hierCaches'); if (!wrap) return;
    wrap.innerHTML = '';
    CFG.levels.forEach(L => {
      const title = h('div', { class: 'mono', style: 'margin:6px 0;color:var(--muted)' }, `${L.name} — ${L.sets} set × ${L.ways} yol`);
      const grid = h('div', { class: 'cacheview' });
      for (let s = 0; s < L.sets; s++) {
        const set = caches[L.key][s];
        for (let w = 0; w < L.ways; w++) {
          const block = set[w];
          const valid = block !== undefined;
          grid.appendChild(h('div', { class: 'cell' + (valid ? ' valid' : '') + (valid && block === justBlock ? ' justloaded' : '') }, [
            h('small', null, `set${s}`),
            valid ? ('B' + block) : '—',
          ]));
        }
      }
      wrap.append(title, grid);
    });
    // RAM
    wrap.append(
      h('div', { class: 'mono', style: 'margin:10px 0 4px;color:var(--muted)' }, `RAM — resident sayfalar (LRU)`),
      h('div', { class: 'cacheview' }, ram.length
        ? ram.map(p => h('div', { class: 'cell valid' }, ['sayfa', 'P' + p]))
        : [h('div', { class: 'cell' }, '—')])
    );
  }

  function renderStats() {
    const wrap = document.getElementById('hierStats'); if (!wrap) return;
    const amat = stats.total ? (stats.totalLat / stats.total) : 0;
    wrap.innerHTML = '';
    const defs = [
      ['L1', 'L1 hit', 'var(--ok)'], ['L2', 'L2 hit', 'var(--accent)'], ['L3', 'L3 hit', 'var(--accent)'],
      ['RAM', 'RAM hit', 'var(--warn)'], ['FAULT', 'Page fault', 'var(--danger)'],
    ];
    defs.forEach(([k, lbl, c]) => wrap.appendChild(h('div', { class: 's' }, [h('b', { style: 'color:' + c }, stats[k]), h('span', null, lbl)])));
    wrap.appendChild(h('div', { class: 's' }, [h('b', null, stats.total), h('span', null, 'toplam erişim')]));
    wrap.appendChild(h('div', { class: 's' }, [h('b', null, amat.toFixed(1) + ' ns'), h('span', null, 'ort. erişim (AMAT)')]));
  }

  function renderLog() {
    const wrap = document.getElementById('hierLog'); if (!wrap) return;
    wrap.innerHTML = '';
    if (!logLines.length) { wrap.appendChild(h('div', { class: 'line', style: 'color:var(--muted)' }, 'Henüz erişim yok. Yukarıdan bir adres gir.')); return; }
    logLines.forEach(e => {
      const cls = e.where === 'FAULT' ? 'fault' : (e.where === 'L1' || e.where === 'L2' || e.where === 'L3' ? 'hit' : 'miss');
      wrap.appendChild(h('div', { class: 'line' }, [
        h('span', { class: 'mono' }, `addr 0x${e.addr.toString(16).padStart(4, '0')} (blok ${e.block}, sayfa ${e.page})  `),
        h('span', { class: 'tag ' + cls }, e.label),
        h('span', { class: 'mono', style: 'color:var(--muted)' }, `  → ${e.lat} ns`),
      ]));
    });
  }

  function renderAll(justBlock) { renderLevels(); renderCaches(justBlock); renderStats(); renderLog(); }

  // kontrol eylemleri
  function parseAddr(v) { v = (v || '').trim(); if (v.startsWith('0x')) return parseInt(v, 16); return parseInt(v, 10); }
  let busy = false;
  async function doAccess() {
    if (busy) return; const inp = document.getElementById('hierAddr');
    const a = parseAddr(inp.value); if (isNaN(a) || a < 0) { inp.value = '0'; return; }
    busy = true; await access(a, ui); busy = false;
  }
  async function seqAccess() {
    if (busy) return; busy = true;
    let base = parseAddr(document.getElementById('hierAddr').value) || 0;
    for (let i = 0; i < 6; i++) { await access(base + i * 16, ui); await sleep(120); }
    busy = false;
  }
  async function repeatAccess() {
    if (busy) return; busy = true;
    const a = parseAddr(document.getElementById('hierAddr').value) || 0;
    for (let i = 0; i < 3; i++) { await access(a, ui); await sleep(120); }
    busy = false;
  }
  async function randomAccess() {
    if (busy) return; busy = true;
    for (let i = 0; i < 8; i++) { await access(Math.floor(Math.random() * 65536), ui); await sleep(80); }
    busy = false;
  }

  window.Modules.hierarchy = {
    title: '1 · Bellek Hiyerarşisi — veri cache/RAM/disk\'te nasıl tutulur',
    desc: 'Bir adrese erişince CPU önce L1, sonra L2, L3 cache\'e, sonra RAM\'e bakar; yoksa page fault ile diskten getirir. ' +
      'Gerçekçi gecikme değerleriyle (ns) her erişimin nerede çözüldüğünü, blokların yukarı taşınmasını ve yerelliğin (locality) etkisini izle.',
    render,
  };
})();
