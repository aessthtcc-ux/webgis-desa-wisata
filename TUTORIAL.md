# Tutorial WebGIS Amenitas Desa Wisata

Dokumen ini menjelaskan proyek baris demi baris: apa peran tiap berkas, mengapa
kodenya ditulis begitu, dan bagian mana yang boleh Anda ubah. Susunannya
mengikuti urutan kerja nyata, dari menyiapkan data di QGIS sampai memodifikasi
tampilan.

---

## Daftar isi

1. [Konsep: WebGIS statis vs WebGIS berbasis server](#1-konsep)
2. [Menyiapkan data di QGIS](#2-menyiapkan-data-di-qgis)
3. [Struktur berkas dan urutan pemuatan](#3-struktur-berkas)
4. [index.html — kerangka halaman](#4-indexhtml)
5. [data/ — cara GeoJSON masuk ke halaman](#5-data)
6. [js/config.js — satu tempat untuk semua pengaturan](#6-jsconfigjs)
7. [js/app.js — inti aplikasi](#7-jsappjs)
8. [js/measure.js — matematika di balik ukur jarak dan luas](#8-jsmeasurejs)
9. [css/style.css — sistem tampilan](#9-cssstylecss)
10. [Latihan modifikasi](#10-latihan-modifikasi)
11. [Masalah yang sering muncul](#11-masalah-yang-sering-muncul)
12. [Ke mana setelah ini](#12-ke-mana-setelah-ini)

---

<a name="1-konsep"></a>
## 1. Konsep: WebGIS statis vs WebGIS berbasis server

WebGIS umumnya punya tiga lapis:

| Lapis | Tugas | Contoh teknologi |
|---|---|---|
| Penyimpanan data | menyimpan geometri dan atribut | PostGIS, shapefile, GeoJSON |
| Layanan peta | mengirim data ke peramban | GeoServer, MapServer, API |
| Antarmuka | menggambar peta di layar | Leaflet, OpenLayers, MapLibre |

Proyek ini memangkas lapis tengah. Data disimpan sebagai berkas GeoJSON yang
dibungkus variabel JavaScript, lalu dibaca langsung oleh peramban. Tidak ada
basis data, tidak ada backend, tidak ada proses yang harus dijalankan.

**Konsekuensinya, yang perlu Anda sadari:**

* **Semua data terunduh sekali di awal.** Cocok sampai sekitar 5 MB GeoJSON.
  Di atas itu peta mulai terasa berat saat dibuka dan saat digeser.
* **Data terbuka untuk siapa saja.** Siapa pun bisa membuka `data/*.js` dan
  melihat seluruh atribut. Jangan taruh data pribadi warga (nomor KTP, nominal
  penghasilan) di sini.
* **Tidak ada query spasial di server.** Analisis seperti *buffer*, *intersect*,
  atau pencarian radius harus dihitung di peramban atau disiapkan lebih dulu di
  QGIS.
* **Bisa diunggah ke mana saja.** GitHub Pages, Netlify, hosting desa, bahkan
  flashdisk. Tidak perlu server khusus.

Itu sebabnya pendekatan ini pas untuk peta amenitas satu desa: datanya kecil,
jarang berubah, dan tujuannya menampilkan, bukan menganalisis.

### Kenapa tidak memakai qgis2web saja?

qgis2web (seperti contoh Peta Desa Kauman) menuliskan gaya, legenda, dan popup
langsung sebagai kode. Setiap kali simbologi di QGIS berubah, Anda harus ekspor
ulang seluruh proyek, dan semua penyesuaian manual pada kode hilang.

Proyek ini memisahkan **data**, **pengaturan**, dan **logika**. Ganti data tanpa
menyentuh kode, ganti warna tanpa menyentuh data. Legenda dan indeks pencarian
dibangun otomatis dari isi data, jadi tidak ada daftar yang perlu disinkronkan
manual.

---

<a name="2-menyiapkan-data-di-qgis"></a>
## 2. Menyiapkan data di QGIS

Ini bagian yang paling menentukan. Kode di bawah sudah rapi; yang membuat peta
gagal tampil hampir selalu masalah data.

### 2.1 Pisahkan berdasarkan tipe geometri

GeoJSON boleh mencampur tipe geometri, tetapi menggambarnya jadi rumit: poligon
butuh isian warna, garis butuh ketebalan, titik butuh radius. Proyek ini memakai
tiga layer terpisah:

| Berkas | Tipe | Isi |
|---|---|---|
| `jalan.geojson` | LineString | jalan aspal, paving, tanah, gang, jalur pejalan kaki |
| `bangunan.geojson` | Polygon | homestay, rumah warga, warung, musholla, balai desa |
| `vegetasi.geojson` | Polygon | sawah, kebun campur, pepohonan, semak belukar, taman |
| `lahan_kosong.geojson` | Polygon | lahan terbuka, tanah kosong, parkir tanah, lapangan |

Jumlah layer bebas. Untuk menambah layer kelima, cukup taruh berkasnya di
`data/` dan tambahkan satu entri di `config.js`.

### 2.1b Skema atribut yang dipakai proyek ini

Keempat layer memakai lima kolom yang sama:

| Kolom | Isi | Dipakai untuk |
|---|---|---|
| `id` | nomor urut fitur | popup |
| `Nama_Obj` | nama objek, mis. `Homestay`, `Sawah` | judul popup, **warna**, legenda, pencarian |
| `Kelas_Obj` | kelas objek, mis. `Permukiman` | popup, pencarian |
| `Keterangan` | penjelasan bebas | popup, pencarian |
| `area` | luas m² (poligon) atau luas perkerasan (jalan) | popup |

`Nama_Obj` adalah kolom yang paling menentukan tampilan: dari situlah warna dan
legenda tiap layer dibentuk.

### 2.2 Rapikan tabel atribut

Aturan penamaan kolom yang menyelamatkan Anda nanti:

* huruf kecil semua, tanpa spasi: `jam_buka`, bukan `Jam Buka`;
* tanpa tanda baca selain garis bawah;
* maksimal 10 karakter kalau data Anda masih berbentuk shapefile (batas DBF),
  karena `Keterangan_Objek` akan terpotong jadi `Keterangan` tanpa peringatan.

Perhatikan contoh buruk pada peta Kauman: ada kategori `Rumah Sakit` **dan**
`Rumah sakit`. Bagi komputer itu dua kategori berbeda, sehingga muncul dua entri
legenda dengan warna berbeda untuk hal yang sama. Sebelum ekspor, buka tabel
atribut, urutkan kolom kategori, dan samakan penulisannya. Cara cepat di QGIS:
**Processing → Vector table → Refactor fields**, atau pakai Field Calculator
dengan ekspresi seperti:

```
trim(replace("kategori", 'Rumah sakit', 'Rumah Sakit'))
```

### 2.3 Hitung luas dan panjang sebelum ekspor

Jangan andalkan angka luas dari WebGIS untuk laporan. Hitung di QGIS dalam
proyeksi metrik (UTM 49S untuk Nganjuk, EPSG:32749), simpan sebagai kolom:

```
$area        → luas_m2
$length      → panjang_m
```

Pastikan CRS proyek sudah UTM saat menghitung, lalu baru ubah ke WGS 84 saat
ekspor.

### 2.4 Ekspor

Klik kanan layer → **Export → Save Features As**:

* Format: **GeoJSON**
* CRS: **EPSG:4326 – WGS 84** (wajib; Leaflet hanya mengerti lintang/bujur
  desimal, bukan meter UTM)
* COORDINATE_PRECISION: **7** (sekitar 1 cm, cukup untuk hasil fotogrametri dan
  memangkas ukuran berkas jauh dibanding 15 angka desimal bawaan)
* Centang hanya kolom yang benar-benar dipakai

### 2.5 Sederhanakan geometri bila perlu

Hasil digitasi layar sering punya simpul rapat. Kalau berkas GeoJSON Anda lebih
dari 2 MB, jalankan **Vector → Geometry Tools → Simplify** dengan toleransi
0,2–0,5 m. Bentuk bangunan tetap terbaca, ukuran berkas bisa turun separuh.

---

<a name="3-struktur-berkas"></a>
## 3. Struktur berkas dan urutan pemuatan

```
webgis-desa-wisata/
├── index.html                  kerangka halaman + urutan pemuatan skrip
├── css/style.css               seluruh tampilan
├── js/
│   ├── config.js               pengaturan: peta dasar, layer, warna, popup
│   ├── measure.js              alat ukur jarak dan luas
│   └── app.js                  logika utama
├── data/
│   ├── jalan.geojson           polyline
│   ├── bangunan.geojson        polygon
│   ├── vegetasi.geojson        polygon
│   └── lahan_kosong.geojson    polygon
├── tools/geojson2js.py         pengubah .geojson menjadi .js
├── img/                        foto untuk popup
├── README.md                   ringkasan pemakaian
└── TUTORIAL.md                 dokumen ini
```

Urutan `<script>` di bagian bawah `index.html` tidak boleh ditukar:

```
leaflet.js   →  menyediakan objek global L
config.js    →  membuat objek CONFIG
measure.js   →  membuat kelas AlatUkur
app.js       →  memakai L, CONFIG, AlatUkur; lalu mengambil data GeoJSON
```

JavaScript dijalankan dari atas ke bawah. Kalau `app.js` dimuat sebelum
`config.js`, muncul galat `CONFIG is not defined` dan peta tampil kosong.

Perhatikan bahwa berkas data **tidak** punya tag `<script>` sama sekali. Data
diambil oleh `app.js` secara asinkron lewat `fetch`, mengikuti daftar `berkas:`
di `config.js`.

---

<a name="4-indexhtml"></a>
## 4. index.html

Berkas ini sengaja tipis. Isinya hanya wadah kosong; seluruh isi peta dibuat
oleh JavaScript.

### 4.1 Bagian `<head>`

```html
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
```

`maximum-scale=1` dan `user-scalable=no` mematikan cubit-zoom pada halaman.
Tanpa ini, di ponsel gerakan mencubit untuk memperbesar peta kadang malah
memperbesar seluruh halaman termasuk panel. Peta punya mekanisme zoom sendiri.

```html
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
```

CSS Leaflet harus dimuat **sebelum** `style.css`, supaya penyesuaian yang Anda
tulis (bentuk popup, tombol) menimpa gaya bawaan, bukan sebaliknya.

Versinya dikunci di `1.9.4`. Jangan ganti jadi `latest`: kalau Leaflet rilis
versi baru dengan perubahan besar, peta Anda bisa rusak sendiri tanpa Anda
mengubah apa pun.

### 4.2 Wadah peta

```html
<div id="map"></div>
```

Satu div kosong. Ukurannya diatur di CSS dengan `position:absolute; inset:0`,
artinya memenuhi seluruh jendela. **Leaflet wajib tahu tinggi wadahnya.** Kalau
tinggi div nol, peta tidak tampil sama sekali meski tidak ada pesan galat sama
sekali di konsol. Ini kesalahan nomor satu pemula Leaflet.

### 4.3 Panel melayang

Panel judul, panel layer, dan kotak hasil ukur ditulis sebagai HTML biasa yang
melayang di atas peta, bukan sebagai `L.Control`. Alasannya: HTML biasa lebih
mudah ditata, di-*styling*, dan dibuat responsif. `L.Control` hanya dipakai untuk
tombol yang memang harus menempel di sudut peta (zoom, ukur).

Yang perlu diperhatikan: elemen di atas peta harus punya `z-index` lebih besar
dari peta. Leaflet memakai `z-index` 400–800 untuk lapisannya, jadi panel diberi
`z-index: 1000`.

Atribut yang tampak kecil tapi penting:

* `aria-label` pada input pencarian — pembaca layar butuh nama untuk kotak isian
  yang tidak punya `<label>` terlihat.
* `aria-expanded` pada tombol panel layer — menandakan panel sedang terbuka atau
  tertutup; nilainya juga dipakai CSS untuk memutar ikon panah.
* `hidden` pada daftar hasil pencarian dan kotak ukur — elemennya ada sejak awal
  tapi disembunyikan, jadi JavaScript tinggal mengubah `hidden` tanpa membuat
  ulang elemen.

---

<a name="5-data"></a>
## 5. data/ — cara GeoJSON masuk ke halaman

Berkas data disimpan apa adanya sebagai `.geojson`, persis seperti keluaran
QGIS:

```json
{
 "type": "FeatureCollection",
 "name": "bangunan",
 "features": [
  {
   "type": "Feature",
   "properties": { "id": 1, "Nama_Obj": "Homestay", "Kelas_Obj": "Permukiman",
                   "Keterangan": "Rumah warga disewakan, 4 kamar", "area": 454.14 },
   "geometry": { "type": "Polygon", "coordinates": [[[111.9019, -7.6040]]] }
  }
 ]
}
```

### 5.1 Cara app.js membacanya

```js
fetch(def.berkas)
  .then(function (r) { return r.json(); })
  .then(function (isi) { bangunLayer(def, isi); });
```

`fetch` mengambil berkas lewat HTTP, lalu `.json()` mengubah teksnya menjadi
objek JavaScript. Prosesnya asinkron: peramban tidak berhenti menunggu unduhan
selesai, melainkan melanjutkan baris berikutnya dan kembali lagi nanti. Karena
itu seluruh pembangunan layer dibungkus `Promise.all`:

```js
Promise.all(CONFIG.layers.map(muatLayer)).then(function (hasil) {
  hasil.forEach(...);         // bangun keempat layer
  map.fitBounds(batasSemua);  // baru sesuaikan tampilan
});
```

`Promise.all` menunggu keempat berkas selesai. Tanpa itu, `fitBounds` bisa
berjalan saat baru satu layer yang masuk, dan peta akan zoom ke sebagian data
saja.

Penanganan kegagalannya juga sengaja dibuat lunak: kalau satu berkas hilang,
tiga layer lain tetap digambar dan muncul kotak pemberitahuan berisi nama layer
yang gagal. Peta tidak mati total hanya karena satu berkas salah nama.

### 5.2 Kenapa harus lewat server lokal

Peramban melarang JavaScript membaca berkas dari cakram lokal ketika halaman
dibuka dengan `file://`. Aturan keamanan ini disebut CORS, dan berlaku bahkan
untuk berkas di folder yang sama. Karena itu, klik dua kali pada `index.html`
akan memunculkan kotak merah berisi penjelasan dan perintah berikut:

```bash
cd webgis-desa-wisata
python -m http.server 8000
```

Lalu buka `http://localhost:8000`. Perintah ini tidak memasang apa pun; ia hanya
menyajikan folder Anda lewat HTTP supaya `fetch` diizinkan.

### 5.3 Kalau memang harus bisa diklik dua kali

Misalnya untuk dikumpulkan sebagai berkas tugas atau dibawa di flashdisk tanpa
jaminan ada Python di komputer tujuan. Solusinya trik yang dipakai qgis2web:
bungkus GeoJSON menjadi variabel JavaScript, lalu muat lewat tag `<script>` yang
tidak dibatasi CORS.

Skrip `tools/geojson2js.py` melakukannya untuk semua berkas sekaligus:

```bash
python tools/geojson2js.py
```

Hasilnya `data/jalan.js` berisi `var json_jalan = {...};` dan seterusnya.
Lalu dua penyesuaian:

1. Di `js/config.js`, ganti `berkas: 'data/jalan.geojson'` menjadi
   `variabel: 'json_jalan'`.
2. Di `index.html`, tambahkan sebelum `js/config.js`:
   ```html
   <script src="data/jalan.js"></script>
   ```

`app.js` mendukung keduanya lewat fungsi `muatLayer`, jadi Anda bisa memakai
`berkas` saat mengembangkan dan `variabel` saat menyerahkan hasil.

### 5.4 Aturan koordinat yang sering bikin peta kosong

GeoJSON menulis koordinat dengan urutan **`[bujur, lintang]`** — x dulu, baru y.
Leaflet dalam pemanggilan seperti `setView()` memakai urutan
**`[lintang, bujur]`**. Terbalik. Ini bukan kesalahan desain, hanya dua standar
berbeda yang bertemu.

Untungnya Anda hampir tak pernah menulis koordinat manual: `L.geoJSON()` sudah
menangani konversinya. Yang perlu ditulis manual hanya `CONFIG.peta.center`, dan
itu memakai urutan Leaflet: lintang dulu.

Cara mengenali kalau tertukar: peta melompat ke laut lepas dekat Somalia, atau
ke daerah kosong yang jauh dari Indonesia. Bujur Indonesia berkisar 95–141,
lintang antara 6 dan −11. Kalau angka pertama di data Anda bernilai −7, berarti
urutannya sudah salah.

### 5.5 Mengganti dengan data sendiri

Timpa keempat berkas di folder `data/` dengan hasil ekspor Anda, dengan nama
berkas yang sama. Tidak ada kode yang perlu disentuh selama nama kolomnya juga
sama. Kalau nama berkasnya berbeda, ubah nilai `berkas:` di `config.js`.

---

<a name="6-jsconfigjs"></a>
## 6. js/config.js — satu tempat untuk semua pengaturan

Inilah berkas yang dirancang untuk Anda ubah. Bentuknya satu objek besar bernama
`CONFIG` dengan tiga bagian.

### 6.1 `CONFIG.peta`

```js
peta: {
  center: [-7.6045, 111.9030],   // [lintang, bujur]
  zoom: 16,
  zoomMin: 10,
  zoomMaks: 24,
  autoFit: true
}
```

`autoFit: true` membuat peta otomatis menyesuaikan ke seluruh data saat dibuka,
sehingga `center` dan `zoom` hanya jadi cadangan bila data kosong. Biarkan
menyala; Anda tidak perlu mencari koordinat tengah desa secara manual.

`zoomMaks: 24` melampaui batas peta dasar daring yang umumnya berhenti di 19.
Bagaimana bisa? Lihat `zoomMaksAsli` di bagian berikutnya.

### 6.2 `CONFIG.basemaps`

```js
{
  nama: 'Citra',
  url: 'https://server.arcgisonline.com/.../{z}/{y}/{x}',
  atribusi: 'Citra &copy; Esri',
  zoomMaksAsli: 19
}
```

`{z}/{x}/{y}` adalah pola penomoran ubin standar: z tingkat zoom, x kolom, y
baris. Perhatikan Esri memakai urutan `{z}/{y}/{x}` — terbalik dari OSM. Salah
urutan berarti ubin acak muncul di tempat yang salah.

`zoomMaksAsli` (`maxNativeZoom` di Leaflet) berarti: "ubin asli hanya tersedia
sampai level ini; di atasnya perbesar saja gambar yang ada." Efeknya, pengguna
tetap bisa zoom sampai 24 untuk melihat detail digitasi, gambar peta dasar jadi
buram tapi tidak berubah jadi kotak abu-abu kosong. Ini penting untuk data
fotogrametri yang detailnya jauh melebihi peta dasar daring.

**Memakai ortofoto drone Anda sendiri.** Di QGIS: **Processing → Raster tools →
Generate XYZ tiles (Directory)**, tentukan zoom 14–21, simpan ke folder `tiles/`
di dalam proyek. Lalu buka komentar blok Ortofoto:

```js
{
  nama: 'Ortofoto',
  url: 'tiles/{z}/{x}/{y}.png',
  atribusi: 'Ortofoto drone, survei desa',
  zoomMaksAsli: 22
}
```

Satu peringatan: ubin lokal dibaca lewat jaringan, jadi ini **harus** dijalankan
lewat server lokal, tidak bisa klik dua kali. Dan hitung dulu ukurannya — zoom
sampai 22 untuk satu desa bisa menghasilkan puluhan ribu berkas dan ratusan MB.
Mulailah dari zoom maksimum 20 dan naikkan hanya kalau memang kurang tajam.

### 6.3 `CONFIG.layers`

Bagian terpenting. Satu objek untuk satu layer:

```js
{
  id: 'bangunan',                     // pengenal internal, harus unik
  nama: 'Bangunan',                   // yang tampil di daftar layer
  tipe: 'poligon',                    // 'poligon' | 'garis' | 'titik'
  berkas: 'data/bangunan.geojson',    // path berkas data
  aktif: true,                        // tampil saat peta dibuka?
  fieldNama: 'Nama_Obj',              // judul popup & pencarian
  fieldKategori: 'Nama_Obj',          // penentu warna & legenda
  popup: {
    'Kelas objek': 'Kelas_Obj',       // 'Label yang tampil': 'nama_kolom'
    'Keterangan': 'Keterangan',
    'Luas (m²)': 'area',
    'ID': 'id'
  },
  warna: { 'Homestay': '#b5651d', 'Warung': '#c0392b' },
  palet: ['#b5651d', '#d08c4a', '#c0392b', '#7a5ea8', '#8e3b46'],
  tebal: 4                            // khusus garis; titik pakai `radius`
}
```

Di proyek ini `fieldNama` dan `fieldKategori` kebetulan sama-sama `Nama_Obj`:
nama objek sekaligus menjadi dasar klasifikasi warna. Kalau kelak Anda ingin
mewarnai berdasarkan kelas, cukup ubah `fieldKategori` menjadi `'Kelas_Obj'`.
Legenda akan langsung ikut berubah tanpa penyesuaian lain.

### 6.3b Bagaimana warna dibagikan per `Nama_Obj`

Inilah bagian yang menggantikan blok `switch...case` panjang milik qgis2web.
Fungsinya ada di `app.js`:

```js
function siapkanWarna(def, geojson) {
  var nilai = [];                       // kumpulkan nilai Nama_Obj yang unik
  geojson.features.forEach(function (f) {
    var v = f.properties[def.fieldKategori] || 'Lainnya';
    if (nilai.indexOf(v) === -1) nilai.push(v);
  });
  nilai.sort(function (a, b) { return a.localeCompare(b, 'id'); });

  var peta = {}, n = 0;
  nilai.forEach(function (v) {
    if (def.warna && def.warna[v]) peta[v] = def.warna[v];   // dikunci manual
    else peta[v] = def.palet[n++ % def.palet.length];        // ambil dari palet
  });
  def._warna = peta;
  def._nilai = nilai;
}
```

Alurnya: kumpulkan seluruh nilai `Nama_Obj` yang benar-benar muncul di data,
urutkan menurut abjad, lalu bagikan warna. Nilai yang sudah Anda kunci di
`warna` dipakai apa adanya; sisanya mengambil warna berikutnya dari `palet`.

Konsekuensi praktisnya:

* **Anda tidak wajib mendaftarkan semua nilai lebih dulu.** Kalau data Anda
  punya `Nama_Obj` bernama `Tambak` yang belum ada di `warna`, objek itu tetap
  digambar dengan warna dari palet dan tetap muncul di legenda. Peta tidak
  pernah diam-diam menyembunyikan data.
* **Urutan abjad membuat warna stabil.** Selama daftar nilai tidak berubah,
  warna suatu kategori akan sama setiap kali halaman dibuka.
* **`% def.palet.length`** membuat warna berputar kembali ke awal kalau jumlah
  kategori melebihi jumlah warna di palet. Kalau itu terjadi dan dua kategori
  jadi berwarna sama, tinggal tambahkan warna baru ke `palet`.

Tiap layer diberi kelompok warna sendiri supaya masih bisa dibedakan sekilas
meski keempatnya menyala bersamaan:

| Layer | Kelompok warna | Alasan |
|---|---|---|
| Vegetasi | hijau | konvensi kartografi untuk tutupan vegetasi |
| Bangunan | merah bata sampai ungu | kontras kuat terhadap hijau, mudah dikenali |
| Lahan kosong | kuning tanah | mengesankan permukaan terbuka tanpa vegetasi |
| Jalan | abu gelap sampai biru | netral, tidak bersaing dengan poligon di bawahnya |

Untuk mengunci satu warna, tambahkan satu baris di `warna`:

```js
warna: {
  'Sawah': '#8fbf5a',
  'Tambak': '#4a8fb5'      // baris baru
}
```

### 6.4 Menambah layer kelima

Dua langkah:

1. Simpan data sebagai `data/utilitas.geojson`.
2. Tambahkan objek baru ke `CONFIG.layers` dengan `id` yang belum dipakai,
   `tipe` sesuai geometrinya, dan `berkas: 'data/utilitas.geojson'`.

Tidak ada berkas lain yang perlu disentuh. Daftar layer, legenda, pencarian, dan
popup akan ikut menyesuaikan.

---

<a name="7-jsappjs"></a>
## 7. js/app.js — inti aplikasi

Seluruh isinya dibungkus IIFE:

```js
(function () {
  'use strict';
  // ...
})();
```

Fungsi yang langsung memanggil dirinya sendiri. Gunanya menjaga agar variabel
seperti `map`, `input`, atau `alat` tidak bocor menjadi variabel global dan
bertabrakan dengan pustaka lain. `'use strict'` membuat peramban menolak
kesalahan diam-diam seperti salah ketik nama variabel.

### 7.1 Membuat peta

```js
var map = L.map('map', {
  zoomControl: false,
  minZoom: CONFIG.peta.zoomMin,
  maxZoom: CONFIG.peta.zoomMaks
}).setView(CONFIG.peta.center, CONFIG.peta.zoom);

L.control.zoom({ position: 'topleft' }).addTo(map);
```

Kenapa `zoomControl: false` lalu ditambahkan lagi? Supaya urutan tombol di sudut
kiri atas bisa diatur: zoom dulu, baru kelompok tombol ukur di bawahnya. Kalau
tombol zoom dibuat otomatis, ia selalu jadi kontrol pertama dan Anda tak bisa
menyisipkan apa pun di atasnya.

### 7.2 Peta dasar

Alih-alih memakai `L.control.layers` bawaan, tombol peta dasar dibuat manual:

```js
CONFIG.basemaps.forEach(function (b, i) {
  var lapisan = L.tileLayer(b.url, { ... });
  var tombol = document.createElement('button');
  tombol.addEventListener('click', function () {
    if (basemapAktif) map.removeLayer(basemapAktif);
    map.addLayer(lapisan);
    lapisan.bringToBack();
    basemapAktif = lapisan;
  });
});
```

Yang penting di sini: `lapisan.bringToBack()`. Layer yang baru ditambahkan
secara bawaan berada di atas, sehingga peta dasar akan menutupi data amenitas
Anda. Perintah itu mendorongnya kembali ke paling bawah.

Pola `if (basemapAktif) map.removeLayer(...)` membuat peta dasar bersifat
"pilih satu": menambahkan yang baru selalu mematikan yang lama. Berbeda dari
layer data yang bisa menyala bersamaan.

### 7.3 Membangun layer data

Bagian ini menggambar geometri sesuai tipenya. Leaflet punya tiga jalur berbeda:

```js
if (def.tipe === 'titik') {
  opsi.pointToLayer = function (feature, latlng) {
    return L.circleMarker(latlng, { radius: def.radius || 6, ... });
  };
} else {
  opsi.style = function (feature) { ... };
}
```

**`style` untuk poligon dan garis, `pointToLayer` untuk titik.** Ini sering
membingungkan. Titik tidak punya "gaya" seperti poligon; Leaflet perlu diberi
tahu benda apa yang harus dibuat di lokasi itu. `pointToLayer` mengembalikan
objek, `style` mengembalikan kumpulan pengaturan.

Di sini dipilih `L.circleMarker`, bukan `L.marker` dengan ikon gambar. Alasannya:
lingkaran berwarna otomatis mengikuti `CONFIG.warna` tanpa perlu menyiapkan
puluhan berkas PNG, dan ukurannya tetap konsisten di semua tingkat zoom. Kalau
kelak Anda ingin ikon bergambar, ganti isi `pointToLayer` dengan:

```js
return L.marker(latlng, {
  icon: L.icon({ iconUrl: 'img/ikon/' + feature.properties.kategori + '.png',
                 iconSize: [24, 24], iconAnchor: [12, 24] })
});
```

### 7.4 Urutan gambar antar layer

```js
['poligon', 'garis', 'titik'].forEach(function (t) {
  daftarLayer.forEach(function (l) {
    if (l.def.tipe === t && map.hasLayer(l.grup)) l.grup.bringToFront();
  });
});
```

Tanpa ini, urutan tampilan mengikuti urutan di `config.js`. Kalau poligon sawah
kebetulan dimuat terakhir, ia akan menutupi seluruh titik fasilitas di atasnya
dan titik jadi tak bisa diklik.

Aturan kartografi yang dipakai: objek besar di bawah, objek kecil di atas.
Poligon → garis → titik.

### 7.5 Popup

```js
function isiPopup(def, props) {
  var html = '<div class="popup-head"><h3>' + aman(judul) + '</h3>...';

  Object.keys(def.popup || {}).forEach(function (label) {
    var nilai = props[def.popup[label]];
    if (nilai === null || nilai === undefined || nilai === '') return;
    if (typeof nilai === 'number') nilai = nilai.toLocaleString('id-ID');
    baris += '<tr><th>' + aman(label) + '</th><td>' + aman(String(nilai)) + '</td></tr>';
  });
}
```

Tiga hal yang layak diperhatikan:

**Fungsi `aman()`** mengubah karakter `<`, `>`, `&`, dan `"` menjadi bentuk
amannya. Tanpa ini, kolom keterangan yang kebetulan berisi tanda `<` akan
merusak struktur HTML popup, dan dalam kasus terburuk bisa disalahgunakan untuk
menyisipkan skrip. Ini kebiasaan dasar yang sebaiknya Anda bawa ke proyek mana
pun: semua data yang masuk ke HTML harus disaring dulu.

**`toLocaleString('id-ID')`** mengubah `1234.5` menjadi `1.234,5` — pemisah
ribuan titik dan desimal koma sesuai kaidah Indonesia.

**Baris kosong dilewati.** Pada contoh Kauman, popup menampilkan semua kolom
termasuk yang kosong. Di sini kolom kosong hilang sendiri, jadi popup toilet
tidak menampilkan "Kontak:" yang melompong.

### 7.6 Legenda otomatis

Legenda tidak ditulis manual. Ia dibangun dari `def._nilai` dan `def._warna`
yang tadi dihasilkan `siapkanWarna()`:

```js
def._nilai.forEach(function (nilai) {
  var sw = document.createElement('i');
  sw.className = 'swatch' + (def.tipe === 'garis' ? ' line' : '');
  if (def.tipe === 'garis') sw.style.borderBottomColor = def._warna[nilai];
  else sw.style.background = def._warna[nilai];
  ...
});
```

Karena sumbernya sama dengan yang dipakai menggambar peta, legenda dan peta
tidak mungkin berbeda. Ini masalah nyata pada peta yang legendanya ditulis
terpisah: warna di peta diubah, legenda lupa disesuaikan, dan pembaca tersesat.

Bentuk kotak legenda menyesuaikan tipe geometri — persegi untuk poligon, garis
untuk polyline, lingkaran untuk titik — lewat kelas CSS `.swatch`, `.swatch.line`,
dan `.swatch.dot`.

Angka di sebelah kanan nama layer adalah jumlah fitur, dihitung dengan
`grup.eachLayer`. Berguna untuk memeriksa cepat apakah data yang masuk lengkap:
kalau `bangunan.geojson` Anda berisi 87 fitur tapi yang tampil 40, ada yang
salah pada geometrinya.

### 7.7 Pencarian

Saat setiap fitur dibangun, `onEachFeature` mendaftarkannya ke katalog:

```js
indeksCari.push({
  nama: String(feature.properties[def.fieldNama] || 'Tanpa nama'),
  kategori: def.nama + ' · ' + String(feature.properties[def.fieldKategori]),
  cocok: [feature.properties.Nama_Obj,
          feature.properties.Kelas_Obj,
          feature.properties.Keterangan].join(' ').toLowerCase(),
  layerId: def.id,
  lyr: lyr          // rujukan ke objek Leaflet-nya
});
```

Kolom `cocok` adalah gabungan semua teks yang bisa dicari, sudah diubah ke huruf
kecil satu kali di awal. Mencocokkan satu teks panjang jauh lebih murah daripada
memanggil `toLowerCase()` pada tiga kolom setiap kali pengguna menekan tombol.
Karena `Keterangan` ikut masuk, mencari "kursi roda" akan menemukan toilet yang
keterangannya menyebut itu, meski namanya hanya "Toilet Umum".

Yang disimpan bukan salinan data, melainkan **rujukan ke objek Leaflet**. Jadi
saat pengguna memilih hasil pencarian, kita bisa langsung memanggil
`d.lyr.openPopup()` tanpa mencari ulang fiturnya di dalam layer.

Pencariannya sederhana: cocokkan potongan teks pada nama atau kategori, minimal
dua huruf, maksimal 25 hasil.

```js
return indeksCari.filter(function (d) {
  return d.cocok.indexOf(kata) > -1;
}).slice(0, 25);
```

Fungsi `pilih()` menangani satu kasus penting: **fitur yang layernya sedang
dimatikan**. Kalau pengguna mematikan layer titik lalu mencari "gazebo",
layernya dinyalakan kembali dan kotak centang di panel ikut diperbarui, baru
peta bergerak. Tanpa itu, peta akan zoom ke tempat kosong.

```js
if (d.lyr.getBounds) map.fitBounds(d.lyr.getBounds(), { padding: [60, 60], maxZoom: 20 });
else map.setView(d.lyr.getLatLng(), Math.max(map.getZoom(), 19));
```

Poligon dan garis punya `getBounds()` (kotak pembatas), titik tidak — titik hanya
punya satu koordinat, jadi dipakai `setView`. `Math.max(map.getZoom(), 19)`
mencegah peta justru menjauh kalau pengguna sudah zoom sangat dekat.

Navigasi papan ketik (panah atas/bawah, Enter, Esc) ditangani di
`input.addEventListener('keydown', ...)`. Ini bukan hiasan: banyak orang
mengetik lalu langsung menekan Enter tanpa menyentuh tetikus.

### 7.8 Tombol ukur

Dibuat sebagai `L.Control` khusus supaya menempel di sudut peta bersama tombol
zoom:

```js
var KontrolUkur = L.Control.extend({
  options: { position: 'topleft' },
  onAdd: function () {
    var wadah = L.DomUtil.create('div', 'map-btn-group');
    L.DomEvent.disableClickPropagation(wadah);
    ...
    return wadah;
  }
});
```

`L.DomEvent.disableClickPropagation(wadah)` wajib ada. Tanpa itu, klik pada
tombol juga diteruskan ke peta di belakangnya — dan saat mode ukur aktif, setiap
kali Anda menekan tombol, sebuah titik ukur ikut tercipta di bawah kursor.

---

<a name="8-jsmeasurejs"></a>
## 8. js/measure.js — matematika di balik ukur jarak dan luas

Proyek ini tidak memakai plugin leaflet-measure. Alasannya: satu
ketergantungan lagi untuk fungsi yang muat dalam 200 baris, dan Anda jadi tidak
bisa melihat bagaimana angkanya dihitung. Untuk tugas kuliah geodesi, itu justru
bagian yang menarik.

### 8.1 Jarak

```js
jarak += titik[j].distanceTo(titik[j - 1]);
```

`distanceTo` bawaan Leaflet memakai model bola dengan jari-jari 6.378.137 m dan
rumus haversine. Untuk jarak di bawah beberapa kilometer, selisihnya terhadap
hitungan ellipsoid (Vincenty di WGS 84) berada di bawah 0,5 %.

### 8.2 Luas

```js
function luasBola(latlngs) {
  var total = 0;
  for (var i = 0, n = latlngs.length; i < n; i++) {
    var p1 = latlngs[i], p2 = latlngs[(i + 1) % n];
    total += (toRad(p2.lng) - toRad(p1.lng)) *
             (2 + Math.sin(toRad(p1.lat)) + Math.sin(toRad(p2.lat)));
  }
  return Math.abs(total * R * R / 2);
}
```

Ini rumus luas poligon bola berdasarkan *spherical excess*, versi yang sama
dipakai pustaka Turf.js dan aslinya dari makalah Chamberlain & Duquette (JPL,
2007). Intinya: luas poligon pada bola sebanding dengan selisih jumlah sudut
dalamnya terhadap poligon datar.

Beberapa hal untuk dicatat dalam laporan Anda:

* `(i + 1) % n` membuat simpul terakhir terhubung kembali ke simpul pertama, jadi
  poligon selalu dianggap tertutup meski pengguna tidak mengklik titik awal lagi.
* `Math.abs()` membuat arah penggambaran (searah atau berlawanan jarum jam)
  tidak memengaruhi hasil.
* Model yang dipakai adalah **bola**, bukan ellipsoid. Untuk petak selebar
  beberapa ratus meter, selisihnya terhadap hitungan luas di UTM biasanya di
  bawah 0,5 %. **Untuk angka yang masuk laporan resmi, tetap pakai `$area` dari
  QGIS dalam proyeksi UTM.** Alat ukur di peta ini untuk perkiraan cepat di
  lapangan, bukan pengganti hitungan kadaster.

### 8.3 Alur interaksi

```
mulai(mode) → pasang event klik, gerak, klik-ganda, tombol Esc
   ↓ setiap klik
_klik()    → simpan titik, gambar simpul, perbarui garis/bidang, kirim hasil
   ↓ setiap gerakan tetikus
_gerak()   → tarik garis putus-putus ke posisi kursor, hitung nilai sementara
   ↓ klik ganda / tombol Selesai / Esc
akhiri()   → lepas event, tempel label hasil, gambar tetap di peta
   ↓ tombol Hapus / ganti mode
batal()    → bersihkan semua
```

Yang membuat terasa halus adalah "garis bayangan" di `_gerak()`: sebelum Anda
mengklik, garis putus-putus sudah mengikuti kursor dan angka di kotak hasil
sudah berubah. Pengguna melihat hasilnya sebelum memutuskan.

### 8.4 Pola `onUbah`

`measure.js` tidak tahu apa pun tentang tampilan. Ia tidak pernah menyentuh
elemen HTML. Yang dilakukannya hanya memanggil fungsi yang dititipkan padanya:

```js
var alat = new AlatUkur(map, {
  onUbah: function (hasil) {
    nilaiUkur.textContent = hasil.teks;
    ...
  }
});
```

Ini disebut *callback*. Manfaatnya nyata: kalau Anda ingin menampilkan hasil
ukur di tempat lain, atau menambahkan tombol "salin ke papan klip", Anda cukup
mengubah fungsi di `app.js`. `measure.js` tidak perlu disentuh. Pemisahan antara
"yang menghitung" dan "yang menampilkan" adalah kebiasaan yang akan sangat
menolong saat proyek Anda membesar.

### 8.5 Satu detail interaksi

```js
L.DomUtil.addClass(this.map.getContainer(), 'measuring');
```

Ditambah aturan CSS:

```css
.measuring .leaflet-overlay-pane,
.measuring .leaflet-marker-pane { pointer-events: none; }
```

Saat mode ukur aktif, seluruh fitur berhenti menanggapi klik. Tanpa ini, setiap
kali Anda mengklik di atas poligon homestay untuk menambah titik ukur, popup
homestay ikut terbuka dan menutupi peta. Masalah kecil yang membuat alat ukur
terasa rusak, dan diselesaikan dengan dua baris CSS.

---

<a name="9-cssstylecss"></a>
## 9. css/style.css — sistem tampilan

### 9.1 Variabel warna

```css
:root{
  --ink:#17231d;        /* teks utama, hijau sangat gelap */
  --paper:#faf8f3;      /* latar panel */
  --line:#ddd6c8;       /* garis pembatas */
  --moss:#2f6b4f;       /* warna aksi: tombol aktif, fokus */
  --saffron:#c98f2b;    /* warna alat ukur */
}
```

Semua warna didefinisikan sekali di `:root` lalu dipanggil dengan `var(--moss)`.
Mau mengganti seluruh nuansa peta menjadi biru? Ubah satu baris, bukan tiga
puluh.

Palet ini sengaja hangat dan sedikit tanah, agar panel tidak berkelahi dengan
citra satelit atau ortofoto yang biasanya didominasi hijau dan cokelat. Warna
aksi hijau lumut dipilih supaya tetap terbaca di atas citra maupun peta polos.

### 9.2 Panel

```css
.panel{
  position:absolute;
  z-index:1000;
  background:var(--paper);
  border:1px solid var(--line);
  border-radius:6px;
  box-shadow:0 2px 10px rgba(23,35,29,.14);
}
```

`z-index: 1000` menempatkan panel di atas seluruh lapisan Leaflet (yang memakai
400–800). Bayangannya sengaja tipis: peta adalah objek utama, panel hanya
mengapung ringan di atasnya.

### 9.3 Tanggapan layar kecil

```css
@media (max-width:640px){
  .panel-head{ left:12px; right:12px; top:auto; bottom:12px; }
  #search-results{ position:absolute; bottom:100%; margin:0 0 6px; }
}
```

Di ponsel, panel judul dan pencarian pindah ke bawah layar — lebih dekat ke ibu
jari — dan daftar hasil pencarian membuka **ke atas**, bukan ke bawah, supaya
tidak tertutup papan ketik yang muncul. Panel layer juga dimulai dalam keadaan
tertutup, diatur di `app.js`:

```js
if (window.innerWidth < 641) {
  tombolPanel.setAttribute('aria-expanded', 'false');
  isiPanel.hidden = true;
}
```

### 9.4 Aksesibilitas

```css
:focus-visible{ outline:2px solid var(--moss); outline-offset:2px }

@media (prefers-reduced-motion:reduce){
  *{ transition:none !important; animation:none !important }
}
```

Baris pertama memastikan pengguna papan ketik selalu tahu elemen mana yang
sedang aktif. Baris kedua mematikan animasi bagi pengguna yang mengaktifkan
pengaturan "kurangi gerakan" di sistemnya, biasanya karena animasi memicu pusing
atau mual. Dua blok pendek, dampaknya nyata.

---

<a name="10-latihan-modifikasi"></a>
## 10. Latihan modifikasi

Urut dari yang paling mudah.

**Ganti judul peta.** `index.html`, cari `<h1>`.

**Ganti warna satu kategori.** `config.js`, bagian `warna`. Muat ulang halaman,
warna di peta dan di legenda berubah bersamaan.

**Tambah kolom di popup.** `config.js`, tambahkan satu baris di `popup`, misalnya
`'Tarif': 'tarif'`. Pastikan kolom `tarif` memang ada di data.

**Ubah peta dasar bawaan.** Pindahkan urutan objek di `CONFIG.basemaps`; yang
pertama selalu aktif saat peta dibuka.

**Tampilkan label nama permanen di titik.** Di `app.js`, di dalam
`onEachFeature`, tambahkan setelah `bindPopup`:

```js
if (def.tipe === 'titik') {
  lyr.bindTooltip(String(feature.properties[def.fieldNama]), {
    permanent: true, direction: 'right', offset: [8, 0], className: 'label-titik'
  });
}
```

Lalu tambahkan gaya `.label-titik` di `style.css`. Hati-hati: kalau titiknya
rapat, label akan saling bertumpuk.

**Tambahkan tombol lokasi saya.** Di `app.js`, sebelum penutup IIFE:

```js
map.on('locationfound', function (e) {
  L.circleMarker(e.latlng, { radius: 7, color: '#fff', weight: 2,
    fillColor: '#2f6b4f', fillOpacity: 1 }).addTo(map).bindPopup('Posisi Anda');
});
map.locate({ setView: false, maxZoom: 18 });
```

Fitur lokasi hanya bekerja lewat HTTPS atau `localhost`; peramban memblokirnya
di `file://` demi privasi. Berguna saat peta dipakai wisatawan di lapangan.

**Sorot fitur saat kursor lewat.** Di dalam `onEachFeature`, untuk poligon:

```js
lyr.on('mouseover', function () { this.setStyle({ weight: 3, fillOpacity: .75 }); });
lyr.on('mouseout',  function () { grup.resetStyle(this); });
```

---

<a name="11-masalah-yang-sering-muncul"></a>
## 11. Masalah yang sering muncul

Kebiasaan pertama sebelum menebak: buka **konsol peramban** dengan F12, klik tab
**Console**. Pesan galat merah di sana biasanya langsung menunjuk berkas dan
nomor barisnya.

| Gejala | Kemungkinan penyebab | Perbaikan |
|---|---|---|
| Kotak merah "Data tidak bisa dimuat" | Halaman dibuka lewat `file://` | Jalankan `python -m http.server 8000` |
| Halaman putih total | Galat sintaks di `config.js`, biasanya kurang koma | Cek konsol; nomor baris di pesan galat menunjuk lokasinya |
| Peta abu-abu, tak ada ubin | Tinggi `#map` nol, atau tidak ada internet | Pastikan CSS termuat; coba peta dasar lain |
| Satu layer hilang, lain tampil | Nama berkas di `berkas:` tidak cocok | Samakan penulisan, perhatikan huruf besar-kecil |
| Data melompat ke laut lepas | Koordinat masih UTM, atau lintang-bujur tertukar | Ekspor ulang dari QGIS dengan CRS EPSG:4326 |
| Popup hanya menampilkan judul | Nama kolom di `popup` tidak cocok | Buka berkas `.geojson`, lihat `"properties"` fitur pertama |
| Judul popup tertulis "Tanpa nama" | Kolom `Nama_Obj` kosong atau beda penulisan | Periksa `fieldNama` di `config.js` |
| Satu kategori muncul dua kali di legenda | Penulisan `Nama_Obj` tidak konsisten | Rapikan di QGIS lalu ekspor ulang |
| Dua kategori berwarna sama | Jumlah kategori melebihi jumlah warna di `palet` | Tambahkan warna baru ke `palet` layer itu |
| Peta sangat lambat dibuka | GeoJSON terlalu besar | Sederhanakan geometri; presisi koordinat 7 angka |
| Ortofoto lokal tidak tampil | Dibuka lewat `file://` | Jalankan lewat server lokal |

---

<a name="12-ke-mana-setelah-ini"></a>
## 12. Ke mana setelah ini

**Menerbitkan.** Unggah seluruh folder ke repositori GitHub, lalu aktifkan
**Settings → Pages → Deploy from branch → main / (root)**. Dalam beberapa menit
peta bisa diakses siapa pun, gratis, lewat HTTPS — yang berarti tombol lokasi
juga ikut berfungsi.

**Kalau data tumbuh besar.** Di atas kira-kira 5 MB, pertimbangkan mengubah
GeoJSON menjadi vector tiles (format PMTiles dengan pustaka `protomaps-leaflet`
bekerja tanpa server juga), atau beralih ke GeoServer.

**Kalau butuh analisis.** Tambahkan Turf.js untuk buffer, irisan, dan pencarian
radius langsung di peramban. Cocok untuk pertanyaan seperti "fasilitas apa saja
dalam radius 200 m dari parkir".

**Kalau perlu pembaruan data oleh perangkat desa.** Di titik itu, WebGIS statis
sudah bukan jawabannya. Anda butuh basis data dan antarmuka penyuntingan —
kombinasi PostGIS dengan QGIS Server, atau layanan seperti Supabase.

---

## Ringkasan satu halaman

| Ingin mengubah… | Buka berkas | Bagian |
|---|---|---|
| Judul dan deskripsi | `index.html` | `<h1>`, `<p>` di `.brand` |
| Data jalan/bangunan/vegetasi/lahan | `data/*.geojson` | timpa berkasnya |
| Warna per `Nama_Obj` | `js/config.js` | `warna` dan `palet` tiap layer |
| Dasar klasifikasi warna | `js/config.js` | `fieldKategori` |
| Kolom yang tampil di popup | `js/config.js` | `popup` |
| Peta dasar, ortofoto | `js/config.js` | `CONFIG.basemaps` |
| Posisi awal peta | `js/config.js` | `CONFIG.peta` |
| Warna antarmuka, ukuran panel | `css/style.css` | `:root` dan `.panel` |
| Cara warna dibagikan | `js/app.js` | `siapkanWarna` |
| Rumus jarak dan luas | `js/measure.js` | `luasBola`, `_hitung` |
