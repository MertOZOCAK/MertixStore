(function(){
  function setFooterYear(){
    const el = document.getElementById('footer-year');
    if(el) el.textContent = new Date().getFullYear();
  }

  function createBackToTop(){
    const btn = document.createElement('button');
    btn.id = 'back-to-top';
    btn.title = 'Sayfanın başına dön';
    btn.innerHTML = '⬆';
    document.body.appendChild(btn);

    btn.addEventListener('click', function(){
      window.scrollTo({top:0, behavior:'smooth'});
    });

    function toggle(){
      if(window.scrollY > 300) btn.classList.add('visible');
      else btn.classList.remove('visible');
    }

    window.addEventListener('scroll', toggle);
    toggle();
  }

  // small enhancement: make footer links smooth for internal anchors
  function enhanceFooterLinks(){
    document.querySelectorAll('.site-footer a[href^="#"]').forEach(a => {
      a.addEventListener('click', function(e){
        e.preventDefault();
        const tgt = document.querySelector(this.getAttribute('href'));
        if(tgt) tgt.scrollIntoView({behavior:'smooth'});
      });
    });
  }

  document.addEventListener('DOMContentLoaded', function(){
    setFooterYear();
    createBackToTop();
    enhanceFooterLinks();
  });
})();

// Subscription handling (saves to Firestore if available, otherwise localStorage)
(function(){
  async function saveSubscription(email){
    // try firestore if initialized or available
    try{
      if (typeof initFirebaseIfNeeded === 'function') {
        const inited = await initFirebaseIfNeeded();
        if (inited && window._firestore) {
          await window._firestore.collection('subscriptions').add({ email, createdAt: new Date().toISOString() });
          return { ok: true, source: 'firestore' };
        }
      }
    }catch(e){
      console.warn('Firestore save failed', e);
    }

    // fallback to localStorage
    try{
      const key = 'mertixSubscriptions';
      const arr = JSON.parse(localStorage.getItem(key) || '[]');
      arr.push({ email, createdAt: new Date().toISOString() });
      localStorage.setItem(key, JSON.stringify(arr));
      return { ok: true, source: 'local' };
    }catch(e){
      return { ok: false, error: e };
    }
  }

  function showMessage(el, text, isError){
    if(!el) return;
    el.textContent = text;
    el.style.color = isError ? 'var(--danger)' : 'var(--muted)';
  }

  document.addEventListener('DOMContentLoaded', function(){
    const form = document.getElementById('footer-subscribe-form');
    const input = document.getElementById('footer-email');
    const msg = document.getElementById('footer-subscribe-msg');
    if(!form || !input) return;

    form.addEventListener('submit', async function(e){
      e.preventDefault();
      const email = (input.value || '').trim();
      if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)){
        showMessage(msg, 'Lütfen geçerli bir e-posta girin.', true);
        return;
      }
      showMessage(msg, 'Gönderiliyor...');
      try{
        const res = await saveSubscription(email);
        if(res.ok){
          showMessage(msg, 'Teşekkürler! Aboneliğiniz alındı.');
          input.value = '';
        }else{
          showMessage(msg, 'Kaydedilemedi. Lütfen tekrar deneyin.', true);
        }
      }catch(err){
        console.error(err);
        showMessage(msg, 'Bir hata oluştu. Lütfen tekrar deneyin.', true);
      }
      setTimeout(()=>{ if(msg) msg.textContent=''; }, 5000);
    });
  });
})();
