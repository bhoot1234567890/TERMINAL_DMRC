import React, { useEffect, useState, createContext, useContext } from 'react';
import { MapContainer, TileLayer, Polyline, CircleMarker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import stationNetwork from '../data/station_network.json';

const { stations, lines } = stationNetwork;

// Context to expose map instance to controls
const MapContext = createContext(null);

// Helper to fit map bounds
function MapUpdater({ route }) {
    const map = useMap();

    useEffect(() => {
        if (route && route.length > 0) {
            const bounds = route.map(stationName => {
                const { lat, lon } = stations[stationName].coords;
                return [lat, lon];
            });
            map.fitBounds(bounds, { padding: [50, 50] });
        }
    }, [route, map]);

    return null;
}

// Component to expose map instance through context
function MapInstanceExposer({ setMapInstance }) {
    const map = useMap();
    useEffect(() => {
        setMapInstance(map);
    }, [map, setMapInstance]);
    return null;
}

// Component to invalidate map size when it becomes visible
function MapSizeInvalidator() {
    const map = useMap();
    useEffect(() => {
        // Small timeout to ensure container has size before invalidating
        const timer = setTimeout(() => {
            map.invalidateSize();
        }, 100);
        return () => clearTimeout(timer);
    }, [map]);
    return null;
}

const Map = ({ routeData, showCircular = true }) => {
    const center = [28.6139, 77.2090];
    const [mapInstance, setMapInstance] = useState(null);

    // Prepare all metro lines for rendering
    const allLines = Object.entries(lines).map(([lineName, data]) => ({
        name: lineName,
        color: data.color,
        paths: data.paths
    }));

    // Detect circular lines
    const circularSet = new Set(Object.entries(lines).filter(([, d]) => d.paths.some(p => p.length > 1 && p[0][0] === p[p.length - 1][0] && p[0][1] === p[p.length - 1][1])).map(([lineName]) => lineName));

    // Prepare route highlight
    const routePolylines = [];
    if (routeData && routeData.segments) {
        for (const seg of routeData.segments) {
            const coords = seg.coords;
            const color = (lines[seg.line] && lines[seg.line].color) || 'black';
            routePolylines.push({ positions: coords, color });
        }
    }

    // Create line code mapping for display
    const lineCodeMap = {
        'Red': 'R_LN',
        'Airport Express': 'AE_LN',
        'Yellow': 'Y_LN',
        'Green': 'G_LN',
        'Aqua': 'A_LN',
        'Blue': 'B_LN',
        'Violet': 'V_LN',
        'Pink': 'P_LN',
        'Magenta': 'M_LN',
        'Gray': 'GY_LN',
        'Rapid Metro': 'RM_LN'
    };

    // Rainbow order for sorting: Red, Orange, Yellow, Green, Cyan/Aqua, Blue, Violet, Pink, Magenta, Gray
    const rainbowOrder = ['Red', 'Airport Express', 'Yellow', 'Green', 'Aqua', 'Blue', 'Violet', 'Pink', 'Magenta', 'Gray', 'Rapid Metro'];

    // Sort lines by rainbow order
    const sortedLines = [...allLines].sort((a, b) => rainbowOrder.indexOf(a.name) - rainbowOrder.indexOf(b.name));

    const handleZoomIn = () => {
        if (mapInstance) mapInstance.zoomIn();
    };

    const handleZoomOut = () => {
        if (mapInstance) mapInstance.zoomOut();
    };

    const handleResetView = () => {
        if (mapInstance) mapInstance.setView(center, 11);
    };

    return (
        <section className="flex-1 bg-terminal-bg relative w-full h-full min-h-0">
            {/* Grid background */}
            <div className="absolute inset-0 opacity-[0.03] pointer-events-none z-0" style={{ backgroundImage: 'linear-gradient(#39ff14 1px, transparent 1px), linear-gradient(90deg, #39ff14 1px, transparent 1px)', backgroundSize: '50px 50px' }}></div>

            {/* Map Legend - Brutalist Card Style */}
            <div className="absolute left-4 top-4 lg:left-8 lg:top-8 brutalist-card p-3 lg:p-5 z-20 w-44 lg:w-56 border-l-4 border-l-neon-blue shadow-[10px_10px_0_rgba(0,0,0,1)] max-h-[60vh] lg:max-h-[80vh] overflow-y-auto hidden sm:block">
                <h4 className="text-[9px] lg:text-[10px] font-black text-neon-blue uppercase tracking-[0.2em] mb-3 lg:mb-4">Active Nodes</h4>
                <div className="space-y-1.5 lg:space-y-2 font-mono text-[8px] lg:text-[9px] uppercase tracking-wider text-slate-400">
                    {sortedLines.map((line) => (
                        <div key={line.name} className="flex items-center gap-2 lg:gap-3">
                            <div
                                className="w-1.5 h-1.5 lg:w-2 lg:h-2 shadow-[0_0_5px_currentColor]"
                                style={{
                                    backgroundColor: line.color,
                                    color: line.color,
                                    boxShadow: `0 0 5px ${line.color}`
                                }}
                            ></div>
                            <span className="text-[8px] lg:text-[9px]">{lineCodeMap[line.name] || line.name}: Active</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Map Controls */}
            <div className="absolute right-4 bottom-4 lg:right-8 lg:bottom-8 flex flex-col z-20">
                <button
                    className="size-10 lg:size-12 bg-black border border-terminal-border text-slate-500 hover:text-neon-blue hover:border-neon-blue flex items-center justify-center mb-[-1px] transition-all"
                    title="Zoom In"
                    onClick={handleZoomIn}
                >
                    <span className="material-symbols-outlined text-[18px] lg:text-[22px]">add</span>
                </button>
                <button
                    className="size-10 lg:size-12 bg-black border border-terminal-border text-slate-500 hover:text-neon-blue hover:border-neon-blue flex items-center justify-center mb-[-1px] transition-all"
                    title="Zoom Out"
                    onClick={handleZoomOut}
                >
                    <span className="material-symbols-outlined text-[18px] lg:text-[22px]">remove</span>
                </button>
                <button
                    className="size-10 lg:size-12 bg-black border border-terminal-border text-slate-500 hover:text-neon-blue hover:border-neon-blue flex items-center justify-center transition-all"
                    title="Reset View"
                    onClick={handleResetView}
                >
                    <span className="material-symbols-outlined text-[18px] lg:text-[22px]">filter_center_focus</span>
                </button>
            </div>

            <MapContainer
                center={center}
                zoom={11}
                style={{ height: '100%', width: '100%', position: 'absolute', inset: 0 }}
                className="map-container relative z-10 cursor-crosshair wireframe-map"
            >
                <MapInstanceExposer setMapInstance={setMapInstance} />
                <MapSizeInvalidator />
                <TileLayer
                    url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                />

                {/* Draw the route glow UNDERNEATH everything */}
                {routePolylines.map((p, idx) => (
                    <React.Fragment key={`route-glow-${idx}`}>
                        <Polyline
                            positions={p.positions}
                            pathOptions={{ color: p.color, weight: 50, opacity: 0.08, lineCap: 'round', lineJoin: 'round' }}
                        />
                        <Polyline
                            positions={p.positions}
                            pathOptions={{ color: p.color, weight: 40, opacity: 0.12, lineCap: 'round', lineJoin: 'round' }}
                        />
                        <Polyline
                            positions={p.positions}
                            pathOptions={{ color: p.color, weight: 30, opacity: 0.18, lineCap: 'round', lineJoin: 'round' }}
                        />
                        <Polyline
                            positions={p.positions}
                            pathOptions={{ color: p.color, weight: 20, opacity: 0.25, lineCap: 'round', lineJoin: 'round' }}
                        />
                        <Polyline
                            positions={p.positions}
                            pathOptions={{ color: p.color, weight: 12, opacity: 0.35, lineCap: 'round', lineJoin: 'round' }}
                        />
                    </React.Fragment>
                ))}

                {/* Render All Metro Lines - Glow layer UNDERNEATH everything */}
                {allLines.map((line) => (
                    line.paths.map((path, idx) => (
                        <Polyline
                            key={`${line.name}-glow-${idx}`}
                            positions={path}
                            pathOptions={{
                                color: line.color,
                                weight: (showCircular && circularSet.has(line.name) ? 16 : 12),
                                opacity: (showCircular && circularSet.has(line.name) ? 0.25 : 0.2),
                                dashArray: (showCircular && circularSet.has(line.name) ? '6,6' : null)
                            }}
                        />
                    ))
                ))}

                {/* Render All Metro Lines - Core line UNDERNEATH stations */}
                {allLines.map((line) => (
                    line.paths.map((path, idx) => (
                        <Polyline
                            key={`${line.name}-core-${idx}`}
                            positions={path}
                            pathOptions={{
                                color: line.color,
                                weight: (showCircular && circularSet.has(line.name) ? 7 : 5),
                                opacity: (showCircular && circularSet.has(line.name) ? 0.95 : 0.85),
                                dashArray: (showCircular && circularSet.has(line.name) ? '6,6' : null)
                            }}
                        />
                    ))
                ))}

                {/* Render Stations - ON TOP of everything */}
                {Object.values(stations).map((station) => (
                    <CircleMarker
                        key={station.name}
                        center={[station.coords.lat, station.coords.lon]}
                        pathOptions={{ color: '#006666', fillColor: '#05070a', fillOpacity: 1, weight: 1.5 }}
                        radius={2.5}
                    >
                        <Popup className="font-mono">{station.name}</Popup>
                    </CircleMarker>
                ))}

                {/* Render Calculated Route Highlight - solid core on top */}
                {routePolylines.map((p, idx) => (
                    <Polyline
                        key={`route-core-${idx}`}
                        positions={p.positions}
                        pathOptions={{ color: p.color, weight: 6, opacity: 1, lineCap: 'round', lineJoin: 'round' }}
                    />
                ))}

                {/* Render Calculated Route Start/End Markers */}
                {routeData?.route && routeData.route.map((stationName, index) => {
                    const isStart = index === 0;
                    const isEnd = index === routeData.route.length - 1;

                    if (isStart || isEnd) {
                        return (
                            <CircleMarker
                                key={`marker-${index}`}
                                center={[stations[stationName].coords.lat, stations[stationName].coords.lon]}
                                pathOptions={{
                                    color: isStart ? '#39ff14' : '#00f3ff',
                                    fillColor: isStart ? '#39ff14' : '#00f3ff',
                                    fillOpacity: 1,
                                    weight: 2
                                }}
                                radius={8}
                            />
                        );
                    }
                    return null;
                })}

                <MapUpdater route={routeData?.route} />
            </MapContainer>
        </section>
    );
};

export default Map;
