import * as THREE from 'three'
import { seeded } from './helpers.js'

/**
 * Procedural PBR surface detail. One small tileable RGBA map (fine grain + aggregate stones / macro patches / puddle mask) and a
 * matching normal map are generated once on a canvas-free path (DataTextures), then patched into the city's materials with
 * world-space projection. The kit meshes keep their palette UVs (lane paint, kerbs); the asphalt grain, bump, roughness and rain
 * puddles come from the world position, so they never stretch or repeat per tile.
 */
function periodicNoise(size, freq, rnd) {
  const g = new Float32Array(freq * freq); for (let i = 0; i < g.length; i++) g[i] = rnd()
  const out = new Float32Array(size * size), sm = (t) => t * t * (3 - 2 * t)
  for (let y = 0; y < size; y++) {
    const fy = (y / size) * freq, iy = Math.floor(fy), ty = sm(fy - iy)
    for (let x = 0; x < size; x++) {
      const fx = (x / size) * freq, ix = Math.floor(fx), tx = sm(fx - ix)
      const a = g[(iy % freq) * freq + (ix % freq)], b = g[(iy % freq) * freq + ((ix + 1) % freq)]
      const c = g[((iy + 1) % freq) * freq + (ix % freq)], d = g[((iy + 1) % freq) * freq + ((ix + 1) % freq)]
      out[y * size + x] = a + (b - a) * tx + (c - a + (a - b - c + d) * tx) * ty
    }
  }
  return out
}

export function createSurfaces({ mobile = false } = {}) {
  const size = mobile ? 128 : 256, rnd = seeded(77)
  // height: fine noise + aggregate stones + mid-scale unevenness
  const mid = periodicNoise(size, 24, rnd), low = periodicNoise(size, 4, rnd), pud = periodicNoise(size, 6, rnd), pud2 = periodicNoise(size, 14, rnd)
  const H = new Float32Array(size * size)
  for (let i = 0; i < H.length; i++) H[i] = rnd() * 0.5 + mid[i] * 0.35
  const stones = Math.round(size * size * 0.012)
  for (let s = 0; s < stones; s++) {
    const cx = rnd() * size | 0, cy = rnd() * size | 0, r = 1 + rnd() * 1.6, hgt = 0.35 + rnd() * 0.5
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const d = Math.hypot(dx, dy); if (d < r) H[((cy + dy + size) % size) * size + ((cx + dx + size) % size)] += hgt * (1 - d / r) }
  }
  let hmax = 0; for (const v of H) hmax = Math.max(hmax, v)
  const rgba = new Uint8Array(size * size * 4), nrm = new Uint8Array(size * size * 4)
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const i = y * size + x, o = i * 4
    const h = (xx, yy) => H[((yy + size) % size) * size + ((xx + size) % size)]
    const dx = h(x + 1, y) - h(x - 1, y), dy = h(x, y + 1) - h(x, y - 1)
    const nx = -dx * 1.6, ny = -dy * 1.6, nl = Math.hypot(nx, ny, 1)
    nrm[o] = (nx / nl * 0.5 + 0.5) * 255; nrm[o + 1] = (ny / nl * 0.5 + 0.5) * 255; nrm[o + 2] = (1 / nl * 0.5 + 0.5) * 255; nrm[o + 3] = 255
    rgba[o] = (H[i] / hmax) * 255                                  // r: grain / stone height → albedo + roughness breakup
    rgba[o + 1] = (low[i] * 0.65 + mid[i] * 0.35) * 255            // g: macro patches (repairs, oil, wear)
    rgba[o + 2] = (pud[i] * 0.6 + pud2[i] * 0.4) * 255             // b: puddle mask
    rgba[o + 3] = 255
  }
  const tex = (data, srgb) => { const t = new THREE.DataTexture(data, size, size, THREE.RGBAFormat); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true; t.anisotropy = mobile ? 2 : 8; t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; t.needsUpdate = true; return t }
  const u = { uSfD: { value: tex(rgba, false) }, uSfN: { value: tex(nrm, false) }, uSfWet: { value: 0 } }

  /**
   * Patch a Lambert / Standard material with world-projected detail.
   * scale: texture repeats per metre · grain: albedo breakup · bump: normal strength · rough: roughness breakup (Standard only) · puddles: rain puddles
   */
  function patch(m, { scale = 0.25, grain = 0.5, bump = 0.5, rough = 0.3, puddles = true } = {}) {
    const std = !!m.isMeshStandardMaterial, f = (n) => n.toFixed(3)
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uSfD = u.uSfD; sh.uniforms.uSfN = u.uSfN; sh.uniforms.uSfWet = u.uSfWet
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vSfP;varying float vSfU;')
        .replace('#include <begin_vertex>', `#include <begin_vertex>
        #ifdef USE_INSTANCING
          vSfP=(modelMatrix*instanceMatrix*vec4(transformed,1.)).xyz; vSfU=normalize(mat3(modelMatrix)*mat3(instanceMatrix)*objectNormal).y;
        #else
          vSfP=(modelMatrix*vec4(transformed,1.)).xyz; vSfU=normalize(mat3(modelMatrix)*objectNormal).y;
        #endif`)
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vSfP;varying float vSfU;uniform sampler2D uSfD,uSfN;uniform float uSfWet;')
        .replace('#include <map_fragment>', `#include <map_fragment>
        float sfUp=smoothstep(.7,.95,vSfU);
        vec4 sfA=texture2D(uSfD,vSfP.xz*${f(scale)});
        vec4 sfM=texture2D(uSfD,vSfP.xz*${f(scale * 0.083)}+vec2(.37,.11));
        float sfPud=${puddles ? 'smoothstep(.56,.76,sfM.b)*uSfWet*sfUp' : '0.'};
        diffuseColor.rgb*=1.+((sfA.r-.5)*${f(grain)}+(sfM.g-.5)*.26)*sfUp;
        diffuseColor.rgb*=1.-sfPud*.5;`)
        .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        {
          vec3 sfN=texture2D(uSfN,vSfP.xz*${f(scale)}).xyz*2.-1.;
          normal=normalize(normal+(viewMatrix*vec4(sfN.x,0.,sfN.y,0.)).xyz*${f(bump)}*sfUp*(1.-sfPud));
        }`)
      if (std) sh.fragmentShader = sh.fragmentShader.replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor=clamp(roughnessFactor+(sfA.r-.5)*${f(rough)}*sfUp+(sfM.g-.5)*.12*sfUp,.06,1.);
        roughnessFactor=mix(roughnessFactor,.05,sfPud);`)
    }
    m.customProgramCacheKey = () => `sf${std ? 'S' : 'L'}${scale}${grain}${bump}${rough}${puddles}`
    return m
  }
  return { patch, u, detail: u.uSfD.value, normal: u.uSfN.value }
}
