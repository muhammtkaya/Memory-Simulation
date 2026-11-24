# Memory Simulation — İşletim Sistemi Bellek & Depolama Simülatörü

İşletim sistemlerinde **bir verinin doğumundan ölümüne kadar olan yolculuğunu** etkileşimli
olarak gösteren, tek sayfalık (kurulum gerektirmeyen) bir eğitim simülatörü.

> Veri → ayrılır (stack/heap) → yönetilir (adres çevirme) → RAM/disk arasında taşınır
> (page fault) → güvenlik için çoğaltılır (RAID) → silinince aslında gizlenir (remanence).

## Çalıştırma

Hiçbir kurulum yok. İki yol:

1. **En kolay:** `index.html` dosyasına çift tıkla (tarayıcıda açılır).
2. **Yerel sunucu** (bazı tarayıcılar `file://` ile script yüklemeyi kısıtlarsa):
   ```powershell
   python -m http.server 8000
   ```
   sonra tarayıcıda `http://localhost:8000` aç.

GitHub Pages ile yayınlarsan hocaya doğrudan link de verebilirsin.

## Modüller

| # | Modül | Ne gösteriyor | Öne çıkan tuzak |
|---|-------|---------------|-----------------|
| 1 | **Bellek Hiyerarşisi** | L1/L2/L3 cache → RAM → disk erişimi, set-associative cache + LRU, gerçekçi gecikme (ns), AMAT | Cache ≠ RAM ≠ Page Table; locality |
| 2 | **Adres Çevirme** | Sanal → fiziksel adres, sayfa/offset ayrışması, TLB, page table, page fault | Page fault ≠ segmentation fault |
| 3 | **Sayfa Değiştirme** | FIFO, LRU, Optimal, Clock; adım adım fault/hit; karşılaştırma | **Belady anomalisi** |
| 4 | **Stack & Heap** | Fonksiyon frame'leri (push/pop), malloc/free, heap blokları | Memory leak, dangling pointer, stack overflow, double free |
| 5 | **RAID** | RAID 0/1/4/5/6/10, gerçek XOR paritesi, disk arızası ve kurtarma | RAID ≠ yedekleme; iki disk arızası |
| 6 | **Veri Silme & Kalıntı** | Silme = "boş işaretle"; adli kurtarma; üzerine yazma; güvenli silme | "Sildim gitti" yanılgısı; data remanence |

## Mimari

```
index.html          → iskelet + navigasyon
css/style.css       → tüm stiller (koyu tema)
js/util.js          → ortak DOM yardımcıları + modül kaydı
js/main.js          → sekme navigasyonu
js/hierarchy.js     → Modül 1
js/translation.js   → Modül 2
js/paging.js        → Modül 3
js/stackheap.js     → Modül 4
js/raid.js          → Modül 5
js/dataremoval.js   → Modül 6
```

Her modül `window.Modules[ad] = { title, desc, render(container) }` olarak kaydolur;
`main.js` tıklanan modülü içerik alanına çizer. Yeni modül eklemek için yeni bir `js/*.js`
yazıp `index.html`'e `<script>` olarak ekle, gerisi otomatik.

## Not: basitleştirmeler

Eğitim amacıyla bazı değerler küçültülmüştür (örn. cache/çerçeve sayıları, RAID 6 Q paritesi
Reed-Solomon yerine ağırlıklı XOR ile temsil edilmiştir). Davranış ve kavramlar doğrudur;
amaç mekanizmayı görünür kılmaktır.
