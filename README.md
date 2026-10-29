# Common Ground — a distance simulation

An interactive architectural 3D simulation of six visitors in a fictional 240 × 160 m plaza. Ava, Ben, Cleo, Dev, Emi, and Finn can be physically close while socially far apart, or physically far apart while directly connected. A locally bundled Three.js scene presents the square alongside live distance measurements, an editable friendship network, and a comparison chart.

## Explore

- Select a pair of visitors to compare their occupied locations and distances.
- Drag the scene to orbit the camera and scroll to zoom. Switch between **Perspective** and **Plan**, or use the camera reset button to restore the initial view.
- Play or pause the simulation as visitors walk along waypoint routes.
- Choose occupant B, then click “Place person B” and select clear ground to relocate them. You can also edit both occupants’ coordinates.
- Edit friendship links to change the social network independently of visitors' physical positions.
- Try **Far away. Still a friend.**, **Nearby. Worlds apart.**, and **The long way around.** to explore contrasting kinds of closeness. Scenarios reset positions and friendships; movement changes spatial distance while friendship links remain fixed until edited.

The 3D scene visualizes the selected spatial connection and obstacle-aware walking route. The friendship network shows social connections and the shortest friendship chain. A two-axis scatterplot compares physical distance in metres with social distance in hops, keeping the two units distinct. Occupant selectors and coordinate fields provide keyboard alternatives to scene selection and placement.

## Two forms of distance

**Physical distance** is the Euclidean straight-line distance between two ground coordinates, measured in simulated metres. Moving a visitor changes the distance between their occupied location and other locations.

**Social distance** is the shortest chain of friendship links between two visitors in a fictional, undirected graph, measured in hops. Direct friends are one hop apart; an indirect connection requires multiple hops. A visitor's distance to themself is zero. Disconnected visitors have no finite social distance, represented as infinity rather than a large finite number.

Friendship-hop distance is a metric within each connected component. Social distance between locations is inferred from the visitors occupying them: it is not an intrinsic property of geography, and an unoccupied point has no assigned social distance. Social distance here describes network connections, not physical separation or health guidance.

The **Far away. Still a friend.** and **Nearby. Worlds apart.** scenarios demonstrate why a visitor can be near a location under one metric and far from it under another. The scatterplot shows the comparison without converting metres into friendship hops. The experiment defines spatially near as ≤40 m, socially close as ≤1 link, intermediate as 2 links, and socially distant as ≥3 links. These are illustrative thresholds, not universal definitions.

## Bonus: routes around obstacles

The route measurement finds a shortest path in a navigation graph sampled on a 2 m grid, then simplifies it using collision-checked line-of-sight segments. It avoids the plaza's pond and buildings and stays inside the plaza boundary. Its length is the sum of the final route segments and can exceed the direct Euclidean distance. Visitors follow waypoint routes at 1.4 m/s before the selected speed multiplier; **The long way around.** highlights how an obstacle changes a route.

The plaza, visitors, friendships, and movement are fictional. Routing treats visitors as points without body-width clearance; landscaping is schematic and passable. The route is an approximation within the model, not a claim about an exact continuous shortest path, observed pedestrian behavior, or real-world accessibility.

## Run and edit

Open [index.html](index.html) in a modern browser, or serve this directory:

```sh
python3 -m http.server 8000
```

Then visit [localhost:8000](http://localhost:8000).

No build step, API keys, backend, or external runtime network requests are required. Three.js **0.160.1** is pinned and bundled locally under its MIT license. The 3D view requires a modern browser with WebGL; measurements, friendship editing, and the comparison chart remain available if scene initialization fails. Keep the following files together when copying or hosting the simulation:

- [index.html](index.html): page structure and controls.
- [assets/simulation.css](assets/simulation.css): layout and visual styling.
- [src/simulation.js](src/simulation.js): simulation state, controls, movement, measurements, and SVG charts.
- [src/scene.js](src/scene.js): Three.js plaza, camera interactions, occupant selection, and distance visualization.
- [src/distance-math.js](src/distance-math.js): physical, social, and routing calculations.
- [assets/vendor/three.min.js](assets/vendor/three.min.js): locally bundled Three.js 0.160.1.
- [assets/vendor/THREE-LICENSE.txt](assets/vendor/THREE-LICENSE.txt): Three.js MIT license; preserve it when redistributing the source.

Edits to these files are reflected when the page reloads. The site can be hosted as static files, including on GitHub Pages.

## Verify calculations

With Node.js installed, run the distance and routing checks:

```sh
node scripts/test-distance-math.cjs
node scripts/test-simulation-routes.cjs
```

These checks cover metric properties and the actual map geometry, including 151 routes. For a visual and interaction check, exercise all three scenarios, play/pause, camera orbit and zoom, Perspective/Plan switching, occupant selection and placement, coordinate validation, co-located people, identity, and disconnected friendships in the browser. Check both desktop and narrow mobile layouts; the calculation checks do not verify WebGL rendering or visual layout.

The 3D redesign was checked in-browser for Perspective/Plan switching, keyboard camera controls, occupant placement, play/pause, all three scenarios, disconnected friendships, identity distance, and layouts at 320 and 1440 px.
