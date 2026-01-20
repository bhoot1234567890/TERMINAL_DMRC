# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

DMRC Pathfinder is a full-stack web application that calculates and visualizes the fastest metro route across the Delhi Metro network (DMRC). The project consists of Python scripts for data processing and route finding, and a React frontend for interactive map visualization.

**Key characteristics:**
- Python backend uses only standard library (no external dependencies)
- Frontend is React + Vite with Tailwind CSS and Leaflet for maps
- Data source is GTFS (General Transit Feed Specification) files
- Pathfinding uses A* algorithm with Haversine distance heuristic

## Common Development Commands

### Python Backend (Project Root)

```bash
# Generate frontend data (includes shapes, colors) for the web app
python3 generate_frontend_data.py

# Generate basic network JSON for CLI usage
python3 generate_network_json.py

# Find routes via CLI (compares Dijkstra vs A*)
python3 find_route.py "Start Station" "End Station"

# Validate generated network JSON
python3 validate_network.py --network frontend/src/data/station_network.json --config generators_config.json
```

### Frontend Development

```bash
cd frontend

# Install dependencies
npm install

# Start development server (Vite)
npm run dev

# Build for production
npm run build

# Run ESLint
npm run lint

# Preview production build
npm run preview
```

## Architecture Overview

### Data Flow

1. **GTFS Data** (`DMRC_GTFS/`) → Python scripts parse into graph representation
2. **Network Generation** → Creates `station_network.json` with stations, edges, and line shapes
3. **Frontend** → Imports network data and runs A* pathfinding in browser
4. **Visualization** → Renders route on Leaflet map with station markers

### Graph Representation

The network is stored as JSON with three main sections:

```json
{
  "stations": {
    "Station Name": {
      "name": "Station Name",
      "line_codes": ["Red", "Yellow"],
      "coords": { "lat": 28.123, "lon": 77.123 }
    }
  },
  "edges": {
    "Station Name": [
      {"to": "Other Station", "distance": 1.23, "line": "Red"}
    ]
  },
  "lines": {
    "Red": {
      "color": "#FF0000",
      "paths": [[[lat,lon], [lat,lon], ...]]
    }
  }
}
```

### Key Python Scripts

| Script | Purpose |
|--------|---------|
| `generate_frontend_data.py` | Creates enhanced JSON with line shapes/colors for frontend |
| `generate_network_json.py` | Creates basic JSON without shapes for CLI |
| `find_route.py` | CLI tool comparing Dijkstra and A* performance |
| `validate_network.py` | Validates network structure and circular line handling |

### Frontend Component Structure

- `App.jsx` - Root component managing route state and sidebar toggle
- `components/Sidebar.jsx` - Station selection with autocomplete, route display
- `components/Map.jsx` - Leaflet map rendering stations, lines, and route
- `utils/pathfinding.js` - A* algorithm implementation (uses simple array priority queue)

### Important Configuration

`generators_config.json` controls:
- `circular_lines`: Lines that form loops (e.g., Pink line)
- `circular_threshold_km`: Distance threshold to detect circular shapes
- `add_reverse_edges`: Makes all edges bidirectional

## Circular Line Handling

The Pink line is configured as circular in `generators_config.json`. Circular lines require:
1. Shape path must be closed (first coordinate repeated at end)
2. Edge from last station back to first station must exist

The generator automatically handles both, but when manually editing JSON or adding new circular lines, ensure these conditions are met.

## Technology Stack Notes

- **Build Tool**: Vite using `rolldown-vite` (not standard Vite)
- **Map**: Leaflet 1.9.4 with react-leaflet 5.0.0
- **Styling**: Tailwind CSS 4.x with PostCSS
- **Icons**: Lucide React
- **Geospatial**: Turf.js for bezier spline interpolation

## Known Limitations

1. **Priority Queue**: Frontend A* uses simple array instead of binary heap (performance concern for larger graphs)
2. **Route Rendering**: Draws straight lines between stations, not exact track shapes
3. **No Time-Based Routing**: Distance-based only, no transfer penalties or dwell times
4. **Map Tiles**: Uses default OpenStreetMap tiles (check terms of use for production)

## Data Source Files Used

- `stops.txt` - Station information and coordinates
- `routes.txt` - Metro line information
- `trips.txt` - Trip definitions
- `stop_times.txt` - Station sequences
- `shapes.txt` - Track shape coordinates
- `calendar.txt` - Service schedules
- `agency.txt` - Operator information

## Development Workflow

When modifying the network or adding features:
1. Edit generator scripts if data structure changes
2. Regenerate network JSON with appropriate script
3. Validate with `validate_network.py`
4. If frontend changes needed, update React components
5. Test with `npm run dev`
