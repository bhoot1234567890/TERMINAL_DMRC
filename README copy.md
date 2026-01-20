# DMRC Pathfinder

✅ **What this project does**

DMRC Pathfinder is a small web app and supporting scripts that calculate and visualize the fastest metro route across the Delhi Metro network (DMRC). The project:

- Parses DMRC GTFS files to construct a station network with station coordinates, adjacency (edges), and line shapes.
- Uses A* (and Dijkstra) pathfinding to compute optimal routes between two stations.
- Displays routes on an interactive Leaflet map with lines, station markers, and a highlighted itinerary.

---

## 💡 Why this exists

This project provides a lightweight, educational route-finder for the Delhi Metro. It demonstrates building a transit graph from GTFS data, running graph pathfinding algorithms, and visualizing the result in a React + Leaflet frontend.

---

## 🔧 Features

- Build network graph from GTFS input (stops, routes, trips, stop_times, shapes) using Python scripts.
- CLI tool to compute and compare routes: `find_route.py` supports both Dijkstra and A*.
- React frontend for interactive route search with a map visualization.
- Basic itinerary info (distance, stops, lines) and map zoom for found routes.

---

## 🗂 Project structure

- `DMRC_GTFS/` — GTFS CSV files used as the data source.
- `generate_network_json.py` — creates `station_network.json` (root) using basic route info.
- `generate_frontend_data.py` — prepares `frontend/src/data/station_network.json` with line colors and shapes for the front-end.
- `find_route.py` — command-line route finder that runs both Dijkstra and A* and compares performance.
- `frontend/` — React app that displays the interactive map and UI.
  - `src/components/Sidebar.jsx` — station autocompletion inputs, UI for route search & results
  - `src/components/Map.jsx` — uses `react-leaflet` to render UI and route
  - `src/utils/pathfinding.js` — A* implementation for the frontend
  - `src/data/station_network.json` — generated JSON for the frontend to render

---

## Getting started (developer)

Prerequisites:
- Node.js (16+ recommended) and npm
- Python 3.8+ to run the generators and CLI tools

1. Generate network data (optional, if not already generated)

To build the frontend JSON (includes shapes, colors), run:

```bash
python3 generate_frontend_data.py
```

This loads GTFS files from `DMRC_GTFS/` and writes `frontend/src/data/station_network.json`.

If you'd like a more compact network JSON without line shapes, use:

```bash
python3 generate_network_json.py
```

This writes `station_network.json` in the project root (which is used by the CLI `find_route.py`).

You can pass a custom config file with options such as `circular_lines` using the `--config` flag:

```bash
python3 generate_frontend_data.py --config generators_config.json
python3 generate_network_json.py --config generators_config.json
```

2. Run route CLI

You can compare Dijkstra and A* using the `find_route.py` script:

```bash
python3 find_route.py "Start Station" "End Station"
```

Example:

```bash
python3 find_route.py "Rajiv Chowk" "Noida City Centre"
```

This script prints distances, line usage, nodes visited, and time spent for Dijkstra vs A*.

3. Run the React front-end

Change into the frontend folder and install dependencies:

```bash
cd frontend
npm install
npm run dev
```

Open the dev server (Vite) URL that prints in the terminal (usually http://localhost:5173).

Search for two station names on the left side panel, choose them, and press "Find Route" to render and view the computed route.

---

## 📚 How the route calculation works

- The Python scripts parse GTFS data to construct a graph where each station is a node and adjacent stops on the same trip are connected with weighted edges (distance in kilometers).
- Each edge stores the `line` that connects two stations and the `distance` between them.
- The frontend A* algorithm uses Haversine distance to compute a heuristic (straight-line distance to the target) and runs A* to find a shortest route (minimizes distance).
- The frontend presentation displays a list of the stations along the route, the total distance (km), number of stops, the lines used, and highlights the route on a Leaflet map.

### Circular lines (e.g., Pink Line)

- The frontend data generator detects circular shapes and ensures the shape's path is exported as a closed path (first coordinate is appended to the end) so the line appears visually closed on the map.
- For the station graph, edges are bidirectional (reverse edges are added) and any circular route is modeled by adding a connecting edge from the last station back to the first (and vice-versa). This way the A* and Dijkstra search can traverse the loop in either direction.
- The closure detection uses a small distance threshold (approx. 50 meters) between the shape's first and last point to mark a shape as circular. You can tweak this threshold in `generate_frontend_data.py`.

If you want to manually ensure a circular line is represented correctly in JSON, you can do two things:

1. Close the line `path` by repeating the first coordinate at the end of the path array (this ensures the polyline looks visually closed in Leaflet):

```json
"lines": {
  "Pink": {
    "color": "#FFC0CB",
    "paths": [
      [[lat1, lon1], [lat2, lon2], ..., [lat1, lon1]]
    ]
  }
}
```

2. In the `edges` map, make sure there's an edge from the last station back to the first station so the graph respects the loop when pathfinding. Example:

```json
"edges": {
  "LastStation": [
    {"to": "FirstStation", "distance": 1.05, "line": "Pink"},
    ...
  ],
  "FirstStation": [
    {"to": "SecondStation", "distance": 0.95, "line": "Pink"},
    {"to": "LastStation", "distance": 1.05, "line": "Pink"}
  ]
}
```

Note: We automatically add both reverse edges for every adjacency in the graph and (optionally) close circular lines using `CIRCULAR_LINES` set in the generator script, so the Pink line will be handled automatically unless you want to fine-tune it manually.

---

## 🚧 Limitations & Future Improvements

- Currently, the frontend A* implementation uses a simple Array for the priority queue. For larger graphs, switching to a binary heap or `MinHeap` will improve performance.
- The route render just draws straight lines between station coordinates rather than following the exact track shapes for each path. `generate_frontend_data.py` gathers shapes in the `lines` object — we can map edges to shape segments to show exact track paths.
- No transfer penalty or dwell-time modeling — paths are distance-based only. It would be useful to model transfer times and train headways for realistic travel-time estimates.
- Minimal mobile/UX support; the UI works well for desktop and should be improved for mobile responsiveness.

---

## 🛠️ Developer notes

- `frontend/src/utils/pathfinding.js` is the main A* implementation used by the web UI; it expects `frontend/src/data/station_network.json` format:

```json
{
  "stations": {
    "Station Name": {
      "name": "Station Name",
      "line_codes": ["Red"],
      "coords": { "lat": 28.123, "lon": 77.123 }
    }
  },
  "edges": {
    "Station Name": [
      {"to": "Other Station", "distance": 1.23, "line": "Red"}
    ]
  },
  "lines": {
    "Red": { "color": "#FF0000", "paths": [ [[lat,lon], [lat,lon], ...], ... ] }
  }
}
```

- To update lines/color and shapes, adjust `get_line_color` mapping and regenerate `station_network.json` using `generate_frontend_data.py`.

## ⚙️ Configuration and Validation

- A `generators_config.json` file in the project root controls generator behavior with the following keys:
  - `circular_lines` — list of line names that should be treated as circular/loop lines (e.g., `"Pink"`).
  - `circular_threshold_km` — detection threshold (in kilometers) used to infer a shape is circular when first and last shape points are within this distance.
  - `add_reverse_edges` — boolean to make edges bi-directional by default.

Example:
```json
{
  "circular_lines": ["Pink"],
  "circular_threshold_km": 0.3,
  "add_reverse_edges": true
}
```

- New scripts read this configuration by default (both generators and `validate_network.py`). You can override the path to config with `--config`.

Validation:

Run the provided validator to ensure the generated JSON obeys two important rules:
  1) All edges are bidirectional (or have reverse edges as configured), and
  2) Circular lines configured in `circular_lines` are represented either by a closed shape path (first==last) or by an explicit last->first edge in the `edges` structure.

Use this command to check the generated network:

```bash
python3 validate_network.py --network frontend/src/data/station_network.json --config generators_config.json
```

---

## 🙌 Contributing

Contributions are welcome. If you want to help:
- Improve the frontend route visual mapping (map route to shapes instead of straight station-to-station lines).
- Add support for travel time, headways, transfer times, or dynamic service availability.
- Improve the priority queue implementation in `pathfinding.js` for performance.

Please open an issue to propose changes and file PRs with tests or reproducible examples.

---

## 📎 License

This project is provided without a specific license. Add a license as needed for your use.

---

If you'd like, I can add screenshots, an example `.env` (if you want to host the map tiles differently), or a small Contributing/PR template next. 💡
