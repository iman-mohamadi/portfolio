import * as THREE from 'three'

const NOISE = /* glsl */ `
float hash(vec3 p){p=fract(p*.3183099+.1);p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
float vnoise(vec3 x){vec3 i=floor(x),f=fract(x);f=f*f*(3.-2.*f);
  return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}
`

/** Sky dome: horizon glow, twinkling stars, nebula and aurora curtains. Drawn last with depth-test so it only shades uncovered pixels. */
export function createSky(scene, { mobile }) {
  const uniforms = { uTime: { value: 0 } }
  const oct = mobile ? 3 : 5
  const mat = new THREE.ShaderMaterial({
    uniforms, side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: 'varying vec3 vDir;void main(){vDir=normalize(position);vec4 p=projectionMatrix*modelViewMatrix*vec4(position,1.);gl_Position=p;gl_Position.z=p.w*.99999;}',
    fragmentShader: /* glsl */ `
    uniform float uTime;varying vec3 vDir;
    ${NOISE}
    float fbm(vec3 p){float a=.5,s=0.;for(int i=0;i<${oct};i++){s+=a*vnoise(p);p=p*2.03+1.7;a*=.5;}return s;}
    void main(){
      vec3 d=normalize(vDir);float h=d.y;
      vec3 c=mix(vec3(.10,.02,.11),vec3(.008,.008,.026),smoothstep(-.02,.6,h));
      c+=vec3(1.,.16,.5)*.20*exp(-abs(h)*10.);
      // stars
      vec3 sp=d*230.;vec3 cell=floor(sp);float r=hash(cell);vec3 f=fract(sp)-.5;
      float star=step(.983,r)*smoothstep(.4,0.,length(f))*(.55+.45*sin(uTime*2.+r*60.));
      c+=vec3(.85,.82,1.)*star*smoothstep(0.,.2,h)*1.4;
      // nebula
      float n=fbm(d*2.4+vec3(0.,uTime*.008,0.)),n2=fbm(d*4.5+7.);
      c+=mix(vec3(.30,.16,1.),vec3(1.,.14,.5),n2)*pow(smoothstep(.42,.9,n),1.7)*.6*smoothstep(.04,.5,h);
      // aurora curtains
      float a=fbm(vec3(d.x*4.+uTime*.03,d.y*9.,d.z*3.));
      float cur=smoothstep(.52,.88,a)*smoothstep(.06,.28,h)*smoothstep(.8,.3,h);
      c+=mix(vec3(.1,1.,.72),vec3(1.,.22,.7),.5+.5*sin(d.x*5.+uTime*.12))*cur*.55;
      gl_FragColor=vec4(c,1.);
    }`,
  })
  const dome = new THREE.Mesh(new THREE.SphereGeometry(400, 32, 16), mat)
  dome.renderOrder = 999; dome.frustumCulled = false; scene.add(dome)

  // ringed planet (parallax-free: follows the camera)
  const far = new THREE.Group(); scene.add(far)
  const pu = { uTime: uniforms.uTime, uSun: { value: new THREE.Vector3(0.6, 0.35, 0.7).normalize() } }
  const planet = new THREE.Mesh(new THREE.SphereGeometry(30, 48, 32), new THREE.ShaderMaterial({
    uniforms: pu, fog: false,
    vertexShader: 'varying vec3 vN;varying vec3 vP;varying vec3 vV;void main(){vN=normalize(mat3(modelMatrix)*normal);vP=position;vec4 w=modelMatrix*vec4(position,1.);vV=normalize(cameraPosition-w.xyz);gl_Position=projectionMatrix*viewMatrix*w;}',
    fragmentShader: /* glsl */ `varying vec3 vN;varying vec3 vP;varying vec3 vV;uniform vec3 uSun;uniform float uTime;
      ${NOISE}
      void main(){
        float band=sin(vP.y*.32+vnoise(vP*.08)*3.)*.5+.5;
        vec3 base=mix(vec3(.22,.08,.5),vec3(1.,.28,.55),band);
        float l=clamp(dot(normalize(vN),uSun)*.5+.55,0.,1.);
        float rim=pow(1.-max(dot(normalize(vN),vV),0.),3.);
        gl_FragColor=vec4(base*l*.8+vec3(.6,.4,1.)*rim*.9,1.);
      }`,
  }))
  const ring = new THREE.Mesh(new THREE.RingGeometry(42, 74, 128, 1), new THREE.ShaderMaterial({
    uniforms: pu, transparent: true, side: THREE.DoubleSide, depthWrite: false, fog: false,
    vertexShader: 'varying vec2 vUv;varying float vR;void main(){vR=length(position.xy);vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: 'varying float vR;void main(){float t=(vR-42.)/32.;float b=.5+.5*sin(vR*1.6)+.35*sin(vR*4.7);float a=smoothstep(0.,.08,t)*smoothstep(1.,.85,t)*(.25+.5*b);gl_FragColor=vec4(mix(vec3(.6,.4,1.),vec3(1.,.5,.75),t),a*.8);}',
  }))
  ring.rotation.set(1.25, 0, 0.35)
  const pg = new THREE.Group(); pg.add(planet, ring); pg.position.set(-190, 120, -300); far.add(pg)
  const moon = new THREE.Mesh(new THREE.SphereGeometry(7, 24, 16), new THREE.MeshBasicMaterial({ color: 0xd9d2ff, fog: false, toneMapped: false })); moon.position.set(210, 90, -240); far.add(moon)
  return { update(cam, t) { uniforms.uTime.value = t; dome.position.copy(cam.position); far.position.copy(cam.position); planet.rotation.y = t * 0.02; pg.rotation.z = Math.sin(t * 0.05) * 0.03 } }
}

/** Instanced neon skyline ring with procedurally lit windows — one draw call. */
export function createSkyline(scene, { mobile, seed = 3 }) {
  const n = mobile ? 90 : 170
  const g = new THREE.BoxGeometry(1, 1, 1); g.translate(0, 0.5, 0)
  const seedAttr = new Float32Array(n)
  const inst = new THREE.InstancedMesh(g, new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uFog: { value: 0.0042 } }, fog: false,
    vertexShader: 'attribute float aSeed;varying vec3 vW;varying vec3 vN;varying float vS;void main(){mat4 m=modelMatrix*instanceMatrix;vec4 w=m*vec4(position,1.);vW=w.xyz;vN=normalize(mat3(m)*normal);vS=aSeed;gl_Position=projectionMatrix*viewMatrix*w;}',
    fragmentShader: /* glsl */ `uniform float uTime,uFog;varying vec3 vW;varying vec3 vN;varying float vS;
      float h1(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      void main(){
        vec2 g=vec2(abs(vN.x)>.5?vW.z:vW.x,vW.y);
        vec2 cell=floor(g*vec2(.6,.5));vec2 f=fract(g*vec2(.6,.5));
        float win=step(.22,f.x)*step(f.x,.78)*step(.28,f.y)*step(f.y,.72);
        float r=h1(cell+vS*41.);
        float lit=step(.6,r)*(.75+.25*sin(uTime*(.4+r*2.)+r*30.));
        vec3 tint=mix(vec3(1.,.2,.55),vec3(.5,.4,1.),h1(cell.yx+vS));
        vec3 col=vec3(.012,.012,.03)+tint*win*lit*1.3*step(vN.y,.5);
        col+=vec3(1.,.2,.55)*exp(-vW.y*.7)*.35;               // glow at the base
        col+=vec3(.5,.4,1.)*smoothstep(.0,1.,fract(vS*7.))*.0;
        float d=distance(cameraPosition,vW);col=mix(col,vec3(.002,.002,.004),1.-exp(-pow(d*uFog,2.)));
        gl_FragColor=vec4(col,1.);
      }`,
  }), n)
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler()
  let s = seed; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647)
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + (rnd() - 0.5) * 0.06, r = 108 + rnd() * 110
    const w = 6 + rnd() * 12, d = 6 + rnd() * 12, h = 14 + Math.pow(rnd(), 1.8) * 95
    e.set(0, rnd() * Math.PI, 0); q.setFromEuler(e)
    m.compose(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r), q, new THREE.Vector3(w, h, d))
    inst.setMatrixAt(i, m); seedAttr[i] = rnd()
  }
  g.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seedAttr, 1))
  inst.frustumCulled = false; scene.add(inst)
  return { update(t) { inst.material.uniforms.uTime.value = t } }
}
