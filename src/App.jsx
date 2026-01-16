import React, { useState } from 'react';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import Map from './components/Map';

function App() {
  const [routeData, setRouteData] = useState(null);
  const [showCircularMap, setShowCircularMap] = useState(true);
  const [showMobileMap, setShowMobileMap] = useState(false);

  const handleFindRoute = (start, end, data) => {
    if (data) {
      setRouteData(data);
      if (typeof data.showCircular !== 'undefined') {
        setShowCircularMap(data.showCircular);
      }
      // Auto-show map on mobile when route is found
      setShowMobileMap(true);
    }
  };

  return (
    <div className="font-display h-screen flex flex-col overflow-hidden selection:bg-neon-green selection:text-black">
      {/* Terminal scanline overlay */}
      <div className="terminal-scanline fixed inset-0 z-50"></div>

      <Header />
      <main className="flex-1 flex flex-col lg:flex-row min-h-0 relative">
        {/* Mobile Map Toggle Button */}
        <button
          onClick={() => setShowMobileMap(!showMobileMap)}
          className="lg:hidden fixed top-20 right-4 z-40 bg-black border border-neon-blue text-neon-blue px-4 py-2 text-xs font-bold uppercase tracking-widest shadow-[0_0_10px_#00f3ff]"
        >
          {showMobileMap ? (
            <>
              <span className="material-symbols-outlined text-sm align-middle">list</span>
              Show Route
            </>
          ) : (
            <>
              <span className="material-symbols-outlined text-sm align-middle">map</span>
              Show Map
            </>
          )}
        </button>

        {/* Sidebar - Hidden on mobile when map is shown */}
        <div className={`${showMobileMap ? 'hidden lg:flex' : 'flex'} w-full lg:w-auto lg:shrink-0 h-full`}>
          <Sidebar
            onFindRoute={handleFindRoute}
            routeData={routeData}
          />
        </div>

        {/* Map - Hidden on mobile when route view is shown */}
        <div className={`${showMobileMap ? 'flex' : 'hidden lg:flex'} flex-1 min-w-0 h-full`}>
          <Map key={showMobileMap ? 'mobile-map-visible' : 'desktop-map'} routeData={routeData} showCircular={showCircularMap} />
        </div>
      </main>
    </div>
  );
}

export default App;
