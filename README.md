# Common Ground — a distance simulation

An interactive architectural 3D simulation of six visitors in a fictional 240 × 160 m plaza. Ava, Ben, Cleo, Dev, Emi, and Finn can be physically close while socially far apart, or physically far apart while directly connected. A locally bundled Three.js scene presents the square alongside live distance measurements, an editable friendship network, and a comparison chart.

## Explore

- Select a pair of visitors to compare their occupied locations and distances.
- Drag the scene to orbit the camera and scroll to zoom. Switch between **Perspective** and **Plan**, or use the camera reset button to restore the initial view.
- Select two visitors, turn **Friends** on, and press **Run simulation**. They approach one another along an obstacle-aware route, then share random destinations and walk together. Turn Friends off while running to let them wander independently.
- Choose occupant B, then click “Place person B” and select clear ground to relocate them. You can also edit both occupants’ coordinates.
- Edit friendship links using the selected-pair switch or the full network. Changes affect movement immediately without teleporting anyone; pausing preserves the current positions.
- Try **Far away. Still a friend.**, **Nearby. Worlds apart.**, and **The long way around.** to explore contrasting kinds of closeness. Scenarios reset positions and friendships. The links remain fixed until edited; motion now responds to those links.

The 3D scene visualizes the selected spatial connection and obstacle-aware walking route. The friendship network shows social connections and the shortest friendship chain. A two-axis scatterplot compares physical distance in metres with social distance in hops, keeping the two units distinct. Occupant selectors and coordinate fields provide keyboard alternatives to scene selection and placement.

## Two forms of distance

**Physical distance** is the Euclidean straight-line distance between two ground coordinates, measured in simulated metres. Moving a visitor changes the distance between their occupied location and other locations.

**Social distance** is the shortest chain of friendship links between two visitors in a fictional, undirected graph, measured in hops. Direct friends are one hop apart; an indirect connection requires multiple hops. A visitor's distance to themself is zero. Disconnected visitors have no finite social distance, represented as infinity rather than a large finite number.

Friendship-hop distance is a metric within each connected component. Social distance between locations is inferred from the visitors occupying them: it is not an intrinsic property of geography, and an unoccupied point has no assigned social distance. Social distance here describes network connections, not physical separation or health guidance.

The **Far away. Still a friend.** and **Nearby. Worlds apart.** scenarios demonstrate why a visitor can be near a location under one metric and far from it under another. The scatterplot shows the comparison without converting metres into friendship hops. The experiment defines spatially near as ≤40 m, socially close as ≤1 link, intermediate as 2 links, and socially distant as ≥3 links. These are illustrative thresholds, not universal definitions.

## How friendship changes motion

The selected pair is an explicit experiment: two distinct direct friends receive priority as walking partners; two selected nonfriends each take an independent random walk, even if they have other friends in the network. Selecting the same person twice makes that visitor wander solo. A friendship chain of two or more hops does not count as a direct friendship.

Other visitors retain an available direct-friend partner where possible, then form pairs in stable ID order. Unmatched visitors wander independently. Each visitor has at most one walking partner, avoiding conflicting destinations when they have several friends. Selecting a different pair can therefore change walking assignments.

Friends initially follow the same obstacle-aware route from opposite ends and meet near its midpoint. They then share randomly sampled destinations and follow a common route with a small following gap (about 3 m). The follower uses the leader's route rather than cutting corners. Both approach and companionship respect the speed limit; friendship edits never teleport people. Removing the selected friendship cancels their shared route and gives both independent destinations. Chance encounters between nonfriends remain possible.

The status panel distinguishes **Finding each other**, **Walking together**, and **Independent walks**. Agent labels give each person's behavior and partner. Straight-line separation can temporarily increase around an obstacle even while friends make progress toward their meeting point. Random destinations vary between runs; the engine accepts a seeded random generator for reproducible tests.

## Bonus: routes around obstacles

The route measurement finds a shortest path in a navigation graph sampled on a 2 m grid, then simplifies it using collision-checked line-of-sight segments. It avoids the plaza's pond and buildings and stays inside the plaza boundary. Its length is the sum of the final route segments and can exceed the direct Euclidean distance. Visitors follow routes at up to 1.4 m/s before the selected speed multiplier; **The long way around.** highlights how an obstacle changes a route.

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
- [src/simulation.js](src/simulation.js): simulation state, controls, measurements, and SVG charts.
- [src/social-motion.js](src/social-motion.js): friendship matching, rendezvous, companionship, and independent random walks.
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
node scripts/test-social-motion.cjs
```

These checks cover metric properties and the actual map geometry, including 151 routes. Seeded motion tests verify convergence, sustained companionship, switching friendships and selections, independent walks, speed limits, and collision-safe movement. For a visual and interaction check, exercise all three scenarios, play/pause, camera orbit and zoom, Perspective/Plan switching, occupant selection and placement, coordinate validation, co-located people, identity, and disconnected friendships in the browser. Check both desktop and narrow mobile layouts; the calculation checks do not verify WebGL rendering or visual layout.

The 3D redesign was checked in-browser for Perspective/Plan switching, keyboard camera controls, occupant placement, play/pause, all three scenarios, disconnected friendships, identity distance, and layouts at 320 and 1440 px.

The friendship behavior was checked in-browser for approach, sustained companionship, removing and restoring a friendship during motion, the full-network checkbox, same-person selection, the pond detour, invalid-coordinate rejection, reset, and layouts at 320, 740, and 1440 px. The seeded motion test checks 205,990 movement sweeps on the actual map; Ava and Ben rendezvous after about 59.4 simulated seconds and stay about 2–3 m apart over a 15-minute shared walk.
