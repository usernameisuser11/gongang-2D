/**
 * The shared actual world elevation of the small sit-friendly foreground.
 * All ground vertices and contact shadows query this identical heightfield.
 */
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const smooth=(a,b,v)=>{
 const t=clamp((v-a)/(b-a));
 return t*t*(3-2*t);
};
const fract=x=>x-Math.floor(x);
const hash=(x,n)=>fract(Math.sin(x*127.1+n*311.7)*43758.5453123);
const noise=(x,n)=>{
 let i=Math.floor(x),f=fract(x);
 f=f*f*(3-2*f);
 return (hash(i,n)*(1-f)+hash(i+1,n)*f)*2-1;
};
export function overlookGroundHeight(x,localZ){
 const edge=smooth(12,92,Math.abs(x));
 return -6.80-.92*smooth(11,40,Math.abs(x))
   +.055*noise(x*.28+localZ*.22,19)
   -.32*edge-.20*noise(x*.035+localZ*.06,19);
}
