const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbz7MWZLhaDi6hFlxYsrKzgwswdD-ziG7SXXTHcZW55SUBKML-4WAZYiodziEKeOtYXQ/exec";

let members = [];
let adminPassword = "";
let currentFilter = 'all';
let toastTimeout = null;

function sanitizeId(raw) {
  return String(raw || '').trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
}

// Ambil data dari Google Sheets
async function loadMembers() {
  const loadingEl = document.getElementById('loadingState');
  if (loadingEl) loadingEl.classList.remove('hidden');

  try {
    const res = await fetch(SCRIPT_URL + "?t=" + Date.now());
    const data = await res.json();
    members = Array.isArray(data) ? data.reverse() : [];
  } catch (err) {
    console.error(err);
    showToast('Gagal memuat data dari Google Sheets');
  }

  if (loadingEl) loadingEl.classList.add('hidden');
  updateStats();
  renderMembers();
}

// Fitur Ambil GPS Otomatis dari HP
function captureCurrentGPS(inputId, btnId) {
  if (!navigator.geolocation) {
    alert('Browser HP Anda tidak mendukung fitur GPS.');
    return;
  }

  const btn = document.getElementById(btnId);
  const originalText = btn.textContent;
  btn.textContent = '⏳ Mencari titik...';
  btn.disabled = true;

  navigator.geolocation.getCurrentPosition(
    function (pos) {
      const lat = pos.coords.latitude.toFixed(6);
      const lng = pos.coords.longitude.toFixed(6);
      const mapsUrl = `https://www.google.com/maps?q=${lat},${lng}`;
      document.getElementById(inputId).value = mapsUrl;
      btn.textContent = '✅ GPS Didapat';
      setTimeout(() => {
        btn.textContent = originalText;
        btn.disabled = false;
      }, 1500);
      showToast('Titik koordinat GPS berhasil diambil!');
    },
    function (err) {
      alert('Gagal mengambil GPS. Pastikan izin Lokasi (Location) di HP dan browser aktif.');
      btn.textContent = originalText;
      btn.disabled = false;
    },
    { enableHighAccuracy: true, timeout: 10000 }
  );
}

function formatMapsUrl(rawLoc) {
  if (!rawLoc) return "";
  const clean = rawLoc.trim();
  if (clean.startsWith("http://") || clean.startsWith("https://")) {
    return clean;
  }
  return `https://www.google.com/maps?q=${encodeURIComponent(clean)}`;
}

// Modal Login & Verifikasi Password
function openLoginModal() {
  const modal = document.getElementById('loginModal');
  modal.classList.remove('hidden');
  modal.classList.add('flex');
  document.getElementById('adminPasswordInput').focus();
}

function closeLoginModal() {
  const modal = document.getElementById('loginModal');
  modal.classList.add('hidden');
  modal.classList.remove('flex');
  document.getElementById('adminPasswordInput').value = '';
}

document.getElementById('loginForm').addEventListener('submit', async function (e) {
  e.preventDefault();
  const inputPass = document.getElementById('adminPasswordInput').value.trim();
  const btn = document.getElementById('btnSubmitLogin');
  if (!inputPass) return;

  btn.textContent = 'Memeriksa...';
  btn.disabled = true;

  try {
    const url = `${SCRIPT_URL}?action=login&password=${encodeURIComponent(inputPass)}&t=${Date.now()}`;
    const res = await fetch(url);
    const result = await res.json();

    if (result.status === 'ok') {
      adminPassword = inputPass;
      closeLoginModal();
      updateAdminUI();
      renderMembers();
      showToast('Login Admin berhasil!');
    } else {
      alert(result.message || 'Password Salah!');
    }
  } catch (err) {
    alert('Gagal terhubung ke Google Apps Script. Cek kembali URL SCRIPT_URL.');
  }

  btn.textContent = 'Masuk';
  btn.disabled = false;
});

function logoutAdmin() {
  adminPassword = "";
  updateAdminUI();
  renderMembers();
  showToast('Anda keluar dari Mode Admin');
}

function updateAdminUI() {
  const isAdmin = adminPassword !== "";
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

// Modal Pilih Metode Pembayaran (Cash / Transfer)
function openPaymentModalByBtn(btn) {
  const id = btn.dataset.id;
  const member = members.find(m => String(m.id) === String(id));
  if (!member) return;

  document.getElementById('payModalMemberId').value = member.id;
  document.getElementById('payModalMemberInfo').textContent = `${member.name} (#${member.id}) — ${formatRupiah(member.amount)}`;
  const modal = document.getElementById('paymentModal');
  modal.classList.remove('hidden');
  modal.classList.add('flex');
}

function closePaymentModal() {
  const modal = document.getElementById('paymentModal');
  modal.classList.add('hidden');
  modal.classList.remove('flex');
}

async function confirmPayment(method) {
  const id = document.getElementById('payModalMemberId').value;
  closePaymentModal();
  const paidAt = new Date().toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
  await sendToSheet({ action: 'toggle', id, paid: true, paidAt, method });
}

// Modal Edit Lokasi Anggota
function openLocationModalByBtn(btn) {
  const id = btn.dataset.id;
  const member = members.find(m => String(m.id) === String(id));
  if (!member) return;

  document.getElementById('editLocMemberId').value = member.id;
  document.getElementById('locModalMemberName').textContent = `Anggota: ${member.name} (#${member.id})`;
  document.getElementById('editLocInput').value = member.location || '';
  const modal = document.getElementById('locationModal');
  modal.classList.remove('hidden');
  modal.classList.add('flex');
}

function closeLocationModal() {
  const modal = document.getElementById('locationModal');
  modal.classList.add('hidden');
  modal.classList.remove('flex');
}

document.getElementById('editLocationForm').addEventListener('submit', async function (e) {
  e.preventDefault();
  const id = document.getElementById('editLocMemberId').value;
  const location = document.getElementById('editLocInput').value.trim();
  closeLocationModal();
  await sendToSheet({ action: 'update_location', id, location });
});

// Kirim perintah perubahan ke Google Sheets
async function sendToSheet(payload) {
  if (!adminPassword) return false;

  showToast('Menyimpan ke Google Sheets...');
  try {
    const params = new URLSearchParams({
      ...payload,
      password: adminPassword,
      t: Date.now()
    });

    const res = await fetch(`${SCRIPT_URL}?${params.toString()}`);
    const result = await res.json();

    if (result.status === 'error') {
      alert(result.message || 'Gagal menyimpan data!');
      return false;
    }

    await loadMembers();
    showToast('Berhasil tersimpan!');
    return true;
  } catch (err) {
    console.error(err);
    showToast('Terjadi kesalahan koneksi internet');
    return false;
  }
}

// Tambah Anggota
document.getElementById('addMemberForm').addEventListener('submit', async function (e) {
  e.preventDefault();
  const customId = sanitizeId(document.getElementById('memberCustomId').value);
  const name = document.getElementById('memberName').value.trim();
  const amount = parseInt(document.getElementById('memberAmount').value, 10);
  const note = document.getElementById('memberNote').value.trim();
  const location = document.getElementById('memberLocation').value.trim();

  if (!name || isNaN(amount) || amount <= 0) return;

  if (customId && members.some(m => sanitizeId(m.id) === customId)) {
    alert(`ID Pelanggan "${customId}" sudah terdaftar! Gunakan ID lain atau kosongkan untuk otomatis.`);
    return;
  }

  const ok = await sendToSheet({ action: 'add', customId, name, amount, note, location });
  if (ok) {
    document.getElementById('addMemberForm').reset();
  }
});

// Ubah Status ke Belum Bayar
function setUnpaidByBtn(btn) {
  const id = btn.dataset.id;
  sendToSheet({ action: 'toggle', id, paid: false, paidAt: '', method: '' });
}

// Hapus Anggota
function deleteMemberByBtn(btn) {
  const id = btn.dataset.id;
  const member = members.find(m => String(m.id) === String(id));
  const label = member ? `${member.name} (#${member.id})` : id;
  if (confirm(`Yakin ingin menghapus ${label}?`)) {
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
  }, 3000);
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
  const cashMembers = paidMembers.filter(m => (m.method || '').toLowerCase() === 'cash');
  const transferMembers = paidMembers.filter(m => (m.method || '').toLowerCase() === 'transfer');

  const collected = paidMembers.reduce((s, m) => s + Number(m.amount), 0);
  const uncollected = unpaidMembers.reduce((s, m) => s + Number(m.amount), 0);
  const cashTotal = cashMembers.reduce((s, m) => s + Number(m.amount), 0);
  const transferTotal = transferMembers.reduce((s, m) => s + Number(m.amount), 0);
  const total = collected + uncollected;

  document.getElementById('statTotalMembers').textContent = `${members.length} Orang`;
  document.getElementById('statPaidRatio').textContent = `${paidMembers.length} dari ${members.length} lunas`;
  document.getElementById('statCollected').textContent = formatRupiah(collected);
  document.getElementById('statCashBreakdown').textContent = `💵 Cash: ${formatRupiah(cashTotal)} (${cashMembers.length})`;
  document.getElementById('statTransferBreakdown').textContent = `🏦 Transfer: ${formatRupiah(transferTotal)} (${transferMembers.length})`;
  document.getElementById('statUncollected').textContent = formatRupiah(uncollected);
  document.getElementById('statUnpaidCount').textContent = `${unpaidMembers.length} orang menunggak`;
  document.getElementById('statTotalTarget').textContent = formatRupiah(total);

  const percent = total > 0 ? Math.round((collected / total) * 100) : 0;
  document.getElementById('progressBar').style.width = `${percent}%`;

  document.getElementById('countAll').textContent = members.length;
  document.getElementById('countPaid').textContent = paidMembers.length;
  document.getElementById('countUnpaid').textContent = unpaidMembers.length;
  document.getElementById('countCash').textContent = cashMembers.length;
  document.getElementById('countTransfer').textContent = transferMembers.length;
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
  const isAdmin = adminPassword !== "";

  const filtered = members.filter(m => {
    const methodLower = (m.method || '').toLowerCase();
    const okFilter =
      currentFilter === 'all' ||
      (currentFilter === 'paid' && m.paid) ||
      (currentFilter === 'unpaid' && !m.paid) ||
      (currentFilter === 'cash' && m.paid && methodLower === 'cash') ||
      (currentFilter === 'transfer' && m.paid && methodLower === 'transfer');
    const okSearch =
      String(m.id).toLowerCase().includes(q) ||
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
      document.getElementById('emptyDesc').textContent = 'Data akan muncul di sini setelah Admin menambahkannya.';
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

    const safeId = escapeHTML(String(m.id));
    const mapsHref = formatMapsUrl(m.location);
    const locationBadge = mapsHref
      ? `<a href="${escapeHTML(mapsHref)}" target="_blank" rel="noopener noreferrer"
           class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[11px] font-bold bg-sky-50 text-sky-700 hover:bg-sky-100 border border-sky-200 transition">
           📍 Buka Maps
         </a>`
      : '';

    const methodLower = (m.method || '').toLowerCase();
    let methodBadge = '';
    if (m.paid && methodLower === 'cash') {
      methodBadge = `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200">💵 Cash</span>`;
    } else if (m.paid && methodLower === 'transfer') {
      methodBadge = `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">🏦 Transfer</span>`;
    }

    const card = document.createElement('div');
    card.className = `bg-white rounded-2xl p-4 sm:p-5 border transition-all shadow-xs animate-fade-in ${
      m.paid
        ? 'border-emerald-200/90 bg-emerald-50/15'
        : 'border-slate-200/90 hover:border-blue-300'
    }`;

    const adminControls = isAdmin ? `
      <div class="flex flex-wrap sm:flex-nowrap items-center justify-between sm:justify-end gap-2 pt-3 sm:pt-0 border-t sm:border-t-0 border-slate-100">
        <div class="inline-flex rounded-xl bg-slate-100 p-1 gap-1">
          <button type="button" data-id="${safeId}" onclick="openPaymentModalByBtn(this)"
            class="px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              m.paid ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:bg-emerald-50 hover:text-emerald-700'
            }">
            Sudah Bayar
          </button>
          <button type="button" data-id="${safeId}" onclick="setUnpaidByBtn(this)"
            class="px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              !m.paid ? 'bg-rose-600 text-white shadow-xs' : 'text-slate-600 hover:bg-rose-50 hover:text-rose-700'
            }">
            Belum Bayar
          </button>
        </div>
        <button type="button" data-id="${safeId}" onclick="openLocationModalByBtn(this)"
          class="p-2 text-slate-500 hover:text-sky-600 hover:bg-sky-50 rounded-lg transition cursor-pointer" title="Atur / Edit Lokasi">
          📍
        </button>
        <button type="button" data-id="${safeId}" onclick="deleteMemberByBtn(this)"
          class="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer" title="Hapus Anggota">
          🗑️
        </button>
      </div>
    ` : '';

    card.innerHTML = `
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div class="flex items-start sm:items-center gap-3.5 min-w-0">
          <div class="w-11 h-11 rounded-xl font-bold text-sm flex items-center justify-center shrink-0 ${
            m.paid ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
          }">
            ${initials || 'W'}
          </div>
          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-1.5">
              <span class="px-2 py-0.5 rounded-md text-[11px] font-mono font-bold bg-slate-100 text-slate-600 border border-slate-200">
                #${safeId}
              </span>
              <h3 class="font-bold text-slate-800 text-base truncate">${escapeHTML(m.name)}</h3>
              <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                m.paid ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
              }">
                ${m.paid ? 'Lunas' : 'Belum Bayar'}
              </span>
              ${methodBadge}
              ${locationBadge}
            </div>
            <p class="text-sm font-extrabold mt-1 ${m.paid ? 'text-emerald-700' : 'text-slate-800'}">
              ${formatRupiah(m.amount)}
              ${m.note ? `<span class="text-xs font-normal text-slate-500"> • ${escapeHTML(m.note)}</span>` : ''}
            </p>
            ${m.paid && m.paidAt ? `<p class="text-[11px] text-emerald-600 mt-1">✓ Dibayar pada ${m.paidAt}${m.method ? ` (${escapeHTML(m.method)})` : ''}</p>` : ''}
          </div>
        </div>
        ${adminControls}
      </div>
    `;
    container.appendChild(card);
  });
}

loadMembers();
