// Ortak yardımcılar — tüm modüller bunu kullanır
window.Modules = {}; // her modül buraya { title, desc, render(container) } kaydeder

// Basit DOM oluşturucu: h('div', {class:'x'}, [child, 'text'])
function h(tag, attrs, children) {
  const e = document.createElement(tag);
  if (attrs) for (const k in attrs) {
    if (k === 'class') e.className = attrs[k];
    else if (k === 'html') e.innerHTML = attrs[k];
    else if (k.startsWith('on') && typeof attrs[k] === 'function') e.addEventListener(k.slice(2), attrs[k]);
    else if (attrs[k] !== null && attrs[k] !== undefined) e.setAttribute(k, attrs[k]);
  }
  if (children != null) (Array.isArray(children) ? children : [children]).forEach(c => {
    if (c == null) return;
    e.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(c) : c);
  });
  return e;
}

const $ = (sel, root) => (root || document).querySelector(sel);
const sleep = ms => new Promise(r => setTimeout(r, ms));

// Modül başlık + açıklama + tricky kutusu için yardımcı
function modHeader(title, desc) {
  return [
    h('h2', { class: 'mod-title' }, title),
    h('p', { class: 'mod-desc' }, desc),
  ];
}
function tricky(titleHtml, bodyHtml) {
  return h('div', { class: 'tricky' }, [
    h('div', { class: 'h' }, ['⚠️ Öğrencilerin takıldığı yer']),
    h('div', { html: '<b>' + titleHtml + '</b> — ' + bodyHtml }),
  ]);
}
