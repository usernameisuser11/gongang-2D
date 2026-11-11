/**
 * Layered 2.5D atmospheric scattering.
 * Mobile-friendly transparent GPU planes between actual Three.js hills.
 * Fog moves with wind and changes color/intensity with time and weather.
 * No static panorama, no giant flat opaque white fog rectangles.
 */
const VS=`
varying vec2 vUv;
void main(){
  vUv=uv;
  gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);
}`;
const FS=`
precision mediump float;
varying vec2 vUv;
uniform float uTime,uWind,uDay,uTwilight,uStorm,uLayer;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){
 vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
 return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),
   mix(hash(i+vec2(0.,1.)),hash(i+1.),f.x),f.y);
}
float fbm(vec2 p){
 float a=.5,v=0.;
 for(int k=0;k<3;k++){v+=a*noise(p);p=p*2.01+vec2(6.3,11.7);a*=.5;}
 return v;
}
void main(){
 vec2 uv=vUv;
 float drift=uTime*(.00010+.00008*clamp(uWind,0.,2.));
 float n=fbm(vec2(uv.x*6.3+drift+uLayer*13.1,uv.y*2.1));
 float wisps=fbm(vec2(uv.x*16.2-drift*.73,uv.y*3.2+uLayer*9.));
 float band=exp(-pow((uv.y-.44-(n-.50)*.20)/.27,2.));
 float soft=smoothstep(0.,.14,uv.y)*(1.-smoothstep(.79,1.,uv.y));
 float alpha=band*soft*(.24+.67*n+.14*wisps);
 alpha*=.16+.085*uStorm+.105*uTwilight;
 alpha*=smoothstep(0.,.08,uv.x)*(1.-smoothstep(.92,1.,uv.x));
 vec3 night=vec3(.070,.19,.34);
 vec3 day=vec3(.38,.66,.75);
 vec3 dusk=vec3(.27,.49,.79);
 vec3 col=mix(night,day,uDay);
 col=mix(col,dusk,clamp(uTwilight*.88,0.,.88));
 gl_FragColor=vec4(col,alpha);
}`;

import { parallaxShift } from '/parallax-25d.js';

export function createAtmosphericDepth25D(THREE,scene){
  const sheets=[];
  const layers=[
    {z:-137,y:-15.2,h:12.5,w:150,phase:.1},
    {z:-117,y:-15.0,h:13.6,w:146,phase:.8},
    {z:-101,y:-14.2,h:12.7,w:140,phase:1.4},
    {z:-85,y:-14.8,h:14.4,w:132,phase:2.2},
    {z:-68,y:-14.1,h:10.2,w:120,phase:3.0}
  ];
  layers.forEach((layer,i)=>{
    const geo=new THREE.PlaneGeometry(layer.w,layer.h);
    const uniforms={
      uTime:{value:0},uWind:{value:.2},uDay:{value:0},
      uTwilight:{value:0},uStorm:{value:0},uLayer:{value:layer.phase}
    };
    const material=new THREE.ShaderMaterial({
      vertexShader:VS,fragmentShader:FS,uniforms,
      transparent:true,depthWrite:false,depthTest:true,fog:false,
      side:THREE.DoubleSide,blending:THREE.NormalBlending
    });
    const mesh=new THREE.Mesh(geo,material);
    mesh.position.set(0,layer.y,layer.z);
    mesh.renderOrder=1;
    mesh.name='Animated atmospheric depth '+i;
    mesh.frustumCulled=false;
    scene.add(mesh);
    sheets.push({mesh,uniforms,baseX:mesh.position.x,baseY:mesh.position.y});
  });
  return{
    count:sheets.length,
    applyParallax(view){
      for(const sheet of sheets){
        const shift=parallaxShift(view,sheet.mesh.position.z);
        sheet.mesh.position.x=sheet.baseX+shift.x;
        sheet.mesh.position.y=sheet.baseY+shift.y;
      }
    },
    update(seconds,env){
      for(const sheet of sheets){
        sheet.uniforms.uTime.value=seconds;
        sheet.uniforms.uWind.value=env.wind;
        sheet.uniforms.uDay.value=env.daylight;
        sheet.uniforms.uTwilight.value=env.twilight;
        sheet.uniforms.uStorm.value=Math.max(env.rain,env.snow,env.cloud*.35);
      }
    },
    dispose(){
      for(const sheet of sheets){
        scene.remove(sheet.mesh);
        sheet.mesh.geometry.dispose();
        sheet.mesh.material.dispose();
      }
    }
  };
}
