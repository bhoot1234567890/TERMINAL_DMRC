import React from 'react';

const Header = () => {
  return (
    <header className="bg-black border-b border-terminal-border h-16 shrink-0 z-40 relative px-6">
      <div className="h-full flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="text-neon-green">
            <span className="material-symbols-outlined text-4xl" style={{ textShadow: '0 0 10px rgba(57, 255, 20, 0.5), 0 0 20px rgba(57, 255, 20, 0.2)' }}>
              terminal
            </span>
          </div>
          <div className="flex flex-col">
            <h1 className="text-white text-lg font-black tracking-widest uppercase italic">Delhi Metro</h1>
            <span className="text-neon-blue text-[10px] font-bold tracking-[0.3em] uppercase leading-none">Command Center v2.04</span>
          </div>
        </div>
        <nav className="hidden xl:flex items-center gap-12">
          <a className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 hover:text-neon-blue transition-colors" href="#">Network Map</a>
          <a className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 hover:text-neon-blue transition-colors" href="#">Fare Calculator</a>
          <a className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 hover:text-neon-blue transition-colors" href="#">Smart Card</a>
          <a className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 hover:text-neon-blue transition-colors" href="#">Help</a>
        </nav>
        <div className="flex items-center gap-6">
          <button className="flex items-center gap-2 text-[10px] font-bold tracking-widest text-slate-400 hover:text-neon-green transition-colors">
            <span className="material-symbols-outlined text-[16px]">language</span>
            LOC_EN
          </button>
          <button className="bg-transparent border border-neon-blue text-neon-blue px-6 py-1.5 text-[10px] font-bold uppercase tracking-widest hover:bg-neon-blue hover:text-black transition-all">
            Access System
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;
