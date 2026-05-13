import ezdxf
from collections import Counter
doc = ezdxf.readfile(r"C:\_myProjects\GPRTool\_projects\30 Beaufort Street, WA 6000\CADMapper-30 Beaufort Street-2D.dxf")
msp = doc.modelspace()
layers = Counter(e.dxf.layer for e in msp)
for l, c in layers.most_common():
    print(f"{l}: {c}")
