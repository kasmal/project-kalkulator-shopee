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

function resetSingle() {
  const defaults = {
    "hpp": "50.000",
    "profit-mode": "percent",
    "profit": "15",
    "diskon": "4",
    "voucher": "2",
    "admin": "8.25",
    "premi": "0.5",
    "xtra-ongkir": "5.5",
    "xtra-promo": "4.5",
    "xtra-live": "3",
    "preorder": "3",
    "spaylater": "4",
    "affiliate": "5",
    "biaya-proses": "1.250",
    "hemat-kirim": "350",
  };
  Object.entries(defaults).forEach(([id, val]) => {
    const el = document.getElementById(id);
    if (el) el.value = val;
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

  // Initial calc
  updateAll();
});
