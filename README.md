# Common Ground — a distance simulation

An interactive simulation of six visitors in a fictional 240 × 160 m plaza. Ava, Ben, Cleo, Dev, Emi, and Finn can be physically close while socially far apart, or physically far apart while directly connected.

## Explore

- Select a pair of visitors to compare their occupied locations and distances.
- Play or pause the simulation as visitors walk along waypoint routes.
- Choose occupant B, then click “Place person B” and select clear ground to relocate them. You can also edit both occupants’ coordinates.
- Edit friendship links to change the social network independently of visitors' physical positions.
- Try **Far away. Still a friend.**, **Nearby. Socially distant.**, and **Across the water.** presets to explore contrasting kinds of closeness.

The map visualizes the selected spatial connection and obstacle-aware route. The friendship network shows social connections and the shortest friendship chain. A two-axis scatterplot compares physical distance in metres with social distance in hops, keeping the two units distinct.

## Two forms of distance

**Physical distance** is the Euclidean straight-line distance between two ground coordinates, measured in simulated metres. Moving a visitor changes the distance between their occupied location and other locations.

**Social distance** is the shortest chain of friendship links between two visitors in a fictional, undirected graph, measured in hops. Direct friends are one hop apart; an indirect connection requires multiple hops. A visitor's distance to themself is zero. Disconnected visitors have no finite social distance, represented as infinity rather than a large finite number.

Friendship-hop distance is a metric within each connected component. Social distance between locations is inferred from the visitors occupying them: it is not an intrinsic property of geography, and an unoccupied point has no assigned social distance. Social distance here describes network connections, not physical separation or health guidance.

The **Far friends** and **Near strangers** scenarios demonstrate why a visitor can be near a location under one metric and far from it under another. The scatterplot shows the comparison without converting metres into friendship hops.

## Bonus: routes around obstacles

The route measurement finds a shortest path in a navigation graph sampled on a 2 m grid, then simplifies it using collision-checked line-of-sight segments. It avoids the plaza's modeled obstacles and stays inside the plaza boundary. Its length is the sum of the final route segments and can exceed the direct Euclidean distance. Visitors follow waypoint routes when moving; the **Detour** preset highlights how an obstacle changes a route.

The plaza, visitors, friendships, and movement are fictional. Routing treats visitors as points without body-width clearance. The route is an approximation within the model, not a claim about an exact continuous shortest path, observed pedestrian behavior, or real-world accessibility.

## Run and edit

Open [index.html](index.html) in a modern browser, or serve this directory:

```sh
python3 -m http.server 8000
```

Then visit [localhost:8000](http://localhost:8000).

No build step, external libraries, API keys, or backend are required. Keep the following files together when copying or hosting the simulation:

- [index.html](index.html): page structure and controls.
- [assets/simulation.css](assets/simulation.css): layout and visual styling.
- [src/simulation.js](src/simulation.js): simulation state, interactions, movement, and visualization.
- [src/distance-math.js](src/distance-math.js): physical, social, and routing calculations.

Edits to these files are reflected when the page reloads. The site can be hosted as static files, including on GitHub Pages.

## Verify calculations

With Node.js installed, run the distance and routing checks:

```sh
node scripts/test-distance-math.cjs
node scripts/test-simulation-routes.cjs
```

These checks cover metric properties and the actual map geometry, including 151 routes. The replacement was also checked in-browser for all three presets, play/pause, map placement, coordinate validation, co-located people, identity, disconnected friendships, and layouts at 320, 900, and 1360 px.
