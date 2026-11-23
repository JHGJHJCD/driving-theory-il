# הנחיה לסוכן דפדפן: הורדת נכסים לחוויית תלת-ממד פוטוריאליסטית

העתיקו את הבלוק שבהמשך (באנגלית) לסוכן הדפדפן. מטרתו: לאסוף נכסים חופשיים או ברישיון שמתיר שימוש, בצורה מתועדת, כדי שאוכל לעבד אותם (דילול, דחיסה, חיבור לסצנות) ולהכניס אותם לאפליקציה.

הערה על הציפייה: פוטוריאליזם בדפדפן מוגבל במשקל. לכן אני מבקש דגמים איכותיים ואני מדלל אותם בעצמי (כ-60–100 אלף משולשים לרכב). סך ההורדה בשימוש רגיל צריך להישאר סביב 100–150MB.

---

## Prompt for the browser agent (paste as is)

**Goal.** Collect, from legitimate sources, every 3D model, texture, HDRI and sound needed to make a browser-based driving-theory lesson app look photorealistic (Israeli road scenes: city streets, junctions, crossings, rail crossing, highways, night, tunnel, rain optional). Download only; do not modify files. Produce one folder + a manifest.

**Hard rules (licensing).**
1. Allowed licenses only: CC0, CC-BY 4.0/3.0, public domain, or a paid license that explicitly allows use in a free web app *only if the user has already purchased it*. Never pay or enter payment details. Never use a login that is not the user's own.
2. NOT allowed: CC-BY-NC, CC-BY-ND, "Editorial only", "Standard license" without commercial/web rights, GPL for assets, anything with unclear or missing license. When in doubt, skip it and note it in `skipped.csv`.
3. No brand marks. Prefer generic vehicles. If a model carries a manufacturer logo/badge, still download it but flag it in the manifest (`has_brand_marks=yes`).
4. For every file, record: file name, source URL, author, license (with license URL), date downloaded, polygon count and file size if shown, `has_brand_marks`, and the attribution text if CC-BY. Save as `manifest.csv`.

**Preferred sources.** Sketchfab (use the filter: Downloadable + license CC0 / CC-BY; download the "glTF/GLB" format; log in with the user's own account), Poly Haven (CC0: HDRIs, PBR textures, props), ambientCG (CC0 PBR textures), Quaternius / Kenney / Poly Pizza (CC0 low-poly props, characters), Mixamo is NOT allowed for this app unless the user confirms its terms, Freesound (CC0 or CC-BY sounds only; log in with the user's own account).

**Formats and size limits.**
- Models: `.glb` (or `.gltf` + textures). PBR materials (base color, normal, roughness/metallic). Max ~15MB per vehicle, ~5MB per other model before I decimate. Wheels as separate parts if possible; interior optional (I remove it). Real-scale if known.
- HDRIs: `.hdr` 2k (1k for night/alt skies). Textures: JPG/PNG 2k, maps: diffuse, normal (OpenGL/gl), roughness, AO, optional displacement.
- Audio: `.wav` or `.ogg`, 5–30 s, mono or stereo, no music.
- Total target: 100–200MB.

**What to collect (aim for 2–3 candidates per line, best first).**

A. Vehicles (photoreal, PBR, exterior detailed):
 1. Electric SUV/crossover, modern, generic (Model-Y-like silhouette) — 2 candidates, and 1 electric saloon/hatchback.
 2. Compact car and family hatchback (ICE), SUV, pickup.
 3. Taxi (any city taxi; Israeli taxis are usually white or yellow — either is fine), police car (generic), ambulance (white/red), fire truck.
 4. City bus (single-decker, urban), articulated bus optional, minibus.
 5. Box truck / delivery van, heavy truck with trailer (semi), garbage truck, tractor (farm), construction vehicle (optional).
 6. Motorcycle (naked/standard and scooter), bicycle; with rider optional.
 7. Train: a modern electric passenger train/locomotive (front car at least) for a railway-crossing scene.

B. People (animated if possible: idle, walk, run; rigged glb):
 1. Realistic pedestrians: adult man, adult woman, elderly person, child (school age), teenager.
 2. Wheelchair user, person with a white cane, person pushing a stroller (optional).
 3. Traffic police officer (optional).

C. Environment:
 1. HDRIs (Poly Haven, CC0): clear midday sky, overcast, sunset, night street, two different urban streets, one tunnel/underpass if available.
 2. PBR textures: asphalt (3 variants: new, worn, wet), concrete pavement tiles, kerb stone, paving stones, cobblestone, grass, dry grass/soil, gravel, plaster walls (Mediterranean beige/white), concrete, rail ballast + rails.
 3. Road marking decals or textures: white dashed/solid lines, zebra crossing, stop line, give-way triangles, arrows, yellow lines (if any).
 4. Buildings: Mediterranean/Middle-East apartment blocks (4–8 floors), small houses, shops with awnings, a gas station, a bus stop shelter, a school building (optional).
 5. Vegetation: palm tree, olive tree, ficus, cypress, bushes, hedges, grass patches.
 6. Street props: street lamps (modern LED), traffic lights (vehicle + pedestrian), traffic signs poles, guardrails, concrete barriers, traffic cones, bollards, rail-crossing barrier arms and warning lights, speed bump, trash bins, benches, parked-car clutter.
 7. Israeli road signs: do NOT download from random sites. Only the official table from gov.il ("לוח התמרורים") — just record the URL and license/terms; I will handle the signs.

D. Sound (Freesound/OpenGameArt; CC0 or CC-BY):
 1. Electric car pass-by and interior-less motor whine, EV low-speed warning hum (AVAS).
 2. Combustion car engine idle/rev/pass-by, diesel truck, bus, motorcycle.
 3. Tyre screech/skid, hard brake, ABS, car horn (single and double), truck horn, bicycle bell.
 4. Door close/open, seat-belt click, turn-signal click, key/ignition, handbrake.
 5. Crash/impact (soft), glass break (optional), siren (ambulance/police/fire).
 6. Ambience: city street, highway, rain on road, wind, train pass-by, railway crossing bell.

**Folder layout to produce (zip it).**
```
assets_pack/
  manifest.csv          (all files + license info)
  skipped.csv           (what you found but skipped, with the reason)
  vehicles/  people/  env/  props/  hdri/  textures/  decals/  audio/
```
Use short lowercase file names with the object type first (`car_ev_suv_01.glb`, `bus_city_01.glb`, `tex_asphalt_new_2k_diff.jpg`).

**When finished.** Give the user: the zip, the manifest, and a 10-line summary (what was found for each category, what is missing, any license doubts). Do not upload anything anywhere else.

---

## מה אעשה כשאקבל את החבילה
1. אבדוק רישיון לכל קובץ מול `manifest.csv` ואוסיף ייחוס ל-`assets3d/LICENSE.txt` ולדף "אודות".
2. אדלל ואדחוס (גם דגם הרכב החשמלי שכבר יש בפרויקט עובר את אותו תהליך: `tools/assets3d/ev_extract.mjs` ו-`ev_finish.mjs`).
3. אחבר לקטלוג הרכבים ב-`js/kit3d.js`, ואחליף בהדרגה את הדגמים המסוגננים בסצנות.
4. אבדוק ביצועים בדפדפן ללא כרטיס מסך ואדאג שהכול נטען גם בלי חיבור לאינטרנט.
