# Using real 3D models (Sketchfab or anywhere)

1. On Sketchfab, open a model that has a **Download 3D model** button (needs a free login) and download the **glTF / GLB** version. Check the license — CC-BY needs attribution (handled below), "Editorial/No-derivatives" models should not be used.
2. Put the `.glb` in this folder.
3. Add it to `models.json` (see `_example`). Slots:
   - `car`    – the vehicle you drive (`size` = length in world units, ~4.4)
   - `avatar` – Iman's character at the spawn plaza (`size` = height, ~3.4). If the file has animations, the first clip plays (a waving/idle clip is ideal).
   - `prop`   – the shovable crates around the world (`size` ~1.6)
4. Reload. Fill in `credit` so the model is listed under "Credits" in the site.

Tips: keep each file under ~5 MB (compress in Blender or with `gltf-transform optimize`); Draco and Meshopt compression are supported. If a model faces the wrong way, change `rotY` (90/180/270).
