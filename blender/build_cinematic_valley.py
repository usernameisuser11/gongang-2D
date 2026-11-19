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
bark = material("Pine bark | deep sienna", (.125, .105, .095))
bark_lit = material("Pine bark | moonlit edges", (.19, .155, .125))
needle = [material("Conifer needles %02d" % i, c) for i, c in enumerate([
    (.035, .12, .105), (.065, .19, .135), (.10, .24, .175),
    (.14, .29, .20), (.075, .17, .155)
])]
leaf = [material("Broadleaf velvet %02d" % i, c) for i, c in enumerate([
    (.085, .21, .15), (.14, .30, .19), (.20, .37, .23),
    (.28, .41, .27), (.18, .32, .20)
])]
stone = [material("Wet layered stone %02d" % i, c) for i,c in enumerate([
    (.14,.20,.245),(.21,.27,.29),(.31,.35,.36),(.11,.18,.23)
])]
grass = [material("Grass blade %02d" % i, c) for i,c in enumerate([
    (.08,.20,.18),(.13,.27,.21),(.18,.30,.24),(.23,.35,.26)
])]
water = material("Silent mirror | cold deep lake", (.055,.18,.24), .18, .16)
wet_silt = material("Riverbank | wet alluvial silt", (.105,.165,.158), .96)
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
    return (5.1*math.sin(depth*.037+.4)
            +2.2*math.sin(depth*.089+1.3)
            +.62*math.sin(depth*.147+.6))

def river_half_width(depth):
    # A gently widening watercourse, with the same center and banks at every
    # depth. Keep these dimensions shared by the terrain and the water mesh.
    return ((1.05+depth*.0095)
            *(1+.06*math.sin(depth*.058)+.032*math.sin(depth*.17+.8)))

def river_level(depth):
    # A river has a slowly descending water surface, not the jagged elevation
    # of the noisy hills it passes through. Depth increases upstream here.
    return -4.32+.033*depth+.16*math.sin(depth*.015)

def smoothstep(edge0,edge1,value):
    t=max(0.0,min(1.0,(value-edge0)/(edge1-edge0)))
    return t*t*(3-2*t)

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
    # Directional, irregular runoff scars. They follow downhill rather than
    # drawing equally spaced horizontal bands across the mountainsides.
    runoff_x=x+.9*math.sin(depth*.035+x*.044)+3.1*fbm(x*.025,y*.031,126)
    runoff=abs(math.sin(runoff_x*.27+depth*.014))
    gullies=(1-smoothstep(.06,.41,runoff))**2
    erosion=-1.35*gullies*(.35+.65*min(1.0,depth/145))
    erosion+=.24*fbm(x*.53,y*.42,319)
    spires = (max(0.0,noise(x*.052,y*.038,130))**2.8)*4.5
    split = 1.1*math.sin(x*.083+depth*.019)+1.8*math.sin(x*.031-depth*.054)
    high = shelf + hillside + far_rise + ridge*(.3+.7*(1-near)) + spires*(1-near) + split*(1-near)
    high+=erosion*(1-near)*smoothstep(3.0,18.0,abs(x-center))
    # Keep the shared multiplayer resting terrace open and almost level.
    clearing = max(0.0,1-abs(x)/24)**2 * max(0.0,1-abs(y-4)/31)**2
    high = high*(1-.97*clearing)+shelf*.97*clearing
    # Sculpt a real, continuous riverbed. The previous stream was attached to
    # high-frequency terrain noise, so the surface climbed over rocks, then
    # disappeared into the next polygon. Give the bed an extra margin beyond
    # either water edge: terrain triangulation cannot intersect the water.
    half=river_half_width(depth)
    bed_half=half+2.25
    bank_extent=4.8+depth*.021
    bed=river_level(depth)-.54+.055*(left_right/bed_half)**2
    bank_top=max(high,river_level(depth)+.18)
    channel_blend=smoothstep(bed_half,bed_half+bank_extent,left_right)
    sculpted=bed*(1-channel_blend)+bank_top*channel_blend
    # The river belongs behind the shared resting terrace, not through it.
    upstream_reveal=smoothstep(0,10,depth)
    return high*(1-upstream_reveal)+sculpted*upstream_reveal

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
    # A continuous terrain sculpt; denser bank geometry avoids diagonal cuts.
    nx,ny = 225,221
    vx, faces, col = [], [], []
    for j in range(ny):
        y = 98.0 - j*360.0/(ny-1)
        for i in range(nx):
            x = -140.0+i*280/(nx-1)
            vx.append((x,y,height(x,y)))
    for j in range(ny-1):
        for i in range(nx-1):
            a=j*nx+i; faces.append((a,a+nx,a+nx+1,a+1))
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
            # River moisture follows its serpentine banks into the actual soil.
            damp=math.exp(-(abs(x-river_center(d))/(3.6+d*.023))**2)
            r=.18+.062*stony+.055*p+.055*distant
            g=.30+.085*n+.065*stony+.043*distant
            b=.25+.055*n+.10*distant+.025*p
            r-=damp*.048
            g-=damp*.037
            b+=damp*.020
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

def add_ovate_leaf(v,f,mids,origin,direction,length,width,mat_idx,fold=0.0):
    """Curved, slender ovate lamina with softened shoulders and a central vein."""
    base=Vector(origin)
    d=Vector(direction).normalized()
    lateral=d.cross(Vector((0,0,1)))
    if lateral.length<.08:lateral=d.cross(Vector((0,1,0)))
    lateral.normalize()
    normal=lateral.cross(d).normalized()
    offset=len(v)
    # Five cross sections keep the leaf's perimeter supple when seen against
    # the sky. The center line rises subtly above its two outer edges.
    sections=((.16,.32),(.40,.86),(.65,1.0),(.87,.43))
    v.append(tuple(base))
    for t,w in sections:
        center=base+d*(length*t)+normal*(fold*math.sin(t*math.pi)+width*.09)
        left=center+lateral*(width*w*.52)-normal*(width*.08*w)
        right=center-lateral*(width*w*.43)-normal*(width*.08*w)
        v.extend((tuple(left),tuple(center),tuple(right)))
    tip=base+d*length+normal*(fold*.55)+lateral*(width*.025)
    v.append(tuple(tip))
    f.extend(((offset,offset+1,offset+2),
              (offset,offset+2,offset+3)))
    for section in range(len(sections)-1):
        a=offset+1+3*section
        b=a+3
        f.extend(((a,b,b+1),(a,b+1,a+1),
                  (a+1,b+1,b+2),(a+1,b+2,a+2)))
    a=offset+1+3*(len(sections)-1)
    tip_index=offset+1+3*len(sections)
    f.extend(((a,tip_index,a+1),(a+1,tip_index,a+2)))
    mids.extend((mat_idx,)*(4*len(sections)))

def create_pine(variant):
    """Irregular fir crowns: staggered boughs, drooping sprays, open pockets."""
    r=random.Random(2100+variant*71)
    v=[];f=[];m=[]
    h=7.7+variant*.8
    lean=(r.uniform(-.30,.30),r.uniform(-.27,.27))
    mid=(lean[0]*.32,lean[1]*.36,h*.57)
    add_tapered_segment(v,f,m,(0,0,0),mid,.34,.19,0,9)
    add_tapered_segment(v,f,m,mid,(lean[0],lean[1],h),.19,.032,0,7)
    tiers=18+variant*2
    crown_twist=r.uniform(-.26,.26)
    for tier in range(tiers):
        t=max(0,min(.98,(tier+r.uniform(-.23,.23))/tiers))
        z=.64+t*(h-.75)
        radius=(1.0-t)**(.92+variant*.06)*(2.55+.16*variant)
        arms=6+r.randrange(4)
        azimuth=tier*2.3999632297+crown_twist
        for k in range(arms):
            if r.random()<.075 and t>.18:continue
            angle=azimuth+TAU*k/arms+r.uniform(-.19,.19)
            ux,uy=math.cos(angle),math.sin(angle)
            length=radius*r.uniform(.72,1.20)
            root=Vector((lean[0]*t,lean[1]*t,z))
            elbow=root+Vector((ux*length*.53,uy*length*.53,-.18*(1-t)))
            tip=root+Vector((ux*length,uy*length,-.52*(1-t)+.12*t))
            add_tapered_segment(v,f,m,root,elbow,.07*(1-t)+.024,.032,0,5)
            add_tapered_segment(v,f,m,elbow,tip,.032,.006,0,5)
            lateral=(-uy,ux)
            for j in range(4):
                q=(j+.68)/4.35
                base=root.lerp(tip,q)
                for leaf_id in range(5):
                    side=(leaf_id-2)/2
                    sweep=(.37+.31*(1-t))*(1-.28*q)
                    direction=Vector((ux*(.53+.21*r.random())+
                                      lateral[0]*side*.75,
                                      uy*(.53+.21*r.random())+
                                      lateral[1]*side*.75,
                                      r.uniform(-.32,.34)+t*.14))
                    offset=Vector((lateral[0]*side*sweep,
                                   lateral[1]*side*sweep,
                                   r.uniform(-.14,.11)))
                    blade_len=(.53+.26*r.random())*(.64+.36*(1-t))
                    add_lance_leaf(v,f,m,base+offset,direction,
                                   blade_len,.18+.12*r.random(),
                                   2+r.randrange(len(needle)),
                                   .015+r.random()*.045)
    obj=object_from_mesh("PINE_MASTER_%d"%variant,v,f,
                         [bark,bark_lit]+needle,m,library_collection)
    obj.hide_render=True
    return obj

def create_broadleaf(variant):
    """Crooked botanical crowns made of overlapping, airy, asymmetric sprays.

    Structural limbs arc out of the trunk at changing heights; leaf fans occupy
    the *ends* of their forks. There is deliberately no spherical fill cloud,
    radial umbrella, or set of rounded clumps that reads as a broccoli tree.
    """
    r=random.Random(459+variant*47)
    v=[];f=[];m=[]
    h=7.75+variant*.58
    lean=Vector((r.uniform(-.76,.76),r.uniform(-.58,.58),0))
    knot=Vector((lean.x*.27,lean.y*.31,h*.36))
    upper=Vector((lean.x*.82,lean.y*.76,h*.73))
    crown=Vector((lean.x*1.18,lean.y*1.05,h))
    add_tapered_segment(v,f,m,(0,0,0),knot,.41,.29,0,10)
    add_tapered_segment(v,f,m,knot,upper,.29,.17,0,9)
    add_tapered_segment(v,f,m,upper,crown,.17,.046,0,7)
    spread=1.09 if variant==0 else .92
    lift=.18 if variant==0 else .58
    crown_bias=r.uniform(-.9,.9)

    limb_count=11 if variant==0 else 10
    for limb in range(limb_count):
        # Golden-angle stagger and different lengths prevent a radial umbrella.
        t=(limb+r.uniform(-.25,.25))/limb_count
        z=h*(.38+.45*t)
        angle=limb*2.3999632297+crown_bias+r.uniform(-.24,.24)
        ux,uy=math.cos(angle),math.sin(angle)
        lateral=Vector((-uy,ux,0))
        length=(3.65-1.02*t)*spread*r.uniform(.72,1.29)
        length*=.85+.20*math.sin(angle*1.7+crown_bias)
        root=Vector((lean.x*(z/h)*.74,lean.y*(z/h)*.75,z))
        elbow=root+Vector((ux*length*.47,uy*length*.47,
                           r.uniform(.18,.73)+lift*.27))
        elbow+=lateral*r.uniform(-.42,.42)
        tip=root+Vector((ux*length,uy*length,
                         r.uniform(-.75,.58)*(1-t)+lift*(.3+t)))
        tip+=lateral*r.uniform(-.65,.65)
        add_tapered_segment(v,f,m,root,elbow,.13*(1-t)+.055,.061,0,7)
        add_tapered_segment(v,f,m,elbow,tip,.061,.011,0,6)

        # Fine trailing twigs hold loosely connected clusters, not a single
        # opaque crown mass. Some gaps stay visible all the way to the hills.
        sprig_count=r.randint(9,13)
        for sprig in range(sprig_count):
            q=.24+.74*(sprig+r.random()*.6)/sprig_count
            p=root*(1-q)**2+elbow*(2*q*(1-q))+tip*q*q
            side=r.choice((-1,1))*r.uniform(.24,.84)
            twig=p+lateral*side+Vector((ux*r.uniform(.08,.41),
                                        uy*r.uniform(.08,.41),
                                        r.uniform(-.46,.55)))
            if sprig%2==0:
                add_tapered_segment(v,f,m,p,twig,.028,.004,
                                    1 if sprig%5==0 else 0,5)
            fan=r.randint(9,14)
            for index in range(fan):
                theta=r.random()*TAU
                fan_width=r.uniform(.15,.48)
                offset=Vector((math.cos(theta)*fan_width,
                               math.sin(theta)*fan_width,
                               r.uniform(-.25,.36)))
                direction=Vector((math.cos(theta)*r.uniform(.32,.95)+ux*.34,
                                  math.sin(theta)*r.uniform(.32,.95)+uy*.34,
                                  r.uniform(-.40,.54)+lift*.16))
                # Broadleaf blades have veins and different rotations. Short
                # inner leaves and long perimeter leaves break the silhouette.
                length_leaf=r.uniform(.43,.80)*(1.10 if q>.78 else .93)
                add_ovate_leaf(v,f,m,twig+offset,direction,
                               length_leaf,r.uniform(.19,.37),
                               2+r.randrange(len(leaf)),r.uniform(-.10,.19))

    # A few restrained interior leaf fans conceal the thickest joins without
    # filling every negative space with the same silhouette.
    for cluster in range(11):
        theta=r.random()*TAU
        radius=r.uniform(.4,1.48)
        z=h*r.uniform(.54,.91)
        center=Vector((lean.x+radius*math.cos(theta),
                       lean.y+radius*math.sin(theta),z))
        for _ in range(r.randint(8,12)):
            outward=Vector((r.uniform(-.9,.9),r.uniform(-.9,.9),r.uniform(-.36,.63)))
            start=center+Vector((r.uniform(-.34,.34),r.uniform(-.34,.34),r.uniform(-.29,.29)))
            add_ovate_leaf(v,f,m,start,outward,
                           r.uniform(.53,.84),r.uniform(.24,.40),
                           2+r.randrange(len(leaf)),r.uniform(-.08,.17))
    obj=object_from_mesh("BROADLEAF_MASTER_%d"%variant,v,f,
                         [bark,bark_lit]+leaf,m,library_collection)
    obj.hide_render=True
    return obj

def scatter_forest():
    masters=[create_pine(i) for i in range(3)]
    broad=[create_broadleaf(i) for i in range(2)]
    count=0
    rng=random.Random(20261117)
    # The valley grows in irregular groves, with pockets of quiet ground between
    # them. Independent uniform positions used to resemble a tree plantation.
    # Each center also carries a slightly different local species mix.
    groves=[
        (-57,-15,18,25,.20), (61,-24,20,23,.27),
        (-39,-58,19,32,.27), (42,-69,25,28,.21),
        (-82,-100,25,37,.12), (79,-107,27,34,.14),
        (-41,-129,26,32,.21), (39,-146,24,34,.14),
        (-86,-182,30,36,.11), (83,-192,29,39,.13),
        (-46,-218,27,29,.15), (47,-231,26,32,.10),
    ]
    placed=[]
    for i in range(1600):
        grove=None
        if rng.random()<.89:
            grove=groves[rng.randrange(len(groves))]
            cx,cy,rx,ry,_=grove
            x=rng.gauss(cx,rx*.74)
            y=rng.gauss(cy,ry*.79)
        else:
            x=rng.uniform(-124,124)
            y=rng.uniform(-241,-7)
        if not (-128<x<128 and -244<y<17):continue
        d=max(0,-y)
        # Keep water, two natural light-catching openings, and the actual
        # multiplayer terrace free of trunks or overhanging heavy crowns.
        if abs(x-river_center(d))<12+d*.105:continue
        if -25<y<28 and abs(x)<27:continue
        if y>-12 and abs(x)<51:continue
        if ((x+61)/18)**2+((y+109)/27)**2<1:continue
        if ((x-48)/17)**2+((y+169)/23)**2<1:continue
        # Subtle coherent empty patches interrupt even the densest groves.
        undergrowth=fbm(x*.043,y*.039,531)
        if undergrowth<-.19 and rng.random()<.72:continue
        if rng.random()<.045:continue

        maturity=rng.random()
        if maturity<.20:
            size=rng.uniform(.47,.73)  # saplings within mature woodland
        elif maturity<.70:
            size=rng.uniform(.81,1.22)
        elif maturity<.93:
            size=rng.uniform(1.22,1.60)
        else:
            size=rng.uniform(1.60,1.92)  # a few canopy landmarks
        size*=1.17 if y>-77 else (.94 if y<-169 else 1.0)
        # Repel trunks in proportion to their actual crowns. This still permits
        # close understory saplings and overlapping canopies, not regular rows.
        spacing=4.6+2.5*size
        if any((x-px)**2+(y-py)**2 <
               (max(spacing,4.6+2.5*ps)*.83)**2
               for px,py,ps in placed):continue
        leaf_chance=(grove[4] if grove else .14)
        leaf_chance+=.065*max(0,1-abs(x-river_center(d))/52)
        leaf_chance+=.10*fbm(x*.032,y*.041,709)
        master=(broad[rng.randrange(len(broad))]
                if rng.random()<leaf_chance
                else masters[rng.randrange(len(masters))])
        if master in broad:size*=1.07
        obj=bpy.data.objects.new("Forest | linked grove tree %03d"%count,master.data)
        world_collection.objects.link(obj)
        obj.location=(x,y,height(x,y)-.20)
        obj.scale=(size*rng.uniform(.91,1.09),
                   size*rng.uniform(.91,1.09),
                   size*rng.uniform(.86,1.23))
        obj.rotation_euler=(rng.uniform(-.055,.055),
                            rng.uniform(-.035,.035),rng.random()*TAU)
        placed.append((x,y,size))
        count+=1
        if count>=184:break
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
        x=rng.uniform(-70,70);y=rng.uniform(-17,73)
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
        y=r.uniform(11,68)
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
    # One gently sloping watercourse. Water must NOT track the terrain height:
    # doing so produces cascading ribbons and visible breaks at every hill.
    # Its banks are excavated in height() using this exact profile instead.
    v=[];f=[]
    sections=384
    across=9
    for i in range(sections):
        y=-250+i*239/(sections-1)
        d=max(0,-y)
        cx=river_center(d)
        half=river_half_width(d)
        for k in range(across):
            t=k/(across-1)*2-1
            x=cx+t*half
            z=river_level(d)+.012*math.sin(d*.17+t*4.0)
            v.append((x,y,z))
        if i>0:
            a=(i-1)*across
            for k in range(across-1):
                f.append((a+k,a+k+1,a+k+1+across,a+k+across))
    obj=object_from_mesh("River | true sculpted winding ribbon",v,f,[water])
    for p in obj.data.polygons:p.use_smooth=True

def riverbank():
    # Low, uneven banks are modeled on the same sculpted heightfield as the
    # watercourse. This is actual ground geometry, not a painted shoreline.
    vertices=[];faces=[]
    sections=288
    bands=5
    for side in (-1,1):
        origin=len(vertices)
        for i in range(sections):
            y=-248+i*235/(sections-1)
            d=max(0,-y)
            center=river_center(d)
            half=river_half_width(d)
            variation=.12*math.sin(d*.19+side*1.8)+.09*noise(d*.12,side*2.0,213)
            for k in range(bands):
                u=k/(bands-1)
                distance=half+.18+u*(1.65+variation+.42*math.sin(d*.027+side))
                x=center+side*distance
                z=height(x,y)+.027+.009*math.sin(d*.43+u*8.0+side)
                vertices.append((x,y,z))
            if i:
                prior=origin+(i-1)*bands
                current=origin+i*bands
                for k in range(bands-1):
                    faces.append((prior+k,prior+k+1,current+k+1,current+k))
    obj=object_from_mesh("Riverbank | sculpted damp sediment",vertices,faces,[wet_silt])
    for polygon in obj.data.polygons:polygon.use_smooth=True

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
riverbank()
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
