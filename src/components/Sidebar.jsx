import React, { useState, useEffect, useRef } from 'react';
import stationNetwork from '../data/station_network.json';

const { stations } = stationNetwork;
const stationList = Object.keys(stations).sort();

const RECENT_SEARCHES_KEY = 'dmrc_recent_searches';
const MAX_RECENT_SEARCHES = 5;

const getLineColor = (line) => {
    const colors = {
        'Yellow': { bg: 'bg-[#FACC15]', glow: 'shadow-[0_0_5px_#FACC15]' },
        'Blue': { bg: 'bg-[#3B82F6]', glow: 'shadow-[0_0_5px_#3B82F6]' },
        'Red': { bg: 'bg-[#EF4444]', glow: 'shadow-[0_0_5px_#EF4444]' },
        'Green': { bg: 'bg-green-500', glow: 'shadow-[0_0_5px_#22c55e]' },
        'Violet': { bg: 'bg-[#A855F7]', glow: 'shadow-[0_0_5px_#A855F7]' },
        'Pink': { bg: 'bg-[#EC4899]', glow: 'shadow-[0_0_5px_#EC4899]' },
        'Magenta': { bg: 'bg-[#DB2777]', glow: 'shadow-[0_0_5px_#DB2777]' },
        'Grey': { bg: 'bg-gray-500', glow: 'shadow-[0_0_5px_#6b7280]' },
        'Orange': { bg: 'bg-[#F97316]', glow: 'shadow-[0_0_5px_#F97316]' },
        'Aqua': { bg: 'bg-cyan-400', glow: 'shadow-[0_0_5px_#22d3ee]' },
        'Rapid': { bg: 'bg-slate-500', glow: 'shadow-[0_0_5px_#64748b]' },
    };
    return colors[line] || { bg: 'bg-slate-400', glow: '' };
};

const Sidebar = ({ onFindRoute, routeData }) => {
    const [start, setStart] = useState('');
    const [end, setEnd] = useState('');
    const [suggestions, setSuggestions] = useState({ start: [], end: [] });
    const [activeInput, setActiveInput] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [recentSearches, setRecentSearches] = useState([]);
    const [error, setError] = useState(null);
    const [routePreference, setRoutePreference] = useState('fastest');
    const startInputRef = useRef(null);
    const endInputRef = useRef(null);

    // Load recent searches from localStorage on mount
    useEffect(() => {
        try {
            const saved = localStorage.getItem(RECENT_SEARCHES_KEY);
            if (saved) {
                setRecentSearches(JSON.parse(saved));
            }
        } catch (e) {
            console.warn('Could not load recent searches:', e);
        }
    }, []);

    // Save recent searches to localStorage
    const saveRecentSearch = (startStation, endStation) => {
        const newSearch = { from: startStation, to: endStation, timestamp: Date.now() };
        const filtered = recentSearches.filter(
            s => s.from !== startStation || s.to !== endStation
        );
        const updated = [newSearch, ...filtered].slice(0, MAX_RECENT_SEARCHES);
        setRecentSearches(updated);
        try {
            localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
        } catch (e) {
            console.warn('Could not save recent search:', e);
        }
    };

    const handleSearch = (type, value) => {
        if (type === 'start') setStart(value); else setEnd(value);
        setError(null);
        if (value.length > 0) {
            const filtered = stationList.filter(s => s.toLowerCase().includes(value.toLowerCase()));
            setSuggestions(prev => ({ ...prev, [type]: filtered.slice(0, 8) }));
        } else {
            setSuggestions(prev => ({ ...prev, [type]: [] }));
        }
    };

    const selectStation = (type, name) => {
        if (type === 'start') setStart(name); else setEnd(name);
        setSuggestions(prev => ({ ...prev, [type]: [] }));
        setError(null);
        if (type === 'start') {
            endInputRef.current?.focus();
        }
    };

    const selectRecentSearch = (from, to) => {
        setStart(from);
        setEnd(to);
        setSuggestions(prev => ({ ...prev, start: [], end: [] }));
        setActiveInput(null);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);

        if (!start || !end) {
            setError('ERROR: COORDINATES REQUIRED. ENTER BOTH ORIGIN AND DESTINATION.');
            return;
        }

        if (start === end) {
            setError('ERROR: ORIGIN AND DESTINATION CANNOT BE IDENTICAL.');
            return;
        }

        setIsLoading(true);

        await new Promise(resolve => setTimeout(resolve, 300));

        try {
            const result = findShortestPath(start, end);

            if (result) {
                const fare = calculateFare(result.totalDistance);
                const time = estimateTime(result.totalDistance, result.lines.length - 1);

                onFindRoute(start, end, {
                    ...result,
                    fare,
                    totalTime: time
                });
                saveRecentSearch(start, end);
                setActiveInput(null);
            } else {
                setError('ERROR: NO ROUTE FOUND. VERIFY STATION NAMES AND RETRY.');
            }
        } catch (err) {
            setError('SYSTEM ERROR: ROUTE CALCULATION FAILED. RETRY.');
            console.error('Route finding error:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const swapStations = () => {
        const tmp = start;
        setStart(end);
        setEnd(tmp);
        setError(null);
    };

    const clearRecentSearches = () => {
        setRecentSearches([]);
        try {
            localStorage.removeItem(RECENT_SEARCHES_KEY);
        } catch (e) {
            console.warn('Could not clear recent searches:', e);
        }
    };

    // Fare calculation (simplified DMRC fare structure)
    const calculateFare = (distance) => {
        const baseFare = 10;
        if (distance <= 2) return baseFare;
        if (distance <= 5) return 20;
        if (distance <= 12) return 30;
        if (distance <= 18) return 40;
        if (distance <= 24) return 50;
        if (distance <= 32) return 60;
        return Math.min(80, baseFare + Math.ceil((distance - 2) / 3) * 10);
    };

    // Time estimation
    const estimateTime = (distance, transfers) => {
        const avgSpeed = 30;
        const travelTime = (distance / avgSpeed) * 60;
        const transferTime = transfers * 5;
        return travelTime + transferTime + 5;
    };

    // Helper function for pathfinding
    function findShortestPath(startNode, endNode) {
        if (!stations[startNode] || !stations[endNode]) return null;

        const edges = stationNetwork.edges;

        const haversine = (lat1, lon1, lat2, lon2) => {
            const toRad = (x) => (x * Math.PI) / 180;
            const R = 6371;
            const dLat = toRad(lat2 - lat1);
            const dLon = toRad(lon2 - lon1);
            const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
                Math.sin(dLon / 2) * Math.sin(dLon / 2);
            return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        };

        const heuristic = (node, target) => {
            const coords1 = stations[node]?.coords;
            const coords2 = stations[target]?.coords;
            if (!coords1 || !coords2) return 0;
            return haversine(coords1.lat, coords1.lon, coords2.lat, coords2.lon);
        };

        const openSet = [{ f: 0, g: 0, node: startNode, path: [] }];
        const closedSet = new Set();
        const gScores = { [startNode]: 0 };
        const transferPenalty = routePreference === 'fastest' ? 1.5 : 3;

        while (openSet.length > 0) {
            openSet.sort((a, b) => a.f - b.f);
            const current = openSet.shift();
            const { g: currentG, node: currentNode, path } = current;

            if (currentNode === endNode) {
                const fullPath = [...path, { station: currentNode, line: null }];
                const route = fullPath.map(p => p.station);
                const lines = [];
                const segments = [];
                let totalDistance = 0;

                for (let i = 0; i < fullPath.length - 1; i++) {
                    const line = fullPath[i].line;
                    if (lines.length === 0 || lines[lines.length - 1] !== line) {
                        lines.push(line);
                    }

                    const currentStation = fullPath[i].station;
                    const nextStation = fullPath[i + 1].station;
                    const edge = edges[currentStation]?.find(e => e.to === nextStation && e.line === line);
                    if (edge) {
                        totalDistance += edge.distance;
                        segments.push({
                            from: currentStation,
                            to: nextStation,
                            line,
                            coords: edge.shape || [
                                [stations[currentStation].coords.lat, stations[currentStation].coords.lon],
                                [stations[nextStation].coords.lat, stations[nextStation].coords.lon]
                            ]
                        });
                    }
                }

                const pathWithDetails = route.map((station, idx) => {
                    let line = lines[0];
                    let lineChange = false;

                    for (let i = 0; i < segments.length; i++) {
                        if (segments[i].from === station) {
                            line = segments[i].line;
                        }
                    }

                    if (idx > 0 && idx < route.length - 1) {
                        for (let i = 0; i < segments.length - 1; i++) {
                            if (segments[i].to === station && segments[i + 1].from === station) {
                                if (segments[i].line !== segments[i + 1].line) {
                                    lineChange = true;
                                }
                            }
                        }
                    }

                    return {
                        name: station,
                        line,
                        lineChange
                    };
                });

                return {
                    route,
                    lines,
                    segments,
                    totalDistance,
                    stops: route.length,
                    path: {
                        path: pathWithDetails,
                        totalTime: 0,
                        fare: 0
                    }
                };
            }

            if (closedSet.has(currentNode)) continue;
            closedSet.add(currentNode);

            const neighbors = edges[currentNode] || [];
            for (const edge of neighbors) {
                if (closedSet.has(edge.to)) continue;

                const prevLine = path.length > 0 ? path[path.length - 1].line : null;
                const penalty = prevLine && prevLine !== edge.line ? transferPenalty : 0;
                const tentativeG = currentG + edge.distance + penalty;

                if (tentativeG < (gScores[edge.to] || Infinity)) {
                    gScores[edge.to] = tentativeG;
                    const h = heuristic(edge.to, endNode);
                    openSet.push({
                        f: tentativeG + h,
                        g: tentativeG,
                        node: edge.to,
                        path: [...path, { station: currentNode, line: edge.line }]
                    });
                }
            }
        }

        return null;
    }

    return (
        <aside className="w-full lg:w-[450px] bg-black border-r border-terminal-border flex flex-col z-30 shrink-0 h-full overflow-y-auto">
            {/* Status Alert */}
            <div className="bg-neon-pink/5 border-b border-neon-pink/30 px-3 py-1.5 lg:px-6 lg:py-2 flex items-center gap-2 lg:gap-3 shrink-0">
                <div className="size-1.5 lg:size-2 bg-neon-pink animate-pulse rounded-full shadow-[0_0_8px_#ff00ff] shrink-0"></div>
                <p className="text-neon-pink text-[8px] lg:text-[10px] font-bold uppercase tracking-[0.1em] truncate">
                    Yellow Line [NOMINAL] // Blue Line [NOMINAL]
                </p>
            </div>

            <div className="p-4 lg:p-8 flex flex-col gap-6 lg:gap-10 flex-1 overflow-y-auto">
                {/* Hero Text */}
                <div className="border-l-4 border-neon-green pl-3 lg:pl-4">
                    <h2 className="text-xl lg:text-3xl font-black text-white uppercase tracking-tighter mb-1 italic">Plan Your Journey</h2>
                    <p className="text-slate-600 text-[9px] lg:text-[11px] font-mono leading-relaxed">SYSTEM_STATUS: READY. AWAITING COORDINATES...</p>
                </div>

                {/* Input Form */}
                <form className="flex flex-col gap-4 lg:gap-8" onSubmit={handleSubmit}>
                    {/* From Input */}
                    <div className="flex flex-col gap-2 lg:gap-3">
                        <div className="flex justify-between items-end">
                            <label className="text-[9px] lg:text-[10px] font-bold text-slate-500 uppercase tracking-[0.15em] lg:tracking-[0.2em]">Origin Station</label>
                            <span className="hidden lg:inline text-[9px] text-neon-green/40 font-mono">[CMD: START_LOC]</span>
                        </div>
                        <div className="relative group">
                            <span className="absolute left-0 top-1/2 -translate-y-1/2 text-neon-green material-symbols-outlined text-[16px] lg:text-[18px]">chevron_right</span>
                            <input
                                ref={startInputRef}
                                type="text"
                                placeholder=" Rajiv Chowk"
                                className="terminal-input text-base lg:text-lg font-bold"
                                value={start}
                                onChange={(e) => handleSearch('start', e.target.value)}
                                onFocus={() => setActiveInput('start')}
                                onBlur={() => setTimeout(() => setActiveInput(null), 200)}
                                autoComplete="off"
                            />
                            {activeInput === 'start' && suggestions.start.length > 0 && (
                                <ul className="absolute left-0 right-0 top-[100%] mt-2 bg-black border border-terminal-border z-50">
                                    {suggestions.start.map((station) => (
                                        <li key={station}>
                                            <button
                                                type="button"
                                                onMouseDown={() => selectStation('start', station)}
                                                className="w-full text-left px-3 py-2 lg:px-4 lg:py-3 hover:bg-neon-green/10 transition text-xs lg:text-sm text-neon-green font-mono border-b border-terminal-border last:border-0"
                                            >
                                                {station}
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </div>

                    {/* Swap Button */}
                    <div className="flex justify-center -my-2 lg:-my-4 relative z-10">
                        <button
                            type="button"
                            onClick={swapStations}
                            className="bg-black border border-terminal-border size-8 lg:size-10 flex items-center justify-center text-neon-blue hover:border-neon-blue hover:shadow-[0_0_10px_#00f3ff] transition-all"
                        >
                            <span className="material-symbols-outlined text-[20px] lg:text-[24px]">swap_calls</span>
                        </button>
                    </div>

                    {/* To Input */}
                    <div className="flex flex-col gap-2 lg:gap-3">
                        <div className="flex justify-between items-end">
                            <label className="text-[9px] lg:text-[10px] font-bold text-slate-500 uppercase tracking-[0.15em] lg:tracking-[0.2em]">Destination</label>
                            <span className="hidden lg:inline text-[9px] text-neon-blue/40 font-mono">[CMD: END_LOC]</span>
                        </div>
                        <div className="relative group">
                            <span className="absolute left-0 top-1/2 -translate-y-1/2 text-neon-blue material-symbols-outlined text-[16px] lg:text-[18px]">location_on</span>
                            <input
                                ref={endInputRef}
                                type="text"
                                placeholder=" Hauz Khas"
                                className="terminal-input neon-blue text-base lg:text-lg font-bold"
                                value={end}
                                onChange={(e) => handleSearch('end', e.target.value)}
                                onFocus={() => setActiveInput('end')}
                                onBlur={() => setTimeout(() => setActiveInput(null), 200)}
                                autoComplete="off"
                            />
                            {activeInput === 'end' && suggestions.end.length > 0 && (
                                <ul className="absolute left-0 right-0 top-[100%] mt-2 bg-black border border-terminal-border z-50">
                                    {suggestions.end.map((station) => (
                                        <li key={station}>
                                            <button
                                                type="button"
                                                onMouseDown={() => selectStation('end', station)}
                                                className="w-full text-left px-3 py-2 lg:px-4 lg:py-3 hover:bg-neon-blue/10 transition text-xs lg:text-sm text-neon-blue font-mono border-b border-terminal-border last:border-0"
                                            >
                                                {station}
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </div>

                    {/* Error Display */}
                    {error && (
                        <div className="flex items-start gap-2 p-2 lg:p-3 bg-neon-pink/10 text-neon-pink border border-neon-pink/30 text-xs lg:text-sm font-mono">
                            <span className="material-symbols-outlined text-[16px] lg:text-[18px]">error</span>
                            <p className="font-medium leading-tight">{error}</p>
                        </div>
                    )}

                    {/* Route Preference */}
                    <div>
                        <label className="block text-[9px] lg:text-[10px] font-bold text-slate-500 uppercase tracking-[0.15em] lg:tracking-[0.2em] mb-3 lg:mb-4">Execution Mode</label>
                        <div className="grid grid-cols-2 gap-px bg-terminal-border border border-terminal-border">
                            <label className="cursor-pointer relative">
                                <input
                                    type="radio"
                                    name="routeType"
                                    className="custom-radio sr-only"
                                    checked={routePreference === 'fastest'}
                                    onChange={() => setRoutePreference('fastest')}
                                />
                                <div className="flex flex-col items-center justify-center p-3 lg:p-6 bg-black transition-all h-full hover:bg-white/5">
                                    <span className="material-symbols-outlined mb-1 lg:mb-2 text-[18px] lg:text-[20px] text-slate-600">bolt</span>
                                    <span className="text-[8px] lg:text-[10px] font-bold uppercase tracking-wider lg:tracking-widest">Fastest</span>
                                    <div className="radio-circle w-1.5 h-1.5 rounded-full border border-slate-800 mt-2 lg:mt-3"></div>
                                </div>
                            </label>
                            <label className="cursor-pointer relative">
                                <input
                                    type="radio"
                                    name="routeType"
                                    className="custom-radio sr-only"
                                    checked={routePreference === 'mininterchange'}
                                    onChange={() => setRoutePreference('mininterchange')}
                                />
                                <div className="flex flex-col items-center justify-center p-3 lg:p-6 bg-black transition-all h-full hover:bg-white/5">
                                    <span className="material-symbols-outlined mb-1 lg:mb-2 text-[18px] lg:text-[20px] text-slate-600">alt_route</span>
                                    <span className="text-[8px] lg:text-[10px] font-bold uppercase tracking-wider lg:tracking-widest">Min Transfer</span>
                                    <div className="radio-circle w-1.5 h-1.5 rounded-full border border-slate-800 mt-2 lg:mt-3"></div>
                                </div>
                            </label>
                        </div>
                    </div>

                    {/* Action Button */}
                    <button
                        type="submit"
                        disabled={!start || !end || isLoading}
                        className="neon-button text-xs lg:text-sm"
                    >
                        {isLoading ? (
                            <>
                                <span className="material-symbols-outlined animate-spin">progress_activity</span>
                                <span className="hidden sm:inline">CALCULATING...</span>
                                <span className="sm:hidden">CALCULATING</span>
                            </>
                        ) : (
                            <>
                                <span className="material-symbols-outlined font-bold">satellite_alt</span>
                                <span className="hidden sm:inline">Find Best Route</span>
                                <span className="sm:hidden">Find Route</span>
                            </>
                        )}
                    </button>
                </form>

                {/* Route Results */}
                {routeData?.path && (
                    <div className="animate-fade-in">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-black text-white uppercase tracking-tighter italic">Route Data</h3>
                            <button
                                onClick={() => {
                                    const shareText = `DELHI_METRO_ROUTE: ${start} -> ${end}\nDISTANCE: ${routeData.path.totalDistance.toFixed(2)}km\nETA: ${Math.round(routeData.path.totalTime)}min\nFARE: ₹${routeData.path.fare}`;
                                    navigator.clipboard?.writeText(shareText);
                                }}
                                className="text-neon-blue hover:text-white text-xs font-mono uppercase tracking-wider flex items-center gap-1"
                            >
                                <span className="material-symbols-outlined text-[16px]">share</span>
                                Export
                            </button>
                        </div>

                        {/* Summary Card */}
                        <div className="bg-black/60 border border-terminal-border p-4 mb-4 font-mono">
                            <div className="grid grid-cols-3 gap-4 text-center">
                                <div>
                                    <p className="text-2xl font-black text-neon-green">{Math.round(routeData.path.totalTime)}</p>
                                    <p className="text-[9px] text-slate-600 uppercase tracking-wider">Minutes</p>
                                </div>
                                <div>
                                    <p className="text-2xl font-black text-neon-green">{routeData.path.path.length}</p>
                                    <p className="text-[9px] text-slate-600 uppercase tracking-wider">Stations</p>
                                </div>
                                <div>
                                    <p className="text-2xl font-black text-neon-green">₹{routeData.path.fare}</p>
                                    <p className="text-[9px] text-slate-600 uppercase tracking-wider">Credits</p>
                                </div>
                            </div>
                        </div>

                        {/* Route Timeline */}
                        <div className="space-y-1">
                            {routeData.path.path.map((station, idx) => {
                                const isStart = idx === 0;
                                const isEnd = idx === routeData.path.path.length - 1;
                                const isInterchange = station.lineChange;
                                const lineColor = getLineColor(station.line);

                                return (
                                    <div key={idx} className="flex items-start gap-3 py-2">
                                        <div className="flex flex-col items-center">
                                            <div className={`w-2 h-2 ${isInterchange ? 'ring-4 ring-neon-pink/50' : ''} ${lineColor.bg} ${lineColor.glow} ${isStart || isEnd ? 'w-3 h-3' : ''}`}></div>
                                            {idx < routeData.path.path.length - 1 && (
                                                <div className={`w-0.5 flex-1 ${lineColor.bg} opacity-30`}></div>
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className={`text-sm font-mono font-medium ${isStart ? 'text-neon-green' : isEnd ? 'text-neon-blue' : isInterchange ? 'text-neon-pink' : 'text-slate-400'}`}>
                                                {station.name}
                                            </p>
                                            {isInterchange && (
                                                <p className="text-[9px] text-slate-600 uppercase tracking-wider">[{station.line}_LINE_TRANSFER]</p>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Recent Searches */}
                {recentSearches.length > 0 && !routeData?.path && (
                    <div className="mt-4 pt-6 border-t border-terminal-border">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">Session History</h3>
                            <button
                                onClick={clearRecentSearches}
                                className="text-[9px] text-neon-pink font-bold hover:underline uppercase"
                            >
                                PURGE_LOGS
                            </button>
                        </div>
                        <div className="space-y-4">
                            {recentSearches.map((search, idx) => (
                                <button
                                    key={idx}
                                    type="button"
                                    onClick={() => selectRecentSearch(search.from, search.to)}
                                    className="w-full flex items-center justify-between p-4 border border-terminal-border hover:border-neon-green transition-all group text-left"
                                >
                                    <div className="flex items-center gap-4">
                                        <span className="material-symbols-outlined text-slate-600 group-hover:text-neon-green">history</span>
                                        <div>
                                            <div className="text-[11px] font-bold text-white uppercase tracking-wider">{search.from} → {search.to}</div>
                                            <div className="text-[9px] font-mono text-slate-600">PATH_ID: #{idx + 1}_TRANSIT</div>
                                        </div>
                                    </div>
                                    <span className="material-symbols-outlined text-slate-700 text-[18px]">arrow_forward</span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Sidebar Footer */}
            <div className="p-3 lg:p-6 bg-black border-t border-terminal-border mt-auto font-mono text-[7px] lg:text-[9px] text-slate-700 flex justify-between uppercase tracking-widest shrink-0">
                <span className="hidden sm:inline">Lat: 28.6139 | Long: 77.2090</span>
                <span className="sm:hidden">28.6139°N | 77.2090°E</span>
                <span className="text-neon-green truncate">© DMRC_SYSTEMS.2026</span>
            </div>
        </aside>
    );
};

export default Sidebar;
