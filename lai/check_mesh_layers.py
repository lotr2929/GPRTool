import ezdxf
from collections import Counter
doc = ezdxf.readfile(r"C:\_myProjects\GPRTool\_projects\30 Beaufort Street, WA 6000\CADMapper-30 Beaufort Street.dxf")
msp = doc.modelspace()
mesh_layers = Counter(e.dxf.layer for e in msp if e.dxftype() == "MESH")
print("MESH entities by layer:")
for l, c in mesh_layers.most_common():
    print(f"  {l}: {c}")
poly_layers = Counter(e.dxf.layer for e in msp if e.dxftype() in ("LWPOLYLINE","POLYLINE"))
print("POLYLINE entities by layer:")
for l, c in poly_layers.most_common():
    print(f"  {l}: {c}")
