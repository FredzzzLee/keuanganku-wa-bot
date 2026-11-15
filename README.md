# Bot WhatsApp Keuanganku

Bot WhatsApp untuk pencatatan keuangan pribadi di aplikasi **Keuanganku**.

## Deploy di Render.com
1. Buat **New Web Service** di Render.
2. Hubungkan repositori GitHub ini.
3. Konfigurasi:
   - **Environment**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `node index.js`
4. Tambahkan **Environment Variable**:
   - `FIREBASE_SERVICE_ACCOUNT`: Isi dengan seluruh teks JSON dari file `service-account.json`.
5. Klik **Deploy Web Service**.
6. Buka URL web service Anda (contoh: `https://<app-name>.onrender.com/qr`) untuk scan QR code WhatsApp.
