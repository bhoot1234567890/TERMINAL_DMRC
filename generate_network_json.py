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
OUTPUT_FILE = 'station_network.json'

def haversine(lat1, lon1, lat2, lon2):
    """
    Calculate the great circle distance between two points 
    on the earth (specified in decimal degrees)
    """
    # Convert decimal degrees to radians 
    lat1, lon1, lat2, lon2 = map(math.radians, [lat1, lon1, lat2, lon2])

    # Haversine formula 
    dlon = lon2 - lon1 
    dlat = lat2 - lat1 
    a = math.sin(dlat/2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon/2)**2
    c = 2 * math.asin(math.sqrt(a)) 
    r = 6371 # Radius of earth in kilometers. Use 3956 for miles
    return c * r

def get_line_name(route_long_name):
    """Extracts the line name from the route_long_name field."""
    if not route_long_name:
        return "Unknown"
    
    # Common format seems to be "COLOR_Start to End" or "COLOR/Other_Start to End"
    # Example: "YELLOW_Qutab Minar to Huda City Centre" -> "Yellow"
    # Example: "ORANGE/AIRPORT_Dwarka..." -> "Airport Express" (Custom mapping)
    
    parts = route_long_name.split('_')
    color_part = parts[0]
    
    if "ORANGE" in color_part or "AIRPORT" in color_part:
        return "Airport Express"
    if "RAPID" in color_part:
        return "Rapid Metro"
    
    # Default to Title Case of the color (e.g., "YELLOW" -> "Yellow")
    return color_part.title()

def main():
    logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')
    parser = argparse.ArgumentParser(description='Generate station network JSON from GTFS files')
    parser.add_argument('--config', default='generators_config.json', help='Path to generator config (JSON)')
    args = parser.parse_args()
    config = {}
    if os.path.exists(args.config):
        try:
            with open(args.config, 'r', encoding='utf-8') as cfg:
                config = json.load(cfg)
        except Exception:
            logging.warning('Failed to read config file %s, using defaults', args.config)

    CIRCULAR_LINES = set(config.get('circular_lines', ['Pink']))
    CIRCULAR_THRESHOLD_KM = float(config.get('circular_threshold_km', 0.3))
    ADD_REVERSE = bool(config.get('add_reverse_edges', True))

    logging.info('Loading GTFS data...')

    # Known circular lines (explicitly close last->first for these lines, e.g., Pink ring)
    CIRCULAR_LINES = {"Pink"}

    # 1. Load Stops
    stations = {}
    stop_lookup = {} # ID -> Name
    logging.info(f"Reading {STOPS_FILE}...")
    with open(STOPS_FILE, 'r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        for row in reader:
            stop_id = row['stop_id']
            name = row['stop_name']
            lat = float(row['stop_lat'])
            lon = float(row['stop_lon'])
            
            stations[name] = {
                "name": name,
                "line_codes": set(), # Use set to avoid duplicates
                "coords": {"lat": lat, "lon": lon}
            }
            stop_lookup[stop_id] = name

    # 2. Load Routes
    routes = {} # route_id -> line_name
    logging.info(f"Reading {ROUTES_FILE}...")
    with open(ROUTES_FILE, 'r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        for row in reader:
            routes[row['route_id']] = get_line_name(row['route_long_name'])

    # 3. Load Trips
    trips = {} # trip_id -> route_id
    logging.info(f"Reading {TRIPS_FILE}...")
    with open(TRIPS_FILE, 'r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        for row in reader:
            trips[row['trip_id']] = row['route_id']

    # 4. Load Stop Times and Build Edges
    edges = defaultdict(list)
    trip_stops = defaultdict(list) # trip_id -> list of (sequence, stop_id)

    logging.info(f"Reading {STOP_TIMES_FILE}...")
    with open(STOP_TIMES_FILE, 'r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        for row in reader:
            trip_id = row['trip_id']
            stop_id = row['stop_id']
            seq = int(row['stop_sequence'])
            trip_stops[trip_id].append((seq, stop_id))

    logging.info("Processing trips to build network...")
    # Process each trip to find connections
    processed_edges = set() # To avoid duplicate edges (same line, same direction)

    def add_edge(edges: Dict[str, Any], frm: str, to: str, distance: float, line: str):
        key = (frm, to, line)
        if key in processed_edges:
            return
        edges.setdefault(frm, []).append({
            'to': to,
            'distance': round(distance, 2),
            'line': line
        })
        processed_edges.add(key)
        if ADD_REVERSE:
            rev_key = (to, frm, line)
            if rev_key not in processed_edges:
                edges.setdefault(to, []).append({
                    'to': frm,
                    'distance': round(distance, 2),
                    'line': line
                })
                processed_edges.add(rev_key)

    for trip_id, stops in trip_stops.items():
        # Sort stops by sequence
        stops.sort(key=lambda x: x[0])
        
        route_id = trips.get(trip_id)
        if not route_id:
            continue
        line_name = routes.get(route_id, "Unknown")

        for i in range(len(stops) - 1):
            from_stop_id = stops[i][1]
            to_stop_id = stops[i+1][1]
            
            from_name = stop_lookup.get(from_stop_id)
            to_name = stop_lookup.get(to_stop_id)

            if not from_name or not to_name:
                continue

            # Add line code to stations
            stations[from_name]["line_codes"].add(line_name)
            stations[to_name]["line_codes"].add(line_name)

            # Create unique edge identifier
            edge_key = (from_name, to_name, line_name)
            
            if edge_key not in processed_edges:
                # Calculate distance
                dist = haversine(
                    stations[from_name]["coords"]["lat"],
                    stations[from_name]["coords"]["lon"],
                    stations[to_name]["coords"]["lat"],
                    stations[to_name]["coords"]["lon"]
                )
                
                # Add edge
                add_edge(edges, from_name, to_name, dist, line_name)
                # Add reverse edge, if it doesn't exist already
                rev_key = (to_name, from_name, line_name)
                if rev_key not in processed_edges:
                    edges[to_name].append({
                        "to": from_name,
                        "distance": round(dist, 2),
                        "line": line_name
                    })
                    processed_edges.add(rev_key)
        # If trip closes back to the first station (or stations are very close), connect last->first
        if len(stops) >= 2:
            first_stop = stop_lookup.get(stops[0][1])
            last_stop = stop_lookup.get(stops[-1][1])
            if first_stop and last_stop and first_stop != last_stop:
                dist_end_start = haversine(
                    stations[first_stop]["coords"]["lat"],
                    stations[first_stop]["coords"]["lon"],
                    stations[last_stop]["coords"]["lat"],
                    stations[last_stop]["coords"]["lon"]
                )
                if dist_end_start < CIRCULAR_THRESHOLD_KM:
                    add_edge(edges, last_stop, first_stop, dist_end_start, line_name)
            # Also explicitly close configured circular lines (e.g., Pink) regardless of threshold
            if line_name in CIRCULAR_LINES and len(stops) >= 2:
                first_stop = stop_lookup.get(stops[0][1])
                last_stop = stop_lookup.get(stops[-1][1])
                if first_stop and last_stop and first_stop != last_stop:
                    dist_end_start = haversine(
                        stations[first_stop]["coords"]["lat"],
                        stations[first_stop]["coords"]["lon"],
                        stations[last_stop]["coords"]["lat"],
                        stations[last_stop]["coords"]["lon"]
                    )
                    add_edge(edges, last_stop, first_stop, dist_end_start, line_name)

    # Convert sets to lists for JSON serialization
    for station in stations.values():
        station["line_codes"] = list(station["line_codes"])
        station["line_codes"].sort()

    # Construct final JSON
    output_data = {
        "stations": stations,
        "edges": dict(edges)
    }

    logging.info(f"Writing output to {OUTPUT_FILE}...")
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(output_data, f, indent=2)
    
    logging.info("Done!")

if __name__ == "__main__":
    main()
