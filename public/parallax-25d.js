/**
 * Gongang — depth-calibrated 2.5D camera tracking.
 * Maps the existing shared world camera, touch drag and photo framing into
 * smooth parallax offsets. No fake time-based "scroll" loop and no image layers.
 * World geometry and its instanced trees remain native Three.js meshes.
 */
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const num=(v,fallback=0)=>Number.isFinite(v)?v:fallback;
export function parallaxInput(view={},viewport={width:1440,height:900}){
  const w=Math.max(300,num(viewport.width,1440));
  const h=Math.max(300,num(viewport.height,900));
  // World coordinates belong to Gongang's existing 0–3200 x 1510–1660 z.
  const walkX=clamp((num(view.x,1600)-1600)/1100,-1.3,1.3);
  const walkZ=clamp((num(view.z,1590)-1590)/95,-1.2,1.2);
  const panX=clamp(num(view.offsetX)/Math.min(w,1450),-.70,.70);
  const panY=clamp(num(view.offsetY)/Math.min(h,950),-.70,.70);
  const x=clamp(walkX-panX*1.65,-1.8,1.8);
  const y=clamp(walkZ+panY*1.15,-1.6,1.6);
  return {x,y,walkX,walkZ,panX,panY,photo:Boolean(view.photo)};
}
/** Natural differential displacement: far away mountains barely shift. */
export function parallaxFactor(depth){
  const z=num(depth,-150);
  const u=clamp((z+150)/185,0,1);
  return .026+.96*u*u;
}
/** Coordinate of a world-depth-layer relative to its original mesh origin. */
export function parallaxShift(view,depth){
  const strength=parallaxFactor(depth);
  return {
    x:-view.x*5.6*strength,
    y:-view.y*1.75*strength,
    strength
  };
}
