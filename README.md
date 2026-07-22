# Mertix Store — Local testing

Quick steps to serve the project so other devices on your network can access it:

- Recommended (Python 3):

```bash
python -m http.server 8000
```

- Or use the provided PowerShell helper on Windows:

```powershell
.\start-server.ps1
```

Then on another device open: `http://<PC_LAN_IP>:8000/`

Check assets and debug page: `http://<PC_LAN_IP>:8000/check-assets.html`

If images don't appear on another device, check browser DevTools (Network/Console) for 404s.
# Mertix Store

Play Store benzeri bir uygulama mağazası projesi.

## Özellikler
- Admin panelinden yeni uygulama ekleme
- APK dosyası yükleme
- Ekran görselleri ekleme
- Firebase Firestore + Storage entegrasyonu
- Kullanıcı tarafında güzel kart arayüzü
- Detay modalı ve indirme butonu

## Kurulum
1. Firebase projesi oluşturun.
2. [firebase-config.js](firebase-config.js) dosyasındaki değerleri kendi proje bilgilerinizle değiştirin.
3. Bir HTTP sunucusu başlatın:
   - Python: `python -m http.server 8000`
4. Tarayıcıda açın:
   - Ana sayfa: http://localhost:8000/index.html
   - Admin: http://localhost:8000/admin.html

## Not
Firebase yapılandırması yapılmazsa site yerel olarak çalışmaya devam eder; ancak veri kaydı için Firebase gerekli olacaktır.
