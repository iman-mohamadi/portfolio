// Merges the Kenney CC0 asset packs (https://kenney.nl) into a few compressed GLB "kits" the game instances at runtime.
// Every model becomes one named root node ("road/road-straight", "car/taxi", …); an index.json records sizes for layout.
//
//   KENNEY_DIR = folder containing the unzipped packs as: roads/ commercial/ suburban/ car/ nature/ racing/
//                (each with a "glb" folder of .glb files — or the original "Models/GLB format" / "Models/GLTF format")
import fs from 'node:fs'
import path from 'node:path'
import { Document, NodeIO, getBounds } from '@gltf-transform/core'
import { ALL_EXTENSIONS, EXTMeshoptCompression } from '@gltf-transform/extensions'
import { dedup, prune, quantize, reorder, weld, mergeDocuments, unpartition } from '@gltf-transform/functions'
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer'

const SRC = process.env.KENNEY_DIR, OUT = path.resolve(import.meta.dirname, '../public/models/kits')
if (!SRC) { console.error('Set KENNEY_DIR'); process.exit(1) }
await MeshoptEncoder.ready
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder })

const dirOf = (pack) => { for (const c of [`${pack}/glb`, `${pack}/Models/GLB format`, `${pack}/Models/GLTF format`]) if (fs.existsSync(path.join(SRC, c))) return path.join(SRC, c); throw new Error('no glb dir for ' + pack) }
const all = (pack) => fs.readdirSync(dirOf(pack)).filter((f) => f.endsWith('.glb')).map((f) => f.replace(/\.glb$/, ''))

// what goes into each kit: [pack, prefix, filter]
const KITS = {
  city: [['roads', 'road', () => true], ['commercial', 'com', () => true], ['suburban', 'sub', () => true]],
  cars: [['car', 'car', () => true]],
  nature: [['nature', 'nat', (n) => /^(tree_(default|oak|fat|tall|simple|small|thin|blocks|cone|detailed|plateau|pine(Default|Round|Tall|Small)[A-F]?|palm(Tall|Short|Bend)?)|rock_(large|small|tall)[A-D]|stone_(large|tall)[A-C]|plant_bush(Large|Small|Detailed)?|plant_flat(Short|Tall)|flower_(red|yellow|purple)[AB]|grass(_large|_leafs)?|log(_large|_stack)?|stump_(old|round|square)|mushroom_(red|tan)|cliff_(block|blockHalf|blockSlope|large|rock|stone|half|corner|cornerLarge|cornerInner|steps|top)(_rock|_stone)?|ground_river(Straight|Bend|Corner|End|Tile|Side|Open|Cross)|lily_(large|small)|fence_(simple|planks)|tent_(small|detailed)(Closed|Open))$/.test(n)]],
  racing: [['racing', 'race', (n) => !/^(raceCar|camera|radar)/.test(n)]],
}

const index = {}
for (const [kit, parts] of Object.entries(KITS)) {
  const target = new Document(); target.createBuffer(); const scene = target.createScene(kit); index[kit] = {}
  for (const [pack, prefix, filter] of parts) {
    for (const name of all(pack).filter(filter)) {
      const src = await io.read(path.join(dirOf(pack), name + '.glb'))
      const map = mergeDocuments(target, src) // Map of source → copied resources
      // wrap everything the source scene held under one uniquely-named root node
      const root = target.createNode(`${prefix}/${name}`); scene.addChild(root)
      for (const s of src.getRoot().listScenes()) for (const n of s.listChildren()) root.addChild(map.get(n))
      // merge() also copies the source scene — drop it
      for (const s of target.getRoot().listScenes()) if (s !== scene) s.dispose()
    }
  }
  await target.transform(dedup(), prune(), weld(), quantize({ quantizePosition: 14, quantizeNormal: 10, quantizeTexcoord: 12 }), reorder({ encoder: MeshoptEncoder }), unpartition())
  target.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE })
  // sizes for layout (native Kenney units)
  for (const root of scene.listChildren()) {
    const b = getBounds(root); let tris = 0
    root.traverse((n) => { const m = n.getMesh(); if (m) for (const p of m.listPrimitives()) tris += (p.getIndices()?.getCount() || 0) / 3 })
    index[kit][root.getName()] = { size: [0, 1, 2].map((i) => +(b.max[i] - b.min[i]).toFixed(3)), min: b.min.map((v) => +v.toFixed(3)), tris: Math.round(tris) }
  }
  const file = path.join(OUT, `${kit}.glb`); await io.write(file, target)
  console.log(kit.padEnd(8), Object.keys(index[kit]).length, 'models →', (fs.statSync(file).size / 1024).toFixed(0), 'KB')
}
fs.writeFileSync(path.join(OUT, 'index.json'), JSON.stringify(index))
fs.writeFileSync(path.join(OUT, 'LICENSE.txt'), 'Models in these kits: Kenney (www.kenney.nl) — City Kit (Roads/Commercial/Suburban), Car Kit, Nature Kit, Racing Kit.\nLicense: Creative Commons CC0 1.0 (public domain) — https://creativecommons.org/publicdomain/zero/1.0/\nCredit is not required but appreciated.\n')
