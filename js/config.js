/* =========================================================================
   config.js — satu-satunya berkas yang perlu Anda ubah untuk memakai data
   sendiri. Tambah atau hapus objek di dalam CONFIG.layers sesuai layer Anda.
   ========================================================================= */

var CONFIG = {

  /* Tampilan awal peta. Kalau autoFit = true, peta otomatis menyesuaikan
     ke seluruh data dan center/zoom di bawah hanya dipakai bila data kosong. */
  peta: {
    center: [-7.6045, 111.9030],   // [lintang, bujur]
    zoom: 16,
    zoomMin: 10,
    zoomMaks: 24,
    autoFit: true
  },

  /* Peta dasar. Layer pertama aktif saat peta dibuka.
     Untuk memakai ortofoto hasil drone sendiri, ekspor jadi XYZ tiles lewat
     QGIS (Processing > Generate XYZ tiles) lalu taruh di folder tiles/,
     kemudian aktifkan blok "Ortofoto" di bawah. */
  basemaps: [
    {
      nama: 'Open Street Map',
      url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      atribusi: '&copy; Kontributor OpenStreetMap',
      zoomMaksAsli: 19
    },
    {
      nama: 'ESRI World Imagery',
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      atribusi: 'Citra &copy; Esri',
      zoomMaksAsli: 19
    },
    // ,{
    //   nama: 'Ortofoto',
    //   url: 'tiles/{z}/{x}/{y}.png',
    //   atribusi: 'Ortofoto drone, survei desa',
    //   zoomMaksAsli: 22
    // }
  ],

  /* ---------------------------------------------------------------------
     LAYER DATA

     berkas   : path ke berkas .geojson di folder data/
                (butuh dijalankan lewat server lokal, lihat README)
     variabel : alternatif tanpa server — isi dengan nama variabel dari
                berkas .js. Pakai salah satu saja, berkas atau variabel.
     tipe     : 'poligon' | 'garis' | 'titik'
     fieldNama     : atribut untuk judul popup dan pencarian
     fieldKategori : atribut penentu warna dan legenda
     popup    : 'Label yang tampil' : 'nama_kolom'
     warna    : nilai kategori : warna, untuk yang ingin dikunci manual
     palet    : daftar warna cadangan. Nilai Nama_Obj yang belum ada di
                `warna` akan diberi warna berbeda dari palet ini secara
                berurutan, jadi kategori baru otomatis dapat warna sendiri.
     --------------------------------------------------------------------- */
  layers: [
    {
      id: 'bangunan',
      nama: 'Bangunan',
      tipe: 'poligon',
      berkas: 'data/Data_Bangunan.geojson',
      aktif: true,
      fieldNama: 'Nama_Obj',
      fieldKategori: 'Nama_Obj',
      popup: {
        'Kelas objek': 'Kelas_Obj',
        'Keterangan': 'Keterangan',
        'Luas (ha)': 'area',
        'ID': 'id'
      },
      // Nuansa merah bata sampai ungu
      warna: {
        'Penginapan': '#c99266',
        'Pemukiman': '#d9b48c',
        'Warung Makan': '#c98a7d',
        'Musholla': '#a595c4',
        'Kanotor Desa': '#b07a8a',
        'Toko': '#d4948f',
        'Cafe': '#bd97a8',
        'Bank': '#c2a178',
        'Puskesmas': '#cd8fa8'
      },
      palet: ['#b5651d', '#d08c4a', '#c0392b', '#7a5ea8', '#8e3b46',
              '#d7574f', '#a4637a', '#96522b', '#c2417a', '#e08a5f']
    },
    {
      id: 'lahan_kosong',
      nama: 'Lahan kosong',
      tipe: 'poligon',
      berkas: 'data/Data_LahanKosong.geojson',
      aktif: true,
      fieldNama: 'Nama_Obj',
      fieldKategori: 'Nama_Obj',
      popup: {
        'Kelas objek': 'Kelas_Obj',
        'Keterangan': 'Keterangan',
        'Luas (ha)': 'area',
        'ID': 'id'
      },
      // Nuansa kuning tanah
      warna: {
        'Lapangan': '#bfae8f',
        'Lahan Kosong': '#ecdba0',
        'Semak Belukar': '#d4b877',
      },
      palet: ['#d9b14a', '#c99a3a', '#a88a5c', '#e5cc7a',
              '#b9762e', '#8f7343']
    },
    {
      id: 'vegetasi',
      nama: 'Vegetasi',
      tipe: 'poligon',
      berkas: 'data/Data_vegetasi.geojson',
      aktif: true,
      fieldNama: 'Nama_Obj',
      fieldKategori: 'Nama_Obj',
      popup: {
        'Kelas objek': 'Kelas_Obj',
        'Keterangan': 'Keterangan',
        'Luas (ha)': 'area',
        'ID': 'id'
      },
      // Nuansa hijau
      warna: {
        'Kelapa Sawit': '#6f9c74',
        'KWT Sari Mukti': '#bcd0a0',
      },
      palet: ['#a3c98a, #8fb875, #6f9c74, #bcd0a0, #7fb39a']
    },
    {
      id: 'jalan',
      nama: 'Jalan',
      tipe: 'garis',
      berkas: 'data/Data_jalan.geojson',
      aktif: true,
      fieldNama: 'Nama_Obj',
      fieldKategori: 'Nama_Obj',
      popup: {
        'Kelas objek': 'Kelas_Obj',
        'Keterangan': 'Keterangan',
        'Length (km)': 'area',
        'ID': 'id'
      },
      // Nuansa gelap sampai biru
      warna: {
        'Jalan Desa': '#3f3f46',
      },
      palet: ['#3f3f46', '#6b7280', '#8a6d3b', '#9aa0a6', '#3d84a8',
              '#5c6b8a', '#2f6b7f', '#57534e'],
      tebal: 4
    }
  ]
};
