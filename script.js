/**
 * HotelOS — Gestion Hôtelière
 * JavaScript Principal — Vanilla JS, LocalStorage, Chart.js
 */

'use strict';

/* =============================================
   STATE & STORAGE
   ============================================= */

/**
 * Charge les données depuis localStorage
 * @param {string} key
 * @param {*} defaultValue
 */
function load(key, defaultValue = []) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : defaultValue;
  } catch { return defaultValue; }
}

/**
 * Sauvegarde les données dans localStorage
 * @param {string} key
 * @param {*} value
 */
function save(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

// Initialisation des données
let rooms = load('hotelos_rooms', []);
let reservations = load('hotelos_reservations', []);

// Insérer des données de démo si vide
if (rooms.length === 0 && reservations.length === 0) {
  rooms = [
    { id: uid(), number: 101, type: 'Simple',  price: 350, status: 'disponible' },
    { id: uid(), number: 102, type: 'Double',  price: 550, status: 'occupée' },
    { id: uid(), number: 201, type: 'Suite',   price: 1200, status: 'disponible' },
    { id: uid(), number: 202, type: 'Deluxe',  price: 800, status: 'occupée' },
    { id: uid(), number: 301, type: 'Présidentielle', price: 2500, status: 'disponible' },
  ];
  reservations = [
    { id: uid(), clientName: 'Ahmed Benali',   roomNumber: 102, checkIn: '2025-06-01', checkOut: '2025-06-05', total: 2200 },
    { id: uid(), clientName: 'Sara El Fassi',  roomNumber: 202, checkIn: '2025-06-03', checkOut: '2025-06-07', total: 3200 },
  ];
  save('hotelos_rooms', rooms);
  save('hotelos_reservations', reservations);
}

/* =============================================
   UTILITIES
   ============================================= */

/** Génère un identifiant unique */
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/** Formate une date ISO en français */
function fmtDate(iso) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

/** Calcule le nombre de nuits entre deux dates ISO */
function nights(checkIn, checkOut) {
  const a = new Date(checkIn), b = new Date(checkOut);
  return Math.max(0, Math.round((b - a) / 86400000));
}

/** Retourne le prix nuit d'une chambre par son numéro */
function roomPrice(number) {
  const r = rooms.find(r => r.number === Number(number));
  return r ? r.price : 0;
}

/** Calcule le total d'une réservation */
function calcTotal(roomNumber, checkIn, checkOut) {
  return nights(checkIn, checkOut) * roomPrice(roomNumber);
}

/* =============================================
   NAVIGATION
   ============================================= */

const pages = { dashboard: null, rooms: null, reservations: null };

/** Active une page */
function showPage(name) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  const page = document.getElementById(`page-${name}`);
  if (page) page.classList.add('active');

  const navItem = document.querySelector(`.nav-item[data-page="${name}"]`);
  if (navItem) navItem.classList.add('active');

  const titles = { dashboard: 'Dashboard', rooms: 'Chambres', reservations: 'Réservations' };
  document.getElementById('pageTitle').textContent = titles[name] || name;

  // Refresh data for the page
  if (name === 'dashboard') renderDashboard();
  if (name === 'rooms') renderRoomsTable();
  if (name === 'reservations') renderReservationsTable();

  closeSidebar();
}

document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', e => {
    e.preventDefault();
    showPage(item.dataset.page);
  });
});

/* ===== Sidebar Mobile ===== */
const sidebar = document.getElementById('sidebar');
const hamburger = document.getElementById('hamburger');
let sidebarOverlay;

function openSidebar() {
  sidebar.classList.add('open');
  if (!sidebarOverlay) {
    sidebarOverlay = document.createElement('div');
    sidebarOverlay.className = 'sidebar-overlay';
    document.body.appendChild(sidebarOverlay);
    sidebarOverlay.addEventListener('click', closeSidebar);
  }
  sidebarOverlay.classList.add('active');
}

function closeSidebar() {
  sidebar.classList.remove('open');
  if (sidebarOverlay) sidebarOverlay.classList.remove('active');
}

hamburger.addEventListener('click', openSidebar);
document.getElementById('sidebarToggle').addEventListener('click', closeSidebar);

/* ===== Dark Mode ===== */
const themeToggle = document.getElementById('themeToggle');
const themeIcon = document.getElementById('themeIcon');
const themeLabel = document.getElementById('themeLabel');
let isDark = localStorage.getItem('hotelos_theme') === 'dark';

function applyTheme() {
  document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
  themeIcon.textContent = isDark ? '○' : '◑';
  themeLabel.textContent = isDark ? 'Mode Clair' : 'Mode Sombre';
  localStorage.setItem('hotelos_theme', isDark ? 'dark' : 'light');
  // Mise à jour du graphique si existant
  if (window._occupancyChart) renderDashboard();
}

themeToggle.addEventListener('click', () => { isDark = !isDark; applyTheme(); });
applyTheme();

/* ===== Date actuelle ===== */
const dateEl = document.getElementById('currentDate');
const now = new Date();
dateEl.textContent = now.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

/* =============================================
   DASHBOARD
   ============================================= */

let occupancyChart = null;

function renderDashboard() {
  const total      = rooms.length;
  const available  = rooms.filter(r => r.status === 'disponible').length;
  const occupied   = rooms.filter(r => r.status === 'occupée').length;
  const totalRes   = reservations.length;
  const revenue    = reservations.reduce((s, r) => s + (r.total || 0), 0);

  document.getElementById('stat-total').textContent        = total;
  document.getElementById('stat-available').textContent    = available;
  document.getElementById('stat-occupied').textContent     = occupied;
  document.getElementById('stat-reservations').textContent = totalRes;
  document.getElementById('stat-revenue').textContent      = `${revenue.toLocaleString('fr-FR')} MAD`;

  renderOccupancyChart(available, occupied);
  renderRecentReservations();
}

function renderOccupancyChart(available, occupied) {
  const ctx = document.getElementById('occupancyChart').getContext('2d');
  const textColor = isDark ? '#8A847C' : '#6B6560';

  if (occupancyChart) occupancyChart.destroy();

  occupancyChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Disponibles', 'Occupées'],
      datasets: [{
        data: [available || 0, occupied || 0],
        backgroundColor: ['#2D7D4F', '#C0442B'],
        borderColor: isDark ? '#1A1714' : '#FFFFFF',
        borderWidth: 3,
        hoverOffset: 8,
      }]
    },
    options: {
      responsive: true,
      cutout: '68%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            color: textColor,
            font: { family: 'DM Sans', size: 12 },
            padding: 16,
            usePointStyle: true,
            pointStyleWidth: 8,
          }
        },
        tooltip: {
          callbacks: {
            label: (ctx) => ` ${ctx.parsed} chambre${ctx.parsed !== 1 ? 's' : ''}`
          }
        }
      }
    }
  });
  window._occupancyChart = occupancyChart;
}

function renderRecentReservations() {
  const container = document.getElementById('recentReservations');
  const recent = [...reservations].sort((a, b) => b.id.localeCompare(a.id)).slice(0, 5);

  if (recent.length === 0) {
    container.innerHTML = '<p class="recent-empty">Aucune réservation</p>';
    return;
  }

  container.innerHTML = recent.map(r => `
    <div class="recent-item">
      <div>
        <div class="recent-client">${escHtml(r.clientName)}</div>
        <div class="recent-room">Ch. ${r.roomNumber} · ${fmtDate(r.checkIn)} → ${fmtDate(r.checkOut)}</div>
      </div>
      <span class="recent-amount">${(r.total || 0).toLocaleString('fr-FR')} MAD</span>
    </div>
  `).join('');
}

/* =============================================
   ROOMS
   ============================================= */

let roomSortField = 'number';
let roomSortAsc   = true;

function renderRoomsTable() {
  const search = (document.getElementById('roomSearch').value || '').toLowerCase();
  const filter = document.getElementById('roomFilter').value;

  let data = rooms.filter(r => {
    const matchSearch = String(r.number).includes(search)
      || r.type.toLowerCase().includes(search)
      || r.status.includes(search);
    const matchFilter = !filter || r.status === filter;
    return matchSearch && matchFilter;
  });

  // Sort
  data.sort((a, b) => {
    let av = a[roomSortField], bv = b[roomSortField];
    if (typeof av === 'string') av = av.toLowerCase();
    if (typeof bv === 'string') bv = bv.toLowerCase();
    return (av < bv ? -1 : av > bv ? 1 : 0) * (roomSortAsc ? 1 : -1);
  });

  const tbody = document.getElementById('roomTableBody');
  const empty = document.getElementById('roomEmpty');

  if (data.length === 0) {
    tbody.innerHTML = '';
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';

  tbody.innerHTML = data.map(r => `
    <tr>
      <td><strong>#${r.number}</strong></td>
      <td>${escHtml(r.type)}</td>
      <td class="price-cell">${r.price.toLocaleString('fr-FR')} MAD</td>
      <td>${statusBadge(r.status)}</td>
      <td>
        <div class="actions-cell">
          <button class="btn-icon edit" onclick="editRoom('${r.id}')" title="Modifier">✎ Modifier</button>
          <button class="btn-icon delete" onclick="deleteRoom('${r.id}')" title="Supprimer">✕ Supprimer</button>
        </div>
      </td>
    </tr>
  `).join('');
}

/** Badge état */
function statusBadge(status) {
  if (status === 'disponible') return `<span class="badge badge-green">Disponible</span>`;
  if (status === 'occupée')   return `<span class="badge badge-rose">Occupée</span>`;
  return `<span class="badge">${status}</span>`;
}

/** Recherche & Filtre temps réel */
document.getElementById('roomSearch').addEventListener('input', renderRoomsTable);
document.getElementById('roomFilter').addEventListener('change', renderRoomsTable);

/** Tri colonnes */
document.getElementById('roomTable').querySelectorAll('th[data-sort]').forEach(th => {
  th.addEventListener('click', () => {
    const field = th.dataset.sort;
    const fieldMap = { number: 'number', type: 'type', price: 'price', status: 'status' };
    const mapped = fieldMap[field] || field;

    if (roomSortField === mapped) roomSortAsc = !roomSortAsc;
    else { roomSortField = mapped; roomSortAsc = true; }

    document.querySelectorAll('#roomTable th').forEach(t => t.classList.remove('sorted'));
    th.classList.add('sorted');
    renderRoomsTable();
  });
});

/** Ouvre le modal d'ajout */
function openRoomModal(room = null) {
  document.getElementById('roomModalTitle').textContent = room ? 'Modifier la Chambre' : 'Ajouter une Chambre';
  document.getElementById('roomSubmitBtn').textContent  = room ? 'Enregistrer les modifications' : 'Ajouter la Chambre';
  document.getElementById('roomId').value        = room ? room.id : '';
  document.getElementById('roomNumber').value    = room ? room.number : '';
  document.getElementById('roomType').value      = room ? room.type : '';
  document.getElementById('roomPrice').value     = room ? room.price : '';
  document.getElementById('roomStatus').value    = room ? room.status : 'disponible';
  clearErrors('roomForm');
  openModal('roomModal');
}

document.getElementById('addRoomBtn').addEventListener('click', () => openRoomModal());

/** Modifier */
function editRoom(id) {
  const room = rooms.find(r => r.id === id);
  if (room) openRoomModal(room);
}

/** Supprimer */
function deleteRoom(id) {
  const room = rooms.find(r => r.id === id);
  if (!room) return;

  // Vérifier si une réservation active utilise cette chambre
  const hasRes = reservations.some(r => r.roomNumber === room.number);
  const msg = hasRes
    ? `Supprimer la chambre #${room.number} ? Des réservations associées existent.`
    : `Supprimer la chambre #${room.number} (${room.type}) ?`;

  confirmAction(msg, () => {
    rooms = rooms.filter(r => r.id !== id);
    save('hotelos_rooms', rooms);
    renderRoomsTable();
    showToast('Chambre supprimée avec succès', 'success');
  });
}

/** Formulaire chambre — soumission */
document.getElementById('roomForm').addEventListener('submit', e => {
  e.preventDefault();
  if (!validateRoomForm()) return;

  const id     = document.getElementById('roomId').value;
  const number = parseInt(document.getElementById('roomNumber').value);
  const type   = document.getElementById('roomType').value;
  const price  = parseFloat(document.getElementById('roomPrice').value);
  const status = document.getElementById('roomStatus').value;

  // Vérifier doublon de numéro (sauf si même chambre)
  const dup = rooms.find(r => r.number === number && r.id !== id);
  if (dup) {
    showFieldError('roomNumber', `La chambre #${number} existe déjà`);
    return;
  }

  if (id) {
    // Modifier
    const idx = rooms.findIndex(r => r.id === id);
    rooms[idx] = { id, number, type, price, status };
    showToast('Chambre modifiée avec succès', 'success');
  } else {
    // Ajouter
    rooms.push({ id: uid(), number, type, price, status });
    showToast('Chambre ajoutée avec succès', 'success');
  }

  save('hotelos_rooms', rooms);
  closeModal('roomModal');
  renderRoomsTable();
  renderDashboard();
});

function validateRoomForm() {
  clearErrors('roomForm');
  let valid = true;

  const num   = document.getElementById('roomNumber').value;
  const type  = document.getElementById('roomType').value;
  const price = document.getElementById('roomPrice').value;

  if (!num || isNaN(num) || parseInt(num) < 1) {
    showFieldError('roomNumber', 'Numéro de chambre invalide (entier positif)');
    valid = false;
  }
  if (!type) {
    showFieldError('roomType', 'Veuillez sélectionner un type');
    valid = false;
  }
  if (!price || isNaN(price) || parseFloat(price) <= 0) {
    showFieldError('roomPrice', 'Prix invalide (nombre positif)');
    valid = false;
  }
  return valid;
}

/* =============================================
   RESERVATIONS
   ============================================= */

let resSortField = 'checkIn';
let resSortAsc   = false;

function renderReservationsTable() {
  const search = (document.getElementById('resSearch').value || '').toLowerCase();
  const filter = document.getElementById('resFilter').value;
  const today  = new Date().toISOString().split('T')[0];

  let data = reservations.filter(r => {
    const matchSearch = r.clientName.toLowerCase().includes(search)
      || String(r.roomNumber).includes(search);
    const isActive = r.checkOut >= today;
    const matchFilter = !filter
      || (filter === 'active' && isActive)
      || (filter === 'past' && !isActive);
    return matchSearch && matchFilter;
  });

  // Sort
  data.sort((a, b) => {
    let av = a[resSortField], bv = b[resSortField];
    if (typeof av === 'string') av = av.toLowerCase();
    if (typeof bv === 'string') bv = bv.toLowerCase();
    return (av < bv ? -1 : av > bv ? 1 : 0) * (resSortAsc ? 1 : -1);
  });

  const tbody = document.getElementById('resTableBody');
  const empty = document.getElementById('resEmpty');

  if (data.length === 0) {
    tbody.innerHTML = '';
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';

  tbody.innerHTML = data.map(r => {
    const isActive = r.checkOut >= today;
    return `
      <tr>
        <td><strong>${escHtml(r.clientName)}</strong></td>
        <td>#${r.roomNumber}</td>
        <td>${fmtDate(r.checkIn)}</td>
        <td>${fmtDate(r.checkOut)}</td>
        <td><strong>${(r.total || 0).toLocaleString('fr-FR')} MAD</strong></td>
        <td>
          <div class="actions-cell">
            <button class="btn-icon edit" onclick="editReservation('${r.id}')" title="Modifier">✎ Modifier</button>
            <button class="btn-icon delete" onclick="deleteReservation('${r.id}')" title="Supprimer">✕ Supprimer</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

document.getElementById('resSearch').addEventListener('input', renderReservationsTable);
document.getElementById('resFilter').addEventListener('change', renderReservationsTable);

/** Tri réservations */
document.getElementById('resTable').querySelectorAll('th[data-sort]').forEach(th => {
  th.addEventListener('click', () => {
    const field = th.dataset.sort;
    if (resSortField === field) resSortAsc = !resSortAsc;
    else { resSortField = field; resSortAsc = true; }

    document.querySelectorAll('#resTable th').forEach(t => t.classList.remove('sorted'));
    th.classList.add('sorted');
    renderReservationsTable();
  });
});

/** Ouvre modal réservation */
function openReservationModal(res = null) {
  document.getElementById('resModalTitle').textContent = res ? 'Modifier la Réservation' : 'Nouvelle Réservation';
  document.getElementById('resSubmitBtn').textContent  = res ? 'Enregistrer les modifications' : 'Confirmer la Réservation';

  // Peupler la liste des chambres disponibles
  const select = document.getElementById('resRoom');
  const editId = res ? res.id : null;

  // En modification, on inclut la chambre actuelle même si occupée
  const availableRooms = rooms.filter(r =>
    r.status === 'disponible' || (res && r.number === res.roomNumber)
  );

  select.innerHTML = '<option value="">Sélectionner une chambre…</option>'
    + availableRooms.map(r => `
      <option value="${r.number}" ${res && r.number === res.roomNumber ? 'selected' : ''}>
        #${r.number} — ${r.type} (${r.price.toLocaleString('fr-FR')} MAD/nuit)
      </option>
    `).join('');

  document.getElementById('resId').value      = res ? res.id : '';
  document.getElementById('clientName').value = res ? res.clientName : '';
  document.getElementById('checkIn').value    = res ? res.checkIn : '';
  document.getElementById('checkOut').value   = res ? res.checkOut : '';

  clearErrors('resForm');
  updatePricePreview();
  openModal('reservationModal');
}

document.getElementById('addReservationBtn').addEventListener('click', () => openReservationModal());

function editReservation(id) {
  const res = reservations.find(r => r.id === id);
  if (res) openReservationModal(res);
}

function deleteReservation(id) {
  const res = reservations.find(r => r.id === id);
  if (!res) return;

  confirmAction(`Supprimer la réservation de ${res.clientName} (Ch. #${res.roomNumber}) ?`, () => {
    // Remettre la chambre en disponible
    const roomIdx = rooms.findIndex(r => r.number === res.roomNumber);
    if (roomIdx !== -1) rooms[roomIdx].status = 'disponible';
    save('hotelos_rooms', rooms);

    reservations = reservations.filter(r => r.id !== id);
    save('hotelos_reservations', reservations);
    renderReservationsTable();
    renderDashboard();
    showToast('Réservation supprimée', 'success');
  });
}

/** Calcul prix en temps réel */
function updatePricePreview() {
  const roomNum  = document.getElementById('resRoom').value;
  const checkIn  = document.getElementById('checkIn').value;
  const checkOut = document.getElementById('checkOut').value;
  const preview  = document.getElementById('pricePreview');

  if (roomNum && checkIn && checkOut && checkOut > checkIn) {
    const n     = nights(checkIn, checkOut);
    const price = roomPrice(roomNum);
    const total = n * price;
    document.getElementById('previewAmount').textContent = `${total.toLocaleString('fr-FR')} MAD`;
    document.getElementById('previewDetail').textContent = `${n} nuit${n > 1 ? 's' : ''} × ${price.toLocaleString('fr-FR')} MAD`;
    preview.style.display = 'flex';
  } else {
    preview.style.display = 'none';
  }
}

document.getElementById('resRoom').addEventListener('change', updatePricePreview);
document.getElementById('checkIn').addEventListener('change', updatePricePreview);
document.getElementById('checkOut').addEventListener('change', updatePricePreview);

/** Formulaire réservation — soumission */
document.getElementById('resForm').addEventListener('submit', e => {
  e.preventDefault();
  if (!validateResForm()) return;

  const id         = document.getElementById('resId').value;
  const clientName = document.getElementById('clientName').value.trim();
  const roomNumber = parseInt(document.getElementById('resRoom').value);
  const checkIn    = document.getElementById('checkIn').value;
  const checkOut   = document.getElementById('checkOut').value;
  const total      = calcTotal(roomNumber, checkIn, checkOut);

  if (id) {
    // Modifier : remettre ancienne chambre disponible si chambre changée
    const oldRes = reservations.find(r => r.id === id);
    if (oldRes && oldRes.roomNumber !== roomNumber) {
      const oldRoomIdx = rooms.findIndex(r => r.number === oldRes.roomNumber);
      if (oldRoomIdx !== -1) rooms[oldRoomIdx].status = 'disponible';
    }

    const idx = reservations.findIndex(r => r.id === id);
    reservations[idx] = { id, clientName, roomNumber, checkIn, checkOut, total };
    showToast('Réservation modifiée avec succès', 'success');
  } else {
    reservations.push({ id: uid(), clientName, roomNumber, checkIn, checkOut, total });
    showToast('Réservation confirmée', 'success');
  }

  // Mettre la chambre en occupée
  const roomIdx = rooms.findIndex(r => r.number === roomNumber);
  if (roomIdx !== -1) rooms[roomIdx].status = 'occupée';

  save('hotelos_rooms', rooms);
  save('hotelos_reservations', reservations);
  closeModal('reservationModal');
  renderReservationsTable();
  renderDashboard();
});

function validateResForm() {
  clearErrors('resForm');
  let valid = true;

  const clientName = document.getElementById('clientName').value.trim();
  const roomNum    = document.getElementById('resRoom').value;
  const checkIn    = document.getElementById('checkIn').value;
  const checkOut   = document.getElementById('checkOut').value;
  const resId      = document.getElementById('resId').value;

  if (!clientName || clientName.length < 2) {
    showFieldError('clientName', 'Nom invalide (min. 2 caractères)');
    valid = false;
  }
  if (!roomNum) {
    showFieldError('resRoom', 'Veuillez sélectionner une chambre');
    valid = false;
  }
  if (!checkIn) {
    showFieldError('checkIn', "Date d'arrivée requise");
    valid = false;
  }
  if (!checkOut) {
    showFieldError('checkOut', 'Date de départ requise');
    valid = false;
  }
  if (checkIn && checkOut && checkOut <= checkIn) {
    showFieldError('checkOut', 'Le départ doit être après l\'arrivée');
    valid = false;
  }

  // Vérifier conflit de réservation pour la même chambre
  if (valid && roomNum && checkIn && checkOut) {
    const rNum = parseInt(roomNum);
    const conflict = reservations.find(r => {
      if (r.id === resId) return false; // Skip la réservation en modification
      if (r.roomNumber !== rNum) return false;
      return !(checkOut <= r.checkIn || checkIn >= r.checkOut);
    });
    if (conflict) {
      showFieldError('resRoom', `Conflit avec la réservation de ${conflict.clientName} (${fmtDate(conflict.checkIn)} → ${fmtDate(conflict.checkOut)})`);
      valid = false;
    }
  }
  return valid;
}

/* =============================================
   MODAL SYSTEM
   ============================================= */

function openModal(id) {
  document.getElementById(id).classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeModal(id) {
  document.getElementById(id).classList.remove('open');
  document.body.style.overflow = '';
}

// Fermer en cliquant sur l'overlay
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', e => {
    if (e.target === overlay) closeModal(overlay.id);
  });
});

// Fermer avec Escape
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay.open').forEach(o => closeModal(o.id));
  }
});

/** Boîte de confirmation */
let confirmCallback = null;

function confirmAction(text, callback) {
  document.getElementById('confirmText').textContent = text;
  confirmCallback = callback;
  openModal('confirmModal');
}

document.getElementById('confirmBtn').addEventListener('click', () => {
  closeModal('confirmModal');
  if (confirmCallback) { confirmCallback(); confirmCallback = null; }
});

/* =============================================
   FORM VALIDATION HELPERS
   ============================================= */

function showFieldError(fieldId, msg) {
  const errEl = document.getElementById(`err-${fieldId}`);
  const input = document.getElementById(fieldId);
  if (errEl) errEl.textContent = msg;
  if (input) input.classList.add('error');
}

function clearErrors(formId) {
  const form = document.getElementById(formId);
  if (!form) return;
  form.querySelectorAll('.field-error').forEach(e => e.textContent = '');
  form.querySelectorAll('.error').forEach(e => e.classList.remove('error'));
}

/* =============================================
   TOAST NOTIFICATIONS
   ============================================= */

const icons = { success: '✓', error: '✕', info: 'ℹ' };

function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span class="toast-icon">${icons[type] || 'ℹ'}</span><span>${escHtml(message)}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'toastOut 0.3s ease forwards';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

/* =============================================
   SECURITY: Escape HTML
   ============================================= */

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/* =============================================
   INIT
   ============================================= */

// Rendre les fonctions globalement accessibles pour les onclick inline
window.openRoomModal       = openRoomModal;
window.openReservationModal = openReservationModal;
window.editRoom            = editRoom;
window.deleteRoom          = deleteRoom;
window.editReservation     = editReservation;
window.deleteReservation   = deleteReservation;
window.closeModal          = closeModal;

// Lancer le dashboard
showPage('dashboard');