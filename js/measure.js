/* =========================================================================
   measure.js — alat ukur jarak dan luas, murni Leaflet tanpa plugin.
   Jarak memakai perhitungan bola bawaan Leaflet (distanceTo).
   Luas memakai rumus luas poligon pada bola (spherical excess).
   ========================================================================= */

(function (global) {
  'use strict';

  var R = 6378137; // jari-jari bumi (m)

  function toRad(d) { return d * Math.PI / 180; }

  // Luas poligon di permukaan bola, hasil dalam meter persegi.
  function luasBola(latlngs) {
    if (latlngs.length < 3) return 0;
    var total = 0;
    for (var i = 0, n = latlngs.length; i < n; i++) {
      var p1 = latlngs[i];
      var p2 = latlngs[(i + 1) % n];
      total += (toRad(p2.lng) - toRad(p1.lng)) *
               (2 + Math.sin(toRad(p1.lat)) + Math.sin(toRad(p2.lat)));
    }
    return Math.abs(total * R * R / 2);
  }

  function angka(x, desimal) {
    return x.toLocaleString('id-ID', {
      minimumFractionDigits: desimal,
      maximumFractionDigits: desimal
    });
  }

  function formatJarak(m) {
    if (m >= 1000) return angka(m / 1000, 2) + ' km';
    return angka(m, 1) + ' m';
  }

  function formatLuas(m2) {
    if (m2 >= 1000000) return angka(m2 / 1000000, 3) + ' km²';
    if (m2 >= 10000) return angka(m2 / 10000, 2) + ' ha';
    return angka(m2, 1) + ' m²';
  }

  /* -------------------------------------------------------------------- */

  function AlatUkur(map, opsi) {
    this.map = map;
    this.opsi = opsi || {};
    this.mode = null;
    this.titik = [];
    this.selesai = false;

    this.lapisan = L.layerGroup().addTo(map);
    this.garis = null;
    this.bidang = null;
    this.bayangan = null;

    this._onKlik = this._klik.bind(this);
    this._onGerak = this._gerak.bind(this);
    this._onKlikGanda = this._klikGanda.bind(this);
    this._onTombol = this._tombol.bind(this);
  }

  AlatUkur.prototype.mulai = function (mode) {
    this.batal();
    this.mode = mode;
    this.selesai = false;
    this.titik = [];

    var warna = this.opsi.warna || '#c98f2b';
    if (mode === 'luas') {
      this.bidang = L.polygon([], {
        color: warna, weight: 2, dashArray: '4 4',
        fillColor: warna, fillOpacity: .18, interactive: false
      }).addTo(this.lapisan);
    }
    this.garis = L.polyline([], {
      color: warna, weight: 2, interactive: false
    }).addTo(this.lapisan);
    this.bayangan = L.polyline([], {
      color: warna, weight: 2, dashArray: '4 4', opacity: .7, interactive: false
    }).addTo(this.lapisan);

    // Selama mengukur, fitur tidak menanggapi klik supaya popup tidak
    // ikut terbuka setiap kali menambah titik.
    L.DomUtil.addClass(this.map.getContainer(), 'measuring');
    this.map.closePopup();
    this.map.getContainer().style.cursor = 'crosshair';
    this.map.on('click', this._onKlik);
    this.map.on('mousemove', this._onGerak);
    this.map.on('dblclick', this._onKlikGanda);
    this.map.doubleClickZoom.disable();
    document.addEventListener('keydown', this._onTombol);

    this._kabar();
  };

  AlatUkur.prototype._tombol = function (e) {
    if (e.key === 'Escape') {
      if (this.selesai || this.titik.length === 0) this.batal();
      else this.akhiri();
    }
  };

  AlatUkur.prototype._klik = function (e) {
    if (this.selesai) return;
    this.titik.push(e.latlng);

    L.circleMarker(e.latlng, {
      radius: 4, color: '#fff', weight: 2,
      fillColor: this.opsi.warna || '#c98f2b', fillOpacity: 1, interactive: false
    }).addTo(this.lapisan);

    this.garis.setLatLngs(this.titik);
    if (this.bidang) this.bidang.setLatLngs(this.titik);
    this._kabar();
  };

  AlatUkur.prototype._gerak = function (e) {
    if (this.selesai || !this.titik.length) return;
    var akhir = this.titik[this.titik.length - 1];
    this.bayangan.setLatLngs([akhir, e.latlng]);
    this._kabar(e.latlng);
  };

  AlatUkur.prototype._klikGanda = function () { this.akhiri(); };

  // Hentikan penggambaran tetapi biarkan hasilnya tampil di peta.
  AlatUkur.prototype.akhiri = function () {
    if (!this.mode || this.selesai) return;
    this.selesai = true;
    this._lepasEvent();
    if (this.bayangan) this.bayangan.setLatLngs([]);

    if (this.titik.length > 1) {
      var isi = this._hitung();
      L.marker(this.titik[this.titik.length - 1], {
        interactive: false,
        icon: L.divIcon({
          className: 'measure-tooltip', html: isi.teks,
          iconSize: null, iconAnchor: [-8, 8]
        })
      }).addTo(this.lapisan);
    }
    this._kabar();
  };

  // Hentikan sekaligus bersihkan gambar.
  AlatUkur.prototype.batal = function () {
    this._lepasEvent();
    this.lapisan.clearLayers();
    this.mode = null;
    this.titik = [];
    this.selesai = false;
    this.garis = this.bidang = this.bayangan = null;
    this._kabar();
  };

  AlatUkur.prototype._lepasEvent = function () {
    this.map.off('click', this._onKlik);
    this.map.off('mousemove', this._onGerak);
    this.map.off('dblclick', this._onKlikGanda);
    this.map.doubleClickZoom.enable();
    L.DomUtil.removeClass(this.map.getContainer(), 'measuring');
    this.map.getContainer().style.cursor = '';
    document.removeEventListener('keydown', this._onTombol);
  };

  AlatUkur.prototype._hitung = function (sementara) {
    var titik = sementara ? this.titik.concat([sementara]) : this.titik.slice();

    if (this.mode === 'luas') {
      var luas = luasBola(titik);
      var keliling = 0;
      for (var i = 1; i < titik.length; i++) keliling += titik[i].distanceTo(titik[i - 1]);
      if (titik.length > 2) keliling += titik[titik.length - 1].distanceTo(titik[0]);
      return {
        teks: formatLuas(luas),
        detail: titik.length > 2 ? 'Keliling ' + formatJarak(keliling) : null,
        nilai: luas
      };
    }

    var jarak = 0;
    for (var j = 1; j < titik.length; j++) jarak += titik[j].distanceTo(titik[j - 1]);
    return {
      teks: formatJarak(jarak),
      detail: titik.length > 1 ? titik.length + ' titik' : null,
      nilai: jarak
    };
  };

  AlatUkur.prototype._kabar = function (sementara) {
    if (!this.opsi.onUbah) return;
    if (!this.mode) { this.opsi.onUbah(null); return; }
    var hasil = this._hitung(sementara);
    hasil.mode = this.mode;
    hasil.selesai = this.selesai;
    hasil.jumlahTitik = this.titik.length;
    this.opsi.onUbah(hasil);
  };

  global.AlatUkur = AlatUkur;
  global.formatJarak = formatJarak;
  global.formatLuas = formatLuas;

})(window);
