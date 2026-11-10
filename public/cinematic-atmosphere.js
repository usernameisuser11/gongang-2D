/**
 * Gongang — cinematic atmospheric perspective for a fixed-camera 3D landscape.
 *
 * Four large, lightly translucent mist sheets span the mountain valleys.
 * Each has irregular, slowly drifting cloud wisps and a shaped horizon.
 * No particles, fullscreen postprocess passes or external textures needed.
 * Source code is original and can be modified for art direction.
 */
const VERTEX = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAGMENT = `
  precision highp float;
  varying vec2 vUv;
  uniform float uTime;
  uniform float uOpacity;
  uniform float uSeed;
  uniform vec3 uTint;
  uniform vec3 uHighlight;

  float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }
  float noise2(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f*f*(3.0-2.0*f);
    return mix(
      mix(hash21(i),hash21(i+vec2(1.,0.)),u.x),
      mix(hash21(i+vec2(0.,1.)),hash21(i+vec2(1.,1.)),u.x),
      u.y
    );
  }
  float fbm(vec2 p) {
    float total = 0.0;
    float a = 0.5;
    for(int i=0;i<3;i++) {
      total += a*noise2(p);
      p = p*2.07 + vec2(19.2, 8.7);
      a *= 0.5;
    }
    return total;
  }

  void main() {
    float t = uTime * 0.009;
    vec2 uv = vUv;
    vec2 p = uv*vec2(7.3, 2.45) + vec2(uSeed, uSeed*0.21);
    float domain = fbm(p*0.62 + vec2(t, 0.0));
    p.x += domain*0.77;
    p.y += domain*0.22;
    float large = fbm(p + vec2(-t*0.62, 0.0));
    float strands = fbm(p*vec2(1.4, 2.1) + vec2(t*0.28, uSeed*0.6));

    // Soft, uneven contour instead of a horizontal transparent rectangle.
    float broken = smoothstep(0.39, 0.66, large*0.79 + strands*0.35);
    float horizontal = smoothstep(0.0, 0.075, uv.x)
      * (1.0 - smoothstep(0.925, 1.0, uv.x));
    float vertical = smoothstep(0.04, 0.35, uv.y)
      * (1.0-smoothstep(0.67, 0.99, uv.y));
    float lowVeil = 0.21 * exp(-pow((uv.y-0.29)/0.26, 2.0));
    float opacity = uOpacity * (broken*0.83 + lowVeil)
      * horizontal*vertical;

    vec3 shade = mix(uTint, uHighlight,
      smoothstep(0.34, 0.80, large) * 0.43
      + (1.0-uv.y) * 0.12);
    gl_FragColor = vec4(shade, clamp(opacity, 0.0, 0.24));
  }
`;

const LAYERS = Object.freeze([
  { z: -119, y: -4.0, width: 235, height: 21, opacity: 0.34,
    tint: '#536e95', highlight: '#9fabc9', seed: 4.2 },
  { z: -97, y: -5.1, width: 232, height: 16, opacity: 0.29,
    tint: '#426a81', highlight: '#8caab7', seed: 11.8 },
  { z: -77, y: -6.5, width: 224, height: 14, opacity: 0.25,
    tint: '#366574', highlight: '#7eacac', seed: 17.4 },
  { z: -48, y: -5.4, width: 208, height: 10, opacity: 0.18,
    tint: '#315a6a', highlight: '#699a9a', seed: 29.2 }
]);

/**
 * @returns {{update:(seconds:number)=>void, dispose:()=>void, count:number}}
 */
export function createCinematicAtmosphere(THREE, scene, options = {}) {
  if (options.enabled === false) return { update() {}, dispose() {}, count: 0 };
  const layers = [];
  const isMobile = options.mobile === true;
  const configs = isMobile ? LAYERS.filter((_, i) => i === 1 || i === 2) : LAYERS;

  for (const config of configs) {
    const geom = new THREE.PlaneGeometry(config.width, config.height, 1, 1);
    const mat = new THREE.ShaderMaterial({
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      fog: false,
      side: THREE.FrontSide,
      uniforms: {
        uTime: { value: 0 },
        uOpacity: { value: config.opacity },
        uSeed: { value: config.seed },
        uTint: { value: new THREE.Color(config.tint) },
        uHighlight: { value: new THREE.Color(config.highlight) }
      }
    });
    const mesh = new THREE.Mesh(geom, mat);
    mesh.name = 'Atmospheric depth / ' + Math.abs(config.z);
    mesh.position.set(0, config.y, config.z);
    mesh.frustumCulled = false;
    scene.add(mesh);
    layers.push({ mesh, geom, mat });
  }

  return {
    count: layers.length,
    update(seconds) {
      const t = Number.isFinite(seconds) ? seconds : 0;
      for (const layer of layers) layer.mat.uniforms.uTime.value = t;
    },
    dispose() {
      for (const layer of layers) {
        scene.remove(layer.mesh);
        layer.geom.dispose();
        layer.mat.dispose();
      }
    }
  };
}
