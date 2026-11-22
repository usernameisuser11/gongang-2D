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
    (.025, .084, .075), (.044, .132, .101), (.067, .172, .115),
    (.098, .211, .137), (.063, .147, .132)
])]
leaf = [material("Broadleaf velvet %02d" % i, c) for i, c in enumerate([
    (.052, .137, .100), (.091, .202, .122), (.144, .259, .141),
    (.212, .307, .165), (.093, .218, .171)
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
    for vertex in obj.data.vertices:
        x,y,z=vertex.co
        d=max(0,-y)
        n=fbm(x*.07,y*.08,17)
        p=fbm(x*.31,y*.29,91)
        distant=min(1,d/240)
        stony=max(0,min(1,(z-3)/20))
        # River moisture follows its serpentine banks into the actual soil.
        damp=math.exp(-(abs(x-river_center(d))/(3.6+d*.023))**2)
        r=.18+.062*stony+.055*p+.055*distant-damp*.048
        g=.30+.085*n+.065*stony+.043*distant-damp*.037
        b=.25+.055*n+.10*distant+.025*p+damp*.020
        col.append((max(.02,r),max(.035,g),max(.04,b),1))
    # Corners sharing a vertex have the same color. Write in bulk so Blender
    # doesn't repeatedly invalidate the mesh while authoring the river valley.
    colors.data.foreach_set("color", [value for loop in obj.data.loops
                                     for value in col[loop.vertex_index]])
    # Vertex colors survive the glTF roundtrip: no static panorama texture.
    bsdf=earth.node_tree.nodes.get("Principled BSDF")
    attr=earth.node_tree.nodes.new("ShaderNodeVertexColor")
    attr.layer_name="Color"
    earth.node_tree.links.new(attr.outputs["Color"],bsdf.inputs["Base Color"])
    return obj

def add_bent_branch(v, f, mids, points, radii, mat_idx=0, sides=7):
    """Share each joint ring so trunks and limbs curve without a visible seam."""
    points = [Vector(point) for point in points]
    axis = (points[-1] - points[0]).normalized()
    reference = Vector((0, 1, 0)) if abs(axis.y) < .75 else Vector((0, 0, 1))
    first=len(v)
    for i, (center, radius) in enumerate(zip(points, radii)):
        tangent = (points[min(i+1, len(points)-1)] - points[max(i-1, 0)]).normalized()
        side = tangent.cross(reference).normalized()
        up = tangent.cross(side)
        for k in range(sides):
            t=TAU*k/sides
            p=center+radius*(side*math.cos(t)+up*math.sin(t))
            v.append(tuple(p))
    for ring in range(len(points)-1):
        a = first + ring*sides
        for k in range(sides):
            next_k = (k+1) % sides
            f.append((a+k, a+next_k, a+sides+next_k, a+sides+k))
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
    # Three cross sections show the curved edge and midrib even in silhouette.
    sections=((.22,.50),(.51,1.0),(.78,.72))
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

def create_pine(variant, distant=False):
    """Mountain fir and weathered pines, with individual forked sprays."""
    r = random.Random(2100 + variant*71)
    v, f, m = [], [], []
    h, bare, spread, taper, lean = (
        (8.4, .36, 3.55, .72, .75),
        (9.6, .21, 2.85, 1.16, .52),
        (7.5, .43, 4.15, .55, 1.42),
    )[variant]
    lean_angle = r.uniform(0, TAU)
    bend = Vector((math.cos(lean_angle)*lean, math.sin(lean_angle)*lean, 0))
    up = Vector((0, 0, 1))

    def stem(t):
        return up*(h*t) + bend*(t**1.7)

    rings = (0, .24, .51, .73, .89, 1)
    add_bent_branch(v, f, m, [stem(t) for t in rings],
                    (.31, .21, .145, .091, .053, .012), sides=6 if distant else 9)
    levels = (7 if distant else 11) + (variant == 1)
    for level in range(levels):
        t = min(1, max(0, (level + r.uniform(-.28, .28))/(levels-1)))
        root = stem(bare + t*(.95-bare))
        reach = spread*(.13+.87*(1-t)**taper)
        if variant != 1:
            reach *= .84+.29*math.sin(t*math.pi)
        arms = r.randint(3, 4) if distant else r.randint(4, 6)
        for arm in range(arms):
            angle = lean_angle + level*2.39996323 + TAU*arm/arms + r.uniform(-.35, .35)
            forward = Vector((math.cos(angle), math.sin(angle), 0))
            side = up.cross(forward)
            windward = .83 + .24*math.cos(angle-lean_angle)
            length = reach*windward*r.uniform(.62, 1.28)
            elbow = root + forward*(length*.49) + side*r.uniform(-.18, .18) - up*(.26*(1-t))
            tip = root + forward*length + side*r.uniform(-.28, .28) + up*r.uniform(-.27, .22)
            limb_width = .064*(1-t)+.022
            add_bent_branch(v, f, m, (root, elbow, tip),
                            (limb_width, limb_width*.54, .008), sides=5)
            twigs = 3 if distant else r.randint(4, 5)
            for twig in range(twigs):
                progress = .16 + .84*twig/(twigs-1)
                anchor = root.lerp(elbow, .68) if twig == 0 else elbow.lerp(tip, progress)
                fork_sign = -1 if twig % 2 else 1
                spray = (forward*r.uniform(.42, .68) + side*fork_sign*r.uniform(.45, .89)
                         + up*r.uniform(-.12, .29)).normalized()
                twig_length = r.uniform(.28, .64) * (.63+.37*(1-t))
                end = anchor + spray*twig_length
                if not distant:
                    add_bent_branch(v, f, m, (anchor, end), (.019, .005), sides=4)
                shade = r.choice((1, 2, 2, 3, 4))
                # Connected sprays give the bough a filled silhouette at a
                # distance. The smaller needles still break up its perimeter.
                fan_length = (.56+.25*length)*(.82+.18*(1-t))
                for layer, side_sign in enumerate((-1, 1)):
                    fan_direction = spray + side*(side_sign*.40) + up*(layer*.22-.13)
                    add_ovate_leaf(
                        v, f, m, anchor.lerp(end, .12+layer*.23), fan_direction,
                        fan_length*(.92+.20*layer), fan_length*(.56-.08*layer),
                        2+max(0, shade-layer), .11*fan_length,
                    )
                blades = 7 if distant else r.randint(8, 11)
                for blade in range(blades):
                    q = (blade+.6)/blades
                    start = anchor.lerp(end, q)
                    start += side*r.uniform(-.20, .20) + up*r.uniform(-.12, .14)
                    direction = (spray*.58 + side*r.uniform(-.84, .84)
                                 + up*r.uniform(-.52, .63))
                    blade_length = r.uniform(.43, .78)*(.72+.28*(1-t))
                    color = shade if r.random()<.8 else r.randrange(len(needle))
                    add_lance_leaf(v, f, m, start, direction, blade_length,
                                   blade_length*r.uniform(.26, .42), 2+color, r.uniform(.014, .045))

    # A narrow terminal spray closes the crown over the exposed trunk tip.
    top_blades = 14 if distant else 24
    for i in range(top_blades):
        angle = i*2.39996323
        t = .87+.13*i/(top_blades-1)
        forward = Vector((math.cos(angle), math.sin(angle), r.uniform(.46, .96)))
        add_lance_leaf(v, f, m, stem(t), forward, r.uniform(.26, .48), .10,
                       2+r.choice((1, 2, 2, 3)), .021)
    suffix = "_DISTANT" if distant else ""
    obj = object_from_mesh("PINE_MASTER_%d%s" % (variant, suffix), v, f,
                           [bark, bark_lit]+needle, m, library_collection)
    obj.hide_render = True
    return obj


def create_broadleaf(variant, distant=False):
    """Sculpt open trunks and unequal crowns that follow their branching wood."""
    r = random.Random(459 + variant*47)
    v, f, m = [], [], []
    up = Vector((0, 0, 1))
    h = (7.85, 8.95)[variant]
    lean = Vector((r.uniform(.70, 1.16), r.uniform(-.65, .65), 0))
    trunk = (
        Vector((0, 0, 0)), lean*.21 + up*(h*.29),
        lean*.73 + up*(h*.59), lean*1.01 + up*(h*.78), lean*1.24 + up*(h*.94),
    )
    add_bent_branch(v, f, m, trunk, (.37, .23, .153, .085, .016),
                    sides=7 if distant else 10)
    spread = (1.12, .92)[variant]
    lift = (.29, .85)[variant]
    count = 8 if distant else 11
    for limb in range(count):
        t = (limb/(count-1))**.73
        if t < .55:
            root = trunk[1].lerp(trunk[2], t/.55)
        elif t < .80:
            root = trunk[2].lerp(trunk[3], (t-.55)/.25)
        else:
            root = trunk[3].lerp(trunk[4], (t-.80)/.20)
        angle = limb*2.39996323 + r.uniform(-.36, .36)
        forward = Vector((math.cos(angle), math.sin(angle), 0))
        side = up.cross(forward)
        length = (3.85-2.20*t)*spread*r.uniform(.75, 1.24)
        elbow = (root + forward*(.44*length) + side*r.uniform(-.35, .35)
                 + up*(lift*.49+r.uniform(.23, .53)))
        tip = (root + forward*length + side*r.uniform(-.41, .41)
               + up*(lift*.61+r.uniform(.28, 1.08) + .25*t))
        thickness = .17*(1-t)+.034
        add_bent_branch(v, f, m, (root, elbow, tip),
                        (thickness, thickness*.58, .012), sides=5 if distant else 7)

        shoots = 5 if distant else r.randint(7, 9)
        for shoot in range(shoots):
            q = .07+.93*shoot/(shoots-1)
            start = elbow.lerp(tip, q)
            side_sign = -1 if shoot % 2 else 1
            spray = (forward*r.uniform(.25, .62) + side*side_sign*r.uniform(.40, .86)
                     + up*r.uniform(.12, .70)).normalized()
            end = start + spray*r.uniform(.47, 1.0)
            if not distant:
                add_bent_branch(v, f, m, (start, end), (.031, .006),
                                1 if shoot % 5 == 0 else 0, sides=5)
            blades = r.randint(9, 12) if distant else r.randint(13, 17)
            shade = r.choice((0, 1, 1, 2, 2, 3, 4))
            for blade in range(blades):
                progress = .10+.90*blade/(blades-1)
                origin = start.lerp(end, progress)
                origin += side*r.uniform(-.27, .27) + up*r.uniform(-.21, .23)
                direction = (spray*.45 + side*r.uniform(-.98, .98)
                             + up*r.uniform(-.48, .54) + forward*r.uniform(-.50, .46))
                length_leaf = r.uniform(.40, .78)
                width_leaf = length_leaf*r.uniform(.46, .66)
                color = shade if r.random()<.76 else r.randrange(len(leaf))
                if distant:
                    add_lance_leaf(v, f, m, origin, direction,
                                   length_leaf*1.18, width_leaf*1.16, 2+color, .045)
                else:
                    add_ovate_leaf(v, f, m, origin, direction, length_leaf,
                                   width_leaf, 2+color, r.uniform(-.042, .108))
    suffix = "_DISTANT" if distant else ""
    obj = object_from_mesh("BROADLEAF_MASTER_%d%s" % (variant, suffix), v, f,
                           [bark, bark_lit]+leaf, m, library_collection)
    obj.hide_render = True
    return obj

def scatter_forest():
    masters=[create_pine(i) for i in range(3)]
    broad=[create_broadleaf(i) for i in range(2)]
    distant_pines=[create_pine(i, distant=True) for i in range(3)]
    distant_broad=[create_broadleaf(i, distant=True) for i in range(2)]
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
        is_broadleaf = rng.random() < leaf_chance
        if is_broadleaf:
            choices = distant_broad if d>76 else broad
            size *= 1.07
        else:
            choices = distant_pines if d>76 else masters
        master = rng.choice(choices)
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
    for x,y,scale,turn,master in [
        (-37,21,2.05,.7,broad[0]),(42,20,2.18,4.0,masters[2]),
        (-56,-9,1.75,1.9,masters[1]),(57,-14,1.85,2.5,broad[1]),
        (-19,22,1.15,2.9,masters[0]),(17,25,1.08,.8,broad[1]),
        (-25,-7,1.12,3.8,masters[1]),(25,-10,.98,2.3,masters[0]),
        (-24,-33,1.06,2.3,masters[2]),(-29,-37,.74,3.4,masters[1]),
        (27,-49,.94,1.6,masters[0]),(30,-42,.77,.5,broad[1])]:
        obj=bpy.data.objects.new("Foreground hero tree",master.data)
        world_collection.objects.link(obj)
        obj.location=(x,y,height(x,y)-.45)
        obj.scale=(scale,scale,scale)
        obj.rotation_euler[2]=turn
    # The portrait camera needs distinct silhouettes near its narrow viewport.
    # These are sculpted meshes, selectively shown only on mobile at runtime.
    for n,(x,y,size,turn,master) in enumerate([
        (-10.8,30,1.84,2.8,broad[0]),
        (11.9,34,1.58,.65,masters[2]),
        (-9.1,11,.89,2.1,masters[1])
    ]):
        obj=bpy.data.objects.new("Portrait framing tree %02d"%n,master.data)
        world_collection.objects.link(obj)
        obj.location=(x,y,height(x,y)-.22)
        obj.scale=(size,size,size)
        obj.rotation_euler[2]=turn
        obj.hide_render=True
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

print("Sculpting uninterrupted terrain...", flush=True)
build_land()
print("Building botanical meshes...", flush=True)
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
