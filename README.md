# Kalkulator Shopee — Untuk Seller Indonesia

Kalkulator lengkap untuk seller Shopee yang membantu menentukan harga jual dengan akurat,
simulasi ROAS iklan (Break Even & sisa profit), dan perhitungan massal untuk ribuan produk.

## 🎯 Fitur

1. **Reverse Calculation (Hitung Harga Jual)**
   - Input HPP, target profit (% atau nominal), lalu isi semua parameter biaya Shopee.
   - Hasilnya adalah Harga Jual yang harus dipasang agar profit bersih **sesuai target**.
   - Mendukung: Diskon Produk, Voucher Toko, Biaya Admin, XTRA (Ongkir/Promo/Live),
     Premi, Layanan Pre-Order, SPayLater, Komisi Affiliate, Biaya Proses, Hemat Kirim.

2. **Simulasi ROAS Iklan**
   - Menampilkan **Break Even ROAS** otomatis (termasuk PPN iklan 11%).
   - Tabel simulasi ROAS 1× hingga 50× dengan sisa profit per order.
   - Indikator warna (hijau = profit, merah = rugi, kuning = impas).

3. **Hitung Massal**
   - Tempel daftar HPP (satu per baris), dapatkan harga jual untuk semua sekaligus.
   - Menggunakan parameter biaya dari tab utama.
   - Ekspor hasil ke CSV (siap buka di Excel atau Google Sheets).

## 📦 Deploy

Karena ini adalah website statis murni (HTML/CSS/JS, tanpa build step), Anda bisa deploy
dengan berbagai cara gratis:

### Opsi 1: Vercel (paling cepat)

1. Buat akun di [vercel.com](https://vercel.com).
2. Install Vercel CLI: `npm i -g vercel`.
3. Di folder ini, jalankan: `vercel` lalu ikuti petunjuk.
4. Selesai. Website Anda akan tersedia di `https://nama-project.vercel.app`.

Atau **lebih mudah**: drag-and-drop folder ini ke [vercel.com/new](https://vercel.com/new).

### Opsi 2: Netlify

1. Buat akun di [netlify.com](https://netlify.com).
2. Drag-and-drop folder ini ke dashboard Netlify.
3. Website Anda akan langsung online.

### Opsi 3: GitHub Pages

1. Push folder ini ke GitHub repository.
2. Di Settings → Pages → pilih branch `main` dan folder `/` (root).
3. Website akan tersedia di `https://username.github.io/nama-repo`.

### Opsi 4: Cloudflare Pages

1. Buat akun Cloudflare.
2. Pages → Create project → connect GitHub repo atau upload langsung.

### Opsi 5: Buka lokal saja

Cukup double-click `index.html` di file explorer — website bisa jalan offline di browser.

## 🧮 Rumus Perhitungan

Kalkulator ini menggunakan **reverse calculation** (hitung mundur) untuk memastikan
target profit tercapai setelah semua biaya Shopee dipotong:

```
HJK (Harga Jual Akhir) = (HPP + Target Profit + Biaya Nominal Netto) / (1 − Total % Biaya)
HJA (Harga Jual Awal)  = HJK / ((1 − Diskon%) × (1 − Voucher%))
```

Dimana:
- **Total % Biaya** = admin + premi + XTRA ongkir + XTRA promo + XTRA live + pre-order + SPayLater + affiliate
- **Biaya Nominal Netto** = Biaya Proses Pesanan − Hemat Biaya Kirim
- **HJA** dipotong Diskon → Harga Setelah Diskon → dipotong Voucher → **HJK**
- Semua biaya % Shopee dihitung dari HJK

## 🛠 Struktur File

```
shopee-kalkulator/
├── index.html    # Struktur halaman + form input
├── style.css     # Styling (modern, responsive, mobile-friendly)
├── script.js     # Semua logika: kalkulasi, tab, formatting, ekspor CSV
└── README.md     # File ini
```

Tidak ada dependency eksternal selain Google Fonts (Fraunces, Plus Jakarta Sans,
JetBrains Mono) yang di-load via CDN.

## 💡 Tips Penggunaan

- **Parameter di tab Hitung Harga Jual** juga jadi acuan untuk tab Simulasi ROAS
  dan Hitung Massal. Ubah sekali, berlaku di semua.
- Set biaya XTRA yang tidak dipakai toko Anda ke **0%** (contoh: kalau tidak ikut
  program Live XTRA, isi `0`).
- Untuk toko **Star+**, biasanya biaya admin 8.25%. Untuk **Non-Star**, bisa 4.75%
  atau 6.5% tergantung kategori. Sesuaikan dengan dashboard Seller Centre Anda.
- **Break Even ROAS** adalah batas minimal. Di bawah angka itu, iklan Anda rugi.
  Ambil jarak minimal 1.2×–1.5× dari angka BEP untuk margin aman.

## 📝 Catatan

- Semua perhitungan berjalan **100% di browser** Anda. Tidak ada data yang
  dikirim ke server manapun. Aman untuk data bisnis sensitif.
- Angka biaya default (8.25%, 5.5%, dll) dapat berubah sewaktu-waktu sesuai
  kebijakan Shopee. Selalu verifikasi dengan dashboard Seller Centre terbaru.

---

Dibuat dengan ❤ untuk komunitas seller Shopee Indonesia.
