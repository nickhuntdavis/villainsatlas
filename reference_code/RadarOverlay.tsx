
import React from 'react';

const RadarOverlay: React.FC = () => {
  return (
    <div className="absolute inset-0 z-[100] bg-[#0f1025]/80 flex items-center justify-center overflow-hidden pointer-events-none backdrop-blur-md">
      {/* Concentric circles of the radar */}
      <div className="absolute w-[100vw] h-[100vw] rounded-full border border-[#a78bfa]/20 animate-pulse-radar" style={{ animationDelay: '0s' }}></div>
      <div className="absolute w-[100vw] h-[100vw] rounded-full border border-[#a78bfa]/30 animate-pulse-radar" style={{ animationDelay: '1s' }}></div>
      <div className="absolute w-[100vw] h-[100vw] rounded-full border border-[#a78bfa]/10 animate-pulse-radar" style={{ animationDelay: '2s' }}></div>

      {/* Scanning Line */}
      <div className="absolute w-[150vw] h-[150vw] bg-gradient-to-t from-[#a78bfa]/10 to-transparent rotate-0 origin-center" 
           style={{ animation: 'spin 3s linear infinite' }}>
      </div>

      <div className="text-center z-10 flex flex-col items-center">
        {/* Central Core */}
        <div className="relative mb-10">
          <div className="w-32 h-32 border-2 border-dashed border-[#a78bfa]/40 rounded-full animate-spin-slow"></div>
          <div className="absolute inset-0 flex items-center justify-center">
             <div className="w-20 h-20 border-t-4 border-[#a78bfa] rounded-full animate-spin shadow-[0_0_60px_rgba(167,139,250,0.4)]"></div>
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-[#a78bfa] font-mono text-2xl tracking-[0.4em] uppercase animate-pulse">Scanning Terrain</h3>
          <div className="flex flex-col items-center space-y-1">
             <p className="text-white/40 font-mono text-[10px] uppercase tracking-[0.3em]">Calibrating Brutalist Nodes</p>
             <div className="w-48 h-1 bg-white/5 rounded-full overflow-hidden">
                <div className="h-full bg-[#a78bfa] animate-loading-bar"></div>
             </div>
          </div>
        </div>
        
        {/* Real-time coordinates flicker */}
        <div className="mt-12 font-mono text-[9px] text-[#a78bfa]/40 grid grid-cols-2 gap-x-8 gap-y-1">
          <span>LAT: 51.5074° N</span>
          <span>LNG: 0.1278° W</span>
          <span>ALT: 24.1m</span>
          <span>SIG: VIOLET</span>
        </div>
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes loading-bar {
          0% { width: 0%; }
          50% { width: 70%; }
          100% { width: 100%; }
        }
        .animate-spin-slow {
          animation: spin-slow 10s linear infinite;
        }
        .animate-loading-bar {
          animation: loading-bar 4s ease-in-out forwards;
        }
      `}</style>
    </div>
  );
};

export default RadarOverlay;
