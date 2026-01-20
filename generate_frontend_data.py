import argparse
import csv
import json
import math
import os
import logging
from collections import defaultdict
from typing import Dict, Any

# Paths to GTFS files
GTFS_DIR = 'DMRC_GTFS'
STOPS_FILE = os.path.join(GTFS_DIR, 'stops.txt')
ROUTES_FILE = os.path.join(GTFS_DIR, 'routes.txt')
TRIPS_FILE = os.path.join(GTFS_DIR, 'trips.txt')
STOP_TIMES_FILE = os.path.join(GTFS_DIR, 'stop_times.txt')
SHAPES_FILE = os.path.join(GTFS_DIR, 'shapes.txt')
OUTPUT_FILE = 'frontend/src/data/station_network.json'

def haversine(lat1, lon1, lat2, lon2):
    lat1, lon1, lat2, lon2 = map(math.radians, [lat1, lon1, lat2, lon2])
    dlon = lon2 - lon1 
    dlat = lat2 - lat1 
    a = math.sin(dlat/2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon/2)**2
    c = 2 * math.asin(math.sqrt(a)) 
    r = 6371 
    return c * r

def get_line_name(route_long_name):
    if not route_long_name: return "Unknown"
    parts = route_long_name.split('_')
    color_part = parts[0]
    if "ORANGE" in color_part or "AIRPORT" in color_part: return "Airport Express"
    if "RAPID" in color_part: return "Rapid Metro"
    return color_part.title()

def get_line_color(line_name):
    colors = {
        "Red": "#FF0000",
        "Yellow": "#FFC300",
        "Blue": "#0000FF",
        "Green": "#008000",
        "Violet": "#EE82EE",
        "Pink": "#FFC0CB",
        "Magenta": "#FF00FF",
        "Gray": "#808080",
        "Orange": "#FFA500",
        "Airport Express": "#FFA500",
        "Aqua": "#00FFFF",
        "Rapid Metro": "#ADD8E6"
    }
    return colors.get(line_name, "#000000")

def main():
    # Ensure output directory exists
    os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)

    logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')
    logging.info("Loading GTFS data...")

    # parse args and load config
    parser = argparse.ArgumentParser(description="Generate frontend station network JSON from GTFS files")
    parser.add_argument("--config", default="generators_config.json", help="Path to generator config (JSON)")
    args = parser.parse_args()
    config = {}
    if os.path.exists(args.config):
        try:
            with open(args.config, 'r', encoding='utf-8') as cfg:
                config = json.load(cfg)
        except Exception:
            logging.warning("Failed to read config file %s, using defaults", args.config)

    CIRCULAR_LINES = set(config.get('circular_lines', ["Pink"]))
    CIRCULAR_THRESHOLD_KM = float(config.get('circular_threshold_km', 0.3))
    ADD_REVERSE = bool(config.get('add_reverse_edges', True))

    # 1. Load Stops
    stations = {}
    stop_lookup = {} 
    with open(STOPS_FILE, 'r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        for row in reader:
            stop_id = row['stop_id']
            name = row['stop_name']
            lat = float(row['stop_lat'])
            lon = float(row['stop_lon'])
            
            stations[name] = {
                "name": name,
                "line_codes": set(),
                "coords": {"lat": lat, "lon": lon}
            }
            stop_lookup[stop_id] = name

    # 2. Load Routes
    routes = {} 
    route_colors = {}
    with open(ROUTES_FILE, 'r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        for row in reader:
            line_name = get_line_name(row['route_long_name'])
            routes[row['route_id']] = line_name
            route_colors[line_name] = get_line_color(line_name)

    # 3. Load Shapes
    shapes = defaultdict(list)
    logging.info(f"Reading {SHAPES_FILE}...")
    with open(SHAPES_FILE, 'r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        for row in reader:
            shape_id = row['shape_id']
            lat = float(row['shape_pt_lat'])
            lon = float(row['shape_pt_lon'])
            seq = int(row['shape_pt_sequence'])
            shapes[shape_id].append((seq, [lat, lon]))
    
    # Sort shapes by sequence
    for shape_id in shapes:
        shapes[shape_id].sort(key=lambda x: x[0])
        shapes[shape_id] = [pt[1] for pt in shapes[shape_id]]

    # 4. Load Trips to link Routes to Shapes
    trips = {} 
    trip_shapes = {}  # trip_id -> shape_id
    route_shapes = defaultdict(set) # line_name -> set of shape_ids
    logging.info(f"Reading {TRIPS_FILE}...")
    with open(TRIPS_FILE, 'r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        for row in reader:
            trip_id = row['trip_id']
            route_id = row['route_id']
            shape_id = row['shape_id']
            trips[trip_id] = route_id
            trip_shapes[trip_id] = shape_id
            
            if shape_id and route_id in routes:
                route_shapes[routes[route_id]].add(shape_id)

    # 5. Load Stop Times and Build Edges
    edges = defaultdict(list)
    trip_stops = defaultdict(list) 

    logging.info(f"Reading {STOP_TIMES_FILE}...")
    with open(STOP_TIMES_FILE, 'r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        for row in reader:
            trip_id = row['trip_id']
            stop_id = row['stop_id']
            seq = int(row['stop_sequence'])
            trip_stops[trip_id].append((seq, stop_id))

    logging.info("Processing trips to build network...")
    processed_edges = set()

    def add_edge(edges: Dict[str, Any], frm: str, to: str, distance: float, line: str, shape_coords=None):
        key = (frm, to, line)
        if key in processed_edges:
            return
        edge_obj = {
            "to": to,
            "distance": round(distance, 2),
            "line": line
        }
        if shape_coords:
            edge_obj["shape"] = shape_coords
        edges.setdefault(frm, []).append(edge_obj)
        processed_edges.add(key)
        if ADD_REVERSE:
            rev_key = (to, frm, line)
            if rev_key not in processed_edges:
                rev_edge_obj = {
                    "to": frm,
                    "distance": round(distance, 2),
                    "line": line
                }
                if shape_coords:
                    rev_edge_obj["shape"] = list(reversed(shape_coords))
                edges.setdefault(to, []).append(rev_edge_obj)
                processed_edges.add(rev_key)

    # helper to find nearest index in a shape's coordinate list
    def nearest_index(shape_points, lat, lon):
        best_idx = None
        best_dist = float('inf')
        for idx, pt in enumerate(shape_points):
            d = haversine(lat, lon, pt[0], pt[1])
            if d < best_dist:
                best_dist = d
                best_idx = idx
        return best_idx, best_dist

    for trip_id, stops in trip_stops.items():
        stops.sort(key=lambda x: x[0])
        
        route_id = trips.get(trip_id)
        if not route_id: continue
        line_name = routes.get(route_id, "Unknown")

        for i in range(len(stops) - 1):
            from_stop_id = stops[i][1]
            to_stop_id = stops[i+1][1]
            
            from_name = stop_lookup.get(from_stop_id)
            to_name = stop_lookup.get(to_stop_id)

            if not from_name or not to_name: continue

            stations[from_name]["line_codes"].add(line_name)
            stations[to_name]["line_codes"].add(line_name)

            edge_key = (from_name, to_name, line_name)
            
            if edge_key not in processed_edges:
                dist = haversine(
                    stations[from_name]["coords"]["lat"],
                    stations[from_name]["coords"]["lon"],
                    stations[to_name]["coords"]["lat"],
                    stations[to_name]["coords"]["lon"]
                )
                # Attach a shape segment to the edge if we know this trip's shape
                shape_segment = None
                shape_id_for_trip = trip_shapes.get(trip_id)
                if shape_id_for_trip and shape_id_for_trip in shapes:
                    shape_pts = shapes[shape_id_for_trip]
                    idx_from, d1 = nearest_index(shape_pts, stations[from_name]["coords"]["lat"], stations[from_name]["coords"]["lon"])
                    idx_to, d2 = nearest_index(shape_pts, stations[to_name]["coords"]["lat"], stations[to_name]["coords"]["lon"])
                    if idx_from is not None and idx_to is not None:
                        if idx_from <= idx_to:
                            shape_segment = shape_pts[idx_from:idx_to+1]
                        else:
                            shape_segment = list(reversed(shape_pts[idx_to:idx_from+1]))

                add_edge(edges, from_name, to_name, dist, line_name, shape_coords=shape_segment)
        # Connect last -> first for circular shapes (if trip's shape is circular)
        shape_id_for_trip = trip_shapes.get(trip_id)
        if shape_id_for_trip and shape_id_for_trip in shapes and len(stops) >= 2:
            s_coords = shapes[shape_id_for_trip]
            if len(s_coords) > 1:
                first_pt = s_coords[0]
                last_pt = s_coords[-1]
                # consider circular if first and last are within a small threshold (~50m)
                if haversine(first_pt[0], first_pt[1], last_pt[0], last_pt[1]) < CIRCULAR_THRESHOLD_KM:
                    from_name = stop_lookup.get(stops[-1][1])
                    to_name = stop_lookup.get(stops[0][1])
                    if from_name and to_name:
                        dist = haversine(
                            stations[from_name]["coords"]["lat"],
                            stations[from_name]["coords"]["lon"],
                            stations[to_name]["coords"]["lat"],
                            stations[to_name]["coords"]["lon"]
                        )
                        # determine shape segment for closure if possible
                        shape_segment = None
                        if shape_id_for_trip and shape_id_for_trip in shapes:
                            shape_pts = shapes[shape_id_for_trip]
                            idx_from, d1 = nearest_index(shape_pts, stations[from_name]["coords"]["lat"], stations[from_name]["coords"]["lon"])
                            idx_to, d2 = nearest_index(shape_pts, stations[to_name]["coords"]["lat"], stations[to_name]["coords"]["lon"])
                            if idx_from is not None and idx_to is not None:
                                if idx_from <= idx_to:
                                    shape_segment = shape_pts[idx_from:idx_to+1]
                                else:
                                    shape_segment = list(reversed(shape_pts[idx_to:idx_from+1]))
                        add_edge(edges, from_name, to_name, dist, line_name, shape_coords=shape_segment)
        # Also explicitly close Pink (or other circular lines) by connecting last->first
        if line_name in CIRCULAR_LINES and len(stops) >= 2:
            from_name = stop_lookup.get(stops[-1][1])
            to_name = stop_lookup.get(stops[0][1])
            if from_name and to_name and from_name != to_name:
                dist = haversine(
                    stations[from_name]["coords"]["lat"],
                    stations[from_name]["coords"]["lon"],
                    stations[to_name]["coords"]["lat"],
                    stations[to_name]["coords"]["lon"]
                )
                # If this is an explicit circular closure, try to detect and attach a shape segment
                shape_segment = None
                shape_id_for_trip = trip_shapes.get(trip_id)
                if shape_id_for_trip and shape_id_for_trip in shapes:
                    shape_pts = shapes[shape_id_for_trip]
                    idx_from, d1 = nearest_index(shape_pts, stations[from_name]["coords"]["lat"], stations[from_name]["coords"]["lon"])
                    idx_to, d2 = nearest_index(shape_pts, stations[to_name]["coords"]["lat"], stations[to_name]["coords"]["lon"])
                    if idx_from is not None and idx_to is not None:
                        if idx_from <= idx_to:
                            shape_segment = shape_pts[idx_from:idx_to+1]
                        else:
                            shape_segment = list(reversed(shape_pts[idx_to:idx_from+1]))
                    add_edge(edges, from_name, to_name, dist, line_name, shape_coords=shape_segment)

    # Prepare Lines Data for Map
    lines_data = {}

    def is_shape_circular(coords):
        if not coords or len(coords) < 2:
            return False
        first = coords[0]
        last = coords[-1]
        return haversine(first[0], first[1], last[0], last[1]) < 0.3

    for line_name, shape_ids in route_shapes.items():
        paths = []
        for sid in shape_ids:
            if sid not in shapes:
                continue
            s = list(shapes[sid])
            # If this shape appears circular, ensure the path is closed visually
            if is_shape_circular(s):
                if s[0] != s[-1]:
                    s = [*s, s[0]]
            paths.append(s)
        lines_data[line_name] = {
            "color": route_colors.get(line_name, "#000000"),
            "paths": paths
        }

    for station in stations.values():
        station["line_codes"] = list(station["line_codes"])
        station["line_codes"].sort()

    output_data = {
        "stations": stations,
        "edges": dict(edges),
        "lines": lines_data
    }

    logging.info(f"Writing output to {OUTPUT_FILE}...")
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(output_data, f, indent=2)
    
    logging.info("Done!")

if __name__ == "__main__":
    main()
