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

earth = material("Sculpted earth | shadow sea-green", (.18, .31, .27))
bark = material("Pine bark | deep sienna", (.10, .095, .115))
bark_lit = material("Pine bark | moonlit edges", (.16, .17, .19))
needle = [material("Conifer needles %02d" % i, c) for i, c in enumerate([
    (.045, .16, .17), (.08, .23, .22), (.12, .29, .25), (.16, .34, .27), (.11, .20, .30)
])]
leaf = [material("Broadleaf velvet %02d" % i, c) for i, c in enumerate([
    (.07, .19, .21), (.11, .27, .24), (.16, .33, .24), (.22, .37, .31)
])]
stone = [material("Wet layered stone %02d" % i, c) for i,c in enumerate([
    (.14,.20,.245),(.21,.27,.29),(.31,.35,.36),(.11,.18,.23)
])]
grass = [material("Grass blade %02d" % i, c) for i,c in enumerate([
    (.08,.20,.18),(.13,.27,.21),(.18,.30,.24),(.23,.35,.26)
])]
water = material("Silent mirror | cold deep lake", (.055,.18,.24), .18, .16)
wildflower = [material("Wildflower petals %02d" % i, color) for i,color in enumerate([
    (.45,.59,.78), (.55,.46,.71), (.73,.56,.72), (.66,.73,.78), (.35,.54,.62)
])]
flower_core = material("Wildflower center | pale amber", (.69,.57,.29))
fern_leaf = [material("Fern fronds %02d" % i, col) for i,col in enumerate([
    (.07,.19,.20),(.10,.26,.24),(.14,.31,.29),(.18,.34,.28)
])]

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
    hillside = 11.5*(1-math.exp(-bank*bank*.63))
    far_rise = 8.7*min(1.0,depth/215)**.9
    ridge = 3.7*fbm(x*.062,y*.041,8)+1.5*fbm(x*.15,y*.09,73)
    spires = (max(0.0,noise(x*.052,y*.038,130))**2.8)*4.5
    split = 1.1*math.sin(x*.083+depth*.019)+1.8*math.sin(x*.031-depth*.054)
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
    colors=obj.data.vertex_colors.new(name="Color")
    for poly in obj.data.polygons:
        for loop_idx in poly.loop_indices:
            vertex=obj.data.vertices[obj.data.loops[loop_idx].vertex_index].co
            x,y,z=vertex; d=max(0,-y)
            n=fbm(x*.07,y*.08,17)
            p=fbm(x*.31,y*.29,91)
            distant=min(1,d/240)
            stony=max(0,min(1,(z-3)/20))
            r=.18+.062*stony+.055*p+.055*distant
            g=.30+.085*n+.065*stony+.043*distant
            b=.25+.055*n+.10*distant+.025*p
            colors.data[loop_idx].color=(max(.02,r),max(.035,g),max(.04,b),1)
    # Vertex colors survive the glTF roundtrip: no static panorama texture.
    bsdf=earth.node_tree.nodes.get("Principled BSDF")
    attr=earth.node_tree.nodes.new("ShaderNodeVertexColor")
    attr.layer_name="Color"
    earth.node_tree.links.new(attr.outputs["Color"],bsdf.inputs["Base Color"])
    return obj

def add_tapered_segment(v,f,mids,start,end,r0,r1,mat_idx,sides=7):
    va=Vector(start);vb=Vector(end);axis=(vb-va).normalized()
    side=axis.cross(Vector((0,1,0)))
    if side.length<.01:side=axis.cross(Vector((1,0,0)))
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

def add_lance_leaf(v,f,mids,origin,direction,length,width,mat_idx,curl=0.0):
    """A curved, asymmetric leaf with a narrow petiole and a pointed tip.
    Actual 3D geometry; no alpha cards, sprites, texture billboards or cones.
    """
    base=Vector(origin)
    d=Vector(direction).normalized()
    lateral=d.cross(Vector((0,0,1)))
    if lateral.length<.06:lateral=d.cross(Vector((1,0,0)))
    lateral.normalize()
    upwards=Vector((0,0,1))
    center=base+d*(length*.52)+upwards*curl
    left=center+lateral*width*.53
    right=center-lateral*width*.43
    tip=base+d*length+upwards*(curl*.65)
    root_left=base+d*(length*.12)+lateral*width*.14
    root_right=base+d*(length*.12)-lateral*width*.12
    first=len(v)
    v.extend((tuple(base),tuple(root_left),tuple(left),
              tuple(tip),tuple(right),tuple(root_right)))
    f.extend(((first,first+1,first+2),(first,first+2,first+5),
              (first+2,first+3,first+4),(first+2,first+4,first+5)))
    mids.extend((mat_idx,mat_idx,mat_idx,mat_idx))

def create_pine(variant):
    """Botanical fir: individually shaped trailing sprays instead of balloon tiers."""
    r=random.Random(2100+variant*71)
    v=[];f=[];m=[]
    h=7.7+variant*.8
    lean=(r.uniform(-.30,.30),r.uniform(-.27,.27))
    add_tapered_segment(v,f,m,(0,0,0),(lean[0],lean[1],h),.30,.052,0,9)
    tiers=17+variant
    for tier in range(tiers):
        t=tier/tiers
        z=.78+t*(h-.85)
        radius=(1.0-t)**1.08*(2.65+.14*variant)
        arms=8+(tier%3)
        for k in range(arms):
            angle=TAU*(k+(tier%2)*.41)/arms+r.uniform(-.11,.11)
            ux,uy=math.cos(angle),math.sin(angle)
            length=radius*r.uniform(.76,1.17)
            tip=(lean[0]*t+ux*length,lean[1]*t+uy*length,
                 z-.34*(1-t)+.10*length)
            add_tapered_segment(v,f,m,(lean[0]*t,lean[1]*t,z),tip,
                                .075*(1-t)+.025,.009,0,5)
            lateral=(-uy,ux)
            for j in range(3):
                q=(j+.55)/3.5
                base=Vector((lean[0]*t+ux*length*q,
                             lean[1]*t+uy*length*q,
                             z+q*(tip[2]-z)))
                for leaf_id in range(6):
                    side=(leaf_id-2.5)/2.5
                    sweep=(.37+.42*(1-t))*(1-.35*q)
                    direction=Vector((ux*(.68+.18*r.random())+
                                      lateral[0]*side*.65,
                                      uy*(.68+.18*r.random())+
                                      lateral[1]*side*.65,
                                      r.uniform(-.47,.30)+(t*.22)))
                    offset=Vector((lateral[0]*side*sweep,
                                   lateral[1]*side*sweep,
                                   r.uniform(-.13,.16)))
                    blade_len=(.52+.31*r.random())*(.56+.44*(1-t))
                    add_lance_leaf(v,f,m,base+offset,direction,
                                   blade_len,.13+.10*r.random(),
                                   2+r.randrange(len(needle)),
                                   .035+r.random()*.075)
    obj=object_from_mesh("PINE_MASTER_%d"%variant,v,f,
                         [bark,bark_lit]+needle,m,library_collection)
    obj.hide_render=True
    return obj

def create_broadleaf(variant):
    """Open sculpted crowns with individually curved leaves and visible branch structure."""
    r=random.Random(459+variant)
    v=[];f=[];m=[]
    h=7.2+variant*.85
    lean=(r.uniform(-.66,.66),r.uniform(-.48,.48))
    base=(0,0,0)
    bend=(lean[0]*.42,lean[1]*.35,h*.52)
    top=(lean[0],lean[1],h)
    add_tapered_segment(v,f,m,base,bend,.47,.31,0,10)
    add_tapered_segment(v,f,m,bend,top,.31,.12,0,9)
    for limb in range(13):
        angle=TAU*(limb+.16*r.random())/13
        ux,uy=math.cos(angle),math.sin(angle)
        length=(2.0+r.random()*2.6)*(1.0 if limb%3 else .77)
        z=h*(.58+r.random()*.32)
        root=Vector((lean[0]*.5,lean[1]*.5,z-.8))
        elbow=Vector((lean[0]+ux*length*.52,lean[1]+uy*length*.48,z+.22))
        tip=Vector((lean[0]+ux*length,lean[1]+uy*length,z+r.uniform(.15,1.35)))
        add_tapered_segment(v,f,m,root,elbow,.13,.075,0,6)
        add_tapered_segment(v,f,m,elbow,tip,.075,.013,0,5)
        for cluster in range(13):
            q=(cluster+.65)/14
            p=elbow.lerp(tip,q)
            for leaf_id in range(8):
                angle2=TAU*(leaf_id+r.random()*.28)/8
                vec=Vector((math.cos(angle2)*.82+ux*.23,
                            math.sin(angle2)*.82+uy*.23,
                            r.uniform(-.44,.48)))
                origin=p+Vector((r.uniform(-.22,.22),
                                 r.uniform(-.22,.22),
                                 r.uniform(-.28,.28)))
                add_lance_leaf(v,f,m,origin,vec,
                               .52+r.random()*.63,
                               .20+r.random()*.19,
                               2+r.randrange(len(leaf)),
                               r.uniform(.02,.16))
    obj=object_from_mesh("BROADLEAF_MASTER_%d"%variant,v,f,
                         [bark,bark_lit]+leaf,m,library_collection)
    obj.hide_render=True
    return obj

def scatter_forest():
    masters=[create_pine(i) for i in range(3)]
    broad=[create_broadleaf(i) for i in range(2)]
    count=0
    rng=random.Random(20261117)
    for i in range(224):
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
        (-37,21,2.3,broad[0]),(42,20,2.4,broad[1]),
        (-56,-9,1.75,masters[1]),(57,-14,1.85,masters[2]),
        (-18,22,1.16,broad[0]),(16,25,1.03,broad[1]),
        (-23,-7,1.12,masters[0]),(24,-10,.98,masters[1])]:
        obj=bpy.data.objects.new("Foreground hero tree",master.data)
        world_collection.objects.link(obj)
        obj.location=(x,y,height(x,y)-.45)
        obj.scale=(scale,scale,scale)
        obj.rotation_euler[2]=rng.random()*TAU
    # The portrait camera needs distinct silhouettes near its narrow viewport.
    # These are sculpted meshes, selectively shown only on mobile at runtime.
    for n,(x,y,size,master) in enumerate([
        (-8.2,30,2.04,broad[0]),
        (8.8,34,1.66,broad[1]),
        (-6.5,11,1.03,masters[0])
    ]):
        obj=bpy.data.objects.new("Portrait framing tree %02d"%n,master.data)
        world_collection.objects.link(obj)
        obj.location=(x,y,height(x,y)-.22)
        obj.scale=(size,size,size)
        obj.rotation_euler[2]=rng.uniform(-.3,.3)
    return count

def scatter_rocks():
    rng=random.Random(7123)
    v=[];f=[];m=[]
    for i in range(86):
        x=rng.uniform(-114,114);y=rng.uniform(-202,30)
        if -18<y<26 and abs(x)<22:continue
        z=height(x,y)
        radius=(.24+rng.random()*.68)*(1+.40*(y>0))
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
    for n in range(2150):
        x=rng.uniform(-70,70);y=rng.uniform(-17,39)
        if abs(x)<18 and -5<y<23 and rng.random()<.76:continue
        z=height(x,y)+.07
        ht=.29+rng.random()*.78
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

def sculpt_fern_groves():
    """Crescent-shaped, individually modeled fern sprays around the resting terrace."""
    r=random.Random(886103)
    v=[];f=[];m=[]
    for group in range(126):
        x=r.uniform(-37,37)
        y=r.uniform(11,41)
        if abs(x)<7 and y<30: continue
        if abs(x)<19 and y<21 and r.random()<.46:continue
        z=height(x,y)+.10
        direction=r.uniform(0,TAU)
        for k in range(12):
            angle=direction+TAU*k/12+r.uniform(-.12,.12)
            length=(.65+r.random()*1.4)*(1.3 if y>24 else 1)
            direction3=(math.cos(angle),math.sin(angle),.48+r.random()*.28)
            add_lance_leaf(v,f,m,(x+r.uniform(-.14,.14),
                                  y+r.uniform(-.14,.14),z),
                           direction3,length,.22+r.random()*.19,
                           r.randrange(len(fern_leaf)),.12+r.random()*.19)
    obj=object_from_mesh("Foreground ferns | swept leaf sculptures",v,f,fern_leaf,m)
    for face in obj.data.polygons:face.use_smooth=True

def flower_patches():
    """Small botanical accents, modeled as curved real petals and stems."""
    rng=random.Random(730021)
    v=[];f=[];materials=[]
    sources=grass[:2]+wildflower+[flower_core]
    for patch in range(39):
        px=rng.uniform(-76,76)
        py=rng.uniform(-17,39)
        # A rest area remains available to actual online visitors.
        if abs(px)<22 and -8<py<25:continue
        color_group=rng.randrange(len(wildflower))
        for n in range(rng.randint(7,16)):
            x=px+rng.gauss(0,2.6)
            y=py+rng.gauss(0,2.0)
            z=height(x,y)+.06
            h=rng.uniform(.45,1.13)
            tilt=rng.uniform(-.13,.13)
            head=(x+tilt,y+tilt*.63,z+h)
            base=len(v)
            # Two crossed blades form one narrow, organically leaning stem.
            v.extend(((x-.024,y,z),(x+.024,y,z),
                      (head[0]+.02,head[1],head[2])))
            f.append((base,base+1,base+2));materials.append(rng.randrange(2))
            radius=rng.uniform(.18,.34)
            petals=rng.choice((5,6,7))
            for k in range(petals):
                angle=TAU*(k+rng.uniform(-.09,.09))/petals
                dx,dy=math.cos(angle),math.sin(angle)
                tangent=(-dy,dx)
                tip=(head[0]+dx*radius,head[1]+dy*radius,head[2]+rng.uniform(-.03,.075))
                left=(head[0]+dx*radius*.55+tangent[0]*radius*.33,
                      head[1]+dy*radius*.55+tangent[1]*radius*.33,
                      head[2]+.035)
                right=(head[0]+dx*radius*.55-tangent[0]*radius*.33,
                       head[1]+dy*radius*.55-tangent[1]*radius*.33,
                       head[2]+.035)
                start=len(v)
                v.extend((head,left,tip,right))
                f.extend(((start,start+1,start+2),
                          (start,start+2,start+3)))
                shade=2+color_group if rng.random()<.8 else 2+rng.randrange(len(wildflower))
                materials.extend((shade,shade))
            base=len(v)
            rad=radius*.19
            v.append(head)
            for k in range(7):
                angle=TAU*k/7
                v.append((head[0]+math.cos(angle)*rad,
                          head[1]+math.sin(angle)*rad,
                          head[2]+.027))
            for k in range(7):
                f.append((base,base+1+k,base+1+(k+1)%7))
                materials.append(len(sources)-1)
    obj=object_from_mesh("Wildflowers | individually sculpted petals",v,f,sources,materials)
    for p in obj.data.polygons:p.use_smooth=False

def river():
    v=[];f=[]
    for i in range(230):
        y=-249+i*1.03
        d=max(0,-y)
        cx=river_center(d)
        half=.82+d*.009
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
sculpt_fern_groves()
flower_patches()
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
