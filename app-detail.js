const defaultImage = './res/default.svg';

function getAppDataFromStorage(id) {
  const apps = JSON.parse(localStorage.getItem('mertixApps') || '[]');
  return apps.find((app) => app.id === id);
}

function formatBytes(bytes) {
  if (!bytes || bytes <= 0) return 'Bilinmiyor';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(1).replace('.0', '')} ${units[unitIndex]}`;
}

async function getApkSize(apkUrl) {
  if (!apkUrl || apkUrl === '#') return null;
  try {
    const response = await fetch(apkUrl, { method: 'HEAD' });
    if (!response.ok) return null;
    const length = response.headers.get('content-length');
    return length ? Number(length) : null;
  } catch (error) {
    return null;
  }
}

function ensureScreenshotUrl(value) {
  if (!value) return defaultImage;
  if (/^https?:\/\//.test(value) || value.startsWith('/') || value.startsWith('./') || value.includes('res/')) {
    return value;
  }
  return `res/${encodeURIComponent(value)}`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatInlineText(value) {
  const escaped = escapeHtml(value);
  return escaped
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong>$1</strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br>');
}

function formatDescriptionText(value) {
  if (!value) {
    return '<p class="detail-paragraph">Bu uygulama için henüz ayrıntılı bir açıklama eklenmemiş.</p>';
  }

  const lines = String(value).replace(/\r\n?/g, '\n').split('\n');
  const blocks = [];
  let listItems = [];

  const flushList = () => {
    if (!listItems.length) return;
    blocks.push(`<ul class="detail-list">${listItems.map((item) => `<li>${item}</li>`).join('')}</ul>`);
    listItems = [];
  };

  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) {
      flushList();
      blocks.push('<div class="detail-spacer"></div>');
      return;
    }

    if (/^[-*•]\s+/.test(trimmed)) {
      listItems.push(formatInlineText(trimmed.replace(/^[-*•]\s+/, '')));
      return;
    }

    flushList();
    blocks.push(`<p class="detail-paragraph">${formatInlineText(trimmed)}</p>`);
  });

  flushList();
  return blocks.join('');
}

function startDownloadSimulation(buttonEl, apkUrl) {
  if (!buttonEl) {
    if (apkUrl && apkUrl !== '#') window.open(apkUrl, '_blank');
    return;
  }

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

  const totalMs = Math.floor(Math.random() * 51 + 10) * 1000;
  const stepMs = totalMs / 100;
  const timers = [];
  const clearTimers = () => {
    timers.forEach((timerId) => clearTimeout(timerId));
    buttonEl._dlTimers = [];
  };

  let pct = 0;
  if (buttonEl._dlTimers?.length) {
    clearTimers();
  }

  for (let i = 1; i <= 100; i += 1) {
    const timerId = setTimeout(() => {
      pct = i;
      fill.style.width = pct + '%';
      label.textContent = `%${pct}`;
      if (pct >= 100) {
        clearTimers();
        delete buttonEl.dataset.downloading;
        buttonEl.classList.remove('downloading');
        buttonEl.onclick = null;
        label.textContent = '%100';
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
          buttonEl.innerHTML = 'APK İndir';
        }, 250);
      }
    }, i * stepMs);
    timers.push(timerId);
  }

  buttonEl._dlTimers = timers;
}

function cancelDownload(buttonEl) {
  if (!buttonEl) return;
  if (buttonEl._dlTimers?.length) {
    buttonEl._dlTimers.forEach((timerId) => clearTimeout(timerId));
    buttonEl._dlTimers = [];
  }
  buttonEl.removeAttribute('data-downloading');
  buttonEl.classList.remove('downloading');
  buttonEl.onclick = null;
  const fill = buttonEl.querySelector('.progress-fill');
  const label = buttonEl.querySelector('.progress-label');
  if (fill) fill.remove();
  if (label) label.remove();
  buttonEl.innerHTML = 'APK İndir';
  buttonEl.disabled = false;
}

async function renderAppDetails(app) {
  const content = document.getElementById('detail-content');
  if (!content) return;
  if (!app) {
    content.innerHTML = `
      <div class="detail-card">
        <div class="detail-body">
          <h2>Uygulama bulunamadı</h2>
          <p>Seçilen uygulama kaydedilmemiş ya da doğru şekilde yüklenmemiş.</p>
          <a class="primary-btn" href="./index.html">Ana sayfaya dön</a>
        </div>
      </div>
    `;
    return;
  }

  const screenshotUrls = Array.isArray(app.screenshotUrls) ? app.screenshotUrls : [defaultImage];
  const heroImage = ensureScreenshotUrl(screenshotUrls[0]) || defaultImage;
  const extraScreenshots = screenshotUrls.slice(1)
    .map((url) => `<img src="${ensureScreenshotUrl(url)}" alt="${app.name}" loading="lazy" />`)
    .join('');
  const apkSize = await getApkSize(app.apkUrl);

  content.innerHTML = `
    <div class="detail-card">
      <div class="detail-header">
        <div>
          <p class="eyebrow">${app.category || 'Kategori'}</p>
          <h2>${app.name}</h2>
          <p class="meta">${app.developer || 'Geliştirici'} • ${app.version || '1.0.0'}</p>
        </div>
        <span class="price">${app.price || 'Ücretsiz'}</span>
      </div>
      <div class="detail-image">
        <img src="${heroImage}" alt="${app.name}" loading="lazy" />
      </div>
      ${extraScreenshots ? `<div class="screenshot-row">${extraScreenshots}</div>` : ''}
      <div class="detail-body">
        <div class="detail-left">
          <div class="detail-section">
            <h3>Açıklama</h3>
            ${formatDescriptionText(app.longDescription || app.description || 'Bu uygulama için henüz ayrıntılı bir açıklama eklenmemiş.')}
          </div>
        </div>
        <div class="detail-right">
          <div class="detail-section whats-new-section">
            <h3>Yenilikler</h3>
            ${formatDescriptionText(app.whatsNew || 'Bu sürüme ait bir değişiklik listesi bulunmuyor.')}
          </div>
          <div class="detail-meta-grid">
            <div><strong>Geliştirici Ekibi</strong><span>${app.developer || 'Bilinmiyor'}</span></div>
            <div><strong>Uygulama Versiyonu</strong><span>${app.version || '1.0.0'}</span></div>
            <div><strong>Paket Adı</strong><span>${app.packageName || 'Belirtilmedi'}</span></div>
            <div><strong>Uygulama Boyutu</strong><span>${apkSize ? formatBytes(apkSize) : 'Bilinmiyor'}</span></div>
            <div>
              <strong>Yükleme • Güncelleme Tarihi</strong>
              <span>${app.installDate ? new Date(app.installDate).toLocaleDateString('tr-TR') : 'Belirtilmedi'} • ${app.updateDate ? new Date(app.updateDate).toLocaleDateString('tr-TR') : 'Belirtilmedi'}</span>
            </div>
          </div>
        </div>
      <div class="app-actions detail-actions">
        <button id="detail-download-btn" class="primary-btn download-btn" type="button" data-apk-url="${app.apkUrl || '#'}">APK İndir</button>
      </div>
    </div>
  `;

  const detailDl = document.getElementById('detail-download-btn');
  if (detailDl) {
    detailDl.addEventListener('click', () => {
      const url = detailDl.getAttribute('data-apk-url');
      if (detailDl.dataset.downloading === 'true' || detailDl._dlTimer) {
        cancelDownload(detailDl);
      } else {
        startDownloadSimulation(detailDl, url);
      }
    });
  }
}

function getAppIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get('id');
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

async function initFirebaseIfNeededLocal() {
  if (window._firebaseInitialized) return true;
  if (!window.firebaseConfig) return false;
  try {
    if (typeof firebase === 'undefined') {
      await loadScript('https://www.gstatic.com/firebasejs/9.22.1/firebase-app-compat.js');
      await loadScript('https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore-compat.js');
    }
    if (!window._firebaseInitialized) {
      firebase.initializeApp(window.firebaseConfig);
      window._firestore = firebase.firestore();
      window._firebaseInitialized = true;
      console.log('app-detail: Firebase initialized');
    }
    return true;
  } catch (e) {
    console.error('app-detail: Firebase init failed', e);
    return false;
  }
}

window.addEventListener('DOMContentLoaded', async () => {
  const id = getAppIdFromUrl();
  const app = id ? getAppDataFromStorage(id) : null;
  renderAppDetails(app);

  // If Firebase is configured, subscribe to real-time updates for this app
  if (id && window.firebaseConfig) {
    const inited = await initFirebaseIfNeededLocal();
    if (!inited) return;

    try {
      const docRef = window._firestore.collection('apps').doc(id);

      // add a small realtime status badge to the page for debugging
      let rtBadge = document.getElementById('realtime-badge');
      if (!rtBadge) {
        rtBadge = document.createElement('div');
        rtBadge.id = 'realtime-badge';
        rtBadge.style.cssText = 'position:fixed;right:18px;top:84px;padding:8px 10px;border-radius:10px;background:rgba(0,0,0,0.45);color:#fff;font-size:12px;z-index:60;';
        rtBadge.textContent = 'Realtime: bağlanılıyor...';
        document.body.appendChild(rtBadge);
      }

      let lastSnapshot = null;
      const setBadge = (txt, ok) => { rtBadge.textContent = `Realtime: ${txt}`; rtBadge.style.background = ok ? 'linear-gradient(90deg,#10b981,#06b6d4)' : 'rgba(239,68,68,0.12)'; };

      const unsubscribe = docRef.onSnapshot((snapshot) => {
        try {
          console.log('app-detail: onSnapshot event', { id, metadata: snapshot && snapshot.metadata });
          if (!snapshot) return;
          if (!snapshot.exists) {
            setBadge('kayıt yok', false);
            return;
          }
          const data = snapshot.data();
          console.log('app-detail: snapshot data', data);
          lastSnapshot = Date.now();
          setBadge('güncellendi ' + new Date(lastSnapshot).toLocaleTimeString(), true);

          // Merge/update localStorage so other parts of UI see the change
          try {
            const apps = JSON.parse(localStorage.getItem('mertixApps') || '[]');
            const idx = apps.findIndex((a) => a.id === id);
            if (idx === -1) apps.push(data);
            else apps[idx] = data;
            localStorage.setItem('mertixApps', JSON.stringify(apps));
          } catch (e) {
            console.warn('app-detail: could not merge to localStorage', e);
          }
          renderAppDetails(data);
        } catch (e) {
          console.error('app-detail: onSnapshot handler exception', e);
        }
      }, (err) => {
        console.error('app-detail: onSnapshot error', err);
        setBadge('hata', false);
      });

      // fallback: if no snapshot received within 12s, do a manual get() poll once
      const pollInterval = 12000;
      let pollTimer = setInterval(async () => {
        try {
          if (lastSnapshot && Date.now() - lastSnapshot < pollInterval) return; // recent snapshot received
          const doc = await docRef.get();
          if (doc && doc.exists) {
            const data = doc.data();
            // compare by updatedAt or JSON
            const apps = JSON.parse(localStorage.getItem('mertixApps') || '[]');
            const idx = apps.findIndex((a) => a.id === id);
            const local = idx === -1 ? null : apps[idx];
            const remoteSerialized = JSON.stringify(data || {});
            const localSerialized = JSON.stringify(local || {});
            if (remoteSerialized !== localSerialized) {
              console.log('app-detail: poll detected change, updating local copy');
              if (idx === -1) apps.push(data); else apps[idx] = data;
              localStorage.setItem('mertixApps', JSON.stringify(apps));
              renderAppDetails(data);
              lastSnapshot = Date.now();
              setBadge('polled ve güncellendi ' + new Date(lastSnapshot).toLocaleTimeString(), true);
            }
          }
        } catch (e) {
          console.warn('app-detail: poll error', e);
        }
      }, pollInterval);

      // detach on unload
      window.addEventListener('beforeunload', () => {
        try { unsubscribe(); } catch (e) {}
        try { clearInterval(pollTimer); } catch (e) {}
      });
    } catch (e) {
      console.error('app-detail: realtime subscription failed', e);
    }
  }
});
