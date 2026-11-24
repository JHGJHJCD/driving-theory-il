# הנחיה לסוכן המחשב: נכסים לתמרורים בתלת-ממד (24/11/2026)

המטרה (החלום): לכל תמרור יש המחשה חיה במקום שבו הוא באמת עומד, למשל "אבנים מידרדרות" ליד מצוק עם אבנים שמתגלגלות.
כבר יש אצלנו: רכבים, כבישים, רמזורים, מסילת רכבת, בניינים, עצים, אדם גדול (דמויות גברים בלבד), עגלת נכים, מקל נחייה, כלי בנייה בסיסיים, צלילים.
לא מבקשים: דגמי נשים (בהחלטה של הפרויקט). הרכבים והכבישים שכבר יש לא צריכים להוריד שוב.

## העתק את הבלוק הבא כמו שהוא לסוכן (באנגלית)

```
Goal. Collect free-licensed 3D models, textures and sounds for a browser-based Israeli driving-theory app. Each road sign gets a live 3D demo at the place where the sign stands (e.g. falling-rocks sign next to a rocky cliff with rolling boulders). Collect ONLY the items below; the app already has cars, roads, traffic lights, railway, buildings, trees and generic male pedestrians.

Hard rules (licensing). Allowed: CC0, CC-BY 4.0/3.0, public domain. NOT allowed: CC-BY-NC, CC-BY-ND, editorial-only, GPL, unclear license, anything that needs payment. Never pay and never enter payment details. No female human models (project decision). If a model has a brand logo, still collect it but flag it in the manifest. For every file record: file name, source URL, author, license + license URL, date, polygon count, file size, has_brand_marks, attribution text.

Formats. Models: .glb (PBR, textures embedded), max ~5 MB each (animals/people up to 8 MB, rigged and animated if possible: idle + walk). Textures: JPG 2k with diffuse + normal (OpenGL) + roughness. Audio: .ogg or .wav, 3-20 s, no music. Preferred sources: Poly Haven, Quaternius, Kenney, Sketchfab (filter Downloadable + CC0/CC-BY), OpenGameArt, Freesound. 2-3 candidates per line, best first.

MUST HAVE (priority A)
1. Animals, low/mid poly, rigged if possible: cow, sheep, goat, camel, gazelle/deer, wild boar, dog, horse. (signs: domestic animals, wild animals, camels)
2. Rocks and cliffs: 5+ boulder variants, a rocky cliff face / rock slope piece, a scree/gravel pile, dry rocky-mountain ground textures. (signs: falling rocks, rock slide)
3. Cyclist: a bicycle with a male rider (animated pedal if possible), and a small boy character (school-age child, male). (signs: cyclists, children, school)
4. Road works: worker in hi-vis vest + helmet (male), jackhammer, excavator, road roller, asphalt paver, arrow board / flashing barrier, traffic cones and barriers in several styles. (signs: road works)
5. Bridges and tunnels: tunnel entrance portal, a simple road overpass/bridge, narrow bridge, pedestrian bridge. (signs: tunnel, narrow bridge, low clearance)
6. Road furniture: speed bump (or texture), roundabout island with planting, guardrail, bollards, convex traffic mirror, concrete median barrier, pedestrian-crossing flashing beacon. (signs: roundabout, speed bump, barriers)

NICE TO HAVE (priority B)
7. Places that road-info signs point to: gas station with pumps, EV charging station, bus stop shelter, taxi stand sign, hospital building, airport terminal front, parking lot / parking garage entrance, rest area with picnic table.
8. Special vehicles: tanker truck (hazardous goods), tow truck, road sweeper, tractor with trailer/wagon, caravan/camper, trailer for a car.
9. Terrain and weather: sand/dune ground texture, dirt-road texture, dry grass, wet asphalt, puddle/flood water surface, a few olive and eucalyptus trees, desert shrubs.
10. People (male only): traffic police officer, elderly man with walking stick, man pushing a stroller, group/crowd of pedestrians.
11. Sounds: rockfall/rumble, cow, sheep, camel, jackhammer, reversing beeper, water splash, strong wind, rain, bicycle freewheel.

Folder layout (zip it).
  signs_pack/manifest.csv, skipped.csv, models/ (animals, rocks, people, roadworks, bridges, furniture, places, vehicles), textures/, audio/
Short lowercase names, object type first: animal_camel_01.glb, rock_boulder_03.glb, tex_dirt_road_2k_diff.jpg.

Delivery. Upload the pack to the GitHub repository JHGJHJCD/driving-theory-il on a NEW branch named assets-signs-pack, under the folder incoming/signs-pack/ (do not touch main, do not open a pull request, no single file over 50 MB, split into several commits if needed). Then give the user a 10-line summary: what was found per line, what is missing, any license doubts.
```

## מה אעשה כשהחבילה תגיע
1. אמשוך את הענף `assets-signs-pack`, אבדוק רישיון לכל קובץ מול `manifest.csv`, אוסיף ייחוס ל-`assets3d/LICENSE.txt`.
2. אדלל ואדחוס, אחבר לקטלוג ב-`js/kit3d.js`.
3. אבנה את המשפחות הבאות לפי סדר: איסורים, הוריה, מידע והדרכה, סימונים. המשפחה הראשונה (53 תמרורי אזהרה) כבר בנויה בתבניות, ויוחלפו בה ההמחשות לדגמים אמיתיים (אבנים, חיות, אופניים).
