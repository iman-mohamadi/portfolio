import * as THREE from 'three'

const NOISE = /* glsl */ `
float hash(vec3 p){p=fract(p*.3183099+.1);p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
float vnoise(vec3 x){vec3 i=floor(x),f=fract(x);f=f*f*(3.-2.*f);
  return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}
`

/** Sky dome: horizon glow, twinkling stars, nebula and aurora curtains. Drawn last with depth-test so it only shades uncovered pixels. */
export function createSky(scene, { mobile, renderer }) {
  const uniforms = {
    uTime: { value: 0 }, uDay: { value: 0 }, uTw: { value: 0 }, uCloud: { value: 0.3 }, uDark: { value: 0 }, uFlash: { value: 0 },
    uHor: { value: new THREE.Color(0.7, 0.82, 0.95) }, uZen: { value: new THREE.Color(0.2, 0.44, 0.86) }, uTwCol: { value: new THREE.Color(1, 0.4, 0.25) }, uSun: { value: new THREE.Vector3(0, 1, 0) },
  }
  const oct = mobile ? 3 : 4
  const FRAG = /* glsl */ `
    uniform float uTime,uDay,uTw,uCloud,uDark,uFlash;uniform vec3 uHor,uZen,uTwCol,uSun;varying vec3 vDir;
    ${NOISE}
    float fbm(vec3 p){float a=.5,s=0.;for(int i=0;i<${oct};i++){s+=a*vnoise(p);p=p*2.03+1.7;a*=.5;}return s;}
    void main(){
      vec3 d=normalize(vDir);float h=d.y;
      vec3 c=vec3(0.);float cov=0.;
      // ---- night: neon horizon, stars, nebula, aurora (skipped in full daylight)
      if(uDay<.985){
        c=mix(vec3(.10,.02,.11),vec3(.008,.008,.026),smoothstep(-.02,.6,h));
        c+=vec3(1.,.16,.5)*.20*exp(-abs(h)*10.);
        vec3 sp=d*230.;vec3 cell=floor(sp);float r=hash(cell);vec3 f=fract(sp)-.5;
        float star=step(.983,r)*smoothstep(.4,0.,length(f))*(.55+.45*sin(uTime*2.+r*60.));
        c+=vec3(.85,.82,1.)*star*smoothstep(0.,.2,h)*1.4;
        float n=fbm(d*2.4+vec3(0.,uTime*.008,0.)),n2=fbm(d*4.5+7.);
        c+=mix(vec3(.30,.16,1.),vec3(1.,.14,.5),n2)*pow(smoothstep(.42,.9,n),1.7)*.6*smoothstep(.04,.5,h);
        float a=fbm(vec3(d.x*4.+uTime*.03,d.y*9.,d.z*3.));
        float cur=smoothstep(.52,.88,a)*smoothstep(.06,.28,h)*smoothstep(.8,.3,h);
        c+=mix(vec3(.1,1.,.72),vec3(1.,.22,.7),.5+.5*sin(d.x*5.+uTime*.12))*cur*.55;
        c*=1.-uDark*.7;
      }
      // ---- day: gradient, sun, drifting clouds (skipped in the dead of night)
      vec3 cd=vec3(0.);
      if(uDay>.01){
        cd=mix(uHor,uZen,pow(smoothstep(-.05,.75,h),.65));
        float sd=max(dot(d,uSun),0.);
        cd+=vec3(1.,.92,.75)*(pow(sd,700.)*7.+pow(sd,22.)*.32)*(1.-uDark);
        vec2 cp=d.xz/(max(h,0.)+.16)*1.5+vec2(uTime*.012,uTime*.005);
        float cl=fbm(vec3(cp,uTime*.015));
        cov=smoothstep(.6-uCloud*.32,.9,cl)*smoothstep(0.,.22,h);
        vec3 cloudCol=mix(vec3(1.),uHor*.75,uDark)*(.88+.12*cl);
        cd=mix(cd,cloudCol,cov*(.55+.4*uDark));
      }
      // ---- dusk / dawn glow, strongest on the sun's side of the horizon
      float side=pow(clamp(dot(normalize(d.xz+1e-4),normalize(uSun.xz+1e-4))*.5+.5,0.,1.),2.2);
      vec3 col=mix(c,cd,uDay)+uTwCol*uTw*exp(-abs(h)*5.5)*(.25+.9*side);
      col+=vec3(.75,.8,1.)*uFlash*(.4+.6*cov+.3*(1.-h));
      gl_FragColor=vec4(col,1.);
    }`
  // The full sky shader is expensive, so it is baked into a small cubemap (one face per frame) and the dome just samples it.
  const half = renderer && (renderer.extensions.has('EXT_color_buffer_float') || renderer.extensions.has('EXT_color_buffer_half_float'))
  const SIZE = mobile ? 160 : 256
  const rt = new THREE.WebGLCubeRenderTarget(SIZE, { type: half ? THREE.HalfFloatType : THREE.UnsignedByteType, generateMipmaps: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter })
  const bakeScene = new THREE.Scene()
  bakeScene.add(new THREE.Mesh(new THREE.SphereGeometry(1, 24, 12), new THREE.ShaderMaterial({ uniforms, side: THREE.BackSide, depthTest: false, depthWrite: false, fog: false, vertexShader: 'varying vec3 vDir;void main(){vDir=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}', fragmentShader: FRAG })))
  const faces = [[1, 0, 0, 0, 1, 0], [-1, 0, 0, 0, 1, 0], [0, 1, 0, 0, 0, -1], [0, -1, 0, 0, 0, 1], [0, 0, 1, 0, 1, 0], [0, 0, -1, 0, 1, 0]].map(([x, y, z, ux, uy, uz]) => { const c = new THREE.PerspectiveCamera(90, 1, 0.1, 10); c.up.set(ux, uy, uz); c.lookAt(x, y, z); c.updateMatrixWorld(); return c })
  let faceI = 0
  const bake = (all = false) => {
    if (!renderer) return
    const prev = renderer.getRenderTarget(), n = all ? 6 : 1
    for (let k = 0; k < n; k++) { renderer.setRenderTarget(rt, faceI); renderer.render(bakeScene, faces[faceI]); faceI = (faceI + 1) % 6 }
    renderer.setRenderTarget(prev)
  }
  const mat = new THREE.ShaderMaterial({
    uniforms: { uSky: { value: rt.texture } }, side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: 'varying vec3 vDir;void main(){vDir=normalize(position);vec4 p=projectionMatrix*modelViewMatrix*vec4(position,1.);gl_Position=p;gl_Position.z=p.w*.99999;}',
    fragmentShader: 'uniform samplerCube uSky;varying vec3 vDir;void main(){gl_FragColor=vec4(textureCube(uSky,normalize(vDir)).rgb,1.);}',
  })
  const dome = new THREE.Mesh(new THREE.SphereGeometry(400, 32, 16), mat)
  dome.renderOrder = 999; dome.frustumCulled = false; scene.add(dome)

  // ringed planet (parallax-free: follows the camera)
  const far = new THREE.Group(); scene.add(far)
  const pu = { uTime: uniforms.uTime, uSun: { value: new THREE.Vector3(0.6, 0.35, 0.7).normalize() }, uFade: { value: 1 }, uHaze: { value: new THREE.Color(0.1, 0.02, 0.11) } }
  const planet = new THREE.Mesh(new THREE.SphereGeometry(30, 48, 32), new THREE.ShaderMaterial({
    uniforms: pu, fog: false,
    vertexShader: 'varying vec3 vN;varying vec3 vP;varying vec3 vV;void main(){vN=normalize(mat3(modelMatrix)*normal);vP=position;vec4 w=modelMatrix*vec4(position,1.);vV=normalize(cameraPosition-w.xyz);gl_Position=projectionMatrix*viewMatrix*w;}',
    fragmentShader: /* glsl */ `varying vec3 vN;varying vec3 vP;varying vec3 vV;uniform vec3 uSun,uHaze;uniform float uTime,uFade;
      ${NOISE}
      void main(){
        float band=sin(vP.y*.32+vnoise(vP*.08)*3.)*.5+.5;
        vec3 base=mix(vec3(.22,.08,.5),vec3(1.,.28,.55),band);
        float l=clamp(dot(normalize(vN),uSun)*.5+.55,0.,1.);
        float rim=pow(1.-max(dot(normalize(vN),vV),0.),3.);
        gl_FragColor=vec4(mix(uHaze,base*l*.8+vec3(.6,.4,1.)*rim*.9,uFade),1.);
      }`,
  }))
  const ring = new THREE.Mesh(new THREE.RingGeometry(42, 74, 128, 1), new THREE.ShaderMaterial({
    uniforms: pu, transparent: true, side: THREE.DoubleSide, depthWrite: false, fog: false,
    vertexShader: 'varying vec2 vUv;varying float vR;void main(){vR=length(position.xy);vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: 'varying float vR;uniform float uFade;void main(){float t=(vR-42.)/32.;float b=.5+.5*sin(vR*1.6)+.35*sin(vR*4.7);float a=smoothstep(0.,.08,t)*smoothstep(1.,.85,t)*(.25+.5*b);gl_FragColor=vec4(mix(vec3(.6,.4,1.),vec3(1.,.5,.75),t),a*.8*uFade);}',
  }))
  ring.rotation.set(1.25, 0, 0.35)
  const pg = new THREE.Group(); pg.add(planet, ring); pg.position.set(-190, 120, -300); far.add(pg)
  const moon = new THREE.Mesh(new THREE.SphereGeometry(7, 24, 16), new THREE.MeshBasicMaterial({ color: 0xd9d2ff, fog: false, toneMapped: false, transparent: true })); moon.position.set(210, 90, -240); far.add(moon)
  const moonFade = (k) => { moon.material.opacity = k; moon.visible = k > 0.01 }
  return {
    uniforms,
    bake,
    update(cam, t) { uniforms.uTime.value = t; bake(); dome.position.copy(cam.position); far.position.copy(cam.position); planet.rotation.y = t * 0.02; pg.rotation.z = Math.sin(t * 0.05) * 0.03 },
    /** night 0..1 fades the planet, ring and moon out for daylight; haze is the horizon colour they dissolve into. */
    setNight(night, haze) { pu.uFade.value = night; pu.uHaze.value.copy(haze); far.visible = night > 0.01; moonFade(night) },
  }
}
