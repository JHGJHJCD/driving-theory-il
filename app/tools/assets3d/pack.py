"""Copy the chosen CC0 3D models (Kenney + Public Transport) into app/assets3d.
Usage: python3 tools/assets3d/pack.py <dir with the extracted kits> 
Expected layout of <dir>: carkit/ roads/ suburban/ commercial/ chars/ train/  (each = the unzipped kit).
Sources (all CC0): opengameart.org/content/car-kit, city-kit-roads, city-kit-suburban, city-kit-commercial, mini-characters, train-kit (Kenney, kenney.nl);
(the bus and the motorcycle are drawn in js/kit3d.js)."""
import os, shutil, sys
src = sys.argv[1]; dst = os.path.join(os.path.dirname(__file__), '..', '..', 'assets3d')
PICK = {
 'cars': ('carkit', ['sedan','sedan-sports','hatchback-sports','suv','suv-luxury','van','taxi','police','ambulance','firetruck','delivery','truck','garbage-truck','tractor','tractor-shovel','cone','box']),
 'roads': ('roads', ['traffic-light','traffic-light-hanging','traffic-light-object-vertical','road-sign-stop','road-sign-warning','road-sign-empty','road-sign-street','road-sign-object-stop','road-sign-object-warning','light-curved','light-square','construction-barrier','construction-cone','construction-light','construction-fence','electricity-pole']),
 'city': ('suburban', ['building-type-a','building-type-b','building-type-c','building-type-d','building-type-e','building-type-f','building-type-g','building-type-h','building-type-i','building-type-k','building-type-l','building-type-m','tree-large','tree-small','fence','fence-low','planter']),
 'shops': ('commercial', ['building-a','building-b','building-c','building-d','building-e','building-f','building-g','building-h','building-skyscraper-a','building-skyscraper-b','low-detail-building-a','low-detail-building-b','low-detail-building-c','low-detail-building-d','low-detail-building-wide-a','detail-awning','detail-parasol-a']),
 'people': ('chars', ['character-male-a','character-male-b','character-male-c','character-male-d','character-male-e','character-male-f','wheelchair','aid-cane','aid-cane-blind','item-luggage']),
 'rail': ('train', ['railroad-straight','railroad-curve','train-electric-city-a','train-electric-city-b','train-locomotive-a','train-carriage-box','train-electric-double-a','train-tram-modern','train-tram-classic']),
}
for out, (kit, names) in PICK.items():
    d = os.path.join(dst, out); os.makedirs(os.path.join(d, 'Textures'), exist_ok=True)
    base = os.path.join(src, kit); glbdir = None
    for r, ds, fs in os.walk(base):
        if os.path.basename(r) == 'GLB format': glbdir = r
    for n in names:
        shutil.copy(os.path.join(glbdir, n + '.glb'), d)
    shutil.copy(os.path.join(glbdir, 'Textures', 'colormap.png'), os.path.join(d, 'Textures'))
