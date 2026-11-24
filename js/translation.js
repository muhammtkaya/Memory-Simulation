// ============================================================
// Modül 2: ADRES ÇEVİRME (Sanal -> Fiziksel)
// Sanal adres = [sayfa no | offset]. TLB -> Page Table -> RAM.
// TLB hit/miss, page table valid biti ve page fault gösterilir.
// ============================================================
(function () {
  const CFG = {
    virtBits: 16,       // 64 KB sanal adres uzayı
    pageBits: 12,       // 4 KB sayfa (offset 12 bit)
    frames: 4,          // fiziksel çerçeve sayısı
    tlbSize: 3,
  };
  const PAGES = 1 << (CFG.virtBits - CFG.pageBits); // 16 sayfa

  let pageTable, tlb, framesOwner, nextFrame, logLines, faults, tlbHits, tlbMiss;

  function reset() {
    pageTable = Array.from({ length: PAGES }, () => ({ valid: false, frame: null }));
    tlb = [];            // {page, frame} LRU
    framesOwner = Array(CFG.frames).fill(null); // frame -> page
    nextFrame = 0;
    logLines = []; faults = 0; tlbHits = 0; tlbMiss = 0;
  }
  reset();

  function translate(vaddr) {
    const offset = vaddr & ((1 << CFG.pageBits) - 1);
    const page = vaddr >> CFG.pageBits;
    const steps = [];
    let frame, source;

    // 1) TLB
    const t = tlb.find(e => e.page === page);
    if (t) {
      frame = t.frame; source = 'TLB';
      tlbHits++; tlb.splice(tlb.indexOf(t), 1); tlb.push(t);
      steps.push(['TLB', 'hit', `sayfa ${page} → çerçeve ${frame}`]);
    } else {
      tlbMiss++;
      steps.push(['TLB', 'miss', `sayfa ${page} TLB\'de yok`]);
      // 2) Page Table
      const pte = pageTable[page];
      if (pte.valid) {
        frame = pte.frame; source = 'PageTable';
        steps.push(['PageTable', 'hit', `valid=1 → çerçeve ${frame}`]);
      } else {
        // 3) PAGE FAULT
        faults++; source = 'Fault';
        steps.push(['PageTable', 'fault', `valid=0 → PAGE FAULT, diskten yükle`]);
        frame = allocFrame(page);
        pte.valid = true; pte.frame = frame;
        steps.push(['RAM', 'load', `sayfa ${page} → çerçeve ${frame} yüklendi`]);
      }
      // TLB'ye ekle
      if (tlb.length >= CFG.tlbSize) tlb.shift();
      tlb.push({ page, frame });
    }

    const paddr = (frame << CFG.pageBits) | offset;
    logLines.unshift({ vaddr, page, offset, frame, paddr, source });
    if (logLines.length > 40) logLines.pop();
    return { page, offset, frame, paddr, steps, source };
  }

  function allocFrame(page) {
    // boş çerçeve ara; yoksa FIFO ile çıkar
    let f = framesOwner.indexOf(null);
    if (f === -1) {
      f = nextFrame; nextFrame = (nextFrame + 1) % CFG.frames;
      const victim = framesOwner[f];
      if (victim !== null) {
        pageTable[victim].valid = false; pageTable[victim].frame = null;
        const ti = tlb.findIndex(e => e.page === victim); if (ti >= 0) tlb.splice(ti, 1);
      }
    } else if (f >= nextFrame) {
      // sıralı dolum için işaretçiyi ilerlet
    }
    framesOwner[f] = page;
    return f;
  }

  function render(container) {
    container.appendChild(tricky(
      'Page fault ≠ Segmentation fault',
      'İkisi de "fault" der ama farklıdır: <b>page fault</b> "sayfa RAM\'de yok, diskten getireceğim" demektir (normal, beklenen). ' +
      '<b>Segmentation fault</b> ise "izinsiz/olmayan adrese eriştin" demektir (program çöker). Ayrıca <b>TLB ≠ Page Table ≠ Cache</b>: ' +
      'TLB sadece <i>çeviriyi</i> önbelleğe alır, veriyi değil. TLB miss olsa bile veri RAM\'de olabilir.'
    ));

    const controls = h('div', { class: 'panel' }, [
      h('h3', null, 'Sanal Adres Çevir'),
      h('div', { class: 'row top' }, [
        h('label', { class: 'ctl' }, ['Sanal adres (0x0000–0xFFFF)',
          h('input', { type: 'text', id: 'trAddr', value: '0x1A3C', style: 'width:140px' })]),
        h('button', { class: 'btn', onclick: () => doTranslate() }, 'Çevir'),
        h('button', { class: 'btn ghost', onclick: () => { for (const a of ['0x1A3C', '0x1A50', '0x4002', '0x1A3C']) { document.getElementById('trAddr').value = a; doTranslate(); } } }, 'Demo dizisi'),
        h('button', { class: 'btn warn', onclick: () => { reset(); renderAll(); } }, 'Sıfırla'),
      ]),
      h('p', { class: 'mono', style: 'color:var(--muted);font-size:12px;margin:10px 0 0' },
        `${CFG.virtBits} bit VA = [ ${CFG.virtBits - CFG.pageBits} bit sayfa no | ${CFG.pageBits} bit offset ] · ${CFG.frames} fiziksel çerçeve · TLB ${CFG.tlbSize} giriş`),
    ]);

    const breakdown = h('div', { class: 'panel' }, [h('h3', null, 'Adres ayrıştırma + çeviri adımları'), h('div', { id: 'trSteps' })]);
    const tables = h('div', { class: 'panel' }, [h('h3', null, 'TLB · Page Table · Fiziksel Çerçeveler'), h('div', { class: 'row top', id: 'trTables' })]);
    const statsP = h('div', { class: 'panel' }, [h('h3', null, 'İstatistik'), h('div', { class: 'stat', id: 'trStats' })]);
    const logP = h('div', { class: 'panel' }, [h('h3', null, 'Günlük'), h('div', { class: 'log', id: 'trLog' })]);
    container.append(controls, breakdown, tables, statsP, logP);
    renderAll();
  }

  let last = null;
  function doTranslate() {
    const v = document.getElementById('trAddr').value.trim();
    const vaddr = (v.startsWith('0x') ? parseInt(v, 16) : parseInt(v, 10)) & 0xFFFF;
    if (isNaN(vaddr)) return;
    last = translate(vaddr);
    renderAll();
  }

  function renderSteps() {
    const wrap = document.getElementById('trSteps'); if (!wrap) return; wrap.innerHTML = '';
    if (!last) { wrap.appendChild(h('p', { style: 'color:var(--muted)' }, 'Bir sanal adres çevir.')); return; }
    const bits = last.vaddr.toString(2).padStart(CFG.virtBits, '0');
    const pageBitsStr = bits.slice(0, CFG.virtBits - CFG.pageBits);
    const offBitsStr = bits.slice(CFG.virtBits - CFG.pageBits);
    wrap.appendChild(h('div', { class: 'mono', style: 'font-size:15px;margin-bottom:10px' }, [
      `VA 0x${last.vaddr.toString(16).padStart(4, '0')} = `,
      h('span', { style: 'color:var(--accent)' }, pageBitsStr),
      ' ',
      h('span', { style: 'color:var(--accent2)' }, offBitsStr),
      `  →  sayfa=${last.page}, offset=${last.offset}`,
    ]));
    last.steps.forEach(([stage, kind, msg]) => {
      const cls = kind === 'hit' ? 'hit' : (kind === 'fault' || kind === 'miss' ? (kind === 'fault' ? 'fault' : 'miss') : 'hit');
      wrap.appendChild(h('div', { style: 'margin:4px 0' }, [h('span', { class: 'tag ' + cls }, stage), ' ', h('span', { class: 'mono' }, msg)]));
    });
    wrap.appendChild(h('div', { class: 'mono', style: 'margin-top:10px;font-size:15px;color:var(--accent2)' },
      `Fiziksel adres PA = (çerçeve ${last.frame} << ${CFG.pageBits}) | offset ${last.offset} = 0x${last.paddr.toString(16).padStart(4, '0')}`));
  }

  function renderTables() {
    const wrap = document.getElementById('trTables'); if (!wrap) return; wrap.innerHTML = '';
    // TLB
    const tlbTbl = h('table', { class: 'info' }, [
      h('tr', null, [h('th', null, 'TLB sayfa'), h('th', null, 'çerçeve')]),
      ...(tlb.length ? tlb.slice().reverse().map(e => h('tr', null, [h('td', { class: 'mono' }, e.page), h('td', { class: 'mono' }, e.frame)]))
        : [h('tr', null, [h('td', { colspan: 2, class: 'mono', style: 'color:var(--muted)' }, 'boş')])]),
    ]);
    // Page table (sadece valid olanlar + birkaç)
    const ptRows = pageTable.map((p, i) => ({ i, ...p })).filter(p => p.valid);
    const ptTbl = h('table', { class: 'info' }, [
      h('tr', null, [h('th', null, 'sayfa'), h('th', null, 'valid'), h('th', null, 'çerçeve')]),
      ...(ptRows.length ? ptRows.map(p => h('tr', null, [h('td', { class: 'mono' }, p.i), h('td', { class: 'mono', style: 'color:var(--ok)' }, '1'), h('td', { class: 'mono' }, p.frame)]))
        : [h('tr', null, [h('td', { colspan: 3, class: 'mono', style: 'color:var(--muted)' }, 'henüz resident sayfa yok')])]),
    ]);
    // Frames
    const frTbl = h('table', { class: 'info' }, [
      h('tr', null, [h('th', null, 'çerçeve'), h('th', null, 'içindeki sayfa')]),
      ...framesOwner.map((p, i) => h('tr', null, [h('td', { class: 'mono' }, i), h('td', { class: 'mono' }, p === null ? '—' : 'sayfa ' + p)])),
    ]);
    wrap.append(
      h('div', null, [h('div', { class: 'mono', style: 'color:var(--muted);margin-bottom:6px' }, 'TLB (son erişilen üstte)'), tlbTbl]),
      h('div', null, [h('div', { class: 'mono', style: 'color:var(--muted);margin-bottom:6px' }, 'Page Table (resident)'), ptTbl]),
      h('div', null, [h('div', { class: 'mono', style: 'color:var(--muted);margin-bottom:6px' }, 'Fiziksel RAM'), frTbl]),
    );
  }

  function renderStats() {
    const wrap = document.getElementById('trStats'); if (!wrap) return; wrap.innerHTML = '';
    [['TLB hit', tlbHits, 'var(--ok)'], ['TLB miss', tlbMiss, 'var(--warn)'], ['Page fault', faults, 'var(--danger)']]
      .forEach(([l, v, c]) => wrap.appendChild(h('div', { class: 's' }, [h('b', { style: 'color:' + c }, v), h('span', null, l)])));
  }

  function renderLog() {
    const wrap = document.getElementById('trLog'); if (!wrap) return; wrap.innerHTML = '';
    if (!logLines.length) { wrap.appendChild(h('div', { class: 'line', style: 'color:var(--muted)' }, 'Henüz çeviri yok.')); return; }
    logLines.forEach(e => wrap.appendChild(h('div', { class: 'line mono' },
      `VA 0x${e.vaddr.toString(16).padStart(4, '0')} → sayfa ${e.page} → çerçeve ${e.frame} → PA 0x${e.paddr.toString(16).padStart(4, '0')}  [${e.source}]`)));
  }

  function renderAll() { renderSteps(); renderTables(); renderStats(); renderLog(); }

  window.Modules.translation = {
    title: '2 · Adres Çevirme (Sanal → Fiziksel)',
    desc: 'Her programın gördüğü sanal adres, TLB ve page table üzerinden gerçek fiziksel adrese çevrilir. ' +
      'Sanal adresin sayfa no / offset ayrışmasını, TLB hit/miss\'i ve valid biti 0 olunca oluşan page fault\'u izle.',
    render,
  };
})();
