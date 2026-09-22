#!/usr/bin/env python3
"""
geojson2js.py — ubah berkas .geojson di folder data/ menjadi .js

Dipakai hanya kalau Anda ingin membuka index.html dengan klik dua kali
(tanpa server lokal). Jalankan dari folder proyek:

    python tools/geojson2js.py

Hasilnya: data/jalan.js berisi `var json_jalan = {...};` dan seterusnya.
Setelah itu, di js/config.js ganti baris

    berkas: 'data/jalan.geojson'
menjadi
    variabel: 'json_jalan'

lalu tambahkan di index.html, sebelum <script src="js/config.js">:

    <script src="data/jalan.js"></script>
"""

import json
import pathlib
import sys

akar = pathlib.Path(__file__).resolve().parent.parent
folder = akar / "data"

berkas = sorted(folder.glob("*.geojson"))
if not berkas:
    sys.exit(f"Tidak ada berkas .geojson di {folder}")

baris_script = []
for g in berkas:
    with g.open(encoding="utf-8") as f:
        isi = json.load(f)

    nama_var = "json_" + g.stem
    keluaran = folder / (g.stem + ".js")
    with keluaran.open("w", encoding="utf-8") as f:
        f.write(f"var {nama_var} = ")
        json.dump(isi, f, ensure_ascii=False, separators=(",", ":"))
        f.write(";\n")

    jumlah = len(isi.get("features", []))
    print(f"{g.name} -> {keluaran.name}  ({jumlah} fitur, variabel {nama_var})")
    baris_script.append(f'<script src="data/{keluaran.name}"></script>')

print("\nTambahkan baris berikut ke index.html sebelum js/config.js:\n")
print("\n".join(baris_script))
