import json
import math
import os
import argparse
import logging

from typing import Dict, Any, Tuple, Optional


def haversine(lat1, lon1, lat2, lon2):
    lat1, lon1, lat2, lon2 = map(math.radians, [lat1, lon1, lat2, lon2])
    dlon = lon2 - lon1
    dlat = lat2 - lat1
    a = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    c = 2 * math.asin(math.sqrt(a))
    r = 6371
    return c * r


def load_config(path: str = 'generators_config.json') -> dict:
    if os.path.exists(path):
        with open(path, 'r', encoding='utf-8') as f:
            return json.load(f)
    return {}


def find_nearest_station(lat: float, lon: float, stations: Dict[str, Any], threshold_km: float = 0.3) -> Tuple[Optional[str], float]:
    best = (None, float('inf'))
    for name, st in stations.items():
        d = haversine(lat, lon, st['coords']['lat'], st['coords']['lon'])
        if d < best[1]:
            best = (name, d)
    if best[1] <= threshold_km:
        return best
    return (None, best[1])


def validate_network(path: str = 'frontend/src/data/station_network.json', config_path: str = 'generators_config.json') -> int:
    logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')
    config = load_config(config_path)
    circular_lines = set(config.get('circular_lines', ['Pink']))
    threshold_km = float(config.get('circular_threshold_km', 0.3))

    with open(path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    stations = data.get('stations', {})
    edges = data.get('edges', {})
    lines = data.get('lines', {})

    ok = True

    # Bidirectional check
    logging.info('Running bidirectional edge checks...')
    for u, u_edges in edges.items():
        for e in u_edges:
            v = e['to']
            line = e.get('line')
            d = e.get('distance')
            found = False
            if v in edges:
                for z in edges[v]:
                    if z['to'] == u and z.get('line') == line:
                        # check distance similar
                        if abs(z.get('distance', 0) - d) > 0.5:  # 0.5 km tolerance
                            logging.warning('Edge distance mismatch %s->%s (%s) vs %s->%s, %s vs %s', u, v, line, v, u, d, z.get('distance'))
                        found = True
                        break
            if not found:
                logging.error('Missing reverse edge for %s->%s (%s)', u, v, line)
                ok = False

    # Circular line check (visual path closed or edges contain last->first)
    logging.info('Running circular line checks...')
    for line in circular_lines:
        ln = lines.get(line)
        if not ln:
            logging.warning('Line %s not present in lines object', line)
            continue
        found_closed = False
        for path in ln.get('paths', []):
            if len(path) < 2:
                continue
            if path[0] == path[-1]:
                found_closed = True
                break
            # find nearest stations to first and last coords
            first = path[0]
            last = path[-1]
            first_sta, fd = find_nearest_station(float(first[0]), float(first[1]), stations, threshold_km)
            last_sta, ld = find_nearest_station(float(last[0]), float(last[1]), stations, threshold_km)
            if first_sta and last_sta and last_sta in edges:
                for e in edges[last_sta]:
                    if e['to'] == first_sta and e['line'] == line:
                        found_closed = True
                        break
            if found_closed:
                break
        if not found_closed:
            logging.error('Circular line %s not detected as closed by shape or edges', line)
            ok = False

    if ok:
        logging.info('Network validation succeeded: all checks pass')
        return 0
    else:
        logging.error('Network validation failed: see errors above')
        return 2


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Validate generated station network JSON')
    parser.add_argument('--network', default='frontend/src/data/station_network.json', help='Path to generated network JSON')
    parser.add_argument('--config', default='generators_config.json', help='Path to generators config')
    args = parser.parse_args()
    exit(validate_network(args.network, args.config))
