import React, { useState, useEffect, useRef } from 'react';
import { Fingerprint, ShieldCheck, Activity, Map as MapIcon } from 'lucide-react';

interface LandingSequenceProps {
  onInitialize: () => void;
}

const LandingSequence: React.FC<LandingSequenceProps> = ({ onInitialize }) => {
  const [holdProgress, setHoldProgress] = useState(0);
  const [isHolding, setIsHolding] = useState(false);
  const [terminalLines, setTerminalLines] = useState<string[]>([]);
  const holdInterval = useRef<number | null>(null);

  const logs = [
    "Establishing secure link...",
    "Locating architectural signatures...",
    "Filtering for Art Deco patterns...",
    "Scanning for memory fragments...",
    "User A: Authenticated",
    "User N: Authenticated",
    "Atlas database connected.",
    "Bypassing mediocre design filters...",
    "Ready for synchronization."
  ];

  useEffect(() => {
    let i = 0;
    const interval = setInterval(() => {
      if (i < logs.length) {
        setTerminalLines(prev => [...prev, logs[i]]);
        i++;
      } else {
        clearInterval(interval);
      }
    }, 400);
    return () => clearInterval(interval);
  }, []);

  const startHold = () => {
    setIsHolding(true);
    holdInterval.current = window.setInterval(() => {
      setHoldProgress(prev => {
        if (prev >= 100) {
          if (holdInterval.current) clearInterval(holdInterval.current);
          onInitialize();
          return 100;
        }
        return prev + 2;
      });
    }, 30);
  };

  const endHold = () => {
    setIsHolding(false);
    if (holdInterval.current) clearInterval(holdInterval.current);
    setHoldProgress(0);
  };

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-between py-12 px-6 bg-[#0f1025]/90 backdrop-blur-sm transition-all duration-700">
      
      {/* Header Info */}
      <div className="w-full max-w-lg flex justify-between items-center opacity-40">
        <div className="flex items-center space-x-2">
          <Activity className="w-4 h-4 text-[#AA8BFF]" />
          <span className="text-[10px] font-mono tracking-widest uppercase">ARCHITECTURE TRACKING: ACTIVE</span>
        </div>
        <div className="text-[10px] font-mono tracking-widest uppercase">
          NICK TRACKING: ACTIVE
        </div>
      </div>

      {/* Center Monogram Interface */}
      <div className="flex flex-col items-center justify-center relative group">
        {/* Decorative Rings */}
        <div className="absolute inset-0 -m-12 border border-white/5 rounded-full animate-spin-slow"></div>
        <div className="absolute inset-0 -m-8 border border-white/10 rounded-full animate-reverse-spin"></div>
        
        {/* SVG Monogram */}
        <div className="relative z-10 text-center select-none cursor-pointer">
          <div className="flex items-center justify-center -space-x-4 mb-2">
            <span className={`text-9xl font-bold transition-all duration-500 ${isHolding ? 'text-white scale-110 drop-shadow-[0_0_30px_rgba(255,255,255,0.4)]' : 'text-white/80'}`}>A</span>
            <span className={`text-9xl font-bold transition-all duration-500 ${isHolding ? 'text-[#AA8BFF] scale-110 drop-shadow-[0_0_30px_rgba(170,139,255,0.4)]' : 'text-[#AA8BFF]/80'}`}>N</span>
          </div>
          <h1 className="text-2xl font-mono tracking-[0.5em] uppercase text-white/40 pl-4 mb-8">Atlas</h1>
          
          {/* Body Text */}
          <div className="max-w-lg px-6 space-y-4 mt-8">
            <p className="text-white font-medium text-base leading-relaxed">
              Mediocre buildings need not apply.
            </p>
            <p className="text-white/80 text-sm leading-relaxed">
              This radar scans for the best of <span className="text-white font-medium">Art Deco</span>, 
              <span className="text-white font-medium"> Brutalism</span>, and 
              <span className="text-white font-medium"> Stalinist Gothic</span>. 
              Hidden between the monoliths, you'll find crumbs of our own history.
            </p>
          </div>
        </div>

        {/* Sync Button / Hold Zone */}
        <div className="mt-16 flex flex-col items-center">
          <button
            onMouseDown={startHold}
            onMouseUp={endHold}
            onMouseLeave={endHold}
            onTouchStart={startHold}
            onTouchEnd={endHold}
            className="relative w-24 h-24 flex items-center justify-center rounded-full border border-white/20 transition-all hover:scale-110 active:scale-95"
            aria-label="Hold to synchronize"
          >
            {/* Progress Ring */}
            <svg className="absolute inset-0 w-full h-full -rotate-90">
              <circle
                cx="48"
                cy="48"
                r="44"
                stroke="rgba(170, 139, 255, 0.1)"
                strokeWidth="4"
                fill="none"
              />
              <circle
                cx="48"
                cy="48"
                r="44"
                stroke="#AA8BFF"
                strokeWidth="4"
                fill="none"
                strokeDasharray="276"
                strokeDashoffset={276 - (276 * holdProgress) / 100}
                className="transition-all duration-75"
              />
            </svg>
            <Fingerprint className={`w-10 h-10 transition-colors ${isHolding ? 'text-white animate-pulse' : 'text-white/40'}`} />
          </button>
          <p className="mt-6 text-[10px] font-mono tracking-[0.3em] uppercase text-white/30 animate-pulse">
            Hold to Synchronize
          </p>
          <p className="mt-3 text-[9px] font-mono text-white/20 max-w-xs text-center">
            You can still browse the map without syncing
          </p>
        </div>
      </div>

      {/* Terminal Feed Bottom Left */}
      <div className="w-full max-w-lg">
        <div className="h-24 overflow-hidden flex flex-col justify-end">
          {terminalLines.slice(-3).map((line, idx) => (
            <div key={idx} className="text-[10px] font-mono text-[#AA8BFF]/60 lowercase mb-1 flex items-center">
              <span className="mr-2 opacity-30">&gt;</span>
              {line}
            </div>
          ))}
        </div>
        
        {/* Footer */}
        <div className="mt-8 flex justify-between items-end border-t border-white/5 pt-4">
           <div className="flex space-x-4">
              <ShieldCheck className="w-4 h-4 text-white/20" />
              <MapIcon className="w-4 h-4 text-white/20" />
           </div>
           <div className="text-[9px] font-mono text-white/20 text-right leading-tight">
             PRIVATE ACCESS ONLY<br/>
             AUTHORIZED OPERATORS: A + N
           </div>
        </div>
      </div>

      <style>{`
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes reverse-spin {
          from { transform: rotate(360deg); }
          to { transform: rotate(0deg); }
        }
        .animate-spin-slow {
          animation: spin-slow 15s linear infinite;
        }
        .animate-reverse-spin {
          animation: reverse-spin 10s linear infinite;
        }
      `}</style>
    </div>
  );
};

export default LandingSequence;

