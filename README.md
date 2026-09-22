# WebGIS Penggunaan Lahan Desa Wisata

WebGIS statis: hanya HTML, CSS, dan JavaScript, tanpa server aplikasi dan tanpa
basis data. Fiturnya: peta dasar yang bisa diganti, daftar layer + legenda
otomatis, pencarian objek, popup informasi, pengukuran jarak dan luas, dan zoom.

## Struktur berkas

```
webgis-desa-wisata/
├── index.html                  kerangka halaman
├── css/style.css               seluruh tampilan
├── js/config.js                ← yang perlu Anda ubah
├── js/app.js                   peta, layer, legenda, pencarian, popup
├── js/measure.js               alat ukur jarak & luas
├── tools/geojson2js.py         pengubah .geojson → .js (mode tanpa server)
└── data/
    ├── jalan.geojson           polyline
    ├── bangunan.geojson        polygon
    ├── vegetasi.geojson        polygon
    └── lahan_kosong.geojson    polygon
```

## Menjalankan

Berkas `.geojson` dibaca lewat `fetch`, dan peramban melarang itu pada alamat
`file://`. Jadi jalankan lewat server lokal:

```bash
cd webgis-desa-wisata
python -m http.server 8000
```

Lalu buka `http://localhost:8000`. Kalau halaman dibuka dengan klik dua kali,
peta akan menampilkan pesan yang menjelaskan hal ini.

**Ingin tetap bisa klik dua kali?** Jalankan `python tools/geojson2js.py`, lalu
ikuti dua langkah yang dicetak skrip itu: ganti `berkas:` menjadi `variabel:` di
`js/config.js`, dan tambahkan tag `<script>` di `index.html`.

## Skema atribut

Keempat layer memakai lima kolom yang sama:

| Kolom | Isi | Dipakai untuk |
|---|---|---|
| `id` | nomor urut fitur | ditampilkan di popup |
| `Nama_Obj` | nama objek, mis. `Homestay`, `Sawah` | judul popup, warna, legenda, pencarian |
| `Kelas_Obj` | kelas objek, mis. `Permukiman` | popup dan pencarian |
| `Keterangan` | penjelasan bebas | popup dan pencarian |
| `area` | luas m² (poligon) atau luas perkerasan (jalan) | popup |

Penulisan `Nama_Obj` harus konsisten. `Rumah Warga` dan `Rumah warga` dianggap
dua kategori berbeda dan akan mendapat dua warna serta dua entri legenda.

## Pewarnaan berdasarkan Nama_Obj

Setiap layer punya kelompok warnanya sendiri, dan setiap nilai `Nama_Obj` di
dalam layer itu mendapat warna yang berbeda:

| Layer | Kelompok warna |
|---|---|
| Vegetasi | hijau |
| Bangunan | merah bata sampai ungu |
| Lahan kosong | kuning tanah |
| Jalan | abu gelap sampai biru |

Di `js/config.js` setiap layer punya dua kunci:

* `warna` — mengunci warna untuk nilai `Nama_Obj` tertentu;
* `palet` — daftar warna cadangan.

Nilai `Nama_Obj` yang belum ada di `warna` otomatis mengambil warna berikutnya
dari `palet`, diurutkan menurut abjad. Artinya kalau data Anda punya nama objek
yang belum terdaftar, objek itu tetap tampil dengan warna sendiri dan tetap
muncul di legenda. Anda tidak wajib mendaftarkan semuanya lebih dulu.

Untuk mengunci warna, cukup tambahkan satu baris:

```js
warna: {
  'Sawah': '#8fbf5a',
  'Kebun Campur': '#5f9e3f',
  'Tambak': '#4a8fb5'      // baris baru
}
```

## Memasukkan data Anda sendiri

1. Di QGIS: klik kanan layer → **Export → Save Features As**.
2. Format **GeoJSON**, CRS **EPSG:4326 – WGS 84** (wajib; Leaflet hanya membaca
   lintang/bujur desimal, bukan meter UTM).
3. COORDINATE_PRECISION **7** agar ukuran berkas tidak membengkak.
4. Simpan dengan nama `jalan.geojson`, `bangunan.geojson`, `vegetasi.geojson`,
   `lahan_kosong.geojson` ke folder `data/`, menimpa berkas contoh.
5. Muat ulang halaman. Tidak ada kode yang perlu diubah selama nama berkas dan
   nama kolom sama.

Kalau nama berkasnya berbeda, ubah nilai `berkas:` di `js/config.js`.
Kalau nama kolomnya berbeda, ubah `fieldNama`, `fieldKategori`, dan daftar
`popup` di berkas yang sama.

Hitung kolom `area` di QGIS dengan Field Calculator (`$area`) saat proyek dalam
proyeksi metrik — UTM 49S / EPSG:32749 untuk Nganjuk — lalu baru ekspor ke
EPSG:4326.

## Menambah layer kelima

1. Taruh `data/utilitas.geojson`.
2. Tambahkan satu objek baru ke `CONFIG.layers` dengan `id` yang belum dipakai,
   `tipe` sesuai geometrinya, dan `berkas: 'data/utilitas.geojson'`.

Daftar layer, legenda, pencarian, dan popup ikut menyesuaikan sendiri.

## Memakai ortofoto drone sebagai peta dasar

Di QGIS: **Processing → Raster tools → Generate XYZ tiles (Directory)**, zoom
mis. 14–20, simpan ke folder `tiles/`. Lalu buka `js/config.js` dan aktifkan
blok `Ortofoto` yang masih dikomentari.

## Catatan

* Leaflet dimuat dari CDN unpkg, jadi butuh internet saat pertama dibuka. Untuk
  luring, unduh `leaflet.js`, `leaflet.css`, dan folder `images/` versi 1.9.4 ke
  dalam proyek, lalu ubah dua tautan di `index.html`.
* Luas dan jarak pada alat ukur dihitung di model bola bumi. Untuk angka resmi,
  pakai hasil `$area` dari QGIS dalam proyeksi UTM.
* Pengukuran: klik untuk menambah titik, klik ganda atau tombol **Selesai**
  untuk mengakhiri, **Esc** untuk membatalkan.

Penjelasan rinci tiap bagian kode ada di `TUTORIAL.md`.
