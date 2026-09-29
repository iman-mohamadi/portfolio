import { NodeIO } from '@gltf-transform/core'
import { MeshoptDecoder } from 'meshoptimizer'
import { KHRMeshQuantization, EXTMeshoptCompression } from '@gltf-transform/extensions'
const io = new NodeIO().registerExtensions([KHRMeshQuantization, EXTMeshoptCompression]).registerDependencies({ 'meshopt.decoder': MeshoptDecoder })
await MeshoptDecoder.ready
const doc = await io.read('../public/models/kits/city.glb')
const want = process.argv.slice(2)
for (const n of doc.getRoot().listScenes()[0].listChildren()) {
  const nm = n.getExtras()?.name || n.getName(); if (!want.includes(nm)) continue
  // collect world-space vertices (apply node local transforms recursively)
  const pts = []
  const walk = (node, m) => {
    const lm = node.getMatrix(); const M = mul(m, lm)
    const mesh = node.getMesh()
    if (mesh) for (const p of mesh.listPrimitives()) { const pos = p.getAttribute('POSITION'); for (let i = 0; i < pos.getCount(); i++) { const e = pos.getElement(i, []); pts.push(apply(M, e)) } }
    node.listChildren().forEach((c) => walk(c, M))
  }
  const I = [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]
  walk(n, I)
  // top height by (x,z) grid
  const key = (p) => p[0].toFixed(2) + ',' + p[2].toFixed(2)
  const top = new Map(); for (const p of pts) { const k = key(p); top.set(k, Math.max(top.get(k) ?? -9, p[1])) }
  const xs = [...new Set(pts.map((p) => +p[0].toFixed(2)))].sort((a, b) => a - b), zs = [...new Set(pts.map((p) => +p[2].toFixed(2)))].sort((a, b) => a - b)
  console.log('==', nm, 'x', xs.join(' '), '| z', zs.join(' '))
  // print height grid rows for each z (coarse)
  for (const z of zs) console.log('  z=' + z.toFixed(2), xs.map((x) => (top.get(x.toFixed(2) + ',' + z.toFixed(2)) ?? NaN).toFixed(2)).join(' '))
}
function mul(a, b) { const o = new Array(16).fill(0); for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k]; return o }
function apply(m, p) { return [m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12], m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13], m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14]] }
