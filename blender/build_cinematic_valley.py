"""Gongang 2D: original Blender-authored cinematic valley.

Run from the repository root:
  blender --background --python blender/build_cinematic_valley.py
Outputs editable .blend, a GLB for Three.js, and a night art-direction preview.
All geometry is built in Blender, never sampled from a photograph or copied asset.
Compatible with Blender 3.6+ (Cycles preview, glTF 2.0 export).
"""
from pathlib import Path
import bpy
import math
import random
import sys
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "blender" / "output"
MODEL = ROOT / "public" / "assets" / "models" / "blender-cinematic-valley.glb"
OUT.mkdir(parents=True, exist_ok=True)
MODEL.parent.mkdir(parents=True, exist_ok=True)
random.seed(26261117)
TAU = math.tau

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
world_collection = bpy.data.collections.new("01 | The Living Valley")
scene.collection.children.link(world_collection)
library_collection = bpy.data.collections.new("02 | Reusable botanical masters")
scene.collection.children.link(library_collection)
preview_collection = bpy.data.collections.new("03 | Studio only")
scene.collection.children.link(preview_collection)
palette = {}

def material(name, color, roughness=0.9, metallic=0.0):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*color, 1)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*color, 1)
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    palette[name] = m
    return m

earth = material("Sculpted earth | shadow sea-green", (.092, .21, .23))
bark = material("Pine bark | deep sienna", (.10, .095, .115))
bark_lit = material("Pine bark | moonlit edges", (.16, .17, .19))
needle = [material("Conifer needles %02d" % i, c) for i, c in enumerate([
    (.035, .16, .19), (.075, .24, .255), (.11, .30, .31), (.17, .38, .36), (.08, .22, .28)
])]
leaf = [material("Broadleaf velvet %02d" % i, c) for i, c in enumerate([
    (.05, .17, .19), (.08, .23, .24), (.14, .31, .30), (.20, .38, .33)
])]
stone = [material("Wet layered stone %02d" % i, c) for i,c in enumerate([
    (.14,.20,.245),(.21,.27,.29),(.31,.35,.36),(.11,.18,.23)
])]
grass = [material("Grass blade %02d" % i, c) for i,c in enumerate([
    (.07,.21,.24),(.14,.30,.31),(.21,.36,.32),(.28,.39,.34)
])]
water = material("Silent mirror | cold deep lake", (.055,.18,.24), .18, .16)

def deterministic_hash(x, y, seed=0):
    k = int(x)*374761393 + int(y)*668265263 + seed*1442695041
    k = (k ^ (k >> 13))*1274126177
    return ((k ^ (k >> 16)) & 0xffffffff)/4294967295.0

def noise(x, y, seed=0):
    xi, yi = math.floor(x), math.floor(y)
    xf, yf = x-xi, y-yi
    sx, sy = xf*xf*(3-2*xf), yf*yf*(3-2*yf)
    a = deterministic_hash(xi,yi,seed)*(1-sx)+deterministic_hash(xi+1,yi,seed)*sx
    b = deterministic_hash(xi,yi+1,seed)*(1-sx)+deterministic_hash(xi+1,yi+1,seed)*sx
    return (a*(1-sy)+b*sy)*2-1

def fbm(x,y,seed=0):
    v=0.0
    for i,w in enumerate((.55,.26,.13,.06)):
        v += noise(x*(1.9**i),y*(1.9**i),seed+i*39)*w
    return v

def river_center(depth):
    return 5.1*math.sin(depth*.037+.4)+2.2*math.sin(depth*.089+1.3)

def height(x, y):
    depth = max(0, -y)
    center = river_center(depth)
    left_right = abs(x-center)
    width = 7.8 + depth*.085
    bank = max(0.0,(left_right-width)/24)
    # Natural asymmetry: split ridge masses on both sides, never mirror them.
    shelf = -3.8 + .37*fbm(x*.14,y*.12,41)
    near = max(0.0,min(1.0,(y+21)/36))
    hillside = 17.0*(1-math.exp(-bank*bank*.66))
    far_rise = 14.0*min(1.0,depth/215)**.9
    ridge = 4.1*fbm(x*.062,y*.041,8)+2.6*fbm(x*.15,y*.09,73)
    spires = (max(0.0,noise(x*.052,y*.038,130))**2.8)*10.0
    split = 1.8*math.sin(x*.083+depth*.019)+2.8*math.sin(x*.031-depth*.054)
    high = shelf + hillside + far_rise + ridge*(.3+.7*(1-near)) + spires*(1-near) + split*(1-near)
    # Keep the shared multiplayer resting terrace open and almost level.
    clearing = max(0.0,1-abs(x)/24)**2 * max(0.0,1-abs(y-4)/31)**2
    high = high*(1-.97*clearing)+shelf*.97*clearing
    # Meandering deep river is recessed rather than pasted on the terrain.
    channel = math.exp(-(left_right/(1.4+depth*.015))**2)
    high -= channel*(.34+min(1.1,depth*.005))
    return high

def object_from_mesh(name, vertices, faces, mats, face_mats=None, collection=world_collection):
    me = bpy.data.meshes.new(name + " mesh")
    me.from_pydata(vertices, [], faces)
    me.update()
    obj = bpy.data.objects.new(name, me)
    collection.objects.link(obj)
    for m in mats: me.materials.append(m)
    if face_mats:
        for p, idx in zip(me.polygons, face_mats):
            p.material_index = idx
    for p in me.polygons: p.use_smooth = True
    return obj

def build_land():
    # A continuous terrain sculpt; no disjoint V-shaped polygon walls.
    nx,ny = 193,153
    vx, faces, col = [], [], []
    for j in range(ny):
        y = 42.0 - j*304.0/(ny-1)
        for i in range(nx):
            x = -140.0+i*280/(nx-1)
            vx.append((x,y,height(x,y)))
    for j in range(ny-1):
        for i in range(nx-1):
            a=j*nx+i; faces.append((a,a+1,a+nx+1,a+nx))
    obj=object_from_mesh("Terrain | one uninterrupted sculpt",vx,faces,[earth])
    colors=obj.data.vertex_colors.new(name="GongangTerrainColor")
    for poly in obj.data.polygons:
        for loop_idx in poly.loop_indices:
            vertex=obj.data.vertices[obj.data.loops[loop_idx].vertex_index].co
            x,y,z=vertex; d=max(0,-y)
            n=fbm(x*.07,y*.08,17)
            p=fbm(x*.31,y*.29,91)
            distant=min(1,d/240)
            stony=max(0,min(1,(z-3)/20))
            r=.105+.065*stony+.052*p+.04*distant
            g=.215+.09*n+.08*stony+.048*distant
            b=.205+.07*n+.07*distant+.022*p
            colors.data[loop_idx].color=(max(.02,r),max(.035,g),max(.04,b),1)
    return obj

def add_ellipsoid(v,f,mids,center,scale,mat_idx,segments=7):
    # Hand-shaped overlapping tapered clumps: never stacked cones.
    x,y,z=center; sx,sy,sz=scale
    start=len(v)
    v.append((x,y,z+sz))
    for ring,zfac,rfac in ((0,.56,.72),(1,0,1),(2,-.62,.73)):
        for k in range(segments):
            t=TAU*k/segments+.17*ring
            irregular=1+.13*math.sin(k*2.1+ring*3.3)
            v.append((x+math.cos(t)*sx*rfac*irregular,
                      y+math.sin(t)*sy*rfac*irregular,
                      z+sz*zfac))
    end=len(v);v.append((x,y,z-sz))
    for k in range(segments):
        f.append((start,start+1+k,start+1+(k+1)%segments));mids.append(mat_idx)
    for ring in range(2):
        for k in range(segments):
            a=start+1+ring*segments+k
            b=start+1+ring*segments+(k+1)%segments
            c=a+segments; d=b+segments
            f.append((a,b,d,c));mids.append(mat_idx)
    for k in range(segments):
        a=start+1+2*segments+k;b=start+1+2*segments+(k+1)%segments
        f.append((a,b,end));mids.append(mat_idx)

def add_tapered_segment(v,f,mids,start,end,r0,r1,mat_idx,sides=6):
    va=Vector(start);vb=Vector(end);axis=(vb-va).normalized()
    side=axis.cross(Vector((0,1,0)))
    if side.length<.01: side=axis.cross(Vector((1,0,0)))
    side.normalize();up=axis.cross(side).normalized()
    first=len(v)
    for center,radius in ((va,r0),(vb,r1)):
        for k in range(sides):
            t=TAU*k/sides
            p=center+radius*(side*math.cos(t)+up*math.sin(t))
            v.append(tuple(p))
    for k in range(sides):
        f.append((first+k,first+(k+1)%sides,first+sides+(k+1)%sides,first+sides+k))
        mids.append(mat_idx)

def create_pine(variant):
    r=random.Random(2100+variant*71)
    v=[];f=[];m=[]
    h=6.2+variant*.8
    add_tapered_segment(v,f,m,(0,0,0),(.10,.04,h),.26,.055,0,9)
    for tier in range(10):
        z=.72+tier*(h-.95)/10
        radius=(1-tier/11)**1.15*(2.15+.15*variant)
        arms=5+(tier%3)
        for k in range(arms):
            angle=TAU*(k+(tier%2)*.46)/arms+r.uniform(-.12,.12)
            length=radius*r.uniform(.72,1.15)
            ux,uy=math.cos(angle),math.sin(angle)
            tip=(ux*length,uy*length,z+.14+length*.21)
            add_tapered_segment(v,f,m,(0,0,z),(ux*length*.9,uy*length*.9,tip[2]),.073,.018,0,5)
            for j in (1,2,3):
                q=j/3
                pos=(ux*length*q,uy*length*q,z+q*(tip[2]-z))
                spread=.29+(.37 if j==2 else .18)*(1-tier/12)
                add_ellipsoid(v,f,m,pos,(spread,spread*.78,.36+.1*(1-tier/12)),
                              2+r.randrange(4),6)
    obj=object_from_mesh("PINE_MASTER_%d"%variant,v,f,[bark,bark_lit]+needle,m,library_collection)
    obj.hide_render=True
    return obj

def create_broadleaf(variant):
    r=random.Random(459+variant)
    v=[];f=[];m=[]
    h=7.5+variant*.6
    trunk=(0.6 if variant else -.6,.2,h)
    add_tapered_segment(v,f,m,(0,0,0),trunk,.46,.12,0,11)
    for limb in range(11):
        angle=TAU*limb/11+r.uniform(-.17,.17)
        distance=2.0+r.random()*2.7
        z=h*(.62+r.random()*.27)
        x=trunk[0]+math.cos(angle)*distance
        y=math.sin(angle)*distance
        add_tapered_segment(v,f,m,(trunk[0]*.5,0,z-.7),(x,y,z),.14,.03,0,6)
        for k in range(5):
            px=x+r.uniform(-1.4,1.4);py=y+r.uniform(-1.1,1.1)
            pz=z+r.uniform(-.9,1.6)
            add_ellipsoid(v,f,m,(px,py,pz),
                          (1.0+r.random()*.65,.72+r.random()*.5,.65+r.random()*.65),
                          2+r.randrange(4),8)
    obj=object_from_mesh("BROADLEAF_MASTER_%d"%variant,v,f,[bark,bark_lit]+leaf,m,library_collection)
    obj.hide_render=True
    return obj

def scatter_forest():
    masters=[create_pine(i) for i in range(3)]
    broad=[create_broadleaf(i) for i in range(2)]
    count=0
    rng=random.Random(20261117)
    for i in range(258):
        y=rng.uniform(-240,16)
        x=rng.uniform(-121,121)
        d=max(0,-y)
        if abs(x-river_center(d))<10+d*.105:continue
        if -19<y<28 and abs(x)<24:continue
        if rng.random() < max(0,1-abs(x)/100)*.19:continue
        master=(broad[rng.randrange(len(broad))] if rng.random()<.10
                else masters[rng.randrange(len(masters))])
        obj=bpy.data.objects.new("Forest | linked tree %03d"%i, master.data)
        world_collection.objects.link(obj)
        size=(.75+rng.random()*.85)*(1.0 if y< -80 else 1.30)
        if master in broad: size*=1.10
        obj.location=(x,y,height(x,y)-.15)
        obj.scale=(size,size,size*(.89+rng.random()*.3))
        obj.rotation_euler=(rng.uniform(-.045,.045),0,rng.random()*TAU)
        count+=1
    # Distinct framing silhouettes to make the image read at phone size.
    for x,y,scale,master in [
        (-37,21,2.8,broad[0]),(42,20,3.0,broad[1]),
        (-56,-9,2.0,masters[1]),(57,-14,2.25,masters[2])]:
        obj=bpy.data.objects.new("Foreground hero tree",master.data)
        world_collection.objects.link(obj)
        obj.location=(x,y,height(x,y)-.45)
        obj.scale=(scale,scale,scale)
        obj.rotation_euler[2]=rng.random()*TAU
    return count

def scatter_rocks():
    rng=random.Random(7123)
    v=[];f=[];m=[]
    for i in range(135):
        x=rng.uniform(-114,114);y=rng.uniform(-202,30)
        if -18<y<26 and abs(x)<22:continue
        z=height(x,y)
        radius=(.28+rng.random()*1.15)*(1+.65*(y>0))
        bx=len(v)
        # Asymmetric low-poly strata, buried below terrain for natural contact.
        sides=8
        for ring,rr,zz in ((0,.55,-.30),(1,1,.0),(2,.73,.6),(3,.17,.93)):
            for k in range(sides):
                t=TAU*k/sides
                jitter=1+rng.uniform(-.19,.19)
                v.append((x+math.cos(t)*radius*rr*jitter,
                          y+math.sin(t)*radius*.73*rr*jitter,
                          z+zz*radius*.60))
        mi=rng.randrange(4)
        for ring in range(3):
            for k in range(sides):
                a=bx+ring*sides+k;b=bx+ring*sides+(k+1)%sides
                f.append((a,b,b+sides,a+sides));m.append(mi)
    object_from_mesh("Rock field | independently eroded strata",v,f,stone,m)

def meadow():
    rng=random.Random(34783)
    v=[];f=[];m=[]
    for n in range(1100):
        x=rng.uniform(-70,70);y=rng.uniform(-17,39)
        if abs(x)<18 and -5<y<23 and rng.random()<.76:continue
        z=height(x,y)+.07
        ht=.25+rng.random()*.86
        direction=rng.random()*TAU
        for k in range(3):
            ang=direction+k*TAU/3+rng.uniform(-.22,.22)
            dx,dy=math.cos(ang),math.sin(ang)
            base=len(v)
            width=.03+.036*rng.random()
            sway=(.13+.18*rng.random())*ht
            v.extend(((x-dy*width,y+dx*width,z),
                      (x+dy*width,y-dx*width,z),
                      (x+dx*sway,y+dy*sway,z+ht)))
            f.append((base,base+1,base+2));m.append(rng.randrange(4))
    obj=object_from_mesh("Meadow | individually rooted blades",v,f,grass,m)
    for p in obj.data.polygons:p.use_smooth=False

def river():
    v=[];f=[]
    for i in range(230):
        y=-249+i*1.03
        d=max(0,-y)
        cx=river_center(d)
        half=1.12+d*.013
        for side in (-1,1):
            x=cx+side*half
            v.append((x,y,height(x,y)+.13))
        if i>0:
            a=(i-1)*2
            f.append((a,a+1,a+3,a+2))
    obj=object_from_mesh("River | true sculpted winding ribbon",v,f,[water])
    for p in obj.data.polygons:p.use_smooth=True

def add_light(kind,name,location,energy,color,size):
    bpy.ops.object.light_add(type=kind,location=location)
    obj=bpy.context.object;obj.name=name
    obj.data.energy=energy;obj.data.color=color
    if kind=="AREA":obj.data.shape="DISK";obj.data.size=size
    for collection in list(obj.users_collection):collection.objects.unlink(obj)
    preview_collection.objects.link(obj)
    return obj

def studio():
    bpy.ops.object.camera_add(location=(0,42,13))
    camera=bpy.context.object;camera.name="Editorial camera | landscape"
    target=Vector((0,-65,5.5))
    camera.rotation_euler=(target-camera.location).to_track_quat("-Z","Y").to_euler()
    camera.data.type="ORTHO";camera.data.ortho_scale=55
    scene.camera=camera
    for collection in list(camera.users_collection):collection.objects.unlink(camera)
    preview_collection.objects.link(camera)
    add_light("AREA","Moon | giant soft source",(34,-28,65),9000,(.57,.74,1),38)
    add_light("AREA","Cold sky | rim",(-43,-125,82),7000,(.22,.65,.81),65)
    add_light("AREA","Rose haze | far valley",(80,-180,48),4200,(.87,.35,.66),65)
    world=bpy.data.worlds.new('Gongang | expansive atmosphere')
    scene.world=world
    world.use_nodes=True
    bg=world.node_tree.nodes.get("Background")
    bg.inputs["Color"].default_value=(.015,.028,.070,1)
    bg.inputs["Strength"].default_value=.48
    scene.render.engine="CYCLES"
    scene.cycles.samples=16
    # Ubuntu's Blender package may ship without OpenImageDenoise.
    for view_layer in scene.view_layers:
        view_layer.cycles.use_denoising = False
    scene.render.resolution_x=1600
    scene.render.resolution_y=900
    scene.render.resolution_percentage=100
    scene.render.image_settings.file_format="PNG"
    scene.render.filepath=str(OUT/"cinematic-valley-night.png")
    scene.render.film_transparent=False
    scene.view_settings.view_transform="AgX" if bpy.app.version>=(4,0,0) else "Filmic"
    scene.camera.data.lens=55

print("Sculpting uninterrupted terrain...")
build_land()
print("Building botanical meshes...")
number_of_trees=scatter_forest()
scatter_rocks()
meadow()
river()
studio()

# Save with models reusable and lights/camera editable in Blender.
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/"gongang-cinematic-valley.blend"))
print("Saved editable scene; woodland count:",number_of_trees)

# Export only the actual visible world, excluding hidden tree masters,
# studio lights, and preview camera. Blender converts its Z-up to glTF Y-up.
bpy.ops.object.select_all(action="DESELECT")
for obj in world_collection.objects:
    if obj.type=="MESH":obj.select_set(True)
bpy.context.view_layer.objects.active=next(o for o in world_collection.objects if o.type=="MESH")
bpy.ops.export_scene.gltf(filepath=str(MODEL),export_format="GLB",
                          use_selection=True,export_yup=True,
                          export_materials="EXPORT",export_cameras=False,
                          export_lights=False)
print("Exported website mesh:",MODEL,MODEL.stat().st_size)

if "--render" in sys.argv:
    # Only the web-independent preview is raytraced; web light stays realtime.
    bpy.ops.render.render(write_still=True)
    print("Rendered original Blender scene:",scene.render.filepath)
