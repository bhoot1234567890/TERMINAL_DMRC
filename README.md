# TERMINAL_DMRC

Terminal-styled web application for calculating and visualizing the fastest metro route across the Delhi Metro network (DMRC).

**Live Demo:** https://terminal-dmrc.pages.dev

## Features

- Interactive Leaflet map with all 11 metro lines
- A* pathfinding algorithm for optimal route calculation
- Neon/cyberpunk terminal aesthetic
- Mobile-responsive design with map/route toggle
- Rainbow-sorted legend with all active metro lines
- Glowing line effects with proper layering

## Metro Lines Supported

- Red Line (R_LN)
- Airport Express Line (AE_LN)
- Yellow Line (Y_LN)
- Green Line (G_LN)
- Aqua Line (A_LN)
- Blue Line (B_LN)
- Violet Line (V_LN)
- Pink Line (P_LN)
- Magenta Line (M_LN)
- Gray Line (GY_LN)
- Rapid Metro Gurugram (RM_LN)

## Tech Stack

- **Frontend:** React 19 + Vite (rolldown-vite)
- **Styling:** Tailwind CSS 4.x
- **Maps:** Leaflet 1.9.4 + react-leaflet 5.0.0
- **Icons:** Material Symbols Outlined
- **Pathfinding:** A* algorithm with Haversine distance heuristic

## Getting Started

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Project Structure

```
src/
├── components/
│   ├── Header.jsx      # Terminal-styled header with status bar
│   ├── Sidebar.jsx     # Station selection & route display
│   └── Map.jsx         # Leaflet map with metro network
├── data/
│   └── station_network.json  # Graph data (stations, edges, line shapes)
├── utils/
│   └── pathfinding.js  # A* pathfinding algorithm
└── index.css           # Tailwind + custom terminal styles
```

## Data Source

The metro network data is derived from GTFS (General Transit Feed Specification) files for Delhi Metro. The graph representation includes:
- **Stations:** Coordinates and line connections
- **Edges:** Adjacent stations with distances
- **Lines:** Color-coded paths for visualization

## License

MIT License - feel free to use this project for your own transit routing needs.

---

**Built with** React + Vite + Tailwind CSS + Leaflet
