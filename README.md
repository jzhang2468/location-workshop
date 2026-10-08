# Location Workshop

An interactive Three.js workshop for describing location and space in Washington Square Park, New York City.

Each modeled space has a stable address, coordinates, and an occupancy record. Explore the same place through five views:

- **Coordinate system:** locate a space by its ID, local east/north coordinates, or latitude and longitude.
- **Object → location:** select the arch, fountain, workshop bench, or simulated visitor.
- **Location → occupant:** inspect a ground point and move the visitor to clear ground.
- **Reference frame:** compare compass directions with the visitor's viewpoint.
- **Infer a location:** use clues to narrow a set of candidate places.

## Run

Open index.html in a modern browser, or serve this directory:

    python3 -m http.server 8000

Then visit [localhost:8000](http://localhost:8000).

WebGL and an internet connection are required. Three.js 0.160.1 and D3 7.9.0 load from pinned jsDelivr URLs. No API keys or backend are required.

## Edit and rebuild

The readable HTML, CSS, and JavaScript source is in [src/workshop.html](src/workshop.html). After editing, regenerate the standalone page:

    python3 scripts/render.py src/workshop.html index.html --force --title "Location Workshop"

The renderer uses only the Python standard library and the checked-in assets. It includes standalone styles and local browser state persistence, so the exported simulation runs outside Codex.

## Coordinate conventions

- The local coordinate origin defaults to the fountain. The arch midpoint can be selected as an alternative origin.
- **X** increases east and **Y** increases north; both use approximate metres. Queries refer to ground level.
- Internally, the 3D engine uses east as X, elevation as Y, and south as Z.
- Grid cells are 20 × 20 m. Columns A–Q increase west to east; rows 01–15 increase south to north.
- The fixed grid starts 180 m west and 140 m south of the fountain. Changing the displayed origin does not change cell IDs.
- A space ID such as WSP-K10 selects the cell's center. Boundary cells may extend beyond the park; the result identifies points outside the park.
- Object locations use ground anchors. Cell occupancy uses footprint intersection, while point occupancy tests the actual ground footprint. Thus a cell may contain the arch's piers while a point beneath its opening is clear.

This is an educational model, not a survey, cadastral system, or live occupancy map.

## Data and attribution

Park and landmark footprints are based on [© OpenStreetMap contributors](https://www.openstreetmap.org/copyright), available under the [Open Database License](https://opendatacommons.org/licenses/odbl/1-0/).

- [Washington Square Park, way 22899302](https://www.openstreetmap.org/way/22899302)
- [Washington Square Arch, way 248166269](https://www.openstreetmap.org/way/248166269)
- [Washington Square Fountain, way 959929617](https://www.openstreetmap.org/way/959929617)

The source geometry snapshot is in [data/landmarks.geojson](data/landmarks.geojson); the running page embeds its geometry. Architecture, planting, paths, the bench, visitor, and workshop grid are simplified or illustrative. Geographic coordinate readouts are approximate.

## Verification

The standalone export was checked in Chrome for coordinate lookup, cell addressing, origin changes, GPS round trips, point occupancy, visitor placement, input validation, saved state, and layouts down to 320 px.
