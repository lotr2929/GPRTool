import ezdxf
from collections import Counter
doc = ezdxf.readfile(r"C:\_myProjects\GPRTool\_projects\30 Beaufort Street, WA 6000\CADMapper-30 Beaufort Street.dxf")
msp = doc.modelspace()
types = Counter(e.dxftype() for e in msp)
for t, c in types.most_common():
    print(f"{t}: {c}")
