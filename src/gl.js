import * as THREE from 'three'
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

const NOISE = /* glsl */ `
vec3 mod289(vec3 x){return x-floor(x*(1./289.))*289.;}
vec4 mod289(vec4 x){return x-floor(x*(1./289.))*289.;}
vec4 permute(vec4 x){return mod289(((x*34.)+1.)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1./6.,1./3.);const vec4 D=vec4(0.,.5,1.,2.);
  vec3 i=floor(v+dot(v,C.yyy));vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz);vec3 l=1.-g;vec3 i1=min(g.xyz,l.zxy);vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx;vec3 x2=x0-i2+C.yyy;vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.,i1.z,i2.z,1.))+i.y+vec4(0.,i1.y,i2.y,1.))+i.x+vec4(0.,i1.x,i2.x,1.));
  float n_=.142857142857;vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.*floor(p*ns.z*ns.z);vec4 x_=floor(j*ns.z);vec4 y_=floor(j-7.*x_);
  vec4 x=x_*ns.x+ns.yyyy;vec4 y=y_*ns.x+ns.yyyy;vec4 h=1.-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy);vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.+1.;vec4 s1=floor(b1)*2.+1.;vec4 sh=-step(h,vec4(0.));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x);vec3 p1=vec3(a0.zw,h.y);vec3 p2=vec3(a1.xy,h.z);vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
  vec4 m=max(.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.);m=m*m;
  return 42.*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}`

const bgFrag = /* glsl */ `
precision highp float;
uniform float uTime, uScroll, uIntro; uniform vec2 uRes, uMouse;
varying vec2 vUv;
${NOISE}
void main(){
  vec2 uv=(gl_FragCoord.xy-.5*uRes)/uRes.y;
  vec2 m=(uMouse*uRes-.5*uRes)/uRes.y;
  float t=uTime*.06;
  float md=length(uv-m);
  float ripple=exp(-md*md*7.)*.35;
  vec3 p=vec3(uv*1.5,t+uScroll*2.);
  float n=snoise(p+vec3(snoise(p*.8+7.)*.6,0.,0.))*.5+.5;
  n+=ripple;
  float k=n*11.;
  float d=abs(fract(k)-.5)/max(fwidth(k),1e-4);
  float line=1.-clamp(d*.5,0.,1.);
  vec3 col=mix(vec3(.48,.36,1.),vec3(1.,.18,.54),smoothstep(.25,.85,n+uScroll*.2));
  float vig=smoothstep(1.25,.15,length(uv));
  float a=line*(.16+.5*ripple)*vig*uIntro;
  vec3 c=col*a+vec3(.02,.005,.02)*vig;
  gl_FragColor=vec4(c,1.);
}`

const ptsVert = /* glsl */ `
uniform float uTime, uMorph, uPx; uniform vec2 uMouse;
attribute float aRand;
varying float vN; varying float vRand;
${NOISE}
void main(){
  vec3 p=position;
  float n=snoise(p*1.15+vec3(0.,uTime*.25,uTime*.12));
  float n2=snoise(p*3.+uTime*.3);
  vec3 dir=normalize(p);
  // morph: sphere -> torus-ish twist as scroll progresses
  float ang=atan(p.z,p.x);
  vec3 tor=vec3(cos(ang)*(1.25+.55*cos(atan(p.y,length(p.xz)-1.)*1.)),p.y*1.2,sin(ang)*(1.25+.55*cos(atan(p.y,length(p.xz)-1.)*1.)));
  p=mix(p,mix(p,tor,.65),uMorph);
  p+=dir*(n*.32+n2*.04)*(1.+uMorph*.6);
  vN=n;vRand=aRand;
  vec4 mv=modelViewMatrix*vec4(p,1.);
  gl_Position=projectionMatrix*mv;
  gl_PointSize=(1.0+aRand*1.6)*uPx*(6./-mv.z);
}`
const ptsFrag = /* glsl */ `
precision highp float; uniform float uAlpha; varying float vN; varying float vRand;
void main(){
  vec2 c=gl_PointCoord-.5; float r=length(c); if(r>.5) discard;
  float a=smoothstep(.5,0.,r);
  vec3 col=mix(vec3(.48,.36,1.),vec3(1.,.18,.54),clamp(vN*.9+.5,0.,1.));
  gl_FragColor=vec4(col*(.5+vRand*.7),a*.7*uAlpha);
}`

export function createGL(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance' })
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5)
  renderer.setPixelRatio(dpr)
  renderer.setClearColor(0x050505, 1)

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 50)
  camera.position.z = 6

  // background isoline field
  const bgUniforms = {
    uTime: { value: 0 }, uScroll: { value: 0 }, uIntro: { value: 0 },
    uRes: { value: new THREE.Vector2() }, uMouse: { value: new THREE.Vector2(.5, .5) },
  }
  const bg = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    new THREE.ShaderMaterial({ uniforms: bgUniforms, vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}', fragmentShader: bgFrag, depthTest: false, depthWrite: false }),
  )
  bg.frustumCulled = false
  bg.renderOrder = -1
  scene.add(bg)

  // particle sphere
  let geo = new THREE.IcosahedronGeometry(1.35, 40)
  geo.deleteAttribute('normal'); geo.deleteAttribute('uv')
  geo = mergeVertices(geo)
  const count = geo.attributes.position.count
  const rand = new Float32Array(count)
  for (let i = 0; i < count; i++) rand[i] = Math.random()
  geo.setAttribute('aRand', new THREE.BufferAttribute(rand, 1))
  const ptsUniforms = { uTime: { value: 0 }, uMorph: { value: 0 }, uAlpha: { value: 1 }, uPx: { value: dpr }, uMouse: { value: new THREE.Vector2() } }
  const pts = new THREE.Points(geo, new THREE.ShaderMaterial({
    uniforms: ptsUniforms, vertexShader: ptsVert, fragmentShader: ptsFrag,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }))
  const group = new THREE.Group()
  group.add(pts)
  scene.add(group)

  const state = { dim: 0, mx: .5, my: .5, tx: .5, ty: .5, scroll: 0, vel: 0, intro: 0, spin: 0 }
  const target = { x: 1.6, y: 0, s: 1, rx: 0 }

  function resize() {
    const w = window.innerWidth, h = window.innerHeight
    renderer.setSize(w, h, false)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
    bgUniforms.uRes.value.set(w * dpr, h * dpr)
    state.narrow = w < 820
  }
  resize()
  window.addEventListener('resize', resize)
  window.addEventListener('pointermove', (e) => { state.tx = e.clientX / window.innerWidth; state.ty = 1 - e.clientY / window.innerHeight }, { passive: true })

  function render(time, delta) {
    const t = time
    state.mx += (state.tx - state.mx) * Math.min(1, delta * 4)
    state.my += (state.ty - state.my) * Math.min(1, delta * 4)
    bgUniforms.uTime.value = t
    bgUniforms.uScroll.value += (state.scroll - bgUniforms.uScroll.value) * Math.min(1, delta * 3)
    bgUniforms.uIntro.value = state.intro
    bgUniforms.uMouse.value.set(state.mx, state.my)
    ptsUniforms.uTime.value = t
    ptsUniforms.uMorph.value += (state.scroll * 4 % 1 - ptsUniforms.uMorph.value) * Math.min(1, delta * 2)

    ptsUniforms.uAlpha.value += ((1 - state.dim * .8) - ptsUniforms.uAlpha.value) * Math.min(1, delta * 3)
    // scroll-choreographed placement: hero right → drifts left / down / scales while scrolling
    const p = state.scroll
    const narrow = state.narrow
    const hero = Math.min(1, p / 0.12)
    target.x = narrow ? 0 : 1.7 - hero * 2.6 + Math.sin(p * 18) * .2
    target.y = narrow ? .9 - hero * .3 : -hero * .2 + Math.cos(p * 12) * .15
    target.s = (narrow ? .7 : 1) * (1 - hero * .35 + Math.sin(p * 30) * .05)
    group.position.x += (target.x - group.position.x) * Math.min(1, delta * 3)
    group.position.y += (target.y - group.position.y) * Math.min(1, delta * 3)
    const s = group.scale.x + (target.s - group.scale.x) * Math.min(1, delta * 3)
    group.scale.setScalar(s * (0.6 + state.intro * .4))
    state.spin += delta * (.12 + Math.abs(state.vel) * .015)
    group.rotation.y = state.spin + (state.mx - .5) * .8
    group.rotation.x = (state.my - .5) * -.5 + p * 3
    renderer.render(scene, camera)
  }
  return { state, render, renderer }
}
