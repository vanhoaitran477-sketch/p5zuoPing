import React from 'react';
import SprayCanvas from './components/SprayCanvas';

const App: React.FC = () => {
  return (
    <div className="relative w-screen h-screen bg-black overflow-hidden flex items-center justify-center">
      <SprayCanvas />
      
      {/* Overlay Instructions */}
      <div className="absolute top-4 left-4 z-50 pointer-events-none">
        <h1 className="text-white text-3xl font-bold tracking-tighter drop-shadow-lg">
          HAND SPRAY AR
        </h1>
        <div className="mt-2 text-white/80 text-sm space-y-1 bg-black/30 p-4 rounded-xl backdrop-blur-sm border border-white/10 inline-block">
          <p className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
            Pinch <span className="font-bold text-white">Index + Thumb</span> to spray.
          </p>
          <p>✋ Move hand <span className="text-yellow-300">Close</span> = Focused Spray (Weak)</p>
          <p>👋 Move hand <span className="text-yellow-300">Far</span> = Wide Spray (Strong)</p>
          <p>🖱️ <span className="font-bold text-white">Click Mouse</span> to change color.</p>
          <p>⌨️ <span className="font-bold text-white">Space</span> to clear canvas.</p>
        </div>
      </div>
    </div>
  );
};

export default App;