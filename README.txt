Cozy Interiors Pixel Pack (Free Demo)
=====================================

A free demo of the Cozy Interiors Pixel Pack: one finished living room, its
floor, carpet autotile, wall face and wall top, and 25 pieces of furniture
and decor on a 16 x 16 grid, in x1, x2 and x4.

WHAT'S INSIDE
  25 furniture and decor sprites, each in x1, x2 and x4:
    living room: 12 sprites
    lamps: 3 sprites
    plants: 2 sprites
    paintings, clocks, shelves: 2 sprites
    windows and doors: 1 sprite
    rugs: 1 sprite
    decor: 4 sprites
  1 seamless floor materials x 4 variants (4 tiles): wood walnut
  1 wall faces, 2 tiles tall with left, middle and right pieces (6 tiles):
    paint, stripes, wallpaper, brick, wood panel, wainscot and tile
  2 autotiles, 47-tile blob (104 tiles): 1 floor pairs (carpet blue on wood
    walnut) and 1 wall tops (wood), with Godot 4 terrain TileSets and Tiled
    Wang sets
  1 finished sample room as PNG (living room)

FOLDERS
  willosuna_interiors/x1/furniture/<category>/<name>.png   furniture, decor
  willosuna_interiors/x1/animations/<category>/<name>_strip.png
      horizontal strip, frames left to right
  willosuna_interiors/x1/animations/<category>/<name>/frame_NN.png
  willosuna_interiors/x1/tiles/       floors, wall faces, autotiles
  willosuna_interiors/x1/rooms/       finished sample rooms
  willosuna_interiors/x2/ and x4/     the same files at 2x and 4x
  willosuna_interiors/manifest.json   every file, size, layer, fps
  willosuna_interiors/godot/   terrain TileSets for the demo autotiles
  willosuna_interiors/tiled/   Tiled tilesets (.tsx) with Wang sets

GRID, PIVOT AND LAYERS
  Everything is drawn on a 16 x 16 grid. Sprite canvases are 16 or 32 px
  wide and 16 or 32 px tall; the object stands on the bottom-left corner of
  its canvas, so snap that corner to the grid. The "layer" in manifest.json
  says where a sprite goes:
    floor       stands on the floor (sort by its bottom edge)
    wall_floor  stands against the top wall; the upper half covers the
                lower wall face row
    wall        hangs on the wall face (windows, paintings, shelves)
    top         goes on a counter, desk or table: place it on the same
                row as the furniture and raise it 6 to 18 px
    rug         flat on the floor, under everything
  Scale only by whole numbers (x2, x3, x4) with nearest-neighbour.

BUILDING A ROOM
  1. Floor: paint a floor (tiles/floors.png, 4 variants per material) or an
     autotile pair such as carpet on wood.
  2. Wall face: two rows of tiles/wall_faces.png under the top wall (top
     row, then bottom row with the baseboard). Use the left and right end
     tiles where the face meets a side wall.
  3. Wall top: paint the outline of the room with a wall_cap autotile.
  4. Furniture and decor on top, sorted by their bottom edge.


ENGINES
  Godot 4: godot/carpet_blue_on_wood_walnut.tres and
  godot/wall_cap_wood.tres are ready terrain TileSets.
  Tiled: the .tsx files have Wang sets.
  Unity, GameMaker and others: import the PNGs with nearest-neighbour
  (Filter Point), 16 pixels per unit, pivot bottom left.

HOW IT WAS MADE
  Every tile, sprite and frame is drawn by original code written for this
  pack (procedural textures, hand-placed pixel shapes and palettes). No
  photos and no third-party art.

THE FULL PACK
  Cozy Interiors Pixel Pack: 383 furniture and decor sprites, 44 animations
    (fireplace, TV, cats, two walking characters...), 28 floors, 20 wall
    faces, 10 autotiles, 6 sample rooms, a Godot 4 demo house and a Tiled
    map. Name your own price from $1.99.
  https://willosuna.itch.io/cozy-interiors-pixel-pack

LICENSE
  Free for commercial use, royalty free, no attribution required. Reselling or
  redistributing the image files as an asset pack is not permitted. Full
  terms in LICENSE.txt
