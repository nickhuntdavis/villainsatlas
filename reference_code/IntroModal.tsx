
import React from 'react';
import { Maximize, ChevronRight } from 'lucide-react';

interface IntroModalProps {
  onInitialize: () => void;
}

const IntroModal: React.FC<IntroModalProps> = ({ onInitialize }) => {
  return (
    <div className="bg-[#2a2d52] w-full max-w-md rounded-[2.5rem] shadow-2xl p-8 md:p-10 border border-white/5 animate-in fade-in zoom-in duration-500">
      <div className="flex justify-between items-start mb-10">
        <div className="relative">
          {/* Monogram Feel Logo */}
          <div className="flex flex-col">
             <div className="flex items-baseline space-x-1">
                <span className="text-5xl font-bold tracking-tighter text-white">A</span>
                <span className="text-5xl font-bold tracking-tighter text-white">N</span>
             </div>
             <h1 className="text-6xl font-light tracking-tight text-white -mt-2 font-mono">Atlas</h1>
          </div>
          <div className="absolute -top-4 -left-4 w-12 h-12 border-t-2 border-l-2 border-white/20 rounded-tl-xl pointer-events-none"></div>
        </div>
        
        <button className="text-white/40 hover:text-white transition-colors">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="space-y-6">
        <h2 className="text-xl font-bold text-white tracking-tight">
          Mediocre buildings need not apply.
        </h2>
        
        <p className="text-lg leading-relaxed text-slate-300 font-light">
          This radar scans for the best of <span className="text-white font-medium">Art Deco</span>, 
          <span className="text-white font-medium"> Brutalism</span>, and 
          <span className="text-white font-medium"> Stalinist Gothic</span>. 
          Follow the deep red markers to find the ominous and the powerful.
        </p>

        <p className="text-slate-400 italic text-sm border-l-2 border-[#a78bfa] pl-4">
          Hidden between the monoliths, you'll find crumbs of our own history.
        </p>

        <button 
          onClick={onInitialize}
          className="w-full bg-[#a78bfa] hover:bg-[#c4b5fd] text-[#1a1b3a] font-bold py-5 rounded-2xl flex items-center justify-center space-x-3 transition-all duration-300 transform hover:scale-[1.02] active:scale-95 shadow-lg shadow-purple-500/20 group"
        >
          <div className="relative flex items-center justify-center">
            <Maximize className="w-6 h-6 animate-pulse" />
          </div>
          <span className="text-lg uppercase tracking-wider font-mono">Initialize Scan</span>
          <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
        </button>
      </div>

      <div className="mt-8 text-center">
        <span className="text-[10px] text-white/20 uppercase tracking-[0.3em] font-mono">
          Proprietary Intelligence Core v3.1
        </span>
      </div>
    </div>
  );
};

export default IntroModal;
