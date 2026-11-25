// TEMPEL URL GOOGLE APPS SCRIPT ANDA DI SINI:
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwPi3Jcumu-YPC4q0NNz52BpZ48UD-G7VoF26ZChv5twAhBGBWsYAX9xCYb1oiCcY8E7g/exec";

let members = [];
let adminPin = ""; // Tersimpan sementara selama sesi admin aktif
let currentFilter = 'all';
let toastTimeout = null;

// Ambil data dari Google Sheets saat halaman dibuka
async function loadMembers() {
  document.getElementById('loadingState').classList.remove('hidden');
  try {
    const res = await fetch(SCRIPT_URL);
    members = await res.json();
    members.reverse(); // Terbaru di atas
  } catch (err) {
    showToast('Gagal memuat data dari Google Sheets');
  }
  document.getElementById('loadingState').classList.add('hidden');
  updateStats();
  renderMembers();
}

// Kirim perintah perubahan ke Google Sheets
async function sendToSheet(payload) {
  showToast('Menyimpan ke Google Sheets...');
  try {
    const res = await fetch(SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify({ ...payload, pin: adminPin })
    });
    const result = await res.json();
    if (result.status === "error") {
      alert(result.message);
      logoutAdmin();
      return false;
    }
    await loadMembers();
    showToast('Berhasil tersimpan!');
    return true;
  } catch (err) {
    showToast('Terjadi kesalahan koneksi');
    return false;
  }
}

// Login pakai PIN sederhana
function openLoginModal() {
  const inputPin = prompt("Masukkan PIN Admin:");
  if (inputPin) {
    adminPin = inputPin;
    updateAdminUI();
    renderMembers();
    showToast('Mode Admin aktif');
  }
}

function logoutAdmin() {
  adminPin = "";
  updateAdminUI();
  renderMembers();
  showToast('Keluar dari Mode Admin');
}

function updateAdminUI() {
  const isAdmin = adminPin !== "";
  document.getElementById('adminFormSection').classList.toggle('hidden', !isAdmin);
  document.getElementById('visitorBanner').classList.toggle('hidden', isAdmin);
  document.getElementById('btnOpenLogin').classList.toggle('hidden', isAdmin);
  document.getElementById('btnLogout').classList.toggle('hidden', !isAdmin);
  document.getElementById('btnResetMonth').classList.toggle('hidden', !isAdmin);

  const listSection = document.getElementById('listSection');
  if (isAdmin) {
    listSection.classList.remove('lg:col-span-12');
    listSection.classList.add('lg:col-span-8');
  } else {
    listSection.classList.remove('lg:col-span-8');
    listSection.classList.add('lg:col-span-12');
  }
}

// Tambah Anggota
document.getElementById('addMemberForm').addEventListener('submit', async function (e) {
  e.preventDefault();
  const name = document.getElementById('memberName').value.trim();
  const amount = parseInt(document.getElementById('memberAmount').value, 10);
  const note = document.getElementById('memberNote').value.trim();
  if (!name || isNaN(amount)) return;

  const ok = await sendToSheet({ action: 'add', name, amount, note });
  if (ok) document.getElementById('addMemberForm').reset();
});

// Ubah Status Bayar / Belum Bayar
function setPaymentStatus(id, isPaid) {
  const paidAt = new Date().toLocaleDateString('id-ID', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });
  sendToSheet({ action: 'toggle', id, paid: isPaid, paidAt });
}

// Hapus Anggota
function deleteMember(id, name) {
  if (confirm(`Hapus ${name} dari Google Sheets?`)) {
    sendToSheet({ action: 'delete', id });
  }
}

// Reset Bulan Baru
function openResetModal() {
  if (confirm('Reset semua anggota menjadi Belum Bayar?')) {
    sendToSheet({ action: 'reset' });
  }
}

function formatRupiah(num) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(num);
}

function setAmountPreset(val) {
  document.getElementById('memberAmount').value = val;
}

function showToast(msg) {
  const toast = document.getElementById('toast');
  document.getElementById('toastText').textContent = msg;
  toast.classList.remove('translate-y-20', 'opacity-0');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => toast.classList.add('translate-y-20', 'opacity-0'), 2800);
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
  document.getElementById('progressBar').style.width = `${total > 0 ? Math.round((collected / total) * 100) : 0}%`;

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
  const isAdmin = adminPin !== "";

  const filtered = members.filter(m => {
    const okFilter = currentFilter === 'all' || (currentFilter === 'paid' && m.paid) || (currentFilter === 'unpaid' && !m.paid);
    const okSearch = m.name.toLowerCase().includes(q) || (m.note && m.note.toLowerCase().includes(q));
    return okFilter && okSearch;
  });

  container.innerHTML = '';
  if (filtered.length === 0) {
    emptyState.classList.remove('hidden');
    return;
  }
  emptyState.classList.add('hidden');

  filtered.forEach(m => {
    const card = document.createElement('div');
    card.className = `bg-white rounded-2xl p-4 sm:p-5 border shadow-xs ${m.paid ? 'border-emerald-200 bg-emerald-50/15' : 'border-slate-200'}`;
    const controls = isAdmin ? `
      <div class="flex flex-wrap items-center gap-2 pt-3 sm:pt-0 border-t sm:border-t-0 border-slate-100">
        <div class="inline-flex rounded-xl bg-slate-100 p-1 gap-1">
          <button onclick="setPaymentStatus('${m.id}', true)" class="px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${m.paid ? 'bg-emerald-600 text-white' : 'text-slate-600'}">Sudah Bayar</button>
          <button onclick="setPaymentStatus('${m.id}', false)" class="px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${!m.paid ? 'bg-rose-600 text-white' : 'text-slate-600'}">Belum Bayar</button>
        </div>
        <button onclick="deleteMember('${m.id}', '${escapeHTML(m.name)}')" class="p-2 text-slate-400 hover:text-rose-600 cursor-pointer">🗑️</button>
      </div>` : '';

    card.innerHTML = `
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div class="flex items-center gap-2">
            <h3 class="font-bold text-slate-800 text-base">${escapeHTML(m.name)}</h3>
            <span class="px-2.5 py-0.5 rounded-full text-[11px] font-bold ${m.paid ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}">${m.paid ? 'Lunas' : 'Belum Bayar'}</span>
          </div>
          <p class="text-sm font-extrabold mt-1 ${m.paid ? 'text-emerald-700' : 'text-slate-800'}">
            ${formatRupiah(m.amount)} ${m.note ? `<span class="text-xs font-normal text-slate-500">• ${escapeHTML(m.note)}</span>` : ''}
          </p>
          ${m.paid && m.paidAt ? `<p class="text-[11px] text-emerald-600 mt-1">✓ Dibayar pada ${m.paidAt}</p>` : ''}
        </div>
        ${controls}
      </div>`;
    container.appendChild(card);
  });
}

// Jalankan pertama kali
loadMembers();
