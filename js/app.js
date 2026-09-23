/* =========================================================================
   app.js — inti WebGIS. Biasanya tidak perlu diubah; atur data dan layer
   lewat js/config.js.
   ========================================================================= */

(function () {
  'use strict';

  /* ---------------------------------------------------------------- peta */

  var map = L.map('map', {
    zoomControl: false,
    minZoom: CONFIG.peta.zoomMin,
    maxZoom: CONFIG.peta.zoomMaks,
    attributionControl: true
  }).setView(CONFIG.peta.center, CONFIG.peta.zoom);

  map.attributionControl.setPrefix(
    '<a href="https://leafletjs.com" target="_blank" rel="noopener">Leaflet</a>'
  );

  L.control.zoom({ position: 'topleft' }).addTo(map);
  L.control.scale({ position: 'bottomleft', imperial: false, maxWidth: 140 }).addTo(map);

  // Leaflet menandai tiap fitur vektor (garis/poligon/titik) sebagai
  // "leaflet-interactive" dengan pointer-events miliknya sendiri, jadi
  // mematikan pointer-events di overlayPane saja tidak cukup (aturan pada
  // elemen fitur tetap menang). Aturan berikut menimpanya lewat !important,
  // hanya berlaku saat kelas "mengukur" ada pada kontainer peta.
  (function suntikStyleUkur() {
    var gaya = document.createElement('style');
    gaya.textContent =
      '.leaflet-container.mengukur .leaflet-interactive {' +
      'pointer-events: none !important;' +
      '}';
    document.head.appendChild(gaya);
  })();

  /* ----------------------------------------------------------- peta dasar */

  var basemapAktif = null;
  var kotakBasemap = document.getElementById('basemap-list');

  CONFIG.basemaps.forEach(function (b, i) {
    var lapisan = L.tileLayer(b.url, {
      attribution: b.atribusi,
      maxNativeZoom: b.zoomMaksAsli || 19,
      maxZoom: CONFIG.peta.zoomMaks
    });

    var tombol = document.createElement('button');
    tombol.className = 'basemap' + (i === 0 ? ' active' : '');
    tombol.type = 'button';
    tombol.textContent = b.nama;
    tombol.addEventListener('click', function () {
      if (basemapAktif === lapisan) return;
      if (basemapAktif) map.removeLayer(basemapAktif);
      map.addLayer(lapisan);
      lapisan.bringToBack();
      basemapAktif = lapisan;
      Array.prototype.forEach.call(
        kotakBasemap.children,
        function (el) { el.classList.remove('active'); }
      );
      tombol.classList.add('active');
    });
    kotakBasemap.appendChild(tombol);

    if (i === 0) { map.addLayer(lapisan); basemapAktif = lapisan; }
  });

  /* ------------------------------------------------------- variabel umum */

  var indeksCari = [];          // katalog untuk pencarian
  var daftarLayer = [];         // { def, grup }
  var batasSemua = L.latLngBounds([]);
  var kotakOverlay = document.getElementById('overlay-list');

  function aman(teks) {
    return String(teks)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* ------------------------------------------------- status layer tersimpan */

  // Menyimpan status on/off tiap layer ke localStorage, per browser/perangkat.
  // Tidak disinkronkan ke pengguna lain — hanya berlaku di browser ini.
  var KUNCI_STATUS = 'statusLayerPeta'; // ganti kalau mau namespace beda per proyek

  function bacaStatusLayer() {
    try {
      return JSON.parse(localStorage.getItem(KUNCI_STATUS) || '{}');
    } catch (e) {
      return {};
    }
  }

  function simpanStatusLayer(id, aktif) {
    try {
      var status = bacaStatusLayer();
      status[id] = aktif;
      localStorage.setItem(KUNCI_STATUS, JSON.stringify(status));
    } catch (e) { /* localStorage tidak tersedia, abaikan */ }
  }

  // Terapkan status tersimpan ke CONFIG.layers sebelum data dimuat, supaya
  // layer yang sebelumnya dimatikan/dinyalakan pengguna tetap konsisten
  // setelah halaman dibuka ulang.
  (function terapkanStatusTersimpan() {
    var status = bacaStatusLayer();
    CONFIG.layers.forEach(function (def) {
      if (status.hasOwnProperty(def.id)) {
        def.aktif = status[def.id];
      }
    });
  })();

  /* ------------------------------------------------------- memuat berkas */

  // Setiap layer boleh memakai `berkas` (path .geojson, perlu server lokal)
  // atau `variabel` (nama variabel global dari berkas .js, bisa file://).
  function muatLayer(def) {
    if (def.variabel) {
      var isi = window[def.variabel];
      if (!isi) return Promise.reject(new Error(
        'Variabel ' + def.variabel + ' tidak ditemukan. Periksa urutan <script> di index.html.'));
      return Promise.resolve(isi);
    }
    if (def.data) return Promise.resolve(def.data);
    if (!def.berkas) return Promise.reject(new Error(
      'Layer "' + def.nama + '" tidak punya `berkas` maupun `variabel` di config.js.'));

    return fetch(def.berkas).then(function (r) {
      if (!r.ok) throw new Error('Berkas ' + def.berkas + ' tidak ditemukan (HTTP ' + r.status + ').');
      return r.json();
    });
  }

  function tampilGalat(pesan, teknis) {
    var kotak = document.createElement('div');
    kotak.className = 'error-box';
    kotak.innerHTML = '<h2>Data tidak bisa dimuat</h2><p>' + pesan + '</p>' +
      (teknis ? '<pre>' + aman(teknis) + '</pre>' : '');
    document.body.appendChild(kotak);
  }

  Promise.all(CONFIG.layers.map(function (def) {
    return muatLayer(def).then(
      function (isi) { return { def: def, isi: isi }; },
      function (err) { return { def: def, isi: null, err: err }; }
    );
  })).then(function (hasil) {

    var gagal = hasil.filter(function (h) { return !h.isi; });

    if (gagal.length === hasil.length) {
      var lewatBerkas = location.protocol === 'file:';
      tampilGalat(
        lewatBerkas
          ? 'Halaman ini dibuka langsung dari berkas (<code>file://</code>), sehingga peramban ' +
            'melarang pembacaan berkas <code>.geojson</code>. Jalankan lewat server lokal: buka ' +
            'terminal di folder proyek, ketik <code>python -m http.server 8000</code>, lalu buka ' +
            '<code>http://localhost:8000</code>.'
          : 'Periksa nama dan lokasi berkas di <code>js/config.js</code>.',
        gagal[0].err ? gagal[0].err.message : ''
      );
      return;
    }

    hasil.forEach(function (h) {
      if (h.isi) bangunLayer(h.def, h.isi);
      else console.error('Layer "' + h.def.nama + '" gagal dimuat:', h.err);
    });

    if (gagal.length) {
      tampilGalat('Sebagian layer gagal dimuat: ' +
        gagal.map(function (g) { return aman(g.def.nama); }).join(', ') +
        '. Layer lain tetap ditampilkan.', gagal[0].err ? gagal[0].err.message : '');
    }

    // Urutan gambar: objek besar di bawah, objek kecil di atas.
    ['poligon', 'garis', 'titik'].forEach(function (t) {
      daftarLayer.forEach(function (l) {
        if (l.def.tipe === t && map.hasLayer(l.grup)) l.grup.bringToFront();
      });
    });

    if (CONFIG.peta.autoFit && batasSemua.isValid()) {
      map.fitBounds(batasSemua, { padding: [40, 40] });
    }
  });

  /* ------------------------------------------------ warna per Nama_Obj */

  // Setiap nilai kategori mendapat warna sendiri. Nilai yang sudah dikunci
  // di `warna` dipakai apa adanya; sisanya dibagi dari `palet` berurutan,
  // jadi kategori baru di data tetap tampil dengan warna yang berbeda.
  function siapkanWarna(def, geojson) {
    var nilai = [];
    (geojson.features || []).forEach(function (f) {
      var v = f.properties ? f.properties[def.fieldKategori] : null;
      v = (v === null || v === undefined || v === '') ? 'Lainnya' : String(v);
      if (nilai.indexOf(v) === -1) nilai.push(v);
    });
    nilai.sort(function (a, b) { return a.localeCompare(b, 'id'); });

    var palet = def.palet || ['#2f6b4f', '#c98f2b', '#3d84a8', '#b5651d',
                              '#7a5ea8', '#c0392b', '#6b7280', '#8fbf5a'];
    var peta = {};
    var n = 0;
    nilai.forEach(function (v) {
      if (def.warna && def.warna[v]) peta[v] = def.warna[v];
      else peta[v] = palet[n++ % palet.length];
    });
    def._warna = peta;
    def._nilai = nilai;
  }

  function warnaFitur(def, props) {
    var v = props[def.fieldKategori];
    v = (v === null || v === undefined || v === '') ? 'Lainnya' : String(v);
    return def._warna[v] || def.warnaLain || '#2f6b4f';
  }

  /* --------------------------------------------------------------- popup */

  function isiPopup(def, props) {
    var judul = props[def.fieldNama] || 'Tanpa nama';
    var sub = props[def.fieldKategori] || def.nama;

    var html = '<div class="popup-head"><h3>' + aman(judul) + '</h3>' +
               '<p>' + aman(def.nama) + (sub && sub !== judul ? ' · ' + aman(sub) : '') +
               '</p></div>';

    if (def.fieldGambar && props[def.fieldGambar]) {
      html += '<img class="popup-img" src="' + aman(props[def.fieldGambar]) +
              '" alt="Foto ' + aman(judul) + '" loading="lazy">';
    }

    var baris = '';
    Object.keys(def.popup || {}).forEach(function (label) {
      var nilai = props[def.popup[label]];
      if (nilai === null || nilai === undefined || nilai === '') return;
      if (typeof nilai === 'number') nilai = nilai.toLocaleString('id-ID');
      baris += '<tr><th scope="row">' + aman(label) + '</th><td>' +
               aman(String(nilai)) + '</td></tr>';
    });
    if (baris) html += '<table class="popup-table">' + baris + '</table>';

    return html;
  }

  /* -------------------------------------------------------- bangun layer */

  function bangunLayer(def, geojson) {
    siapkanWarna(def, geojson);

    var opsi = {
      onEachFeature: function (feature, lyr) {
        lyr.bindPopup(isiPopup(def, feature.properties), {
          maxHeight: 360, autoPanPadding: [30, 30]
        });
        indeksCari.push({
          nama: String(feature.properties[def.fieldNama] || 'Tanpa nama'),
          kategori: def.nama + ' · ' +
                    String(feature.properties[def.fieldKategori] || '-'),
          cocok: [feature.properties[def.fieldNama],
                  feature.properties[def.fieldKategori],
                  feature.properties.Kelas_Obj,
                  feature.properties.Keterangan].join(' ').toLowerCase(),
          layerId: def.id,
          lyr: lyr
        });
      }
    };

    if (def.tipe === 'titik') {
      opsi.pointToLayer = function (feature, latlng) {
        return L.circleMarker(latlng, {
          radius: def.radius || 6, weight: 2, color: '#ffffff',
          fillColor: warnaFitur(def, feature.properties), fillOpacity: 1
        });
      };
    } else if (def.tipe === 'garis') {
      opsi.style = function (feature) {
        return {
          color: warnaFitur(def, feature.properties),
          weight: def.tebal || 4, opacity: .95, lineCap: 'round'
        };
      };
    } else {
      opsi.style = function (feature) {
        var w = warnaFitur(def, feature.properties);
        return {
          color: def.strokeColor || '#2b2b26',   // warna stroke
          weight: def.strokeWeight != null ? def.strokeWeight : 1.2,
          opacity: def.strokeOpacity != null ? def.strokeOpacity : 1,
          fillColor: w, fillOpacity: def.fillOpacity != null ? def.fillOpacity : 1
        };
      };
    }

    var grup = L.geoJSON(geojson, opsi);
    daftarLayer.push({ def: def, grup: grup });

    if (def.aktif !== false) grup.addTo(map);
    try { batasSemua.extend(grup.getBounds()); } catch (e) { /* layer kosong */ }

    kotakOverlay.appendChild(barisLayer(def, grup));
  }

  /* -------------------------------------------- daftar layer + legenda */

  function barisLayer(def, grup) {
    var item = document.createElement('div');
    item.className = 'layer-item';

    var jumlah = 0;
    grup.eachLayer(function () { jumlah++; });

    var head = document.createElement('label');
    head.className = 'layer-head';

    var cek = document.createElement('input');
    cek.type = 'checkbox';
    cek.checked = def.aktif !== false;
    cek.dataset.layer = def.id;
    cek.addEventListener('change', function () {
      if (cek.checked) { grup.addTo(map); grup.bringToFront(); }
      else map.removeLayer(grup);
      simpanStatusLayer(def.id, cek.checked);
    });

    var label = document.createElement('span');
    label.textContent = def.nama;

    var hitung = document.createElement('small');
    hitung.textContent = jumlah;

    head.appendChild(cek);
    head.appendChild(label);
    head.appendChild(hitung);
    item.appendChild(head);

    // Legenda dibangun dari nilai Nama_Obj yang benar-benar ada di data.
    var ul = document.createElement('ul');
    ul.className = 'legend';
    def._nilai.forEach(function (nilai) {
      var li = document.createElement('li');
      var sw = document.createElement('i');
      sw.className = 'swatch' + (def.tipe === 'titik' ? ' dot' : def.tipe === 'garis' ? ' line' : '');
      var w = def._warna[nilai];
      if (def.tipe === 'garis') sw.style.borderBottomColor = w;
      else sw.style.background = w;
      li.appendChild(sw);
      li.appendChild(document.createTextNode(nilai));
      ul.appendChild(li);
    });
    item.appendChild(ul);

    return item;
  }

  var tombolPanel = document.getElementById('layers-toggle');
  var isiPanel = document.getElementById('layers-body');
  tombolPanel.addEventListener('click', function () {
    var buka = tombolPanel.getAttribute('aria-expanded') === 'true';
    tombolPanel.setAttribute('aria-expanded', String(!buka));
    isiPanel.hidden = buka;
  });
  if (window.innerWidth < 641) {
    tombolPanel.setAttribute('aria-expanded', 'false');
    isiPanel.hidden = true;
  }

  /* ------------------------------------------------------------ pencarian */

  var input = document.getElementById('search-input');
  var hasil = document.getElementById('search-results');
  var sorot = -1;

  function cari(kata) {
    kata = kata.trim().toLowerCase();
    if (kata.length < 2) return [];
    return indeksCari.filter(function (d) {
      return d.cocok.indexOf(kata) > -1;
    }).slice(0, 25);
  }

  function tampilHasil(daftar) {
    hasil.innerHTML = '';
    sorot = -1;

    if (!daftar.length) {
      var kosong = document.createElement('li');
      kosong.className = 'empty';
      kosong.textContent = 'Tidak ada objek yang cocok.';
      hasil.appendChild(kosong);
      hasil.hidden = false;
      return;
    }

    daftar.forEach(function (d, i) {
      var li = document.createElement('li');
      li.setAttribute('role', 'option');
      li.dataset.i = i;
      var b = document.createElement('b'); b.textContent = d.nama;
      var s = document.createElement('span'); s.textContent = d.kategori;
      li.appendChild(b); li.appendChild(s);
      li.addEventListener('click', function () { pilih(d); });
      hasil.appendChild(li);
    });
    hasil.hidden = false;
  }

  function pilih(d) {
    // Aktifkan kembali layer bila sedang disembunyikan.
    daftarLayer.forEach(function (l) {
      if (l.def.id === d.layerId && !map.hasLayer(l.grup)) {
        l.grup.addTo(map);
        var cek = kotakOverlay.querySelector('input[data-layer="' + l.def.id + '"]');
        if (cek) cek.checked = true;
        simpanStatusLayer(l.def.id, true);
      }
    });

    if (d.lyr.getBounds) map.fitBounds(d.lyr.getBounds(), { padding: [60, 60], maxZoom: 20 });
    else map.setView(d.lyr.getLatLng(), Math.max(map.getZoom(), 19));

    d.lyr.openPopup();
    hasil.hidden = true;
    input.blur();
  }

  input.addEventListener('input', function () {
    if (input.value.trim().length < 2) { hasil.hidden = true; return; }
    tampilHasil(cari(input.value));
  });

  input.addEventListener('keydown', function (e) {
    var item = hasil.querySelectorAll('li[data-i]');
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (!item.length) return;
      e.preventDefault();
      sorot += (e.key === 'ArrowDown' ? 1 : -1);
      if (sorot < 0) sorot = item.length - 1;
      if (sorot >= item.length) sorot = 0;
      Array.prototype.forEach.call(item, function (el) { el.classList.remove('active'); });
      item[sorot].classList.add('active');
      item[sorot].scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter') {
      var daftar = cari(input.value);
      if (daftar.length) pilih(daftar[sorot > -1 ? sorot : 0]);
    } else if (e.key === 'Escape') {
      hasil.hidden = true;
    }
  });

  document.addEventListener('click', function (e) {
    if (!e.target.closest('.search')) hasil.hidden = true;
  });

  /* ------------------------------------------------------------ alat ukur */

  var kotakUkur = document.getElementById('measure-readout');
  var nilaiUkur = document.getElementById('measure-value');
  var petunjukUkur = document.getElementById('measure-hint');
  var tombolSelesai = document.getElementById('measure-finish');

  // Saat mode ukur aktif (belum selesai), klik pada layer data (popup, dsb.)
  // dimatikan sementara supaya klik tembus ke peta dan bisa dipakai untuk
  // menaruh/mengakhiri titik ukur meski berada tepat di atas layer yang nyala.
  var kontainerPeta = map.getContainer();
  function aturModeUkur(aktif) {
    kontainerPeta.classList.toggle('mengukur', !!aktif);
  }

  var alat = new AlatUkur(map, {
    warna: '#c98f2b',
    onUbah: function (hasil) {
      if (!hasil) { kotakUkur.hidden = true; aturModeUkur(false); segarkanTombol(); return; }
      aturModeUkur(!hasil.selesai);
      kotakUkur.hidden = false;
      nilaiUkur.textContent = hasil.teks;
      tombolSelesai.textContent = hasil.selesai ? 'Ukur lagi' : 'Selesai';
      petunjukUkur.textContent = hasil.selesai
        ? (hasil.detail || 'Pengukuran selesai.')
        : (hasil.jumlahTitik === 0
            ? (hasil.mode === 'luas'
                ? 'Klik tiga titik atau lebih untuk membentuk area.'
                : 'Klik di peta untuk menambah titik.')
            : 'Klik ganda atau tekan Selesai untuk mengakhiri.' +
              (hasil.detail ? ' · ' + hasil.detail : ''));
      segarkanTombol();
    }
  });

  var KontrolUkur = L.Control.extend({
    options: { position: 'topleft' },
    onAdd: function () {
      var wadah = L.DomUtil.create('div', 'map-btn-group');
      L.DomEvent.disableClickPropagation(wadah);

      wadah.appendChild(buatTombol('jarak', 'Ukur jarak',
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 17 17 3l4 4L7 21z"/><path d="M7 7l2 2M11 3l2 2M11 11l2 2M15 15l2 2"/></svg>'));

      wadah.appendChild(buatTombol('luas', 'Ukur luas',
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8l8-4 8 4v8l-8 4-8-4z"/></svg>'));

      var rumah = L.DomUtil.create('button', 'map-btn');
      rumah.type = 'button';
      rumah.title = 'Tampilkan seluruh data';
      rumah.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-6 9 6v11H3z"/></svg>';
      rumah.addEventListener('click', function () {
        if (batasSemua.isValid()) map.fitBounds(batasSemua, { padding: [40, 40] });
        else map.setView(CONFIG.peta.center, CONFIG.peta.zoom);
      });
      wadah.appendChild(rumah);

      return wadah;
    }
  });

  function buatTombol(mode, judul, svg) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'map-btn';
    b.dataset.mode = mode;
    b.title = judul;
    b.setAttribute('aria-label', judul);
    b.innerHTML = svg;
    b.addEventListener('click', function () {
      if (alat.mode === mode && !alat.selesai) alat.batal();
      else alat.mulai(mode);
    });
    return b;
  }

  function segarkanTombol() {
    document.querySelectorAll('.map-btn[data-mode]').forEach(function (b) {
      b.classList.toggle('active', alat.mode === b.dataset.mode && !alat.selesai);
    });
  }

  map.addControl(new KontrolUkur());

  tombolSelesai.addEventListener('click', function () {
    if (alat.selesai) alat.mulai(alat.mode); else alat.akhiri();
  });
  document.getElementById('measure-clear').addEventListener('click', function () {
    alat.batal();
  });

})();