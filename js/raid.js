// ============================================================
// Modül 5: RAID (0, 1, 4, 5, 6, 10)
// Veriyi disklere yerleştirme, gerçek XOR paritesi, disk arızası ve
// kurtarma. Hangi seviye kaç disk arızasına dayanır gösterilir.
// ============================================================
(function () {
  const XOR = arr => arr.reduce((a, b) => a ^ b, 0);

  const LEVELS = {
    0:  { name: 'RAID 0 — Striping', disks: 4, tol: 0 },
    1:  { name: 'RAID 1 — Mirroring', disks: 2, tol: 1 },
    4:  { name: 'RAID 4 — Ayrık parite', disks: 4, tol: 1 },
    5:  { name: 'RAID 5 — Dağıtık parite', disks: 4, tol: 1 },
    6:  { name: 'RAID 6 — Çift parite (P+Q)', disks: 5, tol: 2 },
    10: { name: 'RAID 10 — Ayna + şerit', disks: 4, tol: '1/çift' },
  };

  const STRIPES = 4;
  let level = 5, grid = [], nDisks = 4, dead = new Set(), rebuilt = false;

  // grid[stripe][disk] = {kind, val, label, lost, rebuilt}
  function build() {
    const L = LEVELS[level]; nDisks = L.disks; dead = new Set(); rebuilt = false;
    grid = [];
    let d = 0; // logical data counter
    const rnd = () => Math.floor(Math.random() * 90) + 10; // 2 haneli veri

    for (let s = 0; s < STRIPES; s++) {
      const row = new Array(nDisks).fill(null);
      if (level === 0) {
        for (let disk = 0; disk < nDisks; disk++) row[disk] = { kind: 'data', val: rnd(), label: 'D' + (d++) };
      } else if (level === 1) {
        const v = rnd(), lbl = 'D' + (d++);
        for (let disk = 0; disk < nDisks; disk++) row[disk] = { kind: disk === 0 ? 'data' : 'mirror', val: v, label: lbl };
      } else if (level === 4) {
        const pd = nDisks - 1; const dataVals = [];
        for (let disk = 0; disk < nDisks; disk++) {
          if (disk === pd) continue;
          const v = rnd(); dataVals.push(v); row[disk] = { kind: 'data', val: v, label: 'D' + (d++) };
        }
        row[pd] = { kind: 'parity', val: XOR(dataVals), label: 'P' };
      } else if (level === 5) {
        const pd = (nDisks - 1 - (s % nDisks)); const dataVals = [];
        for (let disk = 0; disk < nDisks; disk++) {
          if (disk === pd) continue;
          const v = rnd(); dataVals.push(v); row[disk] = { kind: 'data', val: v, label: 'D' + (d++) };
        }
        row[pd] = { kind: 'parity', val: XOR(dataVals), label: 'P' };
      } else if (level === 6) {
        const pP = (nDisks - 1 - (s % nDisks));
        const pQ = (nDisks - 2 - (s % nDisks) + nDisks) % nDisks;
        const dataVals = [];
        for (let disk = 0; disk < nDisks; disk++) {
          if (disk === pP || disk === pQ) continue;
          const v = rnd(); dataVals.push(v); row[disk] = { kind: 'data', val: v, label: 'D' + (d++) };
        }
        row[pP] = { kind: 'parity', val: XOR(dataVals), label: 'P' };
        // Q: ağırlıklı XOR (eğitimsel; gerçekte Reed-Solomon)
        row[pQ] = { kind: 'q', val: XOR(dataVals.map((v, i) => (v << (i % 3)) & 0xFF)), label: 'Q' };
      } else if (level === 10) {
        // 4 disk: ayna çiftleri (0,1) ve (2,3), çiftler arasında şerit
        const vA = rnd(), vB = rnd();
        row[0] = { kind: 'data', val: vA, label: 'D' + d };
        row[1] = { kind: 'mirror', val: vA, label: 'D' + d };
        d++;
        row[2] = { kind: 'data', val: vB, label: 'D' + d };
        row[3] = { kind: 'mirror', val: vB, label: 'D' + d };
        d++;
      }
      grid.push(row);
    }
  }
  build();

  function toggleDisk(i) { if (dead.has(i)) dead.delete(i); else dead.add(i); rebuilt = false; renderAll(); }

  // Kurtarma: hangi hücreler kurtarılabilir / kayıp?
  function recover() {
    rebuilt = true;
    grid.forEach((row, s) => {
      row.forEach((cell, disk) => { if (cell) { cell.lost = false; cell.rebuiltNow = false; } });
    });

    if (level === 0) {
      dead.forEach(disk => grid.forEach(row => { if (row[disk]) row[disk].lost = true; }));
    } else if (level === 1) {
      const allDead = [...Array(nDisks).keys()].every(i => dead.has(i));
      dead.forEach(disk => grid.forEach(row => { if (row[disk]) { if (allDead) row[disk].lost = true; else row[disk].rebuiltNow = true; } }));
    } else if (level === 4 || level === 5) {
      if (dead.size <= 1) dead.forEach(disk => grid.forEach(row => { if (row[disk]) row[disk].rebuiltNow = true; }));
      else dead.forEach(disk => grid.forEach(row => { if (row[disk]) row[disk].lost = true; }));
    } else if (level === 6) {
      if (dead.size <= 2) dead.forEach(disk => grid.forEach(row => { if (row[disk]) row[disk].rebuiltNow = true; }));
      else dead.forEach(disk => grid.forEach(row => { if (row[disk]) row[disk].lost = true; }));
    } else if (level === 10) {
      const pairs = [[0, 1], [2, 3]];
      dead.forEach(disk => {
        const pair = pairs.find(p => p.includes(disk));
        const bothDead = pair.every(i => dead.has(i));
        grid.forEach(row => { if (row[disk]) { if (bothDead) row[disk].lost = true; else row[disk].rebuiltNow = true; } });
      });
    }
    renderAll();
  }

  function render(container) {
    container.appendChild(tricky(
      'RAID yedekleme (backup) DEĞİLDİR!',
      'RAID <b>erişilebilirlik</b> (availability) sağlar — disk arızasında sistem çalışmaya devam eder. Ama yanlışlıkla sildiğin ya da virüsün bozduğu dosya ' +
      '<b>tüm disklerden</b> anında gider; RAID bunu geri getirmez. Ayrıca parite sihri XOR\'dur: tek disk ölünce ' +
      '<span class="mono">kayıp = P ⊕ (kalan veriler)</span>. İki disk aynı anda ölürse RAID 5 çöker (bu yüzden RAID 6 / P+Q var).'
    ));

    const controls = h('div', { class: 'panel' }, [
      h('h3', null, 'RAID Seviyesi'),
      h('div', { class: 'row top' }, [
        h('label', { class: 'ctl' }, ['Seviye',
          h('select', { id: 'raidLevel', onchange: e => { level = parseInt(e.target.value, 10); build(); renderAll(); } },
            Object.keys(LEVELS).map(k => h('option', { value: k }, LEVELS[k].name)))]),
        h('button', { class: 'btn ghost', onclick: () => { build(); renderAll(); } }, 'Yeni veri yaz'),
        h('button', { class: 'btn', onclick: recover }, '🔧 Kurtarmayı dene (rebuild)'),
        h('button', { class: 'btn warn', onclick: () => { dead = new Set(); rebuilt = false; renderAll(); } }, 'Diskleri dirilt'),
      ]),
      h('p', { style: 'color:var(--muted);font-size:13px;margin:10px 0 0' }, 'Bir diskin başlığındaki ✕ ile onu "öldür", sonra kurtarmayı dene. Kaç disk arızasına dayandığını gör.'),
    ]);

    const disksP = h('div', { class: 'panel' }, [h('h3', null, 'Disk dizisi (satır = stripe)'), h('div', { class: 'disks', id: 'raidDisks' })]);
    const infoP = h('div', { class: 'panel' }, [h('h3', null, 'Bu seviye hakkında'), h('div', { id: 'raidInfo' })]);
    const tableP = h('div', { class: 'panel' }, [h('h3', null, 'RAID seviyeleri karşılaştırması'), h('div', { id: 'raidTable' })]);
    container.append(controls, disksP, infoP, tableP);
    document.getElementById('raidLevel').value = level;
    renderAll();
  }

  function cellClass(cell) {
    let c = 'blk';
    if (!cell) return c;
    if (cell.kind === 'parity' || cell.kind === 'q') c += ' parity';
    else c += ' data';
    if (cell.lost) c += ' lost';
    if (cell.rebuiltNow) c += ' rebuilt';
    return c;
  }

  function renderDisks() {
    const wrap = document.getElementById('raidDisks'); if (!wrap) return; wrap.innerHTML = '';
    for (let disk = 0; disk < nDisks; disk++) {
      const isDead = dead.has(disk);
      const col = h('div', { class: 'disk' + (isDead ? ' dead' : '') }, [
        h('div', { class: 'dh' }, [
          h('span', null, 'Disk ' + disk),
          h('button', { class: 'btn ' + (isDead ? 'ghost' : 'danger'), style: 'padding:2px 8px;font-size:12px', onclick: () => toggleDisk(disk) }, isDead ? '↺' : '✕'),
        ]),
      ]);
      grid.forEach(row => {
        const cell = row[disk];
        if (!cell) { col.appendChild(h('div', { class: 'blk', style: 'opacity:.3' }, '—')); return; }
        let txt;
        if (isDead && !cell.rebuiltNow && !cell.lost) txt = '??';
        else if (cell.lost) txt = 'KAYIP';
        else txt = cell.label + '=' + cell.val;
        col.appendChild(h('div', { class: cellClass(cell) }, txt));
      });
      wrap.appendChild(col);
    }
  }

  function renderInfo() {
    const wrap = document.getElementById('raidInfo'); if (!wrap) return; wrap.innerHTML = '';
    const L = LEVELS[level];
    const explain = {
      0: 'Veri disklere bölünür (striping). Hız ve kapasite maksimum, ama <b>sıfır yedeklilik</b>: tek disk ölünce o diskteki bloklar tamamen kaybolur.',
      1: 'Her disk ötekinin birebir aynası. Kapasitenin yarısı kullanılır ama bir disk ölse öteki tam kopyayı tutar.',
      4: 'Veri data disklerine şeritlenir, <b>parite tek bir ayrık diskte</b> toplanır. Parite = stripe\'taki verilerin XOR\'u. Dezavantaj: her yazma parite diskine gider (darboğaz).',
      5: 'RAID 4 gibi ama <b>parite tüm disklere dağıtılır</b> (darboğaz yok). Tek disk arızasına dayanır; kayıp blok = P ⊕ (kalanlar).',
      6: 'İki bağımsız parite (P ve Q). <b>Aynı anda 2 disk</b> arızasına dayanır. Büyük dizilerde rebuild sırasında ikinci disk ölme riskine karşı standart.',
      10: 'Önce aynalı çiftler (RAID 1), sonra çiftler arası şerit (RAID 0). Her çiftten bir disk ölebilir; ama <b>aynı çiftin iki diski ölürse</b> o veri gider.',
    }[level];
    wrap.appendChild(h('p', { html: explain }));
    // kapasite / tolerans
    const usable = { 0: nDisks, 1: 1, 4: nDisks - 1, 5: nDisks - 1, 6: nDisks - 2, 10: nDisks / 2 }[level];
    wrap.appendChild(h('div', { class: 'stat' }, [
      h('div', { class: 's' }, [h('b', null, nDisks), h('span', null, 'disk')]),
      h('div', { class: 's' }, [h('b', null, usable + '/' + nDisks), h('span', null, 'kullanılabilir kapasite')]),
      h('div', { class: 's' }, [h('b', { style: 'color:var(--warn)' }, '' + L.tol), h('span', null, 'tolere edilen arıza')]),
      h('div', { class: 's' }, [h('b', { style: 'color:' + (dead.size ? 'var(--danger)' : 'var(--ok)') }, dead.size), h('span', null, 'şu an ölü disk')]),
    ]));
    // XOR örneği (parite varsa, ilk stripe)
    if (level === 4 || level === 5) {
      const row = grid[0]; const dataVals = row.filter(c => c && c.kind === 'data').map(c => c.val);
      const p = row.find(c => c && c.kind === 'parity');
      wrap.appendChild(h('div', { class: 'mono', style: 'margin-top:10px;color:var(--muted)' },
        `Örnek (stripe 0): P = ${dataVals.join(' ⊕ ')} = ${p.val}.  Bir veri diski ölürse: kayıp = ${p.val} ⊕ (kalan veriler).`));
    }
    if (rebuilt) {
      const ok = !grid.some(row => row.some(c => c && c.lost));
      wrap.appendChild(h('div', { style: 'margin-top:12px;font-weight:700;color:' + (ok ? 'var(--ok)' : 'var(--danger)') },
        ok ? '✅ Veri bütünlüğü korundu — tüm bloklar kurtarıldı.' : '❌ VERİ KAYBI — bu seviye bu kadar arızaya dayanamaz.'));
    }
  }

  function renderTable() {
    const wrap = document.getElementById('raidTable'); if (!wrap) return; wrap.innerHTML = '';
    const rows = [
      ['RAID 0', 'Striping', 'Tümü', '0 (hiç)', 'Maks hız, yedek yok'],
      ['RAID 1', 'Mirroring', '%50', '1', 'Basit, pahalı'],
      ['RAID 4', 'Ayrık parite', '(n-1)/n', '1', 'Parite diski darboğaz'],
      ['RAID 5', 'Dağıtık parite', '(n-1)/n', '1', 'En yaygın denge'],
      ['RAID 6', 'Çift parite', '(n-2)/n', '2', 'Büyük diziler için güvenli'],
      ['RAID 10', 'Ayna+şerit', '%50', '1/çift', 'Hız+güvenlik, pahalı'],
    ];
    wrap.appendChild(h('table', { class: 'info' }, [
      h('tr', null, ['Seviye', 'Yöntem', 'Kapasite', 'Arıza toleransı', 'Not'].map(t => h('th', null, t))),
      ...rows.map(r => h('tr', null, r.map((c, i) => h('td', { class: i === 0 ? 'mono' : '' }, c)))),
    ]));
  }

  function renderAll() { renderDisks(); renderInfo(); renderTable(); }

  window.Modules.raid = {
    title: '5 · RAID — disk dizileri ve veri kurtarma',
    desc: 'Birden çok diski tek birim gibi çalıştırma: striping, mirroring ve parite. RAID 0/1/4/5/6/10 seviyelerinde veriyi yaz, ' +
      'bir diski "öldür" ve XOR paritesiyle kurtarmayı dene. Hangi seviye kaç arızaya dayanıyor kendin gör.',
    render,
  };
})();
