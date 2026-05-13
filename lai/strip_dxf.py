"""
strip_dxf.py
Removes 3D MESH blobs (paths/topography) from CADMapper DXF.
Keeps buildings, roads, contours, railways, water, parks intact.
"""
import os

try:
    import ezdxf
except ImportError:
    os.system("pip install ezdxf")
    import ezdxf

# Remove MESH only from these layers (tree blobs, terrain noise)
STRIP_MESH_LAYERS = {'paths', 'topography'}

input_path  = r"C:\_myProjects\GPRTool\_projects\30 Beaufort Street, WA 6000\CADMapper-30 Beaufort Street.dxf"
output_path = r"C:\_myProjects\GPRTool\_projects\30 Beaufort Street, WA 6000\CADMapper-30 Beaufort Street-2D.dxf"

print(f"Reading {input_path} ...")
doc = ezdxf.readfile(input_path)
msp = doc.modelspace()

all_entities = list(msp)
total = len(all_entities)
kept = removed = 0

for entity in all_entities:
    if entity.dxftype() == 'MESH' and entity.dxf.layer in STRIP_MESH_LAYERS:
        msp.delete_entity(entity)
        removed += 1
    else:
        kept += 1

print(f"Total: {total} | Kept: {kept} | Removed: {removed}")
print(f"Saving to {output_path} ...")
doc.saveas(output_path)
print("Done.")
