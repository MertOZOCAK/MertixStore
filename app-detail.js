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

  const totalMs = 3000;
  const stepMs = totalMs / 100;
  let pct = 0;
  if (buttonEl._dlTimer) clearInterval(buttonEl._dlTimer);
  buttonEl._dlTimer = setInterval(() => {
    pct += 2;
    if (pct > 100) pct = 100;
    fill.style.width = pct + '%';
    label.textContent = `%${pct}`;
    if (pct >= 100) {
      clearInterval(buttonEl._dlTimer);
      buttonEl._dlTimer = null;
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
  }, stepMs);
}

function cancelDownload(buttonEl) {
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
        <div class="detail-section">
          <h3>Açıklama</h3>
          <p>${app.longDescription || app.description || 'Bu uygulama için henüz ayrıntılı bir açıklama eklenmemiş.'}</p>
        </div>
        <div class="detail-meta-grid">
          <div><strong>Geliştirici Ekibi</strong><span>${app.developer || 'Bilinmiyor'}</span></div>
          <div><strong>Uygulama Versiyonu</strong><span>${app.version || '1.0.0'}</span></div>
          <div><strong>Paket Adı</strong><span>${app.packageName || 'Belirtilmedi'}</span></div>
          <div><strong>Uygulama Boyutu</strong><span>${apkSize ? formatBytes(apkSize) : 'Bilinmiyor'}</span></div>
          <div><strong>Ekleme / Güncelleme Tarihi</strong><span>${new Date(app.createdAt || Date.now()).toLocaleDateString('tr-TR')}</span></div>
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

window.addEventListener('DOMContentLoaded', () => {
  const id = getAppIdFromUrl();
  const app = id ? getAppDataFromStorage(id) : null;
  renderAppDetails(app);
});
