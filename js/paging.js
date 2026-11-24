// ============================================================
// Modül 3: SAYFA DEĞİŞTİRME ALGORİTMALARI
// FIFO, LRU, Optimal (Belady), Clock (second-chance).
// Referans dizisi üzerinde adım adım fault/hit; Belady anomalisi demosu.
// ============================================================
(function () {
  // Bir algoritmayı tüm referans dizisi üzerinde çalıştırır, adım adım durum döndürür.
  function simulate(algo, refs, nframes) {
    let frames = [];           // içerikteki sayfa no'lar
    const steps = [];
    let faults = 0;
    // FIFO için giriş sırası, Clock için ref bitleri ve pointer
    let fifoQueue = [];
    let clockBits = {}; let clockPtr = 0;
    // LRU için son kullanım
    let lastUsed = {};

    refs.forEach((page, idx) => {
      let fault = false, evicted = null;
      const hit = frames.includes(page);

      if (hit) {
        if (algo === 'LRU') lastUsed[page] = idx;
        if (algo === 'CLOCK') clockBits[page] = 1; // ikinci şans
      } else {
        fault = true; faults++;
        if (frames.length < nframes) {
          frames.push(page);
          fifoQueue.push(page);
          clockBits[page] = 1;
          lastUsed[page] = idx;
        } else {
          // bir kurban seç
          if (algo === 'FIFO') {
            evicted = fifoQueue.shift();
          } else if (algo === 'LRU') {
            evicted = frames.reduce((a, b) => (lastUsed[a] <= lastUsed[b] ? a : b));
          } else if (algo === 'OPT') {
            // gelecekte en geç kullanılacak / hiç kullanılmayacak
            let farthest = -1;
            frames.forEach(f => {
              const next = refs.indexOf(f, idx + 1);
              const dist = next === -1 ? Infinity : next;
              if (dist > farthest) { farthest = dist; evicted = f; }
            });
          } else if (algo === 'CLOCK') {
            // pointer ref biti 0 olanı bulana dek döner; 1'leri 0'a çeker
            const order = frames.slice();
            while (true) {
              const cand = order[clockPtr % order.length];
              if (clockBits[cand] === 0) { evicted = cand; clockPtr = (clockPtr + 1) % order.length; break; }
              clockBits[cand] = 0; clockPtr = (clockPtr + 1) % order.length;
            }
          }
          // kurbanı çıkar, yeni sayfayı koy
          const pos = frames.indexOf(evicted);
          frames[pos] = page;
          if (algo === 'FIFO') fifoQueue.push(page);
          if (algo === 'CLOCK') { delete clockBits[evicted]; clockBits[page] = 1; }
          if (algo === 'LRU') { delete lastUsed[evicted]; lastUsed[page] = idx; }
        }
      }
      steps.push({ page, hit, fault, evicted, frames: frames.slice() });
    });
    return { steps, faults };
  }

  let current = { refs: [3,2,1,0,3,2,4,3,2,1,0,4], nframes: 3, algo: 'FIFO', pos: -1, result: null };

  function run() {
    current.result = simulate(current.algo, current.refs, current.nframes);
    current.pos = current.result.steps.length - 1;
    renderSim();
  }
  function step() {
    if (!current.result) current.result = simulate(current.algo, current.refs, current.nframes);
    if (current.pos < current.result.steps.length - 1) current.pos++;
    renderSim();
  }

  function render(container) {
    container.appendChild(tricky(
      'Belady Anomalisi — daha çok çerçeve, daha çok fault!',
      'Sezgi "RAM artarsa fault azalır" der. Ama <b>FIFO\'da çerçeve sayısını artırmak bazen fault\'u ARTIRIR.</b> ' +
      'Aşağıdaki "Belady demo" düğmesi klasik <span class="mono">1,2,3,4,1,2,5,1,2,3,4,5</span> dizisinde bunu kanıtlar: 3 çerçevede 9, 4 çerçevede 10 fault. ' +
      'LRU ve OPT bu anomaliyi yaşamaz (onlar "stack algoritması"dır).'
    ));

    const controls = h('div', { class: 'panel' }, [
      h('h3', null, 'Ayarlar'),
      h('div', { class: 'row top' }, [
        h('label', { class: 'ctl' }, ['Referans dizisi (virgülle)',
          h('input', { type: 'text', id: 'pgRefs', value: current.refs.join(','), style: 'width:280px' })]),
        h('label', { class: 'ctl' }, ['Çerçeve sayısı',
          h('input', { type: 'number', id: 'pgFrames', value: current.nframes, min: 1, max: 8, style: 'width:80px' })]),
        h('label', { class: 'ctl' }, ['Algoritma',
          h('select', { id: 'pgAlgo' }, [
            h('option', { value: 'FIFO' }, 'FIFO'),
            h('option', { value: 'LRU' }, 'LRU (en az kullanılan)'),
            h('option', { value: 'OPT' }, 'Optimal (Belady, teorik en iyi)'),
            h('option', { value: 'CLOCK' }, 'Clock (second-chance)'),
          ])]),
      ]),
      h('div', { class: 'row', style: 'margin-top:12px' }, [
        h('button', { class: 'btn', onclick: () => { readInputs(); step(); } }, 'Adım →'),
        h('button', { class: 'btn ghost', onclick: () => { readInputs(); run(); } }, 'Tümünü çalıştır'),
        h('button', { class: 'btn ghost', onclick: () => { current.pos = -1; renderSim(); } }, 'Başa sar'),
        h('button', { class: 'btn warn', onclick: beladyDemo }, '🔬 Belady anomalisi demo'),
      ]),
    ]);

    const simP = h('div', { class: 'panel' }, [h('h3', null, 'Simülasyon'), h('div', { id: 'pgSim' })]);
    const cmpP = h('div', { class: 'panel' }, [h('h3', null, 'Algoritma karşılaştırması (aynı dizi & çerçeve)'), h('div', { id: 'pgCmp' })]);
    container.append(controls, simP, cmpP);

    document.getElementById('pgAlgo').value = current.algo;
    renderSim(); renderCmp();
  }

  function readInputs() {
    const refs = document.getElementById('pgRefs').value.split(/[,\s]+/).map(x => parseInt(x, 10)).filter(x => !isNaN(x));
    const nf = Math.max(1, Math.min(8, parseInt(document.getElementById('pgFrames').value, 10) || 3));
    const algo = document.getElementById('pgAlgo').value;
    const changed = refs.join(',') !== current.refs.join(',') || nf !== current.nframes || algo !== current.algo;
    current.refs = refs.length ? refs : current.refs;
    current.nframes = nf; current.algo = algo;
    if (changed) { current.result = null; current.pos = -1; }
    renderCmp();
  }

  function renderSim() {
    const wrap = document.getElementById('pgSim'); if (!wrap) return; wrap.innerHTML = '';
    // referans dizisi şeridi
    const strip = h('div', { class: 'refstr' }, current.refs.map((r, i) =>
      h('div', { class: 'r' + (i === current.pos ? ' cur' : (i < current.pos ? ' done' : '')) }, r)));
    wrap.appendChild(h('div', { class: 'mono', style: 'color:var(--muted);margin-bottom:6px' }, 'Referans dizisi:'));
    wrap.appendChild(strip);

    if (current.pos < 0 || !current.result) {
      wrap.appendChild(h('p', { style: 'color:var(--muted);margin-top:12px' }, '"Adım →" veya "Tümünü çalıştır" ile başla.'));
      return;
    }
    const st = current.result.steps[current.pos];
    // çerçeveler
    const fr = h('div', { class: 'frames', style: 'margin-top:14px' });
    for (let i = 0; i < current.nframes; i++) {
      const pageHere = st.frames[i];
      let cls = 'frame';
      if (pageHere !== undefined) cls += ' in';
      if (st.fault && pageHere === st.page) cls += ' load';
      fr.appendChild(h('div', { class: cls }, pageHere === undefined ? '' : pageHere));
    }
    wrap.appendChild(fr);
    // durum satırı
    const info = h('div', { style: 'margin-top:12px' }, [
      h('span', { class: 'mono' }, `İstenen sayfa: ${st.page}  `),
      st.hit ? h('span', { class: 'tag hit' }, 'HIT') : h('span', { class: 'tag fault' }, 'PAGE FAULT'),
      st.evicted != null ? h('span', { class: 'mono', style: 'color:var(--danger)' }, `  → çıkarılan: ${st.evicted}`) : null,
    ]);
    wrap.appendChild(info);
    const upto = current.result.steps.slice(0, current.pos + 1).filter(s => s.fault).length;
    wrap.appendChild(h('div', { class: 'stat', style: 'margin-top:12px' }, [
      h('div', { class: 's' }, [h('b', { style: 'color:var(--danger)' }, upto), h('span', null, 'buraya kadar fault')]),
      h('div', { class: 's' }, [h('b', null, current.result.faults), h('span', null, 'toplam fault')]),
      h('div', { class: 's' }, [h('b', null, (current.result.faults / current.refs.length * 100).toFixed(0) + '%'), h('span', null, 'fault oranı')]),
    ]));
  }

  function renderCmp() {
    const wrap = document.getElementById('pgCmp'); if (!wrap) return; wrap.innerHTML = '';
    const algos = [['FIFO', 'FIFO'], ['LRU', 'LRU'], ['OPT', 'Optimal'], ['CLOCK', 'Clock']];
    const tbl = h('table', { class: 'info' }, [
      h('tr', null, [h('th', null, 'Algoritma'), h('th', null, 'Page fault'), h('th', null, 'Fault oranı')]),
      ...algos.map(([k, label]) => {
        const r = simulate(k, current.refs, current.nframes);
        return h('tr', null, [h('td', null, label), h('td', { class: 'mono' }, r.faults), h('td', { class: 'mono' }, (r.faults / current.refs.length * 100).toFixed(0) + '%')]);
      }),
    ]);
    wrap.appendChild(tbl);
    wrap.appendChild(h('p', { style: 'color:var(--muted);font-size:13px;margin-top:8px' }, 'Optimal (OPT) her zaman en düşük fault\'u verir ama uygulanamaz (geleceği bilmek gerekir); gerçek sistemler LRU/Clock ile ona yaklaşır.'));
  }

  function beladyDemo() {
    document.getElementById('pgRefs').value = '1,2,3,4,1,2,5,1,2,3,4,5';
    document.getElementById('pgAlgo').value = 'FIFO';
    current.refs = [1,2,3,4,1,2,5,1,2,3,4,5]; current.algo = 'FIFO';
    const f3 = simulate('FIFO', current.refs, 3).faults;
    const f4 = simulate('FIFO', current.refs, 4).faults;
    document.getElementById('pgFrames').value = 3; current.nframes = 3;
    current.result = null; current.pos = -1;
    renderSim(); renderCmp();
    alert(`BELADY ANOMALİSİ (FIFO)\n\nAynı dizi: 1,2,3,4,1,2,5,1,2,3,4,5\n\n3 çerçeve → ${f3} page fault\n4 çerçeve → ${f4} page fault\n\nDaha ÇOK çerçeveye rağmen daha ÇOK fault! Bu, FIFO'nun bir "stack algoritması" olmamasından kaynaklanır. Çerçeve sayısını 3 ve 4 yapıp karşılaştırma tablosundan kendin doğrula.`);
  }

  window.Modules.paging = {
    title: '3 · Sayfa Değiştirme Algoritmaları',
    desc: 'RAM dolduğunda hangi sayfa çıkarılır? FIFO, LRU, Optimal ve Clock algoritmalarını aynı referans dizisinde karşılaştır, ' +
      'adım adım fault/hit izle ve ünlü Belady anomalisini kendi gözünle gör.',
    render,
  };
})();
