// TEMPEL URL GOOGLE APPS SCRIPT ANDA DI SINI (yang berakhiran /exec):
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwPi3Jcumu-YPC4q0NNz52BpZ48UD-G7VoF26ZChv5twAhBGBWsYAX9xCYb1oiCcY8E7g/exec";

let members = [];
let adminPin = "";
let currentFilter = 'all';
let toastTimeout = null;

// Ambil data dari Google Sheets saat halaman dibuka
async function loadMembers() {
  const loadingEl = document.getElementById('loadingState');
  if (loadingEl) loadingEl.classList.remove('hidden');

  try {
    const res = await fetch(SCRIPT_URL);
    const data = await res.json();
    members = Array.isArray(data) ? data.reverse() : [];
  } catch (err) {
    showToast('Gagal memuat data dari Google Sheets');
  }

  if (loadingEl) loadingEl.classList.add('hidden');
  updateStats();
  renderMembers();
}

// Kirim perintah perubahan ke Google Sheets (otomatis minta PIN)
async function sendToSheet(payload) {
  if (!adminPin) {
    const inputPin = prompt("Masukkan PIN Admin:");
    if (!inputPin) return false;
    adminPin = inputPin.trim();
  }

  showToast('Menyimpan ke Google Sheets...');
  try {
    const res = await fetch(SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify({ ...payload, pin: adminPin })
    });
    const result = await res.json();
    if (result.status === "error") {
      alert(result.message || "PIN Salah!");
      adminPin = ""; // Reset PIN jika salah agar bisa coba lagi
      return false;
    }
    await loadMembers();
    showToast('Berhasil tersimpan!');
    return true;
  } catch (err) {
    showToast('Terjadi kesalahan koneksi ke Google Sheets');
    return false;
  }
}

// Tambah Anggota
document.getElementById('addMemberForm').addEventListener('submit', async function (e) {
  e.preventDefault();
  const name = document.getElementById('memberName').value.trim();
  const amount = parseInt(document.getElementById('memberAmount').value, 10);
  const note = document.getElementById('memberNote').value.trim();

  if (!name || isNaN(amount) || amount <= 0) return;

  const ok = await sendToSheet({ action: 'add', name, amount, note });
  if (ok) {
    document.getElementById('addMemberForm').reset();
  }
});

// Ubah Status Bayar / Belum Bayar
function setPaymentStatus(id, isPaid) {
  const paidAt = new Date().toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
  sendToSheet({ action: 'toggle', id, paid: isPaid, paidAt });
}

// Hapus Anggota
function deleteMember(id, name) {
  if (confirm(`Yakin ingin menghapus ${name}?`)) {
    sendToSheet({ action: 'delete', id });
  }
}

// Reset Semua Tagihan Bulan Baru
function openResetModal() {
  if (members.length === 0) {
    showToast('Daftar anggota masih kosong');
    return;
  }
  if (confirm('Reset semua anggota menjadi "Belum Bayar" untuk bulan baru?')) {
    sendToSheet({ action: 'reset' });
  }
}

// Helper Format Rupiah
function formatRupiah(num) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(num);
}

function setAmountPreset(val) {
  document.getElementById('memberAmount').value = val;
}

function showToast(msg) {
  const toast = document.getElementById('toast');
  document.getElementById('toastText').textContent = msg;
  toast.classList.remove('translate-y-20', 'opacity-0');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    toast.classList.add('translate-y-20', 'opacity-0');
  }, 2800);
}

function setFilter(filter) {
  currentFilter = filter;
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.classList.remove('bg-white', 'text-slate-800', 'shadow-sm');
    btn.classList.add('text-slate-600');
  });
  const activeBtn = document.getElementById(`filter-${filter}`);
  activeBtn.classList.add('bg-white', 'text-slate-800', 'shadow-sm');
  activeBtn.classList.remove('text-slate-600');
  renderMembers();
}

function updateStats() {
  const paidMembers = members.filter(m => m.paid);
  const unpaidMembers = members.filter(m => !m.paid);
  const collected = paidMembers.reduce((s, m) => s + Number(m.amount), 0);
  const uncollected = unpaidMembers.reduce((s, m) => s + Number(m.amount), 0);
  const total = collected + uncollected;

  document.getElementById('statTotalMembers').textContent = `${members.length} Orang`;
  document.getElementById('statPaidRatio').textContent = `${paidMembers.length} dari ${members.length} lunas`;
  document.getElementById('statCollected').textContent = formatRupiah(collected);
  document.getElementById('statPaidCount').textContent = `${paidMembers.length} orang lunas`;
  document.getElementById('statUncollected').textContent = formatRupiah(uncollected);
  document.getElementById('statUnpaidCount').textContent = `${unpaidMembers.length} orang menunggak`;
  document.getElementById('statTotalTarget').textContent = formatRupiah(total);

  const percent = total > 0 ? Math.round((collected / total) * 100) : 0;
  document.getElementById('progressBar').style.width = `${percent}%`;

  document.getElementById('countAll').textContent = members.length;
  document.getElementById('countPaid').textContent = paidMembers.length;
  document.getElementById('countUnpaid').textContent = unpaidMembers.length;
}

function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function renderMembers() {
  const container = document.getElementById('memberList');
  const emptyState = document.getElementById('emptyState');
  const q = document.getElementById('searchInput').value.toLowerCase().trim();

  const filtered = members.filter(m => {
    const okFilter =
      currentFilter === 'all' ||
      (currentFilter === 'paid' && m.paid) ||
      (currentFilter === 'unpaid' && !m.paid);
    const okSearch =
      m.name.toLowerCase().includes(q) ||
      (m.note && m.note.toLowerCase().includes(q));
    return okFilter && okSearch;
  });

  container.innerHTML = '';

  if (filtered.length === 0) {
    emptyState.classList.remove('hidden');
    if (members.length > 0) {
      document.getElementById('emptyTitle').textContent = 'Tidak ditemukan';
      document.getElementById('emptyDesc').textContent = 'Tidak ada anggota yang cocok dengan pencarian atau filter.';
    } else {
      document.getElementById('emptyTitle').textContent = 'Belum ada anggota WiFi';
      document.getElementById('emptyDesc').textContent = 'Silakan tambahkan nama anggota dan nominal tagihan melalui formulir di samping.';
    }
    return;
  }

  emptyState.classList.add('hidden');

  filtered.forEach(m => {
    const initials = m.name
      .split(' ')
      .map(n => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();

    const card = document.createElement('div');
    card.className = `bg-white rounded-2xl p-4 sm:p-5 border transition-all shadow-xs animate-fade-in ${
      m.paid
        ? 'border-emerald-200/90 bg-emerald-50/15'
        : 'border-slate-200/90 hover:border-blue-300'
    }`;

    card.innerHTML = `
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div class="flex items-start sm:items-center gap-3.5 min-w-0">
          <div class="w-11 h-11 rounded-xl font-bold text-sm flex items-center justify-center shrink-0 ${
            m.paid ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
          }">
            ${initials || 'W'}
          </div>
          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-2">
              <h3 class="font-bold text-slate-800 text-base truncate">${escapeHTML(m.name)}</h3>
              <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                m.paid ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
              }">
                ${m.paid ? 'Lunas' : 'Belum Bayar'}
              </span>
            </div>
            <p class="text-sm font-extrabold mt-1 ${m.paid ? 'text-emerald-700' : 'text-slate-800'}">
              ${formatRupiah(m.amount)}
              ${m.note ? `<span class="text-xs font-normal text-slate-500"> • ${escapeHTML(m.note)}</span>` : ''}
            </p>
            ${m.paid && m.paidAt ? `<p class="text-[11px] text-emerald-600 mt-1">✓ Dibayar pada ${m.paidAt}</p>` : ''}
          </div>
        </div>

        <div class="flex flex-wrap sm:flex-nowrap items-center justify-between sm:justify-end gap-2 pt-3 sm:pt-0 border-t sm:border-t-0 border-slate-100">
          <div class="inline-flex rounded-xl bg-slate-100 p-1 gap-1">
            <button type="button" onclick="setPaymentStatus('${m.id}', true)"
              class="px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                m.paid ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:bg-emerald-50 hover:text-emerald-700'
              }">
              Sudah Bayar
            </button>
            <button type="button" onclick="setPaymentStatus('${m.id}', false)"
              class="px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                !m.paid ? 'bg-rose-600 text-white shadow-xs' : 'text-slate-600 hover:bg-rose-50 hover:text-rose-700'
              }">
              Belum Bayar
            </button>
          </div>
          <button type="button" onclick="deleteMember('${m.id}', '${escapeHTML(m.name)}')"
            class="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer" title="Hapus Anggota">
            🗑️
          </button>
        </div>
      </div>
    `;
    container.appendChild(card);
  });
}

// Jalankan pertama kali
loadMembers();
