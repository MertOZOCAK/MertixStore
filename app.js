const defaultImage = './res/default.svg';

let editIndex = null;

function showStatus(message, isError = false) {
  const box = document.getElementById('status-box');
  if (!box) return;
  box.textContent = message;
  box.style.borderColor = isError ? 'rgba(239, 68, 68, 0.45)' : 'rgba(79, 70, 229, 0.45)';
}

function getAppDataFromForm(form) {
  const fd = new FormData(form);
  return {
    name: fd.get('name'),
    developer: fd.get('developer'),
    category: fd.get('category'),
    version: fd.get('version'),
    price: fd.get('price'),
    packageName: fd.get('packageName'),
    description: fd.get('description'),
    longDescription: fd.get('longDescription'),
    createdAt: new Date().toISOString(),
  };
}

function saveAppLocally(appData, apkUrl, screenshotUrls) {
  const apps = JSON.parse(localStorage.getItem('mertixApps') || '[]');
  const appRecord = {
    id: crypto.randomUUID(),
    ...appData,
    apkUrl,
    screenshotUrls: screenshotUrls.length ? screenshotUrls : [defaultImage],
  };

  apps.push(appRecord);
  localStorage.setItem('mertixApps', JSON.stringify(apps));
  return appRecord;
}

function updateAppLocally(id, appData, apkUrl, screenshotUrls) {
  const apps = JSON.parse(localStorage.getItem('mertixApps') || '[]');
  const index = apps.findIndex((app) => app.id === id);
  if (index === -1) return null;

  apps[index] = {
    ...apps[index],
    ...appData,
    apkUrl,
    screenshotUrls: screenshotUrls.length ? screenshotUrls : [defaultImage],
    updatedAt: new Date().toISOString(),
  };

  localStorage.setItem('mertixApps', JSON.stringify(apps));
  return apps[index];
}

function deleteAppLocally(id) {
  const apps = JSON.parse(localStorage.getItem('mertixApps') || '[]');
  const filtered = apps.filter((app) => app.id !== id);
  localStorage.setItem('mertixApps', JSON.stringify(filtered));
}

function resolveFileUrl(folder, filename) {
  return filename ? `${folder}/${encodeURIComponent(filename)}` : defaultImage;
}

// --- Firebase helpers (optional) ---
function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

async function initFirebaseIfNeeded() {
  if (window._firebaseInitialized) return true;
  if (!window.firebaseConfig) return false;
  try {
    // load compat SDKs if not already present
    if (typeof firebase === 'undefined') {
      await loadScript('https://www.gstatic.com/firebasejs/9.22.1/firebase-app-compat.js');
      await loadScript('https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore-compat.js');
    }
    if (!window._firebaseInitialized) {
      firebase.initializeApp(window.firebaseConfig);
      window._firestore = firebase.firestore();
      window._firebaseInitialized = true;
      showStatus('Firebase hazır.');
    }
    return true;
  } catch (e) {
    console.error('Firebase init failed', e);
    showStatus(`Firebase başlatılamadı: ${e.message}`, true);
    return false;
  }
}

async function saveAppToFirestore(appRecord) {
  try {
    if (!(await initFirebaseIfNeeded())) return false;
    await window._firestore.collection('apps').doc(appRecord.id).set(appRecord);
    console.log('Firestore: saved', appRecord.id);
    return true;
  } catch (e) {
    console.error('Firestore save error', e);
    showStatus(`Firestore kaydetme hatası: ${e.message}`, true);
    return false;
  }
}

async function deleteAppFromFirestore(id) {
  try {
    if (!(await initFirebaseIfNeeded())) return false;
    await window._firestore.collection('apps').doc(id).delete();
    console.log('Firestore: deleted', id);
    return true;
  } catch (e) {
    console.error('Firestore delete error', e);
    showStatus(`Firestore silme hatası: ${e.message}`, true);
    return false;
  }
}

async function fetchAppsFromFirestore() {
  try {
    if (!(await initFirebaseIfNeeded())) return [];
    const snapshot = await window._firestore.collection('apps').get();
    const docs = [];
    snapshot.forEach((doc) => docs.push(doc.data()));
    return docs;
  } catch (e) {
    console.error('Firestore fetch error', e);
    return [];
  }
}

function ensureScreenshotUrl(value) {
  if (!value) return defaultImage;
  // If it's already a full path or URL, return as-is
  if (/^https?:\/\//.test(value) || value.startsWith('/') || value.startsWith('./') || value.includes(`${'res/'}`)) {
    return value;
  }
  // Otherwise treat as a filename
  return resolveFileUrl('res', value);
}

function getSelectedApk() {
  const select = document.getElementById('apk-selector');
  return select ? select.value : '';
}

function getSelectedScreenshots() {
  return Array.from(document.querySelectorAll('.screenshot-checkbox:checked')).map((input) => input.value);
}

function fillForm(app) {
  const form = document.getElementById('app-form');
  if (!form) return;
  form.name.value = app.name;
  form.developer.value = app.developer;
  form.category.value = app.category;
  form.version.value = app.version;
  form.price.value = app.price;
  form.packageName.value = app.packageName;
  form.description.value = app.description;
  form.longDescription.value = app.longDescription;
  document.getElementById('apk-selector').value = decodeURIComponent(app.apkUrl.replace(/^apk\//, ''));

  // Normalize filenames for comparison so encoded/decoded and folder prefixes don't break matching
  const normalize = (s) => {
    if (!s) return '';
    // remove folder prefix if present and decode
    const name = decodeURIComponent(String(s).replace(/^res\//, '').replace(/^apk\//, ''));
    // only keep the filename portion
    return name.split('/').pop();
  };

  // Try to match apk selector using several fallbacks (decoded, encoded, case-insensitive)
  const apkSelect = document.getElementById('apk-selector');
  const targetApk = normalize(app.apkUrl.replace(/^apk\//, ''));
  if (apkSelect) {
    // try direct match
    if (Array.from(apkSelect.options).some((o) => o.value === targetApk)) {
      apkSelect.value = targetApk;
    } else {
      // case-insensitive match
      const found = Array.from(apkSelect.options).find((o) => String(o.value).toLowerCase() === targetApk.toLowerCase());
      if (found) apkSelect.value = found.value;
    }
  }

  const selectedNames = (app.screenshotUrls || []).map((u) => normalize(u));
  document.querySelectorAll('.screenshot-checkbox').forEach((checkbox) => {
    checkbox.checked = selectedNames.includes(normalize(checkbox.value));
  });
}

function resetForm() {
  const form = document.getElementById('app-form');
  if (!form) return;
  form.reset();
  editIndex = null;
  document.getElementById('submit-button').textContent = 'Kaydet';
  document.getElementById('cancel-edit').classList.add('hidden');
}

async function handleAdminSubmit(event) {
  event.preventDefault();
  const form = event.target;
  const appData = getAppDataFromForm(form);
  const apkFileName = getSelectedApk();
  const screenshotFiles = getSelectedScreenshots();

  if (!apkFileName) {
    showStatus('Lütfen bir APK dosyası seçin.', true);
    return;
  }

  showStatus('Kaydediliyor...');

  const apkUrl = resolveFileUrl('apk', apkFileName);
  const screenshotUrls = screenshotFiles.length ? screenshotFiles.map((name) => resolveFileUrl('res', name)) : [defaultImage];

  try {
    let savedApp;
    if (editIndex) {
      savedApp = updateAppLocally(editIndex, appData, apkUrl, screenshotUrls);
      showStatus(`Başarılı! ${savedApp.name} güncellendi.`);
    } else {
      savedApp = saveAppLocally(appData, apkUrl, screenshotUrls);
      showStatus(`Başarılı! ${savedApp.name} kaydedildi.`);
    }

    // If admin wants to sync to Firebase, attempt to save there too
    const sync = document.getElementById('sync-firebase')?.checked;
    console.log('Admin submit: sync-firebase checked=', sync, 'appId=', savedApp && savedApp.id);
    if (sync && savedApp) {
      // ensure Firebase init and report state
      const inited = await initFirebaseIfNeeded();
      console.log('initFirebaseIfNeeded ->', inited, 'window._firebaseInitialized=', window._firebaseInitialized);
      if (!inited) {
        showStatus('Firebase başlatılamadı. Lütfen Firebase Console üzerinden Firestore etkinleştirin ve config doğrulayın. Hata konsolda.', true);
      } else {
        const ok = await saveAppToFirestore(savedApp);
        console.log('saveAppToFirestore result=', ok);
        if (ok) showStatus(`Başarılı! ${savedApp.name} Firebase'e kaydedildi.`);
        else showStatus('Firebase sync başarısız. Konsolu kontrol edin.', true);
      }
    }

    resetForm();
    populateAdminSelectors();
    renderApps();
    renderPublishedApps();
  } catch (error) {
    console.error(error);
    showStatus(`Hata: ${error.message}`, true);
  }
}

async function fetchFolderFiles(folder) {
  // Start with any global manifest defined by list.js (window.APK_LIST / window.RES_LIST)
  const globalManifest = folder === 'apk' ? window.APK_LIST : folder === 'res' ? window.RES_LIST : null;
  let manifest = Array.isArray(globalManifest) ? Array.from(globalManifest) : null;

  // Try to fetch list.json and merge entries if present (helps when list.js is outdated)
  try {
    const manifestResponse = await fetch(`./${folder}/list.json`);
    if (manifestResponse.ok) {
      const fileNames = await manifestResponse.json();
      if (Array.isArray(fileNames)) {
        manifest = manifest ? Array.from(new Set([...manifest, ...fileNames])) : Array.from(fileNames);
      }
    }
  } catch (error) {
    // ignore
  }

  if (Array.isArray(manifest) && manifest.length) {
    return manifest;
  }

  // Final fallback: try to parse directory listing HTML (for static servers that expose indexes)
  try {
    const response = await fetch(`./${folder}/`);
    if (!response.ok) return [];
    const html = await response.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const anchors = Array.from(doc.querySelectorAll('a'));
    return anchors
      .map((a) => a.getAttribute('href'))
      .filter((href) => href && !href.endsWith('/') && !href.startsWith('?'))
      .map((href) => decodeURIComponent(href.replace(/\?.*$/, '')));
  } catch (error) {
    return [];
  }
}

function buildScreenshotCheckbox(name) {
  const wrapper = document.createElement('label');
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.className = 'screenshot-checkbox';
  checkbox.value = name;
  const span = document.createElement('span');
  span.textContent = name;
  wrapper.appendChild(checkbox);
  wrapper.appendChild(span);
  return wrapper;
}

async function populateAdminSelectors() {
  const apkSelect = document.getElementById('apk-selector');
  const screenshotContainer = document.getElementById('screenshot-selector');
  if (!apkSelect || !screenshotContainer) return;

  const apkFiles = await fetchFolderFiles('apk');
  const resFiles = await fetchFolderFiles('res');

  apkSelect.innerHTML = '<option value="">APK seçin</option>';
  apkFiles.forEach((name) => {
    const decoded = decodeURIComponent(String(name));
    const option = document.createElement('option');
    option.value = decoded;
    option.textContent = decoded;
    apkSelect.appendChild(option);
  });

  console.log('populateAdminSelectors: apkFiles=', apkFiles);

  // ensure the select is enabled and shows placeholder if nothing selected
  apkSelect.disabled = false;
  apkSelect.value = '';

  screenshotContainer.innerHTML = '';
  resFiles.forEach((name) => {
    const decoded = decodeURIComponent(String(name));
    screenshotContainer.appendChild(buildScreenshotCheckbox(decoded));
  });

  console.log('populateAdminSelectors: resFiles=', resFiles);

  // expose names in status box for quick debugging
  try {
    const names = `APK: ${apkFiles.map((n)=>String(n)).join(', ') || '(none)'} | RES: ${resFiles.map((n)=>String(n)).join(', ') || '(none)'} `;
    const box = document.getElementById('status-box');
    if (box) box.textContent = names;
  } catch (e) {}

  if (!apkFiles.length) {
    const option = document.createElement('option');
    option.value = '';
    option.textContent = '(apk klasörü boş veya list.json yok)';
    apkSelect.appendChild(option);
  }
  if (!resFiles.length) {
    const emptyMsg = document.createElement('p');
    emptyMsg.className = 'field-help';
    emptyMsg.textContent = 'res klasörü boş veya list.json yok.';
    screenshotContainer.appendChild(emptyMsg);
  }
  showStatus(`Bulunan APK: ${apkFiles.length}, Görseller: ${resFiles.length}`);
}

function createAppCard(app, index) {
  const card = document.createElement('article');
  card.className = 'app-card';
  card.innerHTML = `
    <div class="app-cover">
      <img src="${ensureScreenshotUrl(app.screenshotUrls?.[0]) || defaultImage}" alt="${app.name}" loading="lazy" />
      <div class="app-badge">${app.category || 'Kategori'}</div>
    </div>
    <div class="app-body">
      <div class="meta">${app.developer || 'Geliştirici'} • ${app.version || '1.0.0'}</div>
      <h4>${app.name}</h4>
      <p>${app.description || 'Açıklama eklenmedi.'}</p>
      <div class="app-footer">
        <span class="price">${app.price || 'Ücretsiz'}</span>
        <div class="app-actions">
          <button class="primary-btn download-btn" data-apk-url="${app.apkUrl || '#'}">İndir</button>
        </div>
      </div>
    </div>
  `;

  // Open details when clicking the card (but not when clicking the download button)
  card.addEventListener('click', (event) => {
    if (event.target.closest('.download-btn')) return;
    openModal(app);
  });

  const dl = card.querySelector('.download-btn');
  if (dl) {
    dl.addEventListener('click', (ev) => {
      ev.stopPropagation();
      const url = dl.getAttribute('data-apk-url');
      if (dl.dataset.downloading === 'true' || dl._dlTimer) {
        cancelDownload(dl);
      } else {
        startDownloadSimulation(dl, url);
      }
    });
  }

  return card;
}

// Download simulation: shows overlay, counts 0->100% over configured seconds, then triggers actual navigation
function startDownloadSimulation(buttonEl, apkUrl) {
  try {
    if (!buttonEl) {
      if (apkUrl) window.open(apkUrl, '_blank');
      return;
    }

    // build choices 10..60 using a for loop, then pick a random one
    const choices = [];
    for (let i = 10; i <= 60; i++) choices.push(i);
    const choice = choices[Math.floor(Math.random() * choices.length)];

    // prepare button UI
    buttonEl.innerHTML = '';
    buttonEl.classList.add('downloading');
    buttonEl.dataset.downloading = 'true';
    const fill = document.createElement('div');
    fill.className = 'progress-fill';
    const label = document.createElement('span');
    label.className = 'progress-label';
    label.textContent = 'İptal %0';
    buttonEl.appendChild(fill);
    buttonEl.appendChild(label);

    buttonEl.onclick = (ev) => {
      ev.stopPropagation();
      cancelDownload(buttonEl);
    };

    const totalMs = Math.max(1000, Math.min(60000, choice * 1000));
    const stepMs = totalMs / 100;
    let pct = 0;
    if (buttonEl._dlTimer) clearInterval(buttonEl._dlTimer);
    buttonEl._dlTimer = setInterval(() => {
      pct += 1;
      fill.style.width = pct + '%';
      label.textContent = `%${pct}`;
      if (pct >= 100) {
        clearInterval(buttonEl._dlTimer);
        buttonEl._dlTimer = null;
        delete buttonEl.dataset.downloading;
        buttonEl.classList.remove('downloading');
        buttonEl.onclick = null;
        label.textContent = '%100';
        // after short delay, trigger actual download
        setTimeout(() => {
          if (apkUrl && apkUrl !== '#') {
            const a = document.createElement('a');
            a.href = apkUrl;
            a.download = '';
            a.target = '_blank';
            document.body.appendChild(a);
            a.click();
            a.remove();
          }
          buttonEl.innerHTML = 'İndir';
          buttonEl.onclick = null;
        }, 300);
      }
    }, stepMs);
  } catch (e) {
    console.error('startDownloadSimulation error', e);
    if (apkUrl) window.open(apkUrl, '_blank');
  }
}

function openModal(app) {
  const modal = document.getElementById('app-modal');
  const content = document.getElementById('modal-content');
  if (!modal || !content) return;
  const screenshots = app.screenshotUrls?.map((url) => `<img src="${ensureScreenshotUrl(url)}" alt="${app.name}" loading="lazy" />`).join('') || `<img src="${defaultImage}" alt="${app.name}" loading="lazy" />`;
  content.innerHTML = `
    <div class="modal-header">
      <div>
        <h3>${app.name}</h3>
        <p class="meta">${app.developer || 'Geliştirici'} • ${app.category || 'Kategori'} • ${app.version || '1.0.0'}</p>
      </div>
      <span class="price">${app.price || 'Ücretsiz'}</span>
    </div>
    <div class="screenshot-row">${screenshots}</div>
    <p>${app.longDescription || app.description}</p>
    <p><strong>Paket:</strong> ${app.packageName || 'Belirtilmedi'}</p>
    <div class="app-actions modal-actions">
      <button id="modal-download-btn" class="primary-btn" data-apk-url="${app.apkUrl || '#'}">APK İndir</button>
    </div>
  `;
  modal.classList.remove('hidden');
  // wire modal download button
  const modalDl = document.getElementById('modal-download-btn');
  if (modalDl) {
    modalDl.addEventListener('click', () => {
      const url = modalDl.getAttribute('data-apk-url');
      if (modalDl.dataset.downloading === 'true' || modalDl._dlTimer) {
        cancelDownload(modalDl);
      } else {
        startDownloadSimulation(modalDl, url);
      }
    });
  }
}

function cancelDownload(buttonEl) {
  try {
    if (!buttonEl) return;
    if (buttonEl._dlTimer) {
      clearInterval(buttonEl._dlTimer);
      buttonEl._dlTimer = null;
    }
    buttonEl.removeAttribute('data-downloading');
    buttonEl.classList.remove('downloading');
    buttonEl.onclick = null;
    const fill = buttonEl.querySelector('.progress-fill');
    const label = buttonEl.querySelector('.progress-label');
    if (fill) fill.remove();
    if (label) label.remove();
    buttonEl.innerHTML = 'İndir';
    buttonEl.disabled = false;
    console.log('Download canceled');
  } catch (e) {
    console.error('cancelDownload error', e);
    if (buttonEl) {
      buttonEl.innerHTML = 'İndir';
      buttonEl.disabled = false;
      buttonEl.onclick = null;
      buttonEl.removeAttribute('data-downloading');
    }
  }
}

function closeModal() {
  document.getElementById('app-modal')?.classList.add('hidden');
}

function loadAppsLocally() {
  return JSON.parse(localStorage.getItem('mertixApps') || '[]');
}

function renderApps() {
  const grid = document.getElementById('app-grid');
  const count = document.getElementById('app-count');
  if (!grid) return;

  const apps = loadAppsLocally().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  grid.innerHTML = '';
  if (!apps.length) {
    grid.innerHTML = '<p class="meta">Henüz uygulama eklenmemiş.</p>';
  } else {
    apps.forEach((app) => grid.appendChild(createAppCard(app)));
  }

  if (count) {
    count.textContent = `${apps.length} uygulama`;
  }
}

function renderPublishedApps() {
  const list = document.getElementById('app-list');
  if (!list) return;
  const apps = loadAppsLocally().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  list.innerHTML = '';
  if (!apps.length) {
    list.innerHTML = '<p class="meta">Henüz yayınlanan uygulama yok.</p>';
    return;
  }

  apps.forEach((app) => {
    const item = document.createElement('div');
    item.className = 'app-item';
    item.innerHTML = `
      <div class="item-info">
        <h5>${app.name}</h5>
        <p>${app.developer} • ${app.version}</p>
      </div>
      <div class="item-actions">
        <button class="secondary-btn" data-action="edit">Düzenle</button>
        <button class="secondary-btn danger-btn" data-action="delete">Sil</button>
      </div>
    `;

    item.querySelector('[data-action="edit"]').addEventListener('click', () => {
      editIndex = app.id;
      fillForm(app);
      document.getElementById('submit-button').textContent = 'Güncelle';
      document.getElementById('cancel-edit').classList.remove('hidden');
    });

    item.querySelector('[data-action="delete"]').addEventListener('click', () => {
      // remove locally
      deleteAppLocally(app.id);
      // also attempt to remove from Firestore if configured
      (async () => {
        try {
          await initFirebaseIfNeeded();
          if (window._firebaseInitialized) await deleteAppFromFirestore(app.id);
        } catch (e) {
          // ignore
        }
      })();
      renderApps();
      renderPublishedApps();
      showStatus(`${app.name} silindi.`);
      resetForm();
    });

    list.appendChild(item);
  });
}

function setupEvents() {
  document.getElementById('close-modal')?.addEventListener('click', closeModal);
  document.getElementById('app-modal')?.addEventListener('click', (event) => {
    if (event.target.id === 'app-modal') closeModal();
  });

  // Export / Import apps (JSON)
  const exportBtn = document.getElementById('export-apps');
  const importInput = document.getElementById('import-apps');
  if (exportBtn) {
    exportBtn.addEventListener('click', () => {
      const data = localStorage.getItem('mertixApps') || '[]';
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `mertixApps-${new Date().toISOString().slice(0,19).replace(/:/g,'')}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    });
  }

  if (importInput) {
    importInput.addEventListener('change', (ev) => {
      const file = ev.target.files && ev.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const parsed = JSON.parse(String(reader.result || '[]'));
          if (!Array.isArray(parsed)) throw new Error('JSON must be an array of apps');
          const existing = JSON.parse(localStorage.getItem('mertixApps') || '[]');
          // merge by id if present, otherwise append
          const map = new Map();
          existing.forEach((a) => map.set(a.id || JSON.stringify(a), a));
          parsed.forEach((a) => map.set(a.id || JSON.stringify(a), a));
          const merged = Array.from(map.values());
          localStorage.setItem('mertixApps', JSON.stringify(merged));
          showStatus('Import başarılı.');
          populateAdminSelectors();
          renderApps();
          renderPublishedApps();
        } catch (e) {
          console.error(e);
          showStatus('Import hatası: Geçersiz dosya.', true);
        }
      };
      reader.readAsText(file);
    });
  }

  const form = document.getElementById('app-form');
  if (form) {
    form.addEventListener('submit', handleAdminSubmit);
  }

  const cancelButton = document.getElementById('cancel-edit');
  if (cancelButton) {
    cancelButton.addEventListener('click', () => {
      resetForm();
    });
  }
}

async function initApp() {
  setupEvents();
  await populateAdminSelectors();
  // Normalize any stored app screenshot URLs to actual files available in the res folder
  if (typeof fetchFolderFiles === 'function') {
    try {
      const resFiles = await fetchFolderFiles('res');
      if (Array.isArray(resFiles) && resFiles.length) {
        const apps = loadAppsLocally();
        let updated = false;
        apps.forEach((app) => {
          if (!Array.isArray(app.screenshotUrls)) return;
          const newUrls = app.screenshotUrls.map((u) => {
            if (!u) return defaultImage;
            // extract basename
            const base = decodeURIComponent(String(u).replace(/^res\//, '').split('/').pop());
            const match = resFiles.find((f) => String(f).toLowerCase() === base.toLowerCase());
            if (match) {
              updated = true;
              return resolveFileUrl('res', match);
            }
            return ensureScreenshotUrl(u);
          });
          app.screenshotUrls = newUrls;
        });
        if (updated) localStorage.setItem('mertixApps', JSON.stringify(apps));
      }
    } catch (e) {
      // ignore normalization errors
    }
  }
  renderApps();
  renderPublishedApps();
  // If firebase is configured, try to fetch remote apps and merge so other devices see them
  if (window.firebaseConfig) {
    try {
      const remote = await fetchAppsFromFirestore();
      if (Array.isArray(remote) && remote.length) {
        const existing = loadAppsLocally();
        const map = new Map();
        existing.forEach((a) => map.set(a.id || JSON.stringify(a), a));
        remote.forEach((a) => map.set(a.id || JSON.stringify(a), a));
        const merged = Array.from(map.values());
        localStorage.setItem('mertixApps', JSON.stringify(merged));
        // re-render after merge
        renderApps();
        renderPublishedApps();
        showStatus(`Firebase'den ${remote.length} uygulama senkronize edildi.`);
      }
    } catch (e) {
      console.error('Remote sync failed', e);
    }
  }
}

window.addEventListener('DOMContentLoaded', initApp);
