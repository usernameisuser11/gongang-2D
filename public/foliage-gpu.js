/* Seam-free instanced 2D plant meshes. WebGL2 is optional; callers provide
   their own static Canvas2D fallback when the GPU is unavailable. */
(() => {
 'use strict';
 function create(img,plants){
   const c=document.createElement('canvas'),scale=.80;
   c.width=Math.floor(1672*scale);c.height=Math.floor(941*scale);
   const gl=c.getContext('webgl2',{alpha:true,premultipliedAlpha:false,
     preserveDrawingBuffer:true,depth:false,antialias:true});
   if(!gl)return null;
   const vert=String.raw`#version 300 es
precision highp float;
in vec2 corner;
in vec4 place;
in vec4 style;
in vec4 extra;
out vec2 uv;
out float alpha;
uniform float time;
float breeze(float t,float x,float phase){
 float front=sin(t*.88-x*.0081);
 float pulse=pow(max(0.,sin(t*.35-x*.0032+.65)),3.);
 float flutter=.19*sin(t*1.71+x*.012+phase);
 float breathing=.73+.20*sin(t*.19+1.2)+.09*sin(t*.43-.8);
 return (.27+front*.63+pulse*.42+flutter)*clamp(breathing,.40,1.04);
}
void main(){
 float q=corner.y;
 float bend=style.z*extra.x*pow(q,1.55)*
   breeze(time-q*.34,place.x,style.w)*extra.y;
 vec2 a=vec2(corner.x*place.z+bend,-q*place.w);
 float cs=cos(extra.z),sn=sin(extra.z);
 vec2 p=place.xy+vec2(a.x*cs-a.y*sn,a.x*sn+a.y*cs);
 gl_Position=vec4(2.0*p.x/1672.0-1.0,1.0-2.0*p.y/941.0,0.,1.);
 uv=vec2((style.x+corner.x+.5)/5.0,1.0-q);
 alpha=style.y;
}`;
   const frag=String.raw`#version 300 es
precision mediump float;
uniform sampler2D tex;
in vec2 uv;
in float alpha;
out vec4 outColor;
void main(){
 vec4 px=texture(tex,uv);
 outColor=vec4(px.rgb,px.a*alpha);
}`;
   function shader(type,source){
     const s=gl.createShader(type);
     gl.shaderSource(s,source);gl.compileShader(s);
     if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))
       throw Error(gl.getShaderInfoLog(s));
     return s;
   }
   const program=gl.createProgram();
   gl.attachShader(program,shader(gl.VERTEX_SHADER,vert));
   gl.attachShader(program,shader(gl.FRAGMENT_SHADER,frag));
   gl.linkProgram(program);
   if(!gl.getProgramParameter(program,gl.LINK_STATUS))
     throw Error(gl.getProgramInfoLog(program));
   const vertices=[];
   for(let i=0;i<24;i++){
     const a=i/24,b=(i+1)/24;
     vertices.push(-.5,a,.5,a,-.5,b,.5,a,.5,b,-.5,b);
   }
   const vao=gl.createVertexArray();gl.bindVertexArray(vao);
   let buf=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buf);
   gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(vertices),gl.STATIC_DRAW);
   const loc=gl.getAttribLocation(program,'corner');
   gl.enableVertexAttribArray(loc);
   gl.vertexAttribPointer(loc,2,gl.FLOAT,false,0,0);
   const attrs=new Float32Array(plants.length*12);
   plants.forEach((p,i)=>attrs.set([
     p.x,p.rootY,p.width,p.height,p.variant,p.alpha,p.amplitude,p.phase,
     p.stiffness,p.direction,p.angle||0,0
   ],i*12));
   buf=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buf);
   gl.bufferData(gl.ARRAY_BUFFER,attrs,gl.STATIC_DRAW);
   ['place','style','extra'].forEach((name,i)=>{
     const location=gl.getAttribLocation(program,name);
     gl.enableVertexAttribArray(location);
     gl.vertexAttribPointer(location,4,gl.FLOAT,false,12*4,i*16);
     gl.vertexAttribDivisor(location,1);
   });
   const texture=gl.createTexture();gl.activeTexture(gl.TEXTURE0);
   gl.bindTexture(gl.TEXTURE_2D,texture);
   gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,false);
   gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,img);
   gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
   gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
   gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
   gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
   gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
   gl.useProgram(program);gl.uniform1i(gl.getUniformLocation(program,'tex'),0);
   gl.viewport(0,0,c.width,c.height);
   const uniform=gl.getUniformLocation(program,'time');
   return {canvas:c,draw(t){
     if(gl.isContextLost())throw Error('Foliage WebGL context lost');
     gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);
     gl.useProgram(program);gl.bindVertexArray(vao);
     gl.uniform1f(uniform,t);
     gl.drawArraysInstanced(gl.TRIANGLES,0,vertices.length/2,plants.length);
   }};
 }
 window.FoliageGPU={create};
})();