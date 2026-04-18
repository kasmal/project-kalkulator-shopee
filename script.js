/* =========================================================================
 * Kalkulator Shopee — Core Logic
 * =========================================================================
 *
 * FORMULA REVERSE CALCULATION (Hitung Mundur):
 *
 *   Harga Jual Awal (HJA) dipotong:
 *     - Diskon Produk (dp)    → Harga Jual Produk = HJA × (1 - dp)
 *     - Voucher Toko (vt)     → Harga Jual Akhir (HJK) = HJA × (1 - dp) × (1 - vt)
 *
 *   Semua biaya persentase Shopee dihitung dari HJK:
 *     Total % biaya dari HJK = (admin + xtra_ongkir + xtra_promo + xtra_live +
 *                               premi + preorder + spaylater + affiliate)
 *
 *   Penghasilan bersih seller:
 *     Net = HJK × (1 - total_pct) - biaya_nominal_netto
 *
 *   dimana biaya_nominal_netto = biaya_proses - hemat_kirim (bisa + atau -)
 *
 *   Target: Net = HPP + target_profit
 *
 *   Maka:
 *     HJK = (HPP + profit + biaya_nominal_netto) / (1 - total_pct)
 *     HJA = HJK / ((1 - dp) × (1 - vt))
 *
 * ========================================================================= */

// ---------- Tarif resmi Shopee 2026 (dari Shopee Seller Education Hub) ----------
// Sumber: https://seller.shopee.co.id/edu/article/26511
// Catatan: Kategori B & C punya range; kami pakai nilai tengah.
const SHOPEE_TARIF_2026 = {
  admin: {
    // Struktur: level-toko → kategori → persen
    // Per info resmi 2026, tarif admin relatif sama antar level toko untuk kategori
    // yang sama (penyesuaian kecil di sub-kategori). Kami sederhanakan dengan
    // angka konsisten per kategori (Star+ biasanya dapat diskon kecil).
    "non-star": {
      "A": 10.0,
      "B": 9.5,
      "C": 6.75,
      "D": 5.25,
      "E": 4.25,
      "khusus": 2.5,
    },
    "star": {
      "A": 10.0,
      "B": 9.25,
      "C": 6.5,
      "D": 5.25,
      "E": 4.25,
      "khusus": 2.5,
    },
    "star-plus": {
      "A": 10.0,
      "B": 9.0,
      "C": 6.5,
      "D": 5.25,
      "E": 4.25,
      "khusus": 2.5,
    },
  },
  // Tarif default saat program opsional di-ON
  programDefault: {
    "xtra-ongkir": 8.0,      // Update 2 Mei 2026: 8% produk biasa, 9,5% produk khusus
    "xtra-promo": 4.5,       // Tarif umum
    "xtra-live": 3.0,
    "preorder": 3.0,         // Resmi Shopee 2026: 3% per kuantitas
    "premi": 0.5,
  },
  spaylater: {
    "3": 2.5,   // Tenor 3 bulan — resmi Shopee 2026
    "6": 4.0,   // Tenor 6 bulan — resmi Shopee 2026
  },
  biayaProses: 1250, // Flat Rp1.250 per transaksi selesai sejak Juli 2025
};

// ---------- Utilities ----------
const fmtRupiah = (n) => {
  // Normalize -0 and tiny floating point values to 0
  const rounded = Math.round(n);
  const safe = rounded === 0 ? 0 : rounded;
  const sign = safe < 0 ? "-" : "";
  const abs = Math.abs(safe);
  return sign + "Rp" + abs.toLocaleString("id-ID");
};

const fmtNumber = (n, decimals = 0) => {
  return Number(n).toLocaleString("id-ID", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
};

const fmtPercent = (n, decimals = 2) => {
  return Number(n).toLocaleString("id-ID", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }) + "%";
};

// Parse a money-formatted string like "50.000" or "1.250,50"
const parseMoney = (str) => {
  if (str === "" || str == null) return 0;
  // Remove thousand separator (.) and convert decimal comma (,) to dot
  const cleaned = String(str).replace(/\./g, "").replace(",", ".").replace(/[^\d.-]/g, "");
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
};

// Parse a plain number (may have decimal comma or dot)
const parseNumber = (str) => {
  if (str === "" || str == null) return 0;
  const cleaned = String(str).replace(",", ".").replace(/[^\d.-]/g, "");
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
};

// Format money as user types
const formatMoneyInput = (value) => {
  if (value === "" || value == null) return "";
  const cleaned = String(value).replace(/\./g, "").replace(/[^\d]/g, "");
  if (cleaned === "") return "";
  return parseInt(cleaned, 10).toLocaleString("id-ID");
};

// ---------- Gather inputs ----------
function getInputs() {
  const hpp = parseMoney(document.getElementById("hpp").value);
  const profitMode = document.getElementById("profit-mode").value;
  // If percent mode: value is like "15" or "15,5" → parseNumber.
  // If nominal mode: value is like "7.500" → parseMoney (thousand separator = dot).
  const profitInput = profitMode === "percent"
    ? parseNumber(document.getElementById("profit").value)
    : parseMoney(document.getElementById("profit").value);
  const profit = profitMode === "percent" ? (hpp * profitInput / 100) : profitInput;

  const pct = {
    diskon: parseNumber(document.getElementById("diskon").value) / 100,
    voucher: parseNumber(document.getElementById("voucher").value) / 100,
    admin: parseNumber(document.getElementById("admin").value) / 100,
    premi: parseNumber(document.getElementById("premi").value) / 100,
    xtraOngkir: parseNumber(document.getElementById("xtra-ongkir").value) / 100,
    xtraPromo: parseNumber(document.getElementById("xtra-promo").value) / 100,
    xtraLive: parseNumber(document.getElementById("xtra-live").value) / 100,
    preorder: parseNumber(document.getElementById("preorder").value) / 100,
    spaylater: parseNumber(document.getElementById("spaylater").value) / 100,
    affiliate: parseNumber(document.getElementById("affiliate").value) / 100,
  };

  const biayaProses = parseMoney(document.getElementById("biaya-proses").value);
  const hematKirim = parseMoney(document.getElementById("hemat-kirim").value);

  return { hpp, profit, profitInput, profitMode, pct, biayaProses, hematKirim };
}

// ---------- Core calculation ----------
function calculate(inputs) {
  const { hpp, profit, pct, biayaProses, hematKirim } = inputs;

  // Total % biaya yang dipotong dari Harga Jual Akhir (HJK)
  const totalPct =
    pct.admin + pct.premi + pct.xtraOngkir + pct.xtraPromo +
    pct.xtraLive + pct.preorder + pct.spaylater + pct.affiliate;

  // Net nominal deduction from HJK (biaya proses is a deduction, hemat kirim is an addition back to seller)
  const biayaNominalNetto = biayaProses - hematKirim;

  // Reverse calc: HJK = (HPP + profit + biaya_nominal_netto) / (1 - totalPct)
  let hjk;
  if (1 - totalPct <= 0) {
    hjk = Infinity;
  } else {
    hjk = (hpp + profit + biayaNominalNetto) / (1 - totalPct);
  }

  // Discount & voucher are applied BEFORE arriving at HJK, so reverse:
  // HJK = HJA × (1-diskon) × (1-voucher)
  const discountFactor = (1 - pct.diskon) * (1 - pct.voucher);
  const hja = discountFactor > 0 ? hjk / discountFactor : Infinity;

  // Intermediate: Harga setelah diskon produk
  const hargaSetelahDiskon = hja * (1 - pct.diskon);
  const nominalDiskon = hja - hargaSetelahDiskon;
  const nominalVoucher = hargaSetelahDiskon - hjk;

  // Individual biaya
  const biaya = {
    admin: hjk * pct.admin,
    xtraOngkir: hjk * pct.xtraOngkir,
    xtraPromo: hjk * pct.xtraPromo,
    xtraLive: hjk * pct.xtraLive,
    premi: hjk * pct.premi,
    preorder: hjk * pct.preorder,
    spaylater: hjk * pct.spaylater,
    affiliate: hjk * pct.affiliate,
  };

  const totalBiayaPersen = Object.values(biaya).reduce((a, b) => a + b, 0);
  const totalPenghasilan = hjk - totalBiayaPersen - biayaProses + hematKirim;
  const profitBersih = totalPenghasilan - hpp;
  const margin = hja > 0 ? (profitBersih / hja) * 100 : 0;

  const totalBiayaKeseluruhan = nominalDiskon + nominalVoucher + totalBiayaPersen + biayaProses - hematKirim;

  return {
    hja,
    hjk,
    hargaSetelahDiskon,
    nominalDiskon,
    nominalVoucher,
    biaya,
    totalBiayaPersen,
    totalPenghasilan,
    profitBersih,
    margin,
    totalBiayaKeseluruhan,
    biayaProses,
    hematKirim,
    hpp,
    targetProfit: profit,
    totalPct,
  };
}

// ---------- Render single calculation ----------
function renderSingleResult() {
  const inputs = getInputs();
  const r = calculate(inputs);

  // Guard: if inputs are invalid / impossible
  if (!isFinite(r.hja) || r.hja <= 0) {
    document.getElementById("result-harga-jual").textContent = "—";
    document.getElementById("result-profit").textContent = "—";
    document.getElementById("result-margin").textContent = "—";
    document.getElementById("result-total-biaya").textContent = "—";
    document.getElementById("breakdown").innerHTML =
      '<div class="breakdown__row"><span class="breakdown__label">Isi HPP dan setidaknya pastikan total biaya % &lt; 100%</span></div>';
    return;
  }

  document.getElementById("result-harga-jual").textContent = fmtRupiah(r.hja);
  document.getElementById("result-profit").textContent = fmtRupiah(r.profitBersih);
  document.getElementById("result-margin").textContent = fmtPercent(r.margin, 2);
  document.getElementById("result-total-biaya").textContent = fmtRupiah(r.totalBiayaKeseluruhan);

  const rows = [
    { label: "Harga Jual Awal", value: fmtRupiah(r.hja), type: "neutral" },
    { label: `Diskon Produk (${fmtPercent(inputs.pct.diskon * 100, 2)})`, value: fmtRupiah(r.nominalDiskon), type: "deduction" },
    { label: "Harga Setelah Diskon", value: fmtRupiah(r.hargaSetelahDiskon), type: "neutral" },
    { label: `Voucher Toko (${fmtPercent(inputs.pct.voucher * 100, 2)})`, value: fmtRupiah(r.nominalVoucher), type: "deduction" },
    { label: "Harga Jual Akhir (HJK)", value: fmtRupiah(r.hjk), type: "subtotal" },
    { label: `Biaya Administrasi (${fmtPercent(inputs.pct.admin * 100, 2)})`, value: fmtRupiah(r.biaya.admin), type: "deduction" },
    { label: `Gratis Ongkir XTRA (${fmtPercent(inputs.pct.xtraOngkir * 100, 2)})`, value: fmtRupiah(r.biaya.xtraOngkir), type: "deduction" },
    { label: `Promo XTRA (${fmtPercent(inputs.pct.xtraPromo * 100, 2)})`, value: fmtRupiah(r.biaya.xtraPromo), type: "deduction" },
    { label: `Live XTRA (${fmtPercent(inputs.pct.xtraLive * 100, 2)})`, value: fmtRupiah(r.biaya.xtraLive), type: "deduction" },
    { label: `Premi (${fmtPercent(inputs.pct.premi * 100, 2)})`, value: fmtRupiah(r.biaya.premi), type: "deduction" },
    { label: `Layanan Pre-Order (${fmtPercent(inputs.pct.preorder * 100, 2)})`, value: fmtRupiah(r.biaya.preorder), type: "deduction" },
    { label: `SPayLater (${fmtPercent(inputs.pct.spaylater * 100, 2)})`, value: fmtRupiah(r.biaya.spaylater), type: "deduction" },
    { label: `Komisi Affiliate (${fmtPercent(inputs.pct.affiliate * 100, 2)})`, value: fmtRupiah(r.biaya.affiliate), type: "deduction" },
    { label: "Biaya Proses Pesanan", value: fmtRupiah(r.biayaProses), type: "deduction" },
    { label: "Hemat Biaya Kirim", value: fmtRupiah(-r.hematKirim), type: "neutral" },
    { label: "Total Penghasilan Bersih", value: fmtRupiah(r.totalPenghasilan), type: "total" },
    { label: "Harga Pokok (HPP)", value: fmtRupiah(-r.hpp), type: "neutral" },
    { label: "Profit Bersih", value: fmtRupiah(r.profitBersih), type: "profit" },
  ];

  const html = rows.map(row => {
    const cls = {
      neutral: "",
      deduction: " breakdown__row--deduction",
      subtotal: " breakdown__row--subtotal",
      total: " breakdown__row--total",
      profit: " breakdown__row--profit",
    }[row.type] || "";
    return `
      <div class="breakdown__row${cls}">
        <span class="breakdown__label">${row.label}</span>
        <span class="breakdown__value">${row.value}</span>
      </div>
    `;
  }).join("");

  document.getElementById("breakdown").innerHTML = html;
}

// ---------- ROAS Simulation ----------
function renderROAS() {
  const inputs = getInputs();
  const r = calculate(inputs);

  if (!isFinite(r.hja) || r.hja <= 0) {
    document.getElementById("roas-bep").textContent = "—";
    document.getElementById("roas-profit-base").textContent = "—";
    document.getElementById("roas-harga-jual").textContent = "—";
    document.getElementById("roas-tbody").innerHTML =
      '<tr><td colspan="6" style="text-align:center; padding: 32px; color: var(--color-muted);">Input belum valid. Periksa tab Hitung Harga Jual.</td></tr>';
    return;
  }

  // ROAS = Revenue / Ad Spend
  // Revenue per order = HJA (harga sebelum diskon, yang customer bayar)
  // Ad cost per order (incl 11% VAT) = HJA / ROAS × 1.11
  // Remaining profit = profitBersih - (HJA / ROAS × 1.11)

  const PPN_IKLAN = 0.11;
  const revenuePerOrder = r.hja;
  const profitBase = r.profitBersih;

  // Break Even ROAS: at what ROAS does profit - adCost*(1+PPN) = 0?
  // profitBase = (revenuePerOrder / ROAS) × (1 + PPN)
  // ROAS = revenuePerOrder × (1 + PPN) / profitBase
  const bepROAS = profitBase > 0 ? (revenuePerOrder * (1 + PPN_IKLAN)) / profitBase : Infinity;

  document.getElementById("roas-harga-jual").textContent = fmtRupiah(r.hja);
  document.getElementById("roas-profit-base").textContent = fmtRupiah(profitBase);
  document.getElementById("roas-bep").textContent = isFinite(bepROAS) && bepROAS > 0
    ? fmtNumber(bepROAS, 2) + "×"
    : "—";

  const rows = [];
  for (let roas = 1; roas <= 50; roas++) {
    const adCostNet = revenuePerOrder / roas;
    const ppn = adCostNet * PPN_IKLAN;
    const totalAdCost = adCostNet + ppn;
    const remaining = profitBase - totalAdCost;

    const isBep = Math.abs(roas - bepROAS) < 0.5 && isFinite(bepROAS);
    const rowClass = remaining > 0 ? "is-profit" : (Math.abs(remaining) < revenuePerOrder * 0.01 ? "is-bep" : "is-loss");

    const statusHtml = remaining > 0
      ? '<span class="roas-status roas-status--profit">Profit</span>'
      : remaining < 0
        ? '<span class="roas-status roas-status--loss">Rugi</span>'
        : '<span class="roas-status roas-status--bep">Impas</span>';

    rows.push(`
      <tr class="${rowClass}">
        <td><strong>${roas}×</strong></td>
        <td>${fmtRupiah(adCostNet)}</td>
        <td>${fmtRupiah(ppn)}</td>
        <td>${fmtRupiah(totalAdCost)}</td>
        <td>${fmtRupiah(remaining)}</td>
        <td style="text-align:right;">${statusHtml}</td>
      </tr>
    `);
  }

  document.getElementById("roas-tbody").innerHTML = rows.join("");
}

// ---------- Quick Check: Iklan kemarin untung/rugi? ----------
//
// Input: biaya iklan (termasuk PPN) + total penjualan dari iklan
// Logic:
//   ROAS = penjualan / biaya_iklan
//   Dari penjualan, hitung profit bersih (pakai setting produk di tab 1)
//   Profit setelah iklan = profit_bersih_dari_penjualan - biaya_iklan
//
// Pendekatan sederhana: kita asumsikan margin profit bersih dari HJA yang di-set
// user di tab 1. Jadi: "seller jualan produk X dengan margin Y%, habis iklan Z,
// dapet penjualan W — untung atau rugi?"
function renderQuickCheck() {
  const biayaIklan = parseMoney(document.getElementById("qc-biaya-iklan").value);
  const penjualan = parseMoney(document.getElementById("qc-penjualan").value);
  const resultBox = document.getElementById("qc-result");

  if (biayaIklan <= 0 || penjualan <= 0) {
    resultBox.hidden = true;
    return;
  }

  // Hitung ROAS
  const roas = penjualan / biayaIklan;

  // Hitung margin profit bersih dari produk (pakai setting saat ini)
  const inputs = getInputs();
  const calc = calculate(inputs);
  // Margin bersih = profit / HJA (harga jual awal, yang customer bayar)
  const marginBersih = calc.hja > 0 ? calc.profitBersih / calc.hja : 0;

  // Estimasi profit kotor dari penjualan ini
  const profitKotor = penjualan * marginBersih;

  // Profit setelah dikurangi biaya iklan
  const profitNet = profitKotor - biayaIklan;

  const isProfit = profitNet > 0;
  const verdictText = isProfit ? "Iklan Anda UNTUNG!" : "Iklan Anda RUGI.";
  const icon = isProfit ? "🎉" : "⚠️";
  const cls = isProfit ? "qc-result--profit" : "qc-result--loss";

  let narrative;
  if (isProfit) {
    narrative = `
      Dari <strong>Rp${biayaIklan.toLocaleString("id-ID")}</strong> yang Anda keluarkan untuk iklan,
      Anda dapat penjualan <strong>Rp${penjualan.toLocaleString("id-ID")}</strong> (ROAS <strong>${roas.toFixed(2)}×</strong>).
      Setelah dikurangi HPP, biaya Shopee, dan biaya iklan, Anda
      <strong>untung bersih sekitar ${fmtRupiah(profitNet)}</strong> dari campaign ini.
    `;
  } else {
    const rugi = Math.abs(profitNet);
    narrative = `
      Dari <strong>Rp${biayaIklan.toLocaleString("id-ID")}</strong> biaya iklan, Anda cuma dapat penjualan
      <strong>Rp${penjualan.toLocaleString("id-ID")}</strong> (ROAS <strong>${roas.toFixed(2)}×</strong>).
      Setelah dikurangi HPP dan biaya Shopee, profit kotor dari penjualan ini kurang dari modal iklannya.
      Anda <strong>rugi sekitar ${fmtRupiah(rugi)}</strong>.
      Kalau pola iklan seperti ini dilanjutkan, saldo akan terus terkuras.
    `;
  }

  resultBox.className = `qc-result ${cls}`;
  resultBox.innerHTML = `
    <div class="qc-result__headline">
      <span class="qc-result__icon">${icon}</span>
      <span class="qc-result__verdict">${verdictText}</span>
      <span class="qc-result__roas">ROAS ${roas.toFixed(2)}×</span>
    </div>
    <p class="qc-result__body">${narrative}</p>
    <div class="qc-breakdown">
      <div class="qc-breakdown__row">
        <span class="qc-breakdown__label">Penjualan dari iklan</span>
        <span class="qc-breakdown__value">${fmtRupiah(penjualan)}</span>
      </div>
      <div class="qc-breakdown__row">
        <span class="qc-breakdown__label">Profit kotor (est. margin ${(marginBersih * 100).toFixed(1)}%)</span>
        <span class="qc-breakdown__value">${fmtRupiah(profitKotor)}</span>
      </div>
      <div class="qc-breakdown__row">
        <span class="qc-breakdown__label">Biaya iklan (termasuk PPN)</span>
        <span class="qc-breakdown__value">− ${fmtRupiah(biayaIklan)}</span>
      </div>
      <div class="qc-breakdown__row">
        <span class="qc-breakdown__label">${isProfit ? "Untung bersih" : "Rugi bersih"}</span>
        <span class="qc-breakdown__value" style="color: ${isProfit ? 'var(--color-ok)' : 'var(--color-bad)'}">${fmtRupiah(profitNet)}</span>
      </div>
    </div>
    <p class="qc-result__body" style="margin-top: 12px;">
      <strong>Break Even ROAS Anda:</strong> ${(1 / marginBersih).toFixed(2)}×.
      ${isProfit
        ? `Pertahankan target ROAS di atas angka ini untuk tetap untung.`
        : `Iklan harus menghasilkan ROAS lebih dari angka ini baru mulai untung.`
      }
    </p>
  `;
  resultBox.hidden = false;
}

// ---------- Bulk calculation ----------
let bulkResults = [];

function renderBulk() {
  const text = document.getElementById("bulk-input").value.trim();
  const tbody = document.getElementById("bulk-tbody");

  if (!text) {
    tbody.innerHTML = '<tr class="bulk-empty"><td colspan="5">Belum ada data. Tempel HPP lalu klik "Hitung Semua".</td></tr>';
    document.getElementById("bulk-count").textContent = "0 produk";
    bulkResults = [];
    return;
  }

  const hppList = text.split(/[\n,;]+/)
    .map(s => s.trim())
    .filter(Boolean)
    .map(parseMoney)
    .filter(n => n > 0);

  if (hppList.length === 0) {
    tbody.innerHTML = '<tr class="bulk-empty"><td colspan="5">Format tidak dikenali. Pastikan tiap HPP berupa angka, satu per baris.</td></tr>';
    document.getElementById("bulk-count").textContent = "0 produk";
    bulkResults = [];
    return;
  }

  const baseInputs = getInputs();
  bulkResults = [];

  const rows = hppList.map((hpp, idx) => {
    // Recalc profit if mode is percent
    const profitAmount = baseInputs.profitMode === "percent"
      ? (hpp * baseInputs.profitInput / 100)
      : baseInputs.profitInput;

    const r = calculate({
      ...baseInputs,
      hpp,
      profit: profitAmount,
    });

    const profitClass = r.profitBersih > 0 ? "bulk-profit-ok" : "bulk-profit-bad";

    bulkResults.push({
      idx: idx + 1,
      hpp,
      hargaJual: r.hja,
      profit: r.profitBersih,
      margin: r.margin,
    });

    return `
      <tr>
        <td>${idx + 1}</td>
        <td>${fmtRupiah(hpp)}</td>
        <td><strong>${isFinite(r.hja) ? fmtRupiah(r.hja) : "—"}</strong></td>
        <td class="${profitClass}">${fmtRupiah(r.profitBersih)}</td>
        <td>${fmtPercent(r.margin, 2)}</td>
      </tr>
    `;
  });

  tbody.innerHTML = rows.join("");
  document.getElementById("bulk-count").textContent = `${hppList.length} produk`;
}

function exportBulkCSV() {
  if (bulkResults.length === 0) {
    alert("Belum ada data untuk diekspor. Klik 'Hitung Semua' terlebih dahulu.");
    return;
  }

  const header = ["No", "HPP", "Harga Jual", "Profit", "Margin (%)"];
  const lines = [header.join(",")];
  bulkResults.forEach(r => {
    lines.push([
      r.idx,
      Math.round(r.hpp),
      Math.round(r.hargaJual),
      Math.round(r.profit),
      r.margin.toFixed(2),
    ].join(","));
  });

  const csv = "\ufeff" + lines.join("\n"); // BOM for Excel UTF-8
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `kalkulator-shopee-massal-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ---------- Input formatting (event delegation; attached ONCE) ----------
function attachMoneyFormatting() {
  // Delegate at document level so toggling data-money / data-number
  // attributes at runtime still works correctly without re-binding.
  document.addEventListener("input", (e) => {
    const t = e.target;
    if (!t || t.tagName !== "INPUT") return;

    if (t.hasAttribute("data-money")) {
      const start = t.selectionStart;
      const oldLen = t.value.length;
      const formatted = formatMoneyInput(t.value);
      if (formatted !== t.value) {
        t.value = formatted;
        const newLen = formatted.length;
        const diff = newLen - oldLen;
        const newPos = Math.max(0, (start || newLen) + diff);
        try { t.setSelectionRange(newPos, newPos); } catch (_) {}
      }
    } else if (t.hasAttribute("data-number")) {
      // Allow digits + single decimal separator
      let v = t.value.replace(/[^\d.,]/g, "");
      const firstSep = v.search(/[.,]/);
      if (firstSep !== -1) {
        v = v.slice(0, firstSep + 1) + v.slice(firstSep + 1).replace(/[.,]/g, "");
      }
      if (v !== t.value) t.value = v;
    }
  });
}

function handleProfitModeChange() {
  const mode = document.getElementById("profit-mode").value;
  const suffix = document.getElementById("profit-suffix");
  const input = document.getElementById("profit");
  const wrap = input.parentElement;

  if (mode === "percent") {
    suffix.textContent = "%";
    suffix.style.display = "";
    // remove Rp prefix if any
    const prefix = wrap.querySelector(".input-prefix");
    if (prefix) prefix.remove();
    input.removeAttribute("data-money");
    input.setAttribute("data-number", "");
    input.style.paddingLeft = "14px";
    input.value = "15";
  } else {
    suffix.style.display = "none";
    if (!wrap.querySelector(".input-prefix")) {
      const pf = document.createElement("span");
      pf.className = "input-prefix";
      pf.textContent = "Rp";
      wrap.insertBefore(pf, input);
    }
    input.removeAttribute("data-number");
    input.setAttribute("data-money", "");
    input.style.paddingLeft = "38px";
    input.value = "7.500";
  }

  updateAll();
}

// ---------- Preset Shopee (kategori + level toko) ----------
function applyAdminPreset() {
  const level = document.getElementById("level-toko").value;
  const kategori = document.getElementById("kategori").value;

  if (kategori === "custom") {
    // Jangan override, user atur manual
    return;
  }

  const tarif = SHOPEE_TARIF_2026.admin[level]?.[kategori];
  if (tarif != null) {
    const adminInput = document.getElementById("admin");
    // Format tanpa trailing zeros: 10.0 → "10", 9.25 → "9,25"
    adminInput.value = String(tarif).replace(".", ",").replace(/,0$/, "");
  }
}

// ---------- Toggle program opsional ----------
function toggleProgram(programKey, checked) {
  // programKey bisa: "xtra-ongkir", "xtra-promo", "xtra-live", "preorder", "spaylater", "premi"
  const input = document.getElementById(programKey);
  if (!input) return;

  input.disabled = !checked;

  if (checked) {
    // Ambil tarif default untuk program ini
    let defaultValue;
    if (programKey === "spaylater") {
      const tenor = document.getElementById("spaylater-tenor").value;
      defaultValue = SHOPEE_TARIF_2026.spaylater[tenor] || 4.0;
    } else {
      defaultValue = SHOPEE_TARIF_2026.programDefault[programKey] || 0;
    }
    input.value = String(defaultValue).replace(".", ",").replace(/,0$/, "");
  } else {
    input.value = "0";
  }
  updateAll();
}

// ---------- Update tarif SPayLater saat tenor berubah ----------
function handleSpaylaterTenorChange() {
  const toggle = document.getElementById("prog-spaylater");
  if (!toggle.checked) return; // kalau program off, tidak usah update
  const tenor = document.getElementById("spaylater-tenor").value;
  const defaultValue = SHOPEE_TARIF_2026.spaylater[tenor] || 4.0;
  const input = document.getElementById("spaylater");
  input.value = String(defaultValue).replace(".", ",").replace(/,0$/, "");
  updateAll();
}

function resetSingle() {
  const defaults = {
    "hpp": "50.000",
    "profit-mode": "percent",
    "profit": "15",
    "level-toko": "star-plus",
    "kategori": "A",
    "diskon": "0",
    "voucher": "0",
    "admin": "10",
    "affiliate": "0",
    "xtra-ongkir": "0",
    "xtra-promo": "0",
    "xtra-live": "0",
    "preorder": "0",
    "spaylater": "0",
    "spaylater-tenor": "6",
    "premi": "0",
    "biaya-proses": "1.250",
    "hemat-kirim": "350",
  };
  Object.entries(defaults).forEach(([id, val]) => {
    const el = document.getElementById(id);
    if (el) el.value = val;
  });

  // Reset semua toggle program ke off
  ["prog-ongkir", "prog-promo", "prog-live", "prog-preorder", "prog-spaylater", "prog-premi"]
    .forEach(id => {
      const cb = document.getElementById(id);
      if (cb) cb.checked = false;
    });

  // Disable semua input program
  ["xtra-ongkir", "xtra-promo", "xtra-live", "preorder", "spaylater", "premi"]
    .forEach(id => {
      const el = document.getElementById(id);
      if (el) el.disabled = true;
    });

  handleProfitModeChange();
  updateAll();
}

// ---------- Tab switching ----------
function switchTab(tabName) {
  document.querySelectorAll(".tab").forEach(t => {
    const active = t.dataset.tab === tabName;
    t.classList.toggle("tab--active", active);
    t.setAttribute("aria-selected", active);
  });
  document.querySelectorAll(".panel").forEach(p => {
    const active = p.id === `panel-${tabName}`;
    p.classList.toggle("panel--active", active);
    p.hidden = !active;
  });
  if (tabName === "roas") renderROAS();
  if (tabName === "bulk") renderBulk();
}

// ---------- Global update ----------
function updateAll() {
  renderSingleResult();
  // Also refresh ROAS silently so if user switches tab it's ready
  const activePanel = document.querySelector(".panel--active");
  if (activePanel && activePanel.id === "panel-roas") {
    renderROAS();
  }
}

// ---------- Init ----------
document.addEventListener("DOMContentLoaded", () => {
  attachMoneyFormatting();

  // All inputs trigger recalc
  document.querySelectorAll(".card--input input, .card--input select").forEach(el => {
    el.addEventListener("input", updateAll);
    el.addEventListener("change", updateAll);
  });

  document.getElementById("profit-mode").addEventListener("change", handleProfitModeChange);

  // Dropdown kategori & level toko → apply admin preset otomatis
  document.getElementById("level-toko").addEventListener("change", () => {
    applyAdminPreset();
    updateAll();
  });
  document.getElementById("kategori").addEventListener("change", () => {
    applyAdminPreset();
    updateAll();
  });

  // Toggle program opsional
  const programMap = {
    "prog-ongkir": "xtra-ongkir",
    "prog-promo": "xtra-promo",
    "prog-live": "xtra-live",
    "prog-preorder": "preorder",
    "prog-spaylater": "spaylater",
    "prog-premi": "premi",
  };
  Object.entries(programMap).forEach(([toggleId, inputId]) => {
    const toggle = document.getElementById(toggleId);
    if (toggle) {
      toggle.addEventListener("change", (e) => {
        toggleProgram(inputId, e.target.checked);
      });
    }
  });

  // SPayLater tenor change
  document.getElementById("spaylater-tenor").addEventListener("change", handleSpaylaterTenorChange);

  // Tabs
  document.querySelectorAll(".tab").forEach(t => {
    t.addEventListener("click", () => switchTab(t.dataset.tab));
  });

  // Reset
  document.getElementById("reset-single").addEventListener("click", resetSingle);

  // Bulk
  document.getElementById("bulk-calc").addEventListener("click", renderBulk);
  document.getElementById("bulk-export").addEventListener("click", exportBulkCSV);
  document.getElementById("bulk-example").addEventListener("click", () => {
    document.getElementById("bulk-input").value = "25.000\n50.000\n75.000\n100.000\n150.000\n250.000\n500.000";
    renderBulk();
  });

  // Quick Check (cek iklan kemarin)
  document.getElementById("qc-hitung").addEventListener("click", renderQuickCheck);
  // Juga hitung saat Enter ditekan di input
  ["qc-biaya-iklan", "qc-penjualan"].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener("keypress", (e) => {
        if (e.key === "Enter") renderQuickCheck();
      });
    }
  });

  // ---------- OCR: setup event listeners ----------
  setupOCR();

  // ---------- OCR: load default jika ada ----------
  if (hasDefaultProfile()) {
    // Visual cue: enable tombol "Pakai default toko"
    const loadBtn = document.getElementById("ocr-load-default");
    if (loadBtn) loadBtn.style.opacity = "1";
  } else {
    const loadBtn = document.getElementById("ocr-load-default");
    if (loadBtn) loadBtn.style.opacity = "0.5";
  }

  // Initial calc
  updateAll();
});


/* =========================================================================
 * OCR SCREENSHOT PARSER (Tab 1 helper)
 *
 * Alur:
 *   1. User klik tombol upload → file picker
 *   2. File dipilih → jalankan Tesseract.js (bahasa English, cukup untuk angka)
 *   3. Raw text diparse dengan regex patterns untuk label Shopee
 *   4. Hasil ditampilkan di modal untuk user konfirmasi
 *   5. User klik "Terapkan" → field kalkulator terisi otomatis + highlight
 *
 * Strategi parser:
 *   - Cari "Harga Produk" / "Subtotal Pesanan" → base untuk hitung %
 *   - Cari label biaya (Admin, Layanan, Pre-Order, dll) → nominal Rp
 *   - Persen = (nominal / base) × 100
 *   - Label variasi (mobile vs desktop) didukung via regex alternatif
 * ========================================================================= */

const OCR_STORAGE_KEY = "shopee_kalkulator_default_profile_v1";

// Data hasil parse yang akan ditampilkan di modal
let pendingOCRData = null;

function setupOCR() {
  const uploadBtn = document.getElementById("ocr-upload-btn");
  const fileInput = document.getElementById("ocr-file");
  const saveBtn = document.getElementById("ocr-save-default");
  const loadBtn = document.getElementById("ocr-load-default");

  if (!uploadBtn || !fileInput) return;

  uploadBtn.addEventListener("click", () => fileInput.click());

  fileInput.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (file) {
      await processOCR(file);
      fileInput.value = ""; // reset supaya bisa upload ulang file yang sama
    }
  });

  // Modal controls
  document.getElementById("ocr-modal-close")?.addEventListener("click", closeOCRModal);
  document.getElementById("ocr-modal-cancel")?.addEventListener("click", closeOCRModal);
  document.getElementById("ocr-modal-backdrop")?.addEventListener("click", closeOCRModal);
  document.getElementById("ocr-modal-apply")?.addEventListener("click", applyOCRData);

  // Save / Load default
  if (saveBtn) saveBtn.addEventListener("click", saveDefaultProfile);
  if (loadBtn) loadBtn.addEventListener("click", loadDefaultProfile);
}

async function processOCR(file) {
  const statusEl = document.getElementById("ocr-status");
  const progressEl = document.getElementById("ocr-progress");
  const statusText = document.getElementById("ocr-status-text");

  statusEl.hidden = false;
  statusText.textContent = "Memuat engine OCR...";
  progressEl.textContent = "0%";

  try {
    // Tesseract.js global harus sudah ter-load dari CDN
    if (typeof Tesseract === "undefined") {
      throw new Error("Library OCR belum ter-load. Cek koneksi internet.");
    }

    const worker = await Tesseract.createWorker("eng", 1, {
      logger: (m) => {
        if (m.status === "recognizing text") {
          const pct = Math.round((m.progress || 0) * 100);
          progressEl.textContent = pct + "%";
          statusText.textContent = "Membaca teks dari gambar...";
        } else if (m.status === "loading tesseract core" || m.status === "initializing api") {
          statusText.textContent = "Mempersiapkan OCR...";
        } else if (m.status === "loading language traineddata") {
          statusText.textContent = "Memuat dataset bahasa...";
        }
      }
    });

    const { data } = await worker.recognize(file);
    await worker.terminate();

    statusEl.hidden = true;

    // Parse hasil
    const parsed = parseShopeeReceipt(data.text);
    if (!parsed.harga_produk || Object.keys(parsed.fees).length === 0) {
      showToast("OCR gagal mendeteksi angka. Coba screenshot lebih jelas atau isi manual.", "error");
      return;
    }

    pendingOCRData = { raw: data.text, parsed };
    showOCRModal();
  } catch (err) {
    console.error(err);
    statusEl.hidden = true;
    showToast("Gagal proses OCR: " + err.message, "error");
  }
}

/* Parser untuk SS Shopee Rincian Penghasilan.
 *
 * Input: raw text dari OCR
 * Output: { harga_produk, fees: { admin: {nominal, percent}, ... }, nominal: {biaya_proses, hemat_kirim, diskon, voucher} }
 *
 * Pattern yang didukung (variasi label Shopee):
 *   - "Harga Produk", "Subtotal Pesanan" → base
 *   - "Biaya Administrasi" → admin
 *   - "Biaya Layanan Gratis Ongkir XTRA" / "Biaya Layanan" → xtra-ongkir (default)
 *   - "Biaya Layanan Promo XTRA" → xtra-promo
 *   - "Biaya Layanan Live XTRA" / "Shopee Live XTRA" → xtra-live
 *   - "Biaya Layanan Pre-Order" → preorder
 *   - "Biaya SPayLater" / "Cicilan" → spaylater
 *   - "Biaya Proses Pesanan" → biaya_proses (nominal Rp)
 *   - "Potongan Ongkos Kirim dari Shopee" → hemat_kirim (nominal Rp)
 *   - "Diskon Produk" → diskon
 *   - "Voucher Toko" / "Voucher Penjual" → voucher
 */
function parseShopeeReceipt(text) {
  const result = {
    harga_produk: null,
    fees: {},         // persentase biaya: admin, xtra-ongkir, xtra-promo, xtra-live, preorder, spaylater
    nominal: {},      // biaya_proses, hemat_kirim (Rp)
    discount: {},     // diskon, voucher (Rp) untuk dihitung % nya
  };

  // Normalize: lowercase, rapikan whitespace, ganti berbagai karakter serupa
  const cleaned = text
    .replace(/[\u2013\u2014]/g, "-")       // en/em dash → hyphen
    .replace(/\u00a0/g, " ")                 // nbsp → space
    .replace(/\s+/g, " ")
    .replace(/([Rr][Pp])\s+/g, "Rp")         // "Rp 85.000" → "Rp85.000"
    .trim();

  // Ekstrak angka dari string Rp, handle minus di depan
  const parseRpValue = (str) => {
    if (!str) return null;
    // "-Rp85.000" atau "Rp85.000" atau "-Rp 85.000"
    const m = String(str).match(/(-?)\s*[Rr][Pp]\s*([\d.,]+)/);
    if (!m) return null;
    const sign = m[1] === "-" ? -1 : 1;
    // Di Indonesia, titik = thousand sep, koma = desimal. Kita abaikan desimal (jarang).
    const raw = m[2].replace(/\./g, "").replace(",", ".");
    const n = parseFloat(raw);
    return isNaN(n) ? null : sign * n;
  };

  // Array patterns: [key, array of regex yang mencari nominal di dekat label tersebut]
  // Gunakan lookahead terbatas (sampai ~80 char) untuk cari angka Rp.
  // Label spesifik diproses dulu, baru label umum di akhir
  const patterns = [
    // === BASE ===
    { key: "harga_produk", target: "base", patterns: [
      /harga\s*produk[^\n]{0,80}?(-?\s*[Rr][Pp][\d.,]+)/i,
      /subtotal\s*pesanan[^\n]{0,80}?(-?\s*[Rr][Pp][\d.,]+)/i,
    ]},

    // === FEES (persen) — SPESIFIK DULU ===
    { key: "admin", target: "fees", patterns: [
      /biaya\s*admin(?:istrasi)?[^\n]{0,80}?(-?\s*[Rr][Pp][\d.,]+)/i,
    ]},
    { key: "xtra-ongkir", target: "fees", patterns: [
      /biaya\s*layanan\s*gratis\s*ongkir\s*x?tra[^\n]{0,80}?(-?\s*[Rr][Pp][\d.,]+)/i,
      /gratis\s*ongkir\s*x?tra[^\n]{0,80}?(-?\s*[Rr][Pp][\d.,]+)/i,
    ]},
    { key: "xtra-promo", target: "fees", patterns: [
      /biaya\s*layanan\s*promo\s*x?tra[^\n]{0,80}?(-?\s*[Rr][Pp][\d.,]+)/i,
      /(?<!biaya\s*layanan\s*)promo\s*x?tra[^\n]{0,80}?(-?\s*[Rr][Pp][\d.,]+)/i,
    ]},
    { key: "xtra-live", target: "fees", patterns: [
      /biaya\s*layanan\s*(?:shopee\s*)?live\s*x?tra[^\n]{0,80}?(-?\s*[Rr][Pp][\d.,]+)/i,
      /(?<!biaya\s*layanan\s*)(?:shopee\s*)?live\s*x?tra[^\n]{0,80}?(-?\s*[Rr][Pp][\d.,]+)/i,
    ]},
    { key: "preorder", target: "fees", patterns: [
      /biaya\s*layanan\s*pre[\s-]?order[^\n]{0,80}?(-?\s*[Rr][Pp][\d.,]+)/i,
      /(?<!biaya\s*layanan\s*)pre[\s-]?order[^\n]{0,80}?(-?\s*[Rr][Pp][\d.,]+)/i,
    ]},
    { key: "spaylater", target: "fees", patterns: [
      /biaya\s*s[\s]?pay[\s]?later[^\n]{0,80}?(-?\s*[Rr][Pp][\d.,]+)/i,
      /spaylater[^\n]{0,80}?(-?\s*[Rr][Pp][\d.,]+)/i,
      /cicilan[^\n]{0,80}?(-?\s*[Rr][Pp][\d.,]+)/i,
    ]},

    // === NOMINAL (Rp tetap) ===
    { key: "biaya_proses", target: "nominal", patterns: [
      /biaya\s*proses\s*pesanan[^\n]{0,80}?(-?\s*[Rr][Pp][\d.,]+)/i,
      /biaya\s*pemrosesan[^\n]{0,80}?(-?\s*[Rr][Pp][\d.,]+)/i,
    ]},
    { key: "hemat_kirim", target: "nominal", patterns: [
      /potongan\s*ongkos\s*kirim\s*dari\s*shopee[^\n]{0,80}?(-?\s*[Rr][Pp][\d.,]+)/i,
      /hemat\s*(?:biaya\s*)?(?:ongkos\s*)?kirim[^\n]{0,80}?(-?\s*[Rr][Pp][\d.,]+)/i,
    ]},

    // === DISCOUNT (Rp, nanti dihitung % nya) ===
    { key: "diskon", target: "discount", patterns: [
      /diskon\s*produk[^\n]{0,80}?(-?\s*[Rr][Pp][\d.,]+)/i,
    ]},
    { key: "voucher", target: "discount", patterns: [
      /voucher\s*(?:toko|penjual)[^\n]{0,80}?(-?\s*[Rr][Pp][\d.,]+)/i,
    ]},
  ];

  // Extract values
  for (const p of patterns) {
    for (const re of p.patterns) {
      const m = cleaned.match(re);
      if (m) {
        const val = parseRpValue(m[1]);
        if (val === null) continue;

        if (p.target === "base") {
          result.harga_produk = Math.abs(val);
        } else if (p.target === "fees") {
          result.fees[p.key] = { nominal: Math.abs(val) };
        } else if (p.target === "nominal") {
          result.nominal[p.key] = Math.abs(val);
        } else if (p.target === "discount") {
          result.discount[p.key] = Math.abs(val);
        }
        break; // pakai first match aja
      }
    }
  }

  // ----- Cari "Biaya Layanan" umum HANYA kalau belum ada label XTRA/Pre-Order/SPayLater spesifik -----
  const hasAnyLayananSpecific = result.fees["xtra-ongkir"] ||
                                 result.fees["xtra-promo"] ||
                                 result.fees["xtra-live"] ||
                                 result.fees["preorder"] ||
                                 result.fees["spaylater"];

  if (!hasAnyLayananSpecific) {
    // Hanya search "Biaya Layanan" generik, dengan negative lookahead untuk exclude yang spesifik
    const genericPattern = /biaya\s*layanan(?!\s*(?:gratis|promo|live|pre[\s-]?order|shopee))[^\n]{0,80}?(-?\s*[Rr][Pp][\d.,]+)/i;
    const m = cleaned.match(genericPattern);
    if (m) {
      const val = parseRpValue(m[1]);
      if (val !== null) {
        result.fees["xtra-ongkir"] = {
          nominal: Math.abs(val),
          _isGabungan: true, // flag untuk info user
        };
      }
    }
  }

  // Hitung persen untuk semua fees (berbasis harga_produk)
  if (result.harga_produk && result.harga_produk > 0) {
    Object.keys(result.fees).forEach(key => {
      const nominal = result.fees[key].nominal;
      result.fees[key].percent = (nominal / result.harga_produk) * 100;
    });
    // Hitung persen untuk discount juga
    Object.keys(result.discount).forEach(key => {
      const nominal = result.discount[key];
      result.discount[key] = {
        nominal,
        percent: (nominal / result.harga_produk) * 100,
      };
    });
  }

  return result;
}

function showOCRModal() {
  if (!pendingOCRData) return;
  const { raw, parsed } = pendingOCRData;

  // Build list of detected items
  const container = document.getElementById("ocr-detected-list");
  const feeLabels = {
    "admin": "Biaya Administrasi",
    "xtra-ongkir": "Gratis Ongkir XTRA",
    "xtra-promo": "Promo XTRA",
    "xtra-live": "Live XTRA",
    "preorder": "Layanan Pre-Order",
    "spaylater": "SPayLater",
  };

  let html = "";

  // Base info
  html += `<div class="ocr-group-title">Info Dasar</div>`;
  html += buildOCRItem({
    label: "Harga Produk (base)",
    value: parsed.harga_produk,
    unit: "Rp",
    dataKey: "_harga_produk",
    isReadonly: true,
    raw: parsed.harga_produk ? "Rp" + parsed.harga_produk.toLocaleString("id-ID") : "—",
  });

  // Fees (%)
  if (Object.keys(parsed.fees).length > 0) {
    html += `<div class="ocr-group-title">Biaya Shopee (%)</div>`;
    Object.entries(parsed.fees).forEach(([key, data]) => {
      const isGabungan = data._isGabungan;
      html += buildOCRItem({
        label: feeLabels[key] + (isGabungan ? " (gabungan — terdeteksi sebagai Biaya Layanan)" : ""),
        value: data.percent ? data.percent.toFixed(2) : "",
        unit: "%",
        dataKey: "fee_" + key,
        raw: "Rp" + data.nominal.toLocaleString("id-ID"),
        warning: isGabungan,
      });
    });
  }

  // Discounts
  if (parsed.discount && Object.keys(parsed.discount).length > 0) {
    html += `<div class="ocr-group-title">Diskon & Voucher (%)</div>`;
    const discLabels = { diskon: "Diskon Produk", voucher: "Voucher Toko" };
    Object.entries(parsed.discount).forEach(([key, data]) => {
      html += buildOCRItem({
        label: discLabels[key] || key,
        value: data.percent ? data.percent.toFixed(2) : "",
        unit: "%",
        dataKey: "disc_" + key,
        raw: "Rp" + data.nominal.toLocaleString("id-ID"),
      });
    });
  }

  // Nominal fees
  if (Object.keys(parsed.nominal).length > 0) {
    html += `<div class="ocr-group-title">Biaya Nominal (Rp)</div>`;
    const nomLabels = {
      biaya_proses: "Biaya Proses Pesanan",
      hemat_kirim: "Hemat Biaya Kirim",
    };
    Object.entries(parsed.nominal).forEach(([key, nominal]) => {
      html += buildOCRItem({
        label: nomLabels[key] || key,
        value: nominal,
        unit: "Rp",
        dataKey: "nom_" + key,
        raw: "Rp" + nominal.toLocaleString("id-ID"),
      });
    });
  }

  // Notes
  const gabunganDetected = Object.values(parsed.fees).some(f => f._isGabungan);
  if (gabunganDetected) {
    html += `
      <div class="ocr-notes">
        <strong>Catatan:</strong> SS Anda menampilkan "Biaya Layanan" sebagai satu angka gabungan. Saya asumsikan ini adalah <strong>Gratis Ongkir XTRA</strong>. Kalau Anda tau sebenarnya ini campuran Promo + Live XTRA, silakan edit nilainya di atas atau split manual setelah diterapkan.
      </div>
    `;
  }

  container.innerHTML = html;

  // Raw text
  document.getElementById("ocr-raw-text").textContent = raw;

  // Show modal
  document.getElementById("ocr-modal").hidden = false;
  document.body.style.overflow = "hidden";
}

function buildOCRItem({ label, value, unit, dataKey, raw, isReadonly = false, warning = false }) {
  const cls = warning ? "ocr-item ocr-item--warning" : "ocr-item";
  const readonlyAttr = isReadonly ? "readonly" : "";
  const displayVal = value != null && value !== "" ? value : "";
  return `
    <div class="${cls}">
      <span class="ocr-item__label">${label}</span>
      <span class="ocr-item__raw">${raw}</span>
      <span class="ocr-item__value-wrap">
        <input type="text" class="ocr-item__input" data-ocr-key="${dataKey}" value="${displayVal}" ${readonlyAttr} />
        <span class="ocr-item__unit">${unit}</span>
      </span>
    </div>
  `;
}

function closeOCRModal() {
  document.getElementById("ocr-modal").hidden = true;
  document.body.style.overflow = "";
}

function applyOCRData() {
  if (!pendingOCRData) return;

  // Ambil nilai-nilai dari input di modal (user bisa edit)
  const modalInputs = document.querySelectorAll(".ocr-item__input[data-ocr-key]");
  const values = {};
  modalInputs.forEach(input => {
    const key = input.dataset.ocrKey;
    const val = parseFloat(String(input.value).replace(",", "."));
    if (!isNaN(val)) values[key] = val;
  });

  // Map ke field kalkulator
  const fieldMap = {
    "fee_admin": { id: "admin", mode: "percent" },
    "fee_xtra-ongkir": { id: "xtra-ongkir", mode: "percent", programId: "prog-ongkir" },
    "fee_xtra-promo": { id: "xtra-promo", mode: "percent", programId: "prog-promo" },
    "fee_xtra-live": { id: "xtra-live", mode: "percent", programId: "prog-live" },
    "fee_preorder": { id: "preorder", mode: "percent", programId: "prog-preorder" },
    "fee_spaylater": { id: "spaylater", mode: "percent", programId: "prog-spaylater" },
    "disc_diskon": { id: "diskon", mode: "percent" },
    "disc_voucher": { id: "voucher", mode: "percent" },
    "nom_biaya_proses": { id: "biaya-proses", mode: "money" },
    "nom_hemat_kirim": { id: "hemat-kirim", mode: "money" },
  };

  let applied = 0;
  const highlightIds = [];

  Object.entries(fieldMap).forEach(([ocrKey, fieldInfo]) => {
    if (values[ocrKey] == null) return;
    const el = document.getElementById(fieldInfo.id);
    if (!el) return;

    // Kalau program, aktifkan toggle-nya dulu
    if (fieldInfo.programId) {
      const toggle = document.getElementById(fieldInfo.programId);
      if (toggle && !toggle.checked) {
        toggle.checked = true;
        toggle.dispatchEvent(new Event("change", { bubbles: true }));
      }
      // Pastikan input tidak disabled
      el.disabled = false;
    }

    // Set value (format sesuai mode)
    if (fieldInfo.mode === "percent") {
      el.value = values[ocrKey].toFixed(2).replace(".", ",").replace(/,00$/, "");
    } else {
      el.value = Math.round(values[ocrKey]).toLocaleString("id-ID");
    }

    el.classList.add("highlight-change");
    highlightIds.push(fieldInfo.id);
    applied++;

    // Set kategori ke custom supaya tidak auto-override
    if (fieldInfo.id === "admin") {
      const katSelect = document.getElementById("kategori");
      if (katSelect) katSelect.value = "custom";
    }
  });

  // Remove highlight after animation
  setTimeout(() => {
    highlightIds.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.classList.remove("highlight-change");
    });
  }, 2100);

  closeOCRModal();
  updateAll();

  showToast(`✓ ${applied} field berhasil terisi dari screenshot`, "success");
  pendingOCRData = null;
}

/* =========================================================================
 * SAVE / LOAD DEFAULT PROFILE TOKO (localStorage)
 * ========================================================================= */

function saveDefaultProfile() {
  const profile = {
    levelToko: document.getElementById("level-toko").value,
    kategori: document.getElementById("kategori").value,
    admin: document.getElementById("admin").value,
    affiliate: document.getElementById("affiliate").value,
    diskon: document.getElementById("diskon").value,
    voucher: document.getElementById("voucher").value,
    biayaProses: document.getElementById("biaya-proses").value,
    hematKirim: document.getElementById("hemat-kirim").value,
    programs: {
      "prog-ongkir": {
        on: document.getElementById("prog-ongkir").checked,
        val: document.getElementById("xtra-ongkir").value,
      },
      "prog-promo": {
        on: document.getElementById("prog-promo").checked,
        val: document.getElementById("xtra-promo").value,
      },
      "prog-live": {
        on: document.getElementById("prog-live").checked,
        val: document.getElementById("xtra-live").value,
      },
      "prog-preorder": {
        on: document.getElementById("prog-preorder").checked,
        val: document.getElementById("preorder").value,
      },
      "prog-spaylater": {
        on: document.getElementById("prog-spaylater").checked,
        val: document.getElementById("spaylater").value,
        tenor: document.getElementById("spaylater-tenor").value,
      },
      "prog-premi": {
        on: document.getElementById("prog-premi").checked,
        val: document.getElementById("premi").value,
      },
    },
    savedAt: new Date().toISOString(),
  };

  try {
    localStorage.setItem(OCR_STORAGE_KEY, JSON.stringify(profile));
    showToast("✓ Setting toko tersimpan. Bisa dipanggil lagi kapan saja.", "success");
    // Enable tombol load
    const loadBtn = document.getElementById("ocr-load-default");
    if (loadBtn) loadBtn.style.opacity = "1";
  } catch (e) {
    showToast("Gagal menyimpan: " + e.message, "error");
  }
}

function hasDefaultProfile() {
  try {
    return !!localStorage.getItem(OCR_STORAGE_KEY);
  } catch (e) {
    return false;
  }
}

function loadDefaultProfile() {
  try {
    const raw = localStorage.getItem(OCR_STORAGE_KEY);
    if (!raw) {
      showToast("Belum ada setting default. Save dulu dengan tombol di sebelah.", "error");
      return;
    }
    const profile = JSON.parse(raw);

    // Restore basic fields
    const simple = {
      "level-toko": profile.levelToko,
      "kategori": profile.kategori,
      "admin": profile.admin,
      "affiliate": profile.affiliate,
      "diskon": profile.diskon,
      "voucher": profile.voucher,
      "biaya-proses": profile.biayaProses,
      "hemat-kirim": profile.hematKirim,
    };
    Object.entries(simple).forEach(([id, val]) => {
      const el = document.getElementById(id);
      if (el && val != null) el.value = val;
    });

    // Restore programs
    Object.entries(profile.programs || {}).forEach(([progId, data]) => {
      const toggle = document.getElementById(progId);
      if (!toggle) return;
      toggle.checked = data.on;

      // Find corresponding input
      const inputMap = {
        "prog-ongkir": "xtra-ongkir",
        "prog-promo": "xtra-promo",
        "prog-live": "xtra-live",
        "prog-preorder": "preorder",
        "prog-spaylater": "spaylater",
        "prog-premi": "premi",
      };
      const inputId = inputMap[progId];
      const input = document.getElementById(inputId);
      if (input) {
        input.disabled = !data.on;
        input.value = data.val || "0";
      }
      if (progId === "prog-spaylater" && data.tenor) {
        const tenorEl = document.getElementById("spaylater-tenor");
        if (tenorEl) tenorEl.value = data.tenor;
      }
    });

    updateAll();

    const when = profile.savedAt ? new Date(profile.savedAt).toLocaleDateString("id-ID") : "";
    showToast(`✓ Setting toko dimuat${when ? " (disimpan " + when + ")" : ""}`, "success");
  } catch (e) {
    showToast("Gagal memuat setting: " + e.message, "error");
  }
}

/* =========================================================================
 * TOAST NOTIFICATION
 * ========================================================================= */

let toastTimer = null;

function showToast(message, variant = "default") {
  const toast = document.getElementById("toast");
  if (!toast) return;

  toast.textContent = message;
  toast.className = "toast";
  if (variant === "success") toast.classList.add("toast--success");
  else if (variant === "error") toast.classList.add("toast--error");
  toast.hidden = false;

  // Force reflow for transition
  toast.offsetHeight;
  toast.classList.add("toast--show");

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove("toast--show");
    setTimeout(() => { toast.hidden = true; }, 300);
  }, 3500);
}
