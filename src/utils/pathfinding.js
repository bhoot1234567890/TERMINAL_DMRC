import stationNetwork from '../data/station_network.json';

const { stations, edges } = stationNetwork;

function haversine(lat1, lon1, lat2, lon2) {
  const toRad = (x) => (x * Math.PI) / 180;
  const R = 6371; // Radius of earth in km

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

function heuristic(node, target) {
  const coords1 = stations[node]?.coords;
  const coords2 = stations[target]?.coords;

  if (!coords1 || !coords2) return 0;

  return haversine(coords1.lat, coords1.lon, coords2.lat, coords2.lon);
}

export function findShortestPath(startNode, endNode, options = {}) {
  if (!stations[startNode] || !stations[endNode]) {
    return null;
  }

  // Priority Queue implementation using a simple array for this scale
  // [f_score, g_score, current_node, path]
  const openSet = [{ f: 0, g: 0, node: startNode, path: [] }];
  const closedSet = new Set();
  
  const gScores = {}; // node -> g_score
  gScores[startNode] = 0;

  while (openSet.length > 0) {
    // Sort by f_score (lowest first)
    openSet.sort((a, b) => a.f - b.f);
    const current = openSet.shift();
    const { g: currentG, node: currentNode, path } = current;

    if (currentNode === endNode) {
      // Reconstruct path with lines
      const fullPath = [...path, { station: currentNode, line: null }];
      return formatResult(fullPath);
    }

    if (closedSet.has(currentNode)) continue;
    closedSet.add(currentNode);

    const neighbors = edges[currentNode] || [];

    for (const edge of neighbors) {
      const neighbor = edge.to;
      const weight = edge.distance;
      const line = edge.line;
      const shape = edge.shape || null;

      if (closedSet.has(neighbor)) continue;

      // Add transfer penalty if the line changed
      // 5 minutes of transfer time ≈ 1.5 km at average metro speed (18 km/h)
      const transferPenalty = options.transferPenalty !== undefined ? options.transferPenalty : 1.5;
      const prevLine = path.length > 0 ? path[path.length - 1].line : null;
      const penalty = prevLine && prevLine !== line ? transferPenalty : 0;
      const tentativeG = currentG + weight + penalty;

      if (tentativeG < (gScores[neighbor] || Infinity)) {
        gScores[neighbor] = tentativeG;
        const h = heuristic(neighbor, endNode);
        const f = tentativeG + h;

        openSet.push({
          f,
          g: tentativeG,
          node: neighbor,
          path: [...path, { station: currentNode, line, shape }],
        });
      }
    }
  }

  return null;
}

function formatResult(pathData) {
  const route = pathData.map(p => p.station);
  const lines = [];
  let totalDistance = 0;
  const segments = [];

  for (let i = 0; i < pathData.length - 1; i++) {
    const currentStation = pathData[i].station;
    const nextStation = pathData[i+1].station;
    const line = pathData[i].line;
    
    if (lines.length === 0 || lines[lines.length - 1] !== line) {
      lines.push(line);
    }

    // Find distance for this segment
    const edge = edges[currentStation].find(e => e.to === nextStation && e.line === line);
    if (edge) {
      totalDistance += edge.distance;
    }
    // prefer edge.shape if available
    if (edge && edge.shape) {
      segments.push({ from: currentStation, to: nextStation, line, coords: edge.shape });
    } else {
      segments.push({ from: currentStation, to: nextStation, line, coords: [
        [stations[currentStation].coords.lat, stations[currentStation].coords.lon],
        [stations[nextStation].coords.lat, stations[nextStation].coords.lon]
      ] });
    }
  }

  return {
    route,
    lines,
    segments,
    totalDistance: parseFloat(totalDistance.toFixed(2)),
    stops: route.length
  };
}
