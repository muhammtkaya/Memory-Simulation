// ============================================================
// Modül 4: STACK & HEAP
// Fonksiyon çağrısı -> stack frame; malloc/free -> heap blokları.
// Stack overflow, memory leak, dangling pointer, double free gösterilir.
// ============================================================
(function () {
  const MAX_DEPTH = 8;
  let stack, heap, nextBlockId, logLines;

  function reset() {
    stack = [];      // {fn, locals:[{name,val}], blocks:[blockId]}
    heap = [];       // {id, size, freed, lostRef}
    nextBlockId = 1;
    logLines = [];
    // ana fonksiyon
    stack.push({ fn: 'main()', locals: [], blocks: [] });
  }
  reset();

  function log(msg, kind) { logLines.unshift({ msg, kind }); if (logLines.length > 40) logLines.pop(); }

  function callFn() {
    if (stack.length >= MAX_DEPTH) {
      log('💥 STACK OVERFLOW — maksimum çağrı derinliği aşıldı! (sonsuz özyineleme buna yol açar)', 'err');
      return;
    }
    const n = stack.length;
    stack.push({ fn: `func_${n}(int x)`, locals: [{ name: 'x', val: n * 10 }, { name: 'i', val: 0 }], blocks: [] });
    log(`stack: func_${n} çağrıldı → yeni frame üste bindi (derinlik ${stack.length})`, 'ok');
  }

  function returnFn() {
    if (stack.length <= 1) { log('main() zaten en altta, return edilemez', 'warn'); return; }
    const f = stack.pop();
    // bu frame'in referans tuttuğu, free edilmemiş bloklar => pointer kaybolur => LEAK
    f.blocks.forEach(id => {
      const b = heap.find(x => x.id === id);
      if (b && !b.freed) { b.lostRef = true; log(`⚠️ LEAK: blok #${id} free edilmeden ${f.fn} return etti → pointer kayboldu, bellek geri alınamaz`, 'err'); }
    });
    log(`stack: ${f.fn} return etti → frame yığından alındı (derinlik ${stack.length})`, 'ok');
  }

  function mallocBlock() {
    const size = [16, 32, 64, 128][Math.floor(Math.random() * 4)];
    const id = nextBlockId++;
    heap.push({ id, size, freed: false, lostRef: false });
    const top = stack[stack.length - 1];
    top.blocks.push(id);
    top.locals.push({ name: `p${id}`, val: `&heap#${id}` });
    log(`heap: p${id} = malloc(${size}) → blok #${id} ayrıldı; pointer ${top.fn} içinde (stack'te)`, 'ok');
  }

  function freeBlock() {
    const top = stack[stack.length - 1];
    // bu frame'in sahip olduğu en son bloğu free etmeye çalış
    const id = [...top.blocks].reverse().find(bid => { const b = heap.find(x => x.id === bid); return b; });
    if (id == null) { log(`free edilecek blok yok (bu frame bir pointer tutmuyor)`, 'warn'); return; }
    const b = heap.find(x => x.id === id);
    if (b.freed) { log(`💥 DOUBLE FREE: blok #${id} zaten free edilmişti!`, 'err'); return; }
    b.freed = true;
    log(`heap: free(p${id}) → blok #${id} serbest bırakıldı. DİKKAT: içindeki veri HEMEN silinmez (bkz. Modül 6).`, 'ok');
    top.locals.push({ name: `p${id}`, val: `⚠ dangling` });
  }

  function useAfterFree() {
    const freed = heap.find(b => b.freed && !b.lostRef);
    if (!freed) { log('Önce bir blok free et, sonra "kullan" ki dangling pointer hatası görebilesin.', 'warn'); return; }
    log(`💥 USE-AFTER-FREE: free edilmiş blok #${freed.id}\'e erişildi → dangling pointer, tanımsız davranış!`, 'err');
  }

  function render(container) {
    container.appendChild(tricky(
      'Pointer stack\'te, veri heap\'te',
      '<span class="mono">int *p = malloc(64);</span> satırında <b>p stack\'tedir</b> (yerel değişken), ama <b>*p\'nin gösterdiği 64 bayt heap\'tedir</b>. ' +
      'Fonksiyon return edince p (stack frame\'iyle) yok olur; ama heap bloğu <b>free edilmediyse</b> yaşamaya devam eder ve ona ulaşan pointer kalmadığı için <b>memory leak</b> olur. ' +
      'Stack aşağı, heap yukarı büyür; ortada buluşurlarsa taşma olur.'
    ));

    const controls = h('div', { class: 'panel' }, [
      h('h3', null, 'İşlemler'),
      h('div', { class: 'row' }, [
        h('button', { class: 'btn', onclick: () => act(callFn) }, 'Fonksiyon çağır (push frame)'),
        h('button', { class: 'btn ghost', onclick: () => act(returnFn) }, 'Return (pop frame)'),
        h('button', { class: 'btn', style: 'background:var(--accent2);color:#06130a', onclick: () => act(mallocBlock) }, 'malloc() — heap\'ten ayır'),
        h('button', { class: 'btn ghost', onclick: () => act(freeBlock) }, 'free()'),
        h('button', { class: 'btn danger', onclick: () => act(useAfterFree) }, 'Free edileni kullan (dangling)'),
        h('button', { class: 'btn warn', onclick: () => act(reset) }, 'Sıfırla'),
      ]),
      h('p', { class: 'mono', style: 'color:var(--muted);font-size:12px;margin:10px 0 0' },
        `Senaryo: "Fonksiyon çağır" + "malloc" yap, sonra free ETMEDEN "Return" et → leak. Ya da üst üste çağırarak stack overflow\'u tetikle (maks derinlik ${MAX_DEPTH}).`),
    ]);

    const mem = h('div', { class: 'panel' }, [
      h('h3', null, 'Bellek görünümü'),
      h('div', { class: 'memcols' }, [
        h('div', { class: 'memcol' }, [h('h4', null, 'STACK (üste doğru büyür ↓ gösterim: en üst = en yeni)'), h('div', { class: 'stack-area', id: 'shStack' })]),
        h('div', { class: 'memcol' }, [h('h4', null, 'HEAP (dinamik ayrılan bloklar)'), h('div', { class: 'heap-area', id: 'shHeap' })]),
      ]),
    ]);
    const statsP = h('div', { class: 'panel' }, [h('h3', null, 'Durum'), h('div', { class: 'stat', id: 'shStats' })]);
    const logP = h('div', { class: 'panel' }, [h('h3', null, 'Olay günlüğü'), h('div', { class: 'log', id: 'shLog' })]);
    container.append(controls, mem, statsP, logP);
    renderAll();
  }

  function act(fn) { fn(); renderAll(); }

  function renderStack() {
    const wrap = document.getElementById('shStack'); if (!wrap) return; wrap.innerHTML = '';
    // en üst frame en üstte görünsün
    [...stack].reverse().forEach((f, i) => {
      wrap.appendChild(h('div', { class: 'frameblock' }, [
        h('div', null, f.fn + (i === 0 ? '  ◄ aktif (stack top)' : '')),
        h('div', { class: 'vars' }, f.locals.length ? f.locals.map(l => `${l.name}=${l.val}`).join('  ') : '(yerel değişken yok)'),
      ]));
    });
  }

  function renderHeap() {
    const wrap = document.getElementById('shHeap'); if (!wrap) return; wrap.innerHTML = '';
    if (!heap.length) { wrap.appendChild(h('p', { style: 'color:var(--muted)' }, 'Heap boş. malloc() ile ayır.')); return; }
    heap.forEach(b => {
      let cls = 'heapblock';
      if (b.freed) cls += ' freed';
      if (b.lostRef && !b.freed) cls += ' leaked';
      let tag = b.freed ? 'free' : (b.lostRef ? 'LEAK 🔴' : 'kullanımda');
      wrap.appendChild(h('div', { class: cls }, [h('span', null, `blok #${b.id} · ${b.size} B`), h('span', null, tag)]));
    });
  }

  function renderStats() {
    const wrap = document.getElementById('shStats'); if (!wrap) return; wrap.innerHTML = '';
    const used = heap.filter(b => !b.freed && !b.lostRef).reduce((s, b) => s + b.size, 0);
    const leaked = heap.filter(b => b.lostRef && !b.freed);
    [['Stack derinliği', stack.length + ' / ' + MAX_DEPTH, 'var(--accent)'],
     ['Aktif heap', used + ' B', 'var(--accent2)'],
     ['Sızan blok', leaked.length, leaked.length ? 'var(--danger)' : 'var(--muted)']]
      .forEach(([l, v, c]) => wrap.appendChild(h('div', { class: 's' }, [h('b', { style: 'color:' + c }, v), h('span', null, l)])));
  }

  function renderLog() {
    const wrap = document.getElementById('shLog'); if (!wrap) return; wrap.innerHTML = '';
    if (!logLines.length) { wrap.appendChild(h('div', { class: 'line', style: 'color:var(--muted)' }, 'Henüz işlem yok.')); return; }
    logLines.forEach(e => {
      const color = e.kind === 'err' ? 'var(--danger)' : e.kind === 'warn' ? 'var(--warn)' : 'var(--text)';
      wrap.appendChild(h('div', { class: 'line', style: 'color:' + color }, e.msg));
    });
  }

  function renderAll() { renderStack(); renderHeap(); renderStats(); renderLog(); }

  window.Modules.stackheap = {
    title: '4 · Stack & Heap',
    desc: 'Fonksiyon çağrıları stack\'te frame olarak yığılır; malloc/new ile alınan bellek heap\'te durur. ' +
      'Frame\'lerin push/pop\'unu, heap bloklarını ve memory leak / dangling pointer / stack overflow hatalarını canlı gör.',
    render,
  };
})();
