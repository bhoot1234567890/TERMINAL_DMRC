import json
import heapq
import sys
import math
import time

# Load the network data
NETWORK_FILE = 'station_network.json'

def load_network():
    with open(NETWORK_FILE, 'r', encoding='utf-8') as f:
        return json.load(f)

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
    r = 6371 # Radius of earth in kilometers
    return c * r

def heuristic(node, target, stations_data):
    """
    Heuristic function for A*: Straight-line distance to the target.
    """
    if node not in stations_data or target not in stations_data:
        return 0
    
    coords1 = stations_data[node]['coords']
    coords2 = stations_data[target]['coords']
    
    return haversine(coords1['lat'], coords1['lon'], coords2['lat'], coords2['lon'])

def dijkstra(graph, start_node, end_node):
    queue = [(0, start_node, [])]
    visited = set()
    min_distances = {node: float('inf') for node in graph}
    min_distances[start_node] = 0
    nodes_visited_count = 0

    while queue:
        current_dist, current_node, path = heapq.heappop(queue)
        nodes_visited_count += 1

        if current_node == end_node:
            return current_dist, path + [(current_node, None)], nodes_visited_count

        if current_node in visited:
            continue
        visited.add(current_node)

        if current_node in graph:
            for edge in graph[current_node]:
                neighbor = edge['to']
                weight = edge['distance']
                line = edge['line']
                
                distance = current_dist + weight

                if distance < min_distances.get(neighbor, float('inf')):
                    min_distances[neighbor] = distance
                    new_path = path + [(current_node, line)]
                    heapq.heappush(queue, (distance, neighbor, new_path))

    return float('inf'), [], nodes_visited_count

def a_star(graph, start_node, end_node, stations_data):
    # Priority queue stores (f_score, g_score, current_node, path)
    # f_score = g_score + h_score
    queue = [(0, 0, start_node, [])]
    visited = set()
    
    # g_score: cost from start to node
    g_scores = {node: float('inf') for node in graph}
    g_scores[start_node] = 0
    
    nodes_visited_count = 0

    while queue:
        f_score, current_g, current_node, path = heapq.heappop(queue)
        nodes_visited_count += 1

        if current_node == end_node:
            return current_g, path + [(current_node, None)], nodes_visited_count

        if current_node in visited:
            continue
        visited.add(current_node)

        if current_node in graph:
            for edge in graph[current_node]:
                neighbor = edge['to']
                weight = edge['distance']
                line = edge['line']
                
                tentative_g = current_g + weight

                if tentative_g < g_scores.get(neighbor, float('inf')):
                    g_scores[neighbor] = tentative_g
                    h_score = heuristic(neighbor, end_node, stations_data)
                    f_score = tentative_g + h_score
                    
                    new_path = path + [(current_node, line)]
                    heapq.heappush(queue, (f_score, tentative_g, neighbor, new_path))

    return float('inf'), [], nodes_visited_count

def format_path(path_data):
    if not path_data:
        return "No path found."

    stations_path = []
    lines_used = []
    
    for i in range(len(path_data) - 1):
        station, line = path_data[i]
        stations_path.append(station)
        if not lines_used or lines_used[-1] != line:
            lines_used.append(line)
    
    stations_path.append(path_data[-1][0])
    
    return {
        "route": stations_path,
        "lines": lines_used
    }

def main():
    if len(sys.argv) < 3:
        print("Usage: python find_route.py \"Start Station\" \"End Station\"")
        return

    start_station = sys.argv[1]
    end_station = sys.argv[2]

    data = load_network()
    stations = data.get('stations', {})
    edges = data.get('edges', {})

    if start_station not in stations:
        print(f"Error: Station '{start_station}' not found.")
        return
    if end_station not in stations:
        print(f"Error: Station '{end_station}' not found.")
        return

    print(f"Finding shortest route from {start_station} to {end_station}...\n")
    
    # Run Dijkstra
    start_time = time.time()
    d_dist, d_path, d_nodes = dijkstra(edges, start_station, end_station)
    d_time = (time.time() - start_time) * 1000

    # Run A*
    start_time = time.time()
    a_dist, a_path, a_nodes = a_star(edges, start_station, end_station, stations)
    a_time = (time.time() - start_time) * 1000

    if d_dist == float('inf'):
        print("No route found between these stations.")
    else:
        result = format_path(a_path)
        print(f"Total Distance: {a_dist:.2f} km")
        print(f"Lines: {', '.join(result['lines'])}")
        print(f"Number of Stations: {len(result['route'])}")
        
        print("\n--- Algorithm Comparison ---")
        print(f"{'Algorithm':<10} | {'Nodes Visited':<15} | {'Time (ms)':<10}")
        print("-" * 40)
        print(f"{'Dijkstra':<10} | {d_nodes:<15} | {d_time:.3f}")
        print(f"{'A*':<10} | {a_nodes:<15} | {a_time:.3f}")
        
        improvement = ((d_nodes - a_nodes) / d_nodes) * 100
        print(f"\nA* visited {improvement:.1f}% fewer nodes.")

        print("\nRoute:")
        print(" -> ".join(result['route']))

if __name__ == "__main__":
    main()
