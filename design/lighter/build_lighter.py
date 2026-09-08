"""Run with Blender --background --python design/lighter/build_lighter.py.

Reference-derived proportions; absolute physical dimensions remain unmeasured.
Generates editable source, embedded-texture GLB, and Cycles review renders.
"""
import bpy
import math
import os
import sys
import numpy as np
from mathutils import Vector

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, 'design/lighter')
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
scene = bpy.context.scene
scene.unit_settings.system = 'METRIC'
scene.unit_settings.scale_length = .07 / 1.69
scene['reference_dimensions'] = 'Height 70 mm, thickness 10 mm supplied by user; width 41.42 mm inferred from front photograph.'
model = bpy.data.collections.new('ED01 — export assembly')
scene.collection.children.link(model)

def move_to_model(obj):
    for coll in list(obj.users_collection):
        coll.objects.unlink(obj)
    model.objects.link(obj)

def material(name, color, rough=.25, metal=1):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (*color, 1)
    bsdf.inputs['Metallic'].default_value = metal
    bsdf.inputs['Roughness'].default_value = rough
    return mat

finish = material('FinishBrushed', (.52, .32, .115), .28)
polish = material('FinishPolished', (.52, .32, .115), .19)
knurlmat = material('FinishKnurl', (.52, .32, .115), .24)
dark = material('Recess', (.009, .011, .014), .36, .65)
burner = material('BurnerSteel', (.15, .16, .17), .28)
ink = material('Engraving', (.025, .017, .009), .49, .35)

# Image-backed brushed finish survives glTF export. Direction follows the UVs.
rng = np.random.default_rng(41)
size = 1024
columns = rng.normal(0, 1, (1, size))
fine = rng.normal(0, .17, (size, size))
height = np.repeat(columns, size, axis=0) + fine
# Slowly varying scratch intensity down the length avoids uniform ruled lines.
height *= .7 + .3 * np.sin(np.linspace(0, 9, size))[:, None] ** 2
def image_data(name, rgb):
    im = bpy.data.images.new(name, width=size, height=size)
    im.colorspace_settings.name = 'Non-Color'
    pixels = np.ones((size, size, 4), dtype=np.float32)
    pixels[:, :, :3] = rgb
    im.pixels.foreach_set(pixels.ravel())
    im.filepath_raw = os.path.join(OUT, name + '.png')
    im.file_format = 'PNG'
    im.save()
    im.pack()
    return im
rough = np.clip(.28 + height * .024, .18, .38)
roughimg = image_data('brushed-roughness', np.repeat(rough[:, :, None], 3, axis=2))
dx = np.gradient(height, axis=1) * .10
dy = np.gradient(height, axis=0) * .10
normal = np.stack((-dx, -dy, np.ones_like(dx)), axis=2)
normal /= np.linalg.norm(normal, axis=2)[:, :, None]
normalimg = image_data('brushed-normal', normal * .5 + .5)
nodes = finish.node_tree.nodes
links = finish.node_tree.links
bsdf = nodes.get('Principled BSDF')
for im, socket in [(roughimg, 'Roughness'), (normalimg, 'Normal')]:
    tex = nodes.new('ShaderNodeTexImage')
    tex.image = im
    if socket == 'Normal':
        norm = nodes.new('ShaderNodeNormalMap')
        norm.inputs['Strength'].default_value = .19
        links.new(tex.outputs['Color'], norm.inputs['Color'])
        links.new(norm.outputs['Normal'], bsdf.inputs[socket])
    else:
        links.new(tex.outputs['Color'], bsdf.inputs[socket])

def bevel(obj, amount=.008, segments=3):
    mod = obj.modifiers.new('Machined edge radii', 'BEVEL')
    mod.width = amount
    mod.segments = segments
    mod = obj.modifiers.new('Weighted corner normals', 'WEIGHTED_NORMAL')
    mod.keep_sharp = True

def cube(name, dims, pos, mat, radius=.006, parent=None):
    bpy.ops.mesh.primitive_cube_add(size=1, location=pos)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = dims
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(mat)
    if radius:
        bevel(obj, radius)
    move_to_model(obj)
    if parent:
        matrix = obj.matrix_world.copy()
        obj.parent = parent
        obj.matrix_world = matrix
    return obj

def prism(name, points, depth, mat):
    n = len(points)
    verts = [(x, -depth/2, z) for x,z in points] + [(x, depth/2, z) for x,z in points]
    faces = [tuple(range(n)), tuple(reversed(range(n,2*n)))]
    faces += [(i, (i+1)%n, (i+1)%n+n, i+n) for i in range(n)]
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    model.objects.link(obj)
    obj.data.materials.append(mat)
    bevel(obj)
    return obj

body = prism('Chassis — control cutout', [(-.5,-.845),(.5,-.845),(.5,-.285),(.325,-.285),(.325,.48),(-.5,.48)], .29, finish)
cube('Bottom edge trim', (.989,.288,.018), (0,0,-.835), polish, .005)
# Subtle front/back shoulder seam below the lid.
for y in [-.1455,.1455]:
    cube('Upper face machining line', (.811,.001,.002),(-.083,y,.401),polish,.0005)

pivot = bpy.data.objects.new('LidPivot', None)
model.objects.link(pivot)
pivot.location = (-.459,0,.481)
pivot['opening_axis'] = 'Blender local Y negative; glTF local Z positive'
pivot['opening_radians'] = 1.78
cube('Lid front brushed panel',(1,.024,.284),(0,-.133,.697),finish,.008,pivot)
cube('Lid rear brushed panel',(1,.024,.284),(0,.133,.697),finish,.008,pivot)
cube('Lid crown',(1,.29,.026),(0,0,.832),finish,.009,pivot)
for x in [-.488,.488]:
    cube('Lid sidewall',(.024,.254,.304),(x,0,.686),finish,.007,pivot)
cube('Lid inner ceiling',(.93,.233,.009),(0,0,.812),polish,.003,pivot)
for y in [-.136,.136]:
    cube('Lid lower polished rail',(1,.018,.06),(0,y,.518),polish,.006,pivot)

def cylinder(name, radius, depth, pos, mat, axis='Z', parent=None, vertices=48):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=pos)
    obj = bpy.context.object
    obj.name = name
    if axis == 'Y':
        obj.rotation_euler.x = math.pi/2
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    obj.data.materials.append(mat)
    bevel(obj,.002,2)
    move_to_model(obj)
    if parent:
        matrix=obj.matrix_world.copy()
        obj.parent=parent
        obj.matrix_world=matrix
    return obj

for y in [-.149,.149]:
    cylinder('Hinge shoulder',.047,.008,(-.459,y,.466),polish,'Y')
    cylinder('Hinge pin',.010,.010,(-.463,y*1.04,.469),burner,'Y')
    cylinder('Hinge pin highlight',.005,.011,(-.463,y*1.06,.469),polish,'Y')
cylinder('Hinge axle',.025,.253,(-.459,0,.481),polish,'Y')

control = bpy.data.objects.new('Control',None)
model.objects.link(control)
cube('Control recessed housing',(.148,.246,.754),(.414,0,.096),dark,.013,control)
cube('Knurl core',(.149,.263,.735),(.414,0,.096),knurlmat,.016,control)
verts, faces = [], []
def tooth(center, u, v, outward, a, b):
    start=len(verts)
    c=Vector(center); U=Vector(u)*a/2; V=Vector(v)*b/2
    verts.extend([c-U-V,c+U-V,c+U+V,c-U+V,c+Vector(outward)*.007])
    faces.extend([(start+i,start+(i+1)%4,start+4) for i in range(4)])
for row in range(20):
    z=-.266+(row+.5)*.0362
    for col in range(4):
        x=.34+(col+.5)*.037
        for sign in [-1,1]:
            tooth((x,sign*.133,z),(1,0,0),(0,0,1),(0,sign,0),.036,.035)
    for col in range(7):
        y=-.129+(col+.5)*.0368
        tooth((.49,y,z),(0,1,0),(0,0,1),(1,0,0),.0358,.035)
mesh=bpy.data.meshes.new('Cut pyramid knurl mesh')
mesh.from_pydata(verts,[],faces)
mesh.update()
obj=bpy.data.objects.new('Knurl — 300 cut teeth',mesh)
model.objects.link(obj)
obj.data.materials.append(knurlmat)
obj.parent=control

# Conservatively reconstructed visible deck; no unseen refill hardware.
cube('Deck gasket',(.898,.239,.012),(0,0,.482),dark,.025)
cube('Inset burner deck',(.886,.23,.025),(0,0,.498),polish,.025)
cube('Valve cover',(.39,.157,.035),(-.08,0,.525),polish,.012)
for y in [-.095,.095]:
    cube('Deck rail',(.65,.016,.033),(-.03,y,.525),polish,.004)
cylinder('Burner outer collar',.067,.047,(.301,0,.533),burner)
cylinder('Burner well',.050,.003,(.301,0,.558),dark)
cylinder('Jet nozzle',.020,.009,(.301,0,.561),polish)
cylinder('Jet aperture',.012,.002,(.301,0,.567),dark)
for x in [-.35,.17]:
    cylinder('Deck fastener',.012,.004,(x,-.063,.519),burner,vertices=24)
    cube('Fastener slot',(.016,.003,.001),(x,-.063,.5215),dark,.0003)

font=bpy.data.fonts.load(os.path.join(ROOT,'assets/fonts/GildaDisplay-Regular.ttf'))
def label(name, text, x, z, width):
    curve=bpy.data.curves.new(name,'FONT')
    curve.body=text
    curve.font=font
    curve.align_x='CENTER'
    curve.size=.1
    curve.resolution_u=10
    curve.extrude=0
    obj=bpy.data.objects.new(name,curve)
    model.objects.link(obj)
    obj.rotation_euler=(math.pi/2,0,0)
    obj.location=(x,-.1457,z)
    curve.materials.append(ink)
    bpy.context.view_layer.update()
    scale=width/obj.dimensions.x
    obj.scale=(scale,scale,scale)
    bpy.context.view_layer.objects.active=obj
    obj.select_set(True)
    bpy.ops.object.convert(target='MESH')
    obj.select_set(False)
label('BROKE engraving','BROKE',0,-.555,.443)
label('Edition engraving','ED 01',-.27,-.725,.195)
label('Number engraving','No 01/250',.18,-.725,.347)

# Consistent planar UVs on each dominant face, preserving vertical brush direction.
for obj in model.objects:
    if obj.type!='MESH': continue
    mesh=obj.data
    if not mesh.uv_layers: mesh.uv_layers.new(name='UVMap')
    uv=mesh.uv_layers.active.data
    for poly in mesh.polygons:
        n=poly.normal
        for li in poly.loop_indices:
            co=mesh.vertices[mesh.loops[li].vertex_index].co
            if abs(n.z)>.7:
                coord=(co.x+.5,co.y+.5)
            elif abs(n.x)>.7:
                coord=(co.y+.5,co.z/1.69+.5)
            else:
                coord=(co.x+.5,co.z/1.69+.5)
            uv[li].uv=coord

# Calibrate depth to the supplied 10 mm while retaining photograph-derived width.
assembly = bpy.data.objects.new('ED01', None)
model.objects.link(assembly)
for obj in list(model.objects):
    if obj != assembly and obj.parent is None:
        obj.parent = assembly
assembly.scale.y = (.01 / scene.unit_settings.scale_length) / .29
# Export just the closed assembly. Camera and studio remain in editable source.
bpy.ops.object.select_all(action='DESELECT')
for obj in model.objects: obj.select_set(True)
assembly.scale *= scene.unit_settings.scale_length
bpy.ops.export_scene.gltf(filepath=os.path.join(ROOT,'assets/models/ed01-lighter.glb'),
    export_format='GLB',use_selection=True,export_apply=True,export_animations=False,export_yup=True)
assembly.scale /= scene.unit_settings.scale_length

def aim(obj, point):
    obj.rotation_euler=(Vector(point)-obj.location).to_track_quat('-Z','Y').to_euler()
scene.world.color=(.15,.15,.15)
scene.world.use_nodes=True
scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.24,.25,.27,1)
scene.world.node_tree.nodes['Background'].inputs[1].default_value=.4
def area(name,pos,energy,size,shape='DISK',size_y=None):
    data=bpy.data.lights.new(name,'AREA');data.energy=energy;data.shape=shape;data.size=size
    if size_y: data.size_y=size_y
    obj=bpy.data.objects.new(name,data);scene.collection.objects.link(obj);obj.location=pos;aim(obj,(0,0,0))
area('Tall left softbox',(-2,-3,2.5),180,2,'RECTANGLE',4)
area('Right strip reflection',(2,-1,1.5),110,.7,'RECTANGLE',3)
area('Rim',(0,2,2),220,2)
area('Front fill',(-.5,-4,-.5),35,2)
floor=material('Studio warm grey',(.075,.069,.06),.75,0)
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.86))
bpy.context.object.name='Studio ground'
bpy.context.object.data.materials.append(floor)
data=bpy.data.cameras.new('Review camera');cam=bpy.data.objects.new('Review camera',data)
scene.collection.objects.link(cam);scene.camera=cam
cam.location=(2.25,-5.8,1.9);aim(cam,(0,0,0))
cam.data.type='ORTHO';cam.data.ortho_scale=2.7
scene.render.engine='CYCLES';scene.cycles.samples=48
scene.cycles.use_denoising=True
scene.render.resolution_x=1200;scene.render.resolution_y=1400;scene.render.resolution_percentage=100
scene.view_settings.view_transform='AgX'
scene.render.image_settings.file_format='PNG'
bpy.ops.object.select_all(action='DESELECT')
body.select_set(True)
bpy.context.view_layer.objects.active=body
for screen in bpy.data.screens:
    for area in screen.areas:
        if area.type == 'VIEW_3D':
            area.spaces.active.region_3d.view_perspective='CAMERA'
            area.spaces.active.shading.type='MATERIAL'
bpy.context.preferences.filepaths.save_version=0
bpy.ops.file.pack_all()
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT,'ed01-lighter.blend'))
if '--skip-renders' in sys.argv:
    print('ED01 source and GLB build complete (renders skipped)')
    sys.exit(0)
def render(name):
    scene.render.filepath=os.path.join(OUT,name+'.png');bpy.ops.render.render(write_still=True)
render('brass-closed')
pivot.rotation_euler.y=-1.78
cam.data.ortho_scale=2.9;aim(cam,(-.10,0,.15))
render('brass-open')
pivot.rotation_euler.y=0
cam.data.ortho_scale=2.7;aim(cam,(0,0,0))
for name,color in [('onyx',(.018,.020,.025)),('steel',(.63,.65,.68))]:
    for mat in [finish,polish,knurlmat]:
        mat.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value=(*color,1)
    ink.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value=(.65,.67,.69,1)
    render(name+'-closed')
print('ED01 build complete')
