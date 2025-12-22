
import React, { useState, useEffect } from 'react';
import LandingSequence from './components/LandingSequence';
import MapInterface from './components/MapInterface';
import RadarOverlay from './components/RadarOverlay';
import { AppState } from './types';

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(AppState.INTRO);

  const handleStartScan = () => {
    // We can add a brief 'glitch' pause here for extra impact
    setAppState(AppState.SCANNING);
    
    // Simulate a scan duration
    setTimeout(() => {
      setAppState(AppState.MAP_VIEW);
    }, 4500); // Slightly longer for the more complex landing
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#0f1025]">
      {/* Underlying Map Interface */}
      <div className={`transition-all duration-[2000ms] h-full w-full 
        ${appState === AppState.INTRO ? 'blur-xl grayscale opacity-20 scale-125' : 'blur-0 grayscale-0 opacity-100 scale-100'}`}>
        <MapInterface active={appState === AppState.MAP_VIEW} />
      </div>

      {/* New Immersive Landing Experience */}
      {appState === AppState.INTRO && (
        <LandingSequence onInitialize={handleStartScan} />
      )}

      {/* Full-screen Radar Scan Effect */}
      {appState === AppState.SCANNING && (
        <RadarOverlay />
      )}

      {/* HUD Borders (Always Visible for style) */}
      <div className="absolute inset-0 pointer-events-none z-[150] border-[20px] border-[#0f1025] hidden md:block opacity-50"></div>
    </div>
  );
};

export default App;
