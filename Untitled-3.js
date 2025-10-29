// Navigation between sections
function showSection(id) {
  // Scroll the target section into view instead of hiding others.
  const el = document.getElementById(id);
  if (!el) return;
  // add a temporary active class for subtle highlighting
  el.classList.add('active');
  el.setAttribute('tabindex', '-1');
  el.focus({ preventScroll: true });
  // smooth scroll into view
  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  // remove temporary focus after a short delay
  setTimeout(() => {
    try { el.removeAttribute('tabindex'); } catch (e) {}
    el.classList.remove('active');
  }, 1200);
}

// Initialize storage
if (!localStorage.getItem("items")) {
  localStorage.setItem("items", JSON.stringify([]));
}

// Helper: read File objects to data URLs
function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function readFilesAsDataURLs(fileList) {
  const files = Array.from(fileList || []);
  // Enforce PNG-only uploads
  for (const f of files) {
    if (!f.type || f.type.toLowerCase() !== 'image/png') {
      return Promise.reject(new Error('Only PNG images are accepted. Please upload PNG files.'));
    }
  }
  return Promise.all(files.map(readFileAsDataURL));
}

// Removed file size limit for uploads

// SSG passphrase helpers
function getSSGPassphrase() {
  // stored key with better default
  const p = localStorage.getItem('ssg_passphrase');
  return p || 'ssg-admin-2023';
}

function setSSGPassphrase(newPass, currentPass) {
  if (!newPass || newPass.length < 6) {
    throw new Error('New passphrase must be at least 6 characters');
  }

  const existing = getSSGPassphrase();
  
  // Require current passphrase to match for changes
  if (currentPass !== existing) {
    return false;
  }

  // Store passphrase with timestamp
  localStorage.setItem('ssg_passphrase', newPass);
  localStorage.setItem('ssg_passphrase_updated', new Date().toISOString());
  return true;
}

function authenticateAdmin() {
  // Check session first
  const sessionAuth = sessionStorage.getItem('ssg_admin');
  if (sessionAuth) {
    const sessionData = JSON.parse(sessionAuth);
    // Verify session is still valid (24 hours)
    if (sessionData.expires > Date.now()) {
      return true;
    }
    // Clear expired session
    sessionStorage.removeItem('ssg_admin');
  }

  const attempt = prompt('Enter SSG admin passphrase:');
  if (!attempt) return false;

  if (attempt === getSSGPassphrase()) {
    // Store session with 24 hour expiry
    const sessionData = {
      authenticated: true,
      expires: Date.now() + (24 * 60 * 60 * 1000), // 24 hours
      lastAccess: Date.now()
    };
    sessionStorage.setItem('ssg_admin', JSON.stringify(sessionData));
    return true;
  }
  return false;
}

// New helper to check admin status without prompting
function isAdminAuthenticated() {
  const sessionAuth = sessionStorage.getItem('ssg_admin');
  if (!sessionAuth) return false;
  
  const sessionData = JSON.parse(sessionAuth);
  return sessionData.expires > Date.now();
}

// expose to global for admin page
window.getSSGPassphrase = getSSGPassphrase;
window.setSSGPassphrase = setSSGPassphrase;
window.authenticateAdmin = authenticateAdmin;

// Add Lost Item (strict: require ID, program/grade, photos)
const lostFormEl = document.getElementById('lostForm');
if (lostFormEl) {
  lostFormEl.addEventListener('submit', async function(e) {
    e.preventDefault();
    const form = this;
    const statusMsg = document.getElementById('statusMessage');
    const submitBtn = form.querySelector('button[type=submit]') || form.querySelector('button');
    
    // Show loading state
    if (submitBtn) { 
      submitBtn.disabled = true; 
      submitBtn.textContent = 'Submitting...'; 
    }
    if (statusMsg) {
      statusMsg.style.display = 'none';
    }
    
    try {
      const name = form.elements['itemName'].value.trim();
      const desc = form.elements['desc'].value.trim();
      const loc = form.elements['location'].value.trim();
      const date = form.elements['date'].value;
      const reporter = form.elements['reporter'].value.trim();
      const reporterId = form.elements['reporterId'].value.trim();
      const reporterProgram = form.elements['reporterProgram'].value.trim();
      const contact = form.elements['contact'].value.trim();
      const photoFiles = form.elements['photos'].files;

      // Validate required fields
      if (!name || !desc || !loc || !date || !reporter || !reporterId || !reporterProgram || !photoFiles.length) {
        throw new Error('Please complete all required fields and attach at least one photo for verification.');
      }

      // Validate meaningful content
      if (name.length < 2 || desc.length < 10 || loc.length < 2) {
        throw new Error('Please provide meaningful details for the item name, description, and location.');
      }

      // Only check file type, no size limit
      for (const f of Array.from(photoFiles)) {
        if (!f.type || f.type.toLowerCase() !== 'image/png') {
          throw new Error('All photos must be in PNG format. Please convert your images before uploading.');
        }
      }

      let photos;
      try {
        photos = await readFilesAsDataURLs(photoFiles);
      } catch (err) {
        throw new Error(err.message || 'Error processing images. Please try uploading smaller or different PNG images.');
      }

      // Add item to storage
      addItem('lost', { name, desc, loc, date, person: reporter, contact, reporterId, reporterProgram, photos });

      // Show success message
      if (statusMsg) {
        statusMsg.textContent = 'Lost item reported successfully! Our admin team will review your report.';
        statusMsg.className = 'status success';
        statusMsg.style.display = 'block';
        statusMsg.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }

      // Reset form
      form.reset();

      // Delay redirect to show success message
      setTimeout(() => {
        location.href = 'lost.html?item=' + encodeURIComponent(name);
      }, 2000);

    } catch (err) {
      // Show error message
      if (statusMsg) {
        statusMsg.textContent = err.message || 'Error submitting form. Please try again.';
        statusMsg.className = 'status error';
        statusMsg.style.display = 'block';
        statusMsg.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else {
        alert(err.message || 'Error submitting form. Please try again.');
      }
    } finally {
      // Reset button state
      if (submitBtn) { 
        submitBtn.disabled = false; 
        submitBtn.textContent = 'Submit Lost Item Report';
      }
    }
  });
}

/* Scroll-driven scale for hero images: images gently grow as the hero enters the viewport */
(function(){
  const hero = document.querySelector('.hero');
  if (!hero) return;
  const imgs = hero.querySelectorAll('.hero-images .img');
  let raf = null;

  function clamp(v, a=0, b=1){ return Math.max(a, Math.min(b, v)); }

  function updateScale(){
    const rect = hero.getBoundingClientRect();
    const windowH = window.innerHeight || document.documentElement.clientHeight;
    // progress ~ how much the hero is visible (0..1)
    const progress = clamp((windowH - rect.top) / (windowH + rect.height));
    // map progress to scale range: 1 -> maxScale
    const maxScale = 1.18; // max growth
    const scale = 1 + (maxScale - 1) * progress;
    imgs.forEach(img => {
      img.style.setProperty('--img-scale', scale.toFixed(3));
    });
    raf = null;
  }

  function schedule(){ if (raf) return; raf = requestAnimationFrame(updateScale); }

  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule);
  // initialize
  schedule();
})();

// Add Found Item (strict: require finder ID, program/grade, photos)
const foundFormEl = document.getElementById('foundForm');
if (foundFormEl) {
  foundFormEl.addEventListener('submit', async function(e) {
    e.preventDefault();
    const form = this;
    const submitBtn = form.querySelector('button[type=submit]') || form.querySelector('button');
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Submitting...'; }
    const name = form.elements['itemName'].value.trim();
    const desc = form.elements['desc'].value.trim();
    const loc = form.elements['foundLocation'].value.trim();
    const date = form.elements['date'].value;
    const finder = form.elements['finder'].value.trim();
    const finderId = form.elements['finderId'].value.trim();
    const finderProgram = form.elements['finderProgram'].value.trim();
    const contact = form.elements['contact'].value.trim();
    const photoFiles = form.elements['photos'].files;

    if (!name || !desc || !loc || !date || !finder || !finderId || !finderProgram || !photoFiles.length) {
      alert('Please complete all required fields and attach at least one photo for verification.');
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Submit'; }
      return;
    }

    // Only check file type, no size limit
    for (const f of Array.from(photoFiles)) {
      if (!f.type || f.type.toLowerCase() !== 'image/png') {
        alert('All photos must be PNG format.');
        if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Submit'; }
        return;
      }
    }

    let photos;
    try {
      photos = await readFilesAsDataURLs(photoFiles);
    } catch (err) {
      alert(err.message || 'Invalid file selection. Only PNG images are accepted.');
      return;
    }

    addItem('found', { name, desc, loc, date, person: finder, contact, finderId, finderProgram, photos });
    form.reset();
    // navigate to found items page and highlight the newly reported item
    location.href = 'found.html?item=' + encodeURIComponent(name);
  });
}

// Add item to storage
function addItem(type, payload) {
  const items = JSON.parse(localStorage.getItem('items')) || [];
  const item = Object.assign({
    type,
    name: payload.name,
    desc: payload.desc,
    loc: payload.loc,
    date: payload.date,
    person: payload.person,
    contact: payload.contact || '',
    photos: payload.photos || [],
    status: 'Pending Verification',
    claims: [],
    meta: {
      reporterId: payload.reporterId || payload.finderId || '',
      reporterProgram: payload.reporterProgram || payload.finderProgram || ''
    }
  }, {});
  items.push(item);
  localStorage.setItem('items', JSON.stringify(items));
  displayItems();
}

// Display items
function displayItems(filter = 'all') {
  const container = document.getElementById('itemList');
  const items = JSON.parse(localStorage.getItem('items')) || [];
  container.innerHTML = '';

  const filtered = filter === 'all' ? items : items.filter(i => i.type === filter);

  if (filtered.length === 0) {
    container.innerHTML = '<p>No items to display.</p>';
    return;
  }

  filtered.forEach((item, index) => {
    const card = document.createElement('div');
    card.className = 'item-card';

    // photos
    let photosHtml = '';
    if (item.photos && item.photos.length) {
      photosHtml = '<div class="card-photos">' + item.photos.map(p => `<img src="${p}" alt="photo" style="width:96px;height:64px;object-fit:cover;border-radius:6px;margin-right:8px;border:2px solid #fff;box-shadow:0 6px 16px rgba(2,6,23,0.12)">`).join('') + '</div>';
    }

    // claims list (show claimant ID proof and status)
    let claimsHtml = '';
    if (item.claims && item.claims.length) {
      claimsHtml = '<div class="claims"><h4>Claims</h4>' + item.claims.map((c, ci) => `
        <div class="claim">
          <p><b>Name:</b> ${c.name} — <b>ID:</b> ${c.id} ${c.status ? `<span style="color:#9ca3af;margin-left:8px;font-weight:700">(${c.status})</span>` : ''}</p>
          <p><b>Note:</b> ${c.note}</p>
          <div style="display:flex;gap:12px;align-items:center;margin-top:8px">${c.proof ? `<div style="display:flex;flex-direction:column;gap:6px"><img src="${c.proof}" alt="proof" style="width:120px;height:80px;object-fit:cover;border-radius:6px;border:2px solid #fff;box-shadow:0 6px 16px rgba(2,6,23,0.12)"><small style=\"color:var(--muted);\">Proof</small></div>` : ''}
          ${c.idProof ? `<div style="display:flex;flex-direction:column;gap:6px"><img src="${c.idProof}" alt="id" style="width:120px;height:80px;object-fit:cover;border-radius:6px;border:2px solid #fff;box-shadow:0 6px 16px rgba(2,6,23,0.12)"><small style=\"color:var(--muted);\">ID Photo</small></div>` : ''}
          <div style="display:flex;flex-direction:column;gap:6px">${c.verified ? '<span style="color:var(--green-600);font-weight:700">Verified</span>' : ''}
            <div style="display:flex;gap:8px;margin-top:6px">${c.verified ? '' : `<button onclick="verifyClaim(${index}, ${ci})">Verify &amp; Release</button><button onclick="rejectClaim(${index}, ${ci})" style=\"background:#ef4444;color:#fff;border:0;padding:8px;border-radius:8px;cursor:pointer\">Reject</button>`}</div>
          </div>
          </div>
        </div>
      `).join('') + '</div>';
    }

    card.innerHTML = `
      <h3>${item.name}</h3>
      <p><b>Type:</b> ${item.type.toUpperCase()}</p>
      <p><b>Description:</b> ${item.desc}</p>
      <p><b>Location:</b> ${item.loc}</p>
      <p><b>Date:</b> ${item.date}</p>
      <p><b>Reported by:</b> ${item.person} <span style="color:#6b7280">(ID: ${item.meta.reporterId || 'N/A'}, ${item.meta.reporterProgram || ''})</span></p>
      ${photosHtml}
      <p><b>Status:</b> ${item.status}</p>
      ${claimsHtml}
      <div style="margin-top:8px;display:flex;gap:8px;align-items:center">
        ${item.status.includes('Verified') || item.status === 'Released' ? 
          '<span style="color:#dc2626;font-weight:500">✓ Item Verified/Released</span>' :
          `<button onclick="promptClaim('${item.name.replace(/'/g,"\\'" ) }')">Request Claim</button>`
        }
        <button onclick="promptAdminVerify(${index})">SSG Verify</button>
      </div>
    `;

    container.appendChild(card);
  });
}

// Filter function
function filterItems(type) {
  displayItems(type);
}

// Claim flow: navigate to dedicated claim page and prefill item name via query param
function promptClaim(itemName) {
  // open claim page with item prefilled
  const url = 'claim.html?item=' + encodeURIComponent(itemName);
  // use location.href so the user lands on the claim page
  location.href = url;
}

// Claim Item submission — attach only when claim form exists
const claimFormEl = document.getElementById('claimForm');
if (claimFormEl) {
  // Add real-time item availability check
  const itemNameInput = claimFormEl.elements['itemName'];
  
  function checkItemAvailability(itemName) {
    if (!itemName) {
      document.getElementById('itemStatus').style.display = 'none';
      document.querySelector('.status-indicator').className = 'status-indicator';
      return;
    }
    
    const items = JSON.parse(localStorage.getItem('items')) || [];
    const matchingItem = items.find(i => i.name.toLowerCase() === itemName.toLowerCase());
    const statusDiv = document.getElementById('itemStatus');
    const indicator = document.querySelector('.status-indicator');
    
    if (!matchingItem) {
      statusDiv.textContent = '⚠️ Item not found in the system';
      statusDiv.className = 'error';
      statusDiv.style.display = 'block';
      indicator.className = 'status-indicator unavailable';
      return false;
    }
    
    if (matchingItem.status === 'Released' || matchingItem.status.includes('Verified')) {
      statusDiv.textContent = '⚠️ This item has been verified/released and cannot be claimed';
      statusDiv.className = 'error';
      statusDiv.style.display = 'block';
      indicator.className = 'status-indicator unavailable';
      return false;
    }
    
    statusDiv.textContent = '✅ Item is available for claim';
    statusDiv.className = 'success';
    statusDiv.style.display = 'block';
    indicator.className = 'status-indicator available';
    return true;
  }

  // Check availability on input change
  itemNameInput.addEventListener('input', (e) => {
    checkItemAvailability(e.target.value.trim());
  });

  // Initial check if item name is prefilled
  checkItemAvailability(itemNameInput.value.trim());
  claimFormEl.addEventListener('submit', async function(e) {
    e.preventDefault();
    const form = this;
    const submitBtn = form.querySelector('button[type=submit]') || form.querySelector('button');
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Submitting...'; }
    const itemName = form.elements['itemName'].value.trim();
    const note = form.elements['proofDesc'].value.trim();
    const name = form.elements['claimant'].value.trim();
    const id = form.elements['claimantId'].value.trim();
    const contact = form.elements['contact'].value.trim();
    const proofFiles = form.elements['claimProof'].files;
    const idProofFiles = form.elements['claimantIdProof'] ? form.elements['claimantIdProof'].files : [];

    if (!itemName || !note || !name || !id || !proofFiles.length || !idProofFiles.length) {
      alert('Please complete all required claim fields and attach both proof and an ID photo (PNG).');
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Submit Claim'; }
      return;
    }

    // check file type only (removed size limit)
    for (const f of Array.from(proofFiles)) {
      if (!f.type || f.type.toLowerCase() !== 'image/png') { alert('Proof image must be PNG.'); if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Submit Claim'; } return; }
    }
    for (const f of Array.from(idProofFiles)) {
      if (!f.type || f.type.toLowerCase() !== 'image/png') { alert('ID image must be PNG.'); if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Submit Claim'; } return; }
    }

    let proofs, idProofs;
    try {
      proofs = await readFilesAsDataURLs(proofFiles);
      idProofs = await readFilesAsDataURLs(idProofFiles);
    } catch (err) {
      alert(err.message || 'Invalid proof file. Only PNG images are accepted.');
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Submit Claim'; }
      return;
    }
    const proof = proofs[0];
    const idProof = idProofs[0];

    // find the first matching item by name (case-insensitive) that is available for claim
    const items = JSON.parse(localStorage.getItem('items')) || [];
    const idx = items.findIndex(i => {
      const nameMatch = i.name.toLowerCase() === itemName.toLowerCase();
      const isAvailable = !i.status.includes('Verified') && i.status !== 'Released';
      return nameMatch && isAvailable;
    });
    
    if (idx === -1) {
      const matchingItem = items.find(i => i.name.toLowerCase() === itemName.toLowerCase());
      const message = matchingItem ? 
        'This item has been verified/released and cannot be claimed.' :
        'No matching item found in the system.';
        
      if (document.getElementById('itemStatus')) {
        const statusDiv = document.getElementById('itemStatus');
        statusDiv.textContent = '⚠️ ' + message;
        statusDiv.className = 'error';
        statusDiv.style.display = 'block';
      } else {
        alert(message);
      }
      
      if (submitBtn) { 
        submitBtn.disabled = false; 
        submitBtn.textContent = 'Submit Claim'; 
      }
      return;
    }

  const claim = { name, id, contact, note, proof, idProof, time: new Date().toISOString(), status: 'Pending Admin Verification', verified: false };
    items[idx].claims = items[idx].claims || [];
    items[idx].claims.push(claim);
  items[idx].status = 'Claim Requested - Pending Admin Verification';
    localStorage.setItem('items', JSON.stringify(items));
    if (document.getElementById('itemList')) displayItems();
    form.reset();
    // navigate back to the proper list page for that item type and highlight it
    const item = items[idx];
    const dest = item && item.type === 'found' ? 'found.html' : 'lost.html';
    location.href = dest + '?item=' + encodeURIComponent(itemName);
  });
}

// Admin verify flow (simple passphrase prompt) — marks item as Verified
function promptAdminVerify(index) {
  // require admin auth (session or passphrase prompt)
  if (!authenticateAdmin()) { alert('Incorrect passphrase. Verification aborted.'); return; }
  const items = JSON.parse(localStorage.getItem('items')) || [];
  items[index].status = 'Verified - Ready for Release';
  localStorage.setItem('items', JSON.stringify(items));
  displayItems();
  alert('Item marked as Verified. You can now release to a verified claimant.');
}

// Verify and release a specific claim (admin action triggered from claim list)
function verifyClaim(itemIndex, claimIndex) {
  if (!authenticateAdmin()) { alert('Incorrect passphrase.'); return; }
  const items = JSON.parse(localStorage.getItem('items')) || [];
  const item = items[itemIndex];
  if (!item || !item.claims || !item.claims[claimIndex]) { alert('Claim not found'); return; }
  const claim = item.claims[claimIndex];
  // mark claim as verified and release
  claim.verified = true;
  claim.verifiedAt = new Date().toISOString();
  claim.verifiedBy = 'SSG';
  item.status = 'Released';
  item.releasedTo = { name: claim.name, id: claim.id, contact: claim.contact, time: new Date().toISOString() };
  localStorage.setItem('items', JSON.stringify(items));
  displayItems();
  alert(`Item released to ${claim.name} (ID: ${claim.id}).`);
}

function rejectClaim(itemIndex, claimIndex) {
  if (!authenticateAdmin()) { alert('Incorrect passphrase.'); return; }
  const items = JSON.parse(localStorage.getItem('items')) || [];
  const item = items[itemIndex];
  if (!item || !item.claims || !item.claims[claimIndex]) { alert('Claim not found'); return; }
  const claim = item.claims[claimIndex];
  claim.status = 'Rejected';
  claim.rejectedAt = new Date().toISOString();
  claim.rejectedBy = 'SSG';
  localStorage.setItem('items', JSON.stringify(items));
  displayItems();
  alert(`Claim by ${claim.name} (ID: ${claim.id}) has been rejected.`);
}

// initial render handled on DOMContentLoaded (so we can highlight a submitted item via ?item=...)

// Mobile hamburger toggle: toggle .nav-open on header
document.addEventListener('DOMContentLoaded', () => {
  const hb = document.getElementById('hamburgerBtn');
  if (hb) {
    hb.addEventListener('click', () => {
      const header = document.querySelector('.site-header');
      if (!header) return;
      const expanded = hb.getAttribute('aria-expanded') === 'true';
      header.classList.toggle('nav-open');
      hb.setAttribute('aria-expanded', (!expanded).toString());
      // toggle hamburger icon to X when open
      hb.textContent = (!expanded) ? '✕' : '☰';
    });
  }

  // central nav handler: handle nav button/anchor clicks, navigate, apply filter, and close mobile nav
  const primaryNav = document.getElementById('primaryNav');
  if (primaryNav) {
    primaryNav.addEventListener('click', (e) => {
      // support buttons or anchors
      const btn = e.target.closest('button, a');
      if (!btn || !primaryNav.contains(btn)) return;

      // if it's an anchor with an href to another page, allow navigation
      if (btn.tagName.toLowerCase() === 'a' && btn.getAttribute('href')) {
        // close mobile nav then allow default navigation
        const header = document.querySelector('.site-header');
        if (header && header.classList.contains('nav-open')) {
          header.classList.remove('nav-open');
          hb.setAttribute('aria-expanded', 'false');
        }
        return;
      }

      const target = btn.dataset ? btn.dataset.target : null;
      const filter = btn.dataset ? btn.dataset.filter : null;
      if (target) showSection(target);
      if (filter) filterItems(filter);

        // close mobile nav if open
        const header = document.querySelector('.site-header');
        if (header && header.classList.contains('nav-open')) {
            header.classList.remove('nav-open');
            if (hb) { hb.setAttribute('aria-expanded', 'false'); hb.textContent = '☰'; }
          }
    });
  }
  // If we're on claim.html, and an item query param is present, prefill the form
  const qp = new URLSearchParams(location.search);
  const item = qp.get('item');
  if (item) {
    const claimForm = document.getElementById('claimForm');
    if (claimForm) claimForm.elements['itemName'].value = item;
  }
  // If this page has an itemList (lost.html or found.html) render items and optionally highlight an item from ?item=
  const itemListEl = document.getElementById('itemList');
  if (itemListEl) {
    displayItems();
    const highlight = qp.get('item');
    if (highlight) {
      // allow a tiny delay for DOM to be populated
      setTimeout(() => {
        const cards = Array.from(itemListEl.querySelectorAll('.item-card'));
        const match = cards.find(c => {
          const h = c.querySelector('h3');
          return h && h.textContent.trim().toLowerCase() === highlight.toLowerCase();
        });
        if (match) {
          match.scrollIntoView({ behavior: 'smooth', block: 'center' });
          match.classList.add('highlight');
          setTimeout(() => match.classList.remove('highlight'), 3500);
        }
      }, 120);
    }
  }
});
