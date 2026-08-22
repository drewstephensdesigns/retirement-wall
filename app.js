import { app } from './firebase-config.js';
import {
  getFirestore, collection, addDoc, serverTimestamp,
  query, orderBy, onSnapshot, doc, updateDoc, increment
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

const db = getFirestore(app);

// Photos are compressed client-side and stored inline as base64 in the
// Firestore document (no Cloud Storage / Blaze plan needed). Firestore caps
// a document at 1MB total, so we target a conservative ceiling per photo.
const MAX_ORIGINAL_BYTES = 20 * 1024 * 1024; // reject absurdly large uploads before we even try to process them
const MAX_ENCODED_BYTES = 700 * 1024; // target size of the final base64 string

// ---------- Personalize hero from #config ----------
const cfg = document.getElementById('config');
if (cfg) {
  const name = cfg.dataset.name || '';
  const branch = cfg.dataset.branch || '';
  const years = cfg.dataset.years || '';
  const eyebrow = cfg.dataset.eyebrow || '';
  document.getElementById('hero-name').textContent = 'Andrew\'s story. Every maintainer has one.' ;
  document.getElementById('eyebrow').textContent = eyebrow;
  if (branch || years) {
    document.getElementById('hero-sub').textContent =
        ` After ${years ? years + ' years ' : ''}${branch ? 'in the ' + branch + ', ' : ''} there are too many people, places, and memories to fit into a single goodbye. This wall is for the people who were part of that
          journey. Please take a minute and leave your mark below — a note, a photo, whatever you'd want remembered.`
  }
  document.title = `Exceptional Release, ${name} — A Memory Wall`;
}

// ---------- Places served map ----------
// Edit this list: one entry per base/deployment.
// Get lat/lng by searching the place in Google Maps, right-clicking the pin,
// and clicking the coordinates to copy them.
const LOCATIONS = [
  { name: 'Lackland AFB, TX', lat: 29.3843, lng: -98.6205, years: 'September - November 2004 · Basic Training' },
  { name: 'Sheppard AFB, TX', lat: 33.9889, lng: -98.4919, years: 'November 2004 - April 2005 · Tech School' },
  { name: 'Barksdale AFB, LA', lat: 32.5019, lng: -93.6628, years: 'April 2005 – June 2011' },
  { name: 'Hill AFB, UT', lat: 41.1239, lng: -111.9728, years: 'June 2011 – July 2015' },
  { name: 'Dyess AFB, TX', lat: 32.4208, lng: -99.8547, years: 'July 2015 – October 2024' },
  { name: 'Pituffik Space Base, Greenland', lat: 76.5311, lng: -68.7031, years: 'October 2024 – October 2025' },
  { name: 'Dyess AFB, TX', lat: 32.4558, lng: -99.8197, years: 'October 2025 – February 2027' },
];

// Deployments — their own marker style, no flight-path line, so the main
// duty-station path stays readable.
const DEPLOYMENTS = [
  { name: 'Andersen AFB, Guam', lat: 13.5844, lng: 144.9300, years: '2005–2006 · Deployment' },
  { name: 'Bagram Airfield, Afghanistan', lat: 34.9461, lng: 69.2650, years: '2018–2019 · Deployment' },
  { name: 'Camp Lemonnier, Djibouti', lat: 11.5436, lng: 43.1486, years: 'Dec 2020–Jan 2021 · Deployment' },
  { name: 'Bagram Airfield, Afghanistan', lat: 34.9461, lng: 69.2650, years: 'Jan–May 2021 · Deployment' },
  { name: 'Athens, Greece', lat: 37.9838, lng: 23.7275, years: 'Oct 2023 · Deployment' },
  { name: 'Aviano AB, Italy', lat: 46.0314, lng: 12.5969, years: 'Oct–Dec 2023 · Deployment' },
];

// TDY locations
const TDY_LOCATIONS = [
  { name: 'New Orleans, LA', lat: 29.9511, lng: -90.0715, years: '' },
  { name: 'Sheppard AFB, TX', lat: 33.9889, lng: -98.4919, years: '' },
  { name: 'Alexandria, LA', lat: 31.3113, lng: -92.4451, years: '' },
  { name: 'Washington, D.C.', lat: 38.9072, lng: -77.0369, years: '' },
  { name: "Coeur d'Alene, ID", lat: 47.6777, lng: -116.7805, years: '' },
  { name: 'St. Louis, MO', lat: 38.6270, lng: -90.1994, years: '' },
  { name: 'Oxon Hill, MD', lat: 38.7998, lng: -76.9955, years: '' },
  { name: "St. John's, Newfoundland and Labrador", lat: 47.5615, lng: -52.7126, years: '' },
  { name: 'Ramstein AB, Germany', lat: 49.4369, lng: 7.6003, years: '' },
  { name: 'Crete, Greece', lat: 35.3387, lng: 25.1442, years: '' },
  { name: 'Orlando, FL', lat: 28.5384, lng: -81.3789, years: '' },
  { name: 'Anchorage, AK', lat: 61.2181, lng: -149.9003, years: '' }
]

function initLocationsMap() {
  const mapEl = document.getElementById('locations-map');
  if (!mapEl || !window.L || LOCATIONS.length === 0) {
    if (mapEl) mapEl.style.display = 'none';
    return;
  }

  const map = L.map(mapEl, { scrollWheelZoom: false });
  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
    maxZoom: 18
  }).addTo(map);

  const icon = L.divIcon({ className: 'loc-marker', html: '<span></span>', iconSize: [14, 14] });
  const deployIcon = L.divIcon({ className: 'deployment-marker', html: '<span></span>', iconSize: [11, 11] });
  const tdyIcon = L.divIcon({ className: 'tdy-marker', html: '<span></span>', iconSize: [9, 9] });

  const latlngs = LOCATIONS.map((loc) => [loc.lat, loc.lng]);

  LOCATIONS.forEach((loc) => {
    L.marker([loc.lat, loc.lng], { icon })
        .addTo(map)
        .bindPopup(`<strong>${loc.name}</strong><br>${loc.years || ''}`);
  });

  DEPLOYMENTS.forEach((loc) => {
    L.marker([loc.lat, loc.lng], { icon: deployIcon })
        .addTo(map)
        .bindPopup(`<strong>${loc.name}</strong><br>${loc.years || ''}`);
  });

  TDY_LOCATIONS.forEach((loc) => {
    L.marker([loc.lat, loc.lng], { icon: tdyIcon })
        .addTo(map)
        .bindPopup(`<strong>${loc.name}</strong><br>${loc.years || ''}<br><em>TDY</em>`);
  });

  if (latlngs.length > 1) {
    L.polyline(latlngs, { color: '#B8875A', weight: 2, opacity: 0.6, dashArray: '4 8' }).addTo(map);
  }

  const allLatLngs = latlngs
      .concat(DEPLOYMENTS.map((loc) => [loc.lat, loc.lng]))
      .concat(TDY_LOCATIONS.map((loc) => [loc.lat, loc.lng]));
  map.fitBounds(L.latLngBounds(allLatLngs), { padding: [30, 30] });
}

initLocationsMap();

// ---------- Image compression (resize + re-encode as JPEG) ----------
function readAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

async function compressImage(file, maxDim = 1100, maxBytes = MAX_ENCODED_BYTES) {
  const dataUrl = await readAsDataURL(file);
  const img = await loadImage(dataUrl);

  let width = img.width;
  let height = img.height;
  if (width > maxDim || height > maxDim) {
    if (width >= height) {
      height = Math.round(height * (maxDim / width));
      width = maxDim;
    } else {
      width = Math.round(width * (maxDim / height));
      height = maxDim;
    }
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d').drawImage(img, 0, 0, width, height);

  let quality = 0.75;
  let out = canvas.toDataURL('image/jpeg', quality);
  while (out.length > maxBytes && quality > 0.35) {
    quality -= 0.1;
    out = canvas.toDataURL('image/jpeg', quality);
  }

  // Still too big even at low quality — shrink dimensions and retry.
  if (out.length > maxBytes && maxDim > 500) {
    return compressImage(file, Math.round(maxDim * 0.8), maxBytes);
  }

  return out;
}

// ---------- Kiosk / slideshow mode ---------- // NEW SECTION
// Open the site with ?display on the end of the URL (e.g. yoursite.com/?display)
// to get a fullscreen, auto-scrolling view meant for a TV at the ceremony —
// no form, larger text, and a soft pulse + chime when a new entry comes in.
const isKiosk = new URLSearchParams(window.location.search).has('display');
if (isKiosk) document.body.classList.add('kiosk');

function playChime() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    osc.start();
    osc.stop(ctx.currentTime + 0.5);
  } catch (e) { /* audio not available — silently skip */ }
}

function startAutoScroll() {
  const PAUSE_AT_ENDS_MS = 4000;
  function frame() {
    if (!isKiosk) return;
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
    if (window.scrollY >= maxScroll - 2) {
      setTimeout(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        setTimeout(() => requestAnimationFrame(frame), 1200);
      }, PAUSE_AT_ENDS_MS);
      return;
    }
    window.scrollBy(0, 0.6);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

if (isKiosk) setTimeout(startAutoScroll, 3000);

// ---------- Reactions ---------- // NEW SECTION
// One like per browser, tracked in localStorage (not accounts) so the same
// visitor can't spam a single entry. Firestore rules independently enforce
// that a write can ONLY increment `likes` by exactly 1 — see firestore.rules.
function getLikedSet() {
  try {
    return new Set(JSON.parse(localStorage.getItem('likedEntries') || '[]'));
  } catch (e) { return new Set(); }
}
function saveLikedSet(set) {
  try { localStorage.setItem('likedEntries', JSON.stringify([...set])); } catch (e) { /* ignore */ }
}

async function likeEntry(entryId, btn) {
  const liked = getLikedSet();
  if (liked.has(entryId)) return;
  btn.disabled = true;
  try {
    await updateDoc(doc(db, 'entries', entryId), { likes: increment(1) });
    liked.add(entryId);
    saveLikedSet(liked);
  } catch (err) {
    console.error(err);
    btn.disabled = false;
  }
}

// ---------- Photo preview ----------
const photoInput = document.getElementById('photo');
const photoPreview = document.getElementById('photo-preview');
const photoPreviewImg = document.getElementById('photo-preview-img');
const photoRemoveBtn = document.getElementById('photo-remove');

photoInput.addEventListener('change', () => {
  const file = photoInput.files[0];
  if (!file) { photoPreview.hidden = true; return; }
  if (file.size > MAX_ORIGINAL_BYTES) {
    setStatus('That photo is too large — please pick a smaller one.', 'error');
    photoInput.value = '';
    photoPreview.hidden = true;
    return;
  }
  const reader = new FileReader();
  reader.onload = (e) => {
    photoPreviewImg.src = e.target.result;
    photoPreview.hidden = false;
  };
  reader.readAsDataURL(file);
});

photoRemoveBtn.addEventListener('click', () => {
  photoInput.value = '';
  photoPreview.hidden = true;
});

// ---------- Form submission ----------
const form = document.getElementById('note-form');
const submitBtn = document.getElementById('submit-btn');
const statusEl = document.getElementById('form-status');

function setStatus(msg, kind) {
  statusEl.textContent = msg;
  statusEl.className = 'form-status' + (kind ? ' ' + kind : '');
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const name = document.getElementById('name').value.trim();
  const message = document.getElementById('message').value.trim();
  const file = photoInput.files[0];

  if (!name) {
    setStatus('Please add your name.', 'error');
    return;
  }
  if (!message && !file) {
    setStatus('Add a note, a photo, or both.', 'error');
    return;
  }

  submitBtn.disabled = true;
  setStatus(file ? 'Compressing photo…' : 'Posting…');

  try {
    let imageUrl = null;
    if (file) {
      imageUrl = await compressImage(file);
      setStatus('Posting…');
    }

    await addDoc(collection(db, 'entries'), {
      name: name.slice(0, 60),
      message: message.slice(0, 1000),
      imageUrl,
      likes: 0, // NEW — required so firestore.rules' create check (likes == 0) passes, and so like counts start at 0
      createdAt: serverTimestamp()
    });

    form.reset();
    photoPreview.hidden = true;
    setStatus('Posted. Thank you for signing the record.', 'success');
  } catch (err) {
    console.error(err);
    setStatus('Something went wrong — please try again.', 'error');
  } finally {
    submitBtn.disabled = false;
  }
});

// ---------- Live wall ----------
const wallEl = document.getElementById('wall');
const wallEmpty = document.getElementById('wall-empty');
const wallCount = document.getElementById('wall-count');

const q = query(collection(db, 'entries'), orderBy('createdAt', 'asc'));

// knownIds/firstSnapshot are NEW — used to detect which entries are freshly
// added (vs. just re-rendered because likes changed) so we only pulse/chime
// for genuinely new posts, not every Firestore update.
let knownIds = new Set();
let firstSnapshot = true;

onSnapshot(q, (snapshot) => {
  const entries = [];
  snapshot.forEach((doc) => entries.push({ id: doc.id, ...doc.data() }));

  wallCount.textContent = entries.length
      ? `${entries.length} ${entries.length === 1 ? 'entry' : 'entries'}`
      : '';
  wallEmpty.hidden = entries.length > 0;

  const newIds = firstSnapshot ? new Set() : new Set(entries.map((e) => e.id).filter((id) => !knownIds.has(id)));
  knownIds = new Set(entries.map((e) => e.id));
  firstSnapshot = false;

  if (isKiosk && newIds.size > 0) playChime();

  // Newest first, but keep each entry's original chronological number
  const numbered = entries.map((e, i) => ({ ...e, num: i + 1 })).reverse();

  wallEl.innerHTML = '';
  wallEl.appendChild(wallEmpty);
  numbered.forEach((entry) => wallEl.appendChild(renderEntry(entry, newIds.has(entry.id))));
}, (err) => {
  console.error(err);
  setStatus('Could not load entries — check your Firebase setup.', 'error');
});

function renderEntry(entry, isNew) {
  const card = document.createElement('article');
  card.className = 'entry' + (isNew ? ' new-entry' : ''); // 'new-entry' class is NEW — triggers the CSS pulse animation

  const num = document.createElement('p');
  num.className = 'entry-num';
  num.textContent = `No. ${String(entry.num).padStart(3, '0')}`;
  card.appendChild(num);

  if (entry.imageUrl) {
    const img = document.createElement('img');
    img.className = 'entry-photo';
    img.src = entry.imageUrl;
    img.alt = `Photo shared by ${entry.name}`;
    img.loading = 'lazy';
    img.addEventListener('click', () => openLightbox(entry.imageUrl));
    card.appendChild(img);
  }

  if (entry.message) {
    const msg = document.createElement('p');
    msg.className = 'entry-message';
    msg.textContent = entry.message;
    card.appendChild(msg);
  }

  const meta = document.createElement('div');
  meta.className = 'entry-meta';

  const name = document.createElement('span');
  name.className = 'entry-name';
  name.textContent = entry.name;
  meta.appendChild(name);

  const date = document.createElement('span');
  date.className = 'entry-date';
  date.textContent = formatDate(entry.createdAt);
  meta.appendChild(date);

  card.appendChild(meta);

  // ---- Reaction / like button — NEW ----
  const liked = getLikedSet().has(entry.id);
  const likeBtn = document.createElement('button');
  likeBtn.type = 'button';
  likeBtn.className = 'like-btn' + (liked ? ' liked' : '');
  likeBtn.disabled = liked;
  likeBtn.innerHTML = `<span class="like-heart">${liked ? '♥' : '♡'}</span><span class="like-count">${entry.likes || 0}</span>`;
  likeBtn.addEventListener('click', () => likeEntry(entry.id, likeBtn));
  card.appendChild(likeBtn);

  return card;
}

function formatDate(ts) {
  if (!ts || !ts.toDate) return '';
  const d = ts.toDate();
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

// ---------- Lightbox ----------
const lightbox = document.getElementById('lightbox');
const lightboxImg = document.getElementById('lightbox-img');
const lightboxClose = document.getElementById('lightbox-close');

function openLightbox(src) {
  lightboxImg.src = src;
  lightbox.hidden = false;
}
function closeLightbox() {
  lightbox.hidden = true;
  lightboxImg.src = '';
}
lightboxClose.addEventListener('click', closeLightbox);
lightbox.addEventListener('click', (e) => { if (e.target === lightbox) closeLightbox(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeLightbox(); });
