import * as THREE from 'three'
import gsap from 'gsap'
import { palette } from './core.js'
import { metal, glowMat, basicMat } from './world.js'

/**
 * Each effect layer is a real GLSL function. The material below is assembled from these exact strings and the
 * Vue panel prints the very same source — so what you read is what is running on your GPU.
 */
export const CHUNKS = {
  pbr: { title: 'Environment reflection', cost: 0.6, kind: 'frag', glsl: `// PBR-style studio reflection (Schlick Fresnel)
vec3 layerPbr(vec3 col, vec3 N, vec3 V) {
  vec3 R = reflect(-V, N);
  vec3 env = studio(R);
  float F = .04 + .96 * pow(1. - max(dot(N, V), 0.), 5.);
  return mix(col * .35, env, F * .9 + .12);
}` },
  rim: { title: 'Fresnel rim light', cost: 0.1, kind: 'frag', glsl: `// rim light: brightest where the surface turns away
vec3 layerRim(vec3 col, vec3 N, vec3 V) {
  float r = pow(1. - max(dot(N, V), 0.), 3.);
  return col + uSecondary * r * 1.4;
}` },
  iridescence: { title: 'Thin-film iridescence', cost: 0.4, kind: 'frag', glsl: `// thin-film interference: hue shifts with view angle
vec3 layerIri(vec3 col, vec3 N, vec3 V) {
  float a = dot(N, V);
  vec3 film = .5 + .5 * cos(6.2832 * (a * 1.35 + vec3(0., .33, .67) + uTime * .05));
  return mix(col, col * film * 1.9, .85);
}` },
  displace: { title: 'Vertex displacement', cost: 1.1, kind: 'vert', glsl: `// liquid surface: noise pushes vertices along their normal
vec3 displace(vec3 p, vec3 n, float t) {
  float d = snoise(p * .9 + vec3(0., t * .35, 0.)) * .55
          + snoise(p * 2.1 - t * .2) * .16;
  return p + n * d;
}` },
  bloom: { title: 'Bloom post-process', cost: 1.8, kind: 'post', glsl: `// bloom: bright pixels are extracted, blurred over
// a mip chain and added back (UnrealBloomPass)
threshold = .58;  strength = .62;  radius = .55;` },
}
export const LAYER_ORDER = ['pbr', 'rim', 'iridescence', 'displace', 'bloom']

const NOISE = `
vec3 mod289(vec3 x){return x-floor(x*(1./289.))*289.;}vec4 mod289(vec4 x){return x-floor(x*(1./289.))*289.;}
vec4 permute(vec4 x){return mod289(((x*34.)+1.)*x);}vec4 tis(vec4 r){return 1.79284291400159-.85373472095314*r;}
float snoise(vec3 v){const vec2 C=vec2(1./6.,1./3.);const vec4 D=vec4(0.,.5,1.,2.);
vec3 i=floor(v+dot(v,C.yyy));vec3 x0=v-i+dot(i,C.xxx);vec3 g=step(x0.yzx,x0.xyz);vec3 l=1.-g;vec3 i1=min(g.xyz,l.zxy);vec3 i2=max(g.xyz,l.zxy);
vec3 x1=x0-i1+C.xxx;vec3 x2=x0-i2+C.yyy;vec3 x3=x0-D.yyy;i=mod289(i);
vec4 p=permute(permute(permute(i.z+vec4(0.,i1.z,i2.z,1.))+i.y+vec4(0.,i1.y,i2.y,1.))+i.x+vec4(0.,i1.x,i2.x,1.));
float n_=.142857142857;vec3 ns=n_*D.wyz-D.xzx;vec4 j=p-49.*floor(p*ns.z*ns.z);vec4 x_=floor(j*ns.z);vec4 y_=floor(j-7.*x_);
vec4 x=x_*ns.x+ns.yyyy;vec4 y=y_*ns.x+ns.yyyy;vec4 h=1.-abs(x)-abs(y);vec4 b0=vec4(x.xy,y.xy);vec4 b1=vec4(x.zw,y.zw);
vec4 s0=floor(b0)*2.+1.;vec4 s1=floor(b1)*2.+1.;vec4 sh=-step(h,vec4(0.));vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
vec3 p0=vec3(a0.xy,h.x);vec3 p1=vec3(a0.zw,h.y);vec3 p2=vec3(a1.xy,h.z);vec3 p3=vec3(a1.zw,h.w);
vec4 norm=tis(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
vec4 m=max(.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.);m=m*m;return 42.*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));}`

const STUDIO = `
// procedural softbox studio the reflection layer samples
vec3 studio(vec3 r){
  vec3 c=mix(vec3(.02,.02,.04),vec3(.1,.11,.16),r.y*.5+.5);
  c+=uPrimary*smoothstep(.82,.98,dot(r,normalize(vec3(-.6,.5,.6))))*3.2;
  c+=uSecondary*smoothstep(.85,.99,dot(r,normalize(vec3(.7,.35,.3))))*3.;
  c+=vec3(1.)*smoothstep(.93,.99,dot(r,normalize(vec3(0.,1.,.15))))*2.6;
  c+=uAccent*smoothstep(.9,.99,dot(r,normalize(vec3(0.,-.6,-.8))))*2.;
  return c;
}`

export function createRenderStation({ core, dock, state }) {
  const group = new THREE.Group(); group.position.set(0, 0, -8); dock.group.add(group)

  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uPbr: { value: 0 }, uRim: { value: 0 }, uIri: { value: 0 }, uDisp: { value: 0 }, uPrimary: { value: palette.primary }, uSecondary: { value: palette.secondary }, uAccent: { value: palette.accent }, uL0: { value: new THREE.Vector3() }, uL1: { value: new THREE.Vector3() } },
    vertexShader: `uniform float uTime,uDisp;varying vec3 vW;varying vec3 vN;\n${NOISE}\n${CHUNKS.displace.glsl}
      void main(){vec3 p=position,n=normal;vec3 q=mix(p,displace(p,n,uTime),uDisp);vec4 w=modelMatrix*vec4(q,1.);vW=w.xyz;vN=normalize(mat3(modelMatrix)*n);gl_Position=projectionMatrix*viewMatrix*w;}`,
    fragmentShader: `uniform float uTime,uPbr,uRim,uIri,uDisp;uniform vec3 uPrimary,uSecondary,uAccent,uL0,uL1;varying vec3 vW;varying vec3 vN;\n${STUDIO}\n${CHUNKS.pbr.glsl}\n${CHUNKS.rim.glsl}\n${CHUNKS.iridescence.glsl}
      void main(){
        vec3 N=normalize(vN);
        // displaced geometry has stale normals: rebuild from screen-space derivatives
        vec3 dn=normalize(cross(dFdx(vW),dFdy(vW)));N=normalize(mix(N,dn,uDisp));
        vec3 V=normalize(cameraPosition-vW);
        vec3 base=uPrimary*.42;
        float d0=max(dot(N,normalize(uL0-vW)),0.),d1=max(dot(N,normalize(uL1-vW)),0.);
        vec3 col=base*(.18+d0*.9)+uSecondary*.25*d1;
        col=mix(col,layerPbr(col,N,V),uPbr);
        col=mix(col,layerIri(col,N,V),uIri);
        col=mix(col,layerRim(col,N,V),uRim);
        gl_FragColor=vec4(col,1.);
      }`,
  })
  const knot = new THREE.Mesh(new THREE.TorusKnotGeometry(2.7, 0.92, core.mobile ? 160 : 260, core.mobile ? 24 : 40, 2, 3), mat); knot.position.set(0, 8.4, 1); group.add(knot)
  const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(4.6, 5.2, 0.9, 40), metal(0x0d0f16, 0.4, 0.85)); pedestal.position.set(0, 0.45, 1); group.add(pedestal)
  const ring = new THREE.Mesh(new THREE.TorusGeometry(4.5, 0.06, 8, 72), glowMat(palette.primary, 3.4)); ring.rotation.x = Math.PI / 2; ring.position.set(0, 0.92, 1); group.add(ring)
  // two orbiting lights (visible spheres) drive the shading
  const lights = [0, 1].map((i) => { const s = new THREE.Mesh(new THREE.SphereGeometry(0.32, 16, 12), basicMat(i ? palette.secondary : palette.primary)); group.add(s); return s })
  const tail = new THREE.Mesh(new THREE.TorusGeometry(6.2, 0.02, 6, 96), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.12 })); tail.position.copy(knot.position); tail.rotation.x = Math.PI / 2.4; group.add(tail)

  const k = { pbr: 0, rim: 0, iri: 0, disp: 0 }
  const unsub = core.add((t, dt) => {
    if (!group.visible) return
    const L = state.layers, u = mat.uniforms, e = Math.min(1, dt * 5)
    k.pbr += ((L.pbr ? 1 : 0) - k.pbr) * e; k.rim += ((L.rim ? 1 : 0) - k.rim) * e; k.iri += ((L.iridescence ? 1 : 0) - k.iri) * e; k.disp += ((L.displace ? 1 : 0) - k.disp) * e
    u.uPbr.value = k.pbr; u.uRim.value = k.rim; u.uIri.value = k.iri; u.uDisp.value = k.disp; u.uTime.value = t
    knot.rotation.y = t * 0.35; knot.rotation.x = Math.sin(t * 0.3) * 0.3
    lights[0].position.set(Math.cos(t * 0.9) * 6.2, 8.4 + Math.sin(t * 0.9) * 2.2, 1 + Math.sin(t * 0.9) * 4.6)
    lights[1].position.set(Math.cos(t * 0.6 + 3) * -6.2, 8.4 + Math.cos(t * 0.7) * 2.6, 1 + Math.sin(t * 0.6 + 3) * 4.6)
    u.uL0.value.copy(lights[0].position).add(group.position); u.uL1.value.copy(lights[1].position).add(group.position)
    // bloom is a real post-process toggle
    core.bloom.enabled = !!L.bloom
    const layersOn = LAYER_ORDER.filter((n) => L[n]).length
    state.stats.shaderMs = +LAYER_ORDER.reduce((a, n) => a + (L[n] ? CHUNKS[n].cost : 0), 0).toFixed(1); state.stats.layersOn = layersOn
  })
  return { group, enter() { group.visible = true; gsap.fromTo(knot.scale, { x: 0.01, y: 0.01, z: 0.01 }, { x: 1, y: 1, z: 1, duration: 1.1, ease: 'elastic.out(1,.6)' }) }, leave() { core.bloom.enabled = true }, dispose: unsub }
}
