import React, { useEffect, useRef, useState } from 'react';
import p5 from 'p5';
import * as HandsPkg from '@mediapipe/hands';
import * as CameraUtilsPkg from '@mediapipe/camera_utils';
import type { Results } from '@mediapipe/hands';

// Colors for the spray
const PALETTE = [
  '#FF0055', // Neon Pink
  '#00FF99', // Neon Green
  '#00CCFF', // Cyan
  '#FFFF00', // Yellow
  '#FF6600', // Orange
  '#CC00FF', // Purple
  '#FFFFFF', // White
];

const SprayCanvas: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const p5InstanceRef = useRef<p5 | null>(null);
  const [currentColorIndex, setCurrentColorIndex] = useState(0);
  
  // We use refs for data accessed inside the p5 draw loop to avoid closure staleness
  const handResultsRef = useRef<Results | null>(null);
  const colorIndexRef = useRef(0);
  
  // Effect to sync state with ref for p5
  useEffect(() => {
    colorIndexRef.current = currentColorIndex;
  }, [currentColorIndex]);

  useEffect(() => {
    let myP5: p5;
    // We define these loosely to allow for the dynamic import resolution below
    let camera: any;
    let hands: any;

    const initMediaPipe = async () => {
      if (!videoRef.current) return;

      // Safe extraction of MediaPipe classes to handle different ESM bundle formats (CDN compatibility)
      // @ts-ignore
      const Hands = HandsPkg.Hands || (HandsPkg.default?.Hands);
      // @ts-ignore
      const Camera = CameraUtilsPkg.Camera || (CameraUtilsPkg.default?.Camera);

      if (!Hands || !Camera) {
        console.error("MediaPipe classes failed to load. Check imports.", { HandsPkg, CameraUtilsPkg });
        return;
      }

      hands = new Hands({
        locateFile: (file: string) => {
          return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
        },
      });

      hands.setOptions({
        maxNumHands: 1,
        modelComplexity: 1,
        minDetectionConfidence: 0.7,
        minTrackingConfidence: 0.7,
      });

      hands.onResults((results: Results) => {
        handResultsRef.current = results;
      });

      if (videoRef.current) {
        camera = new Camera(videoRef.current, {
          onFrame: async () => {
            if (videoRef.current && hands) {
              await hands.send({ image: videoRef.current });
            }
          },
          width: 1280,
          height: 720,
        });
        camera.start();
      }
    };

    const sketch = (p: p5) => {
      p.setup = () => {
        if (!containerRef.current) return;
        const canvas = p.createCanvas(window.innerWidth, window.innerHeight);
        canvas.parent(containerRef.current);
        p.clear(); // Transparent background
        p.noStroke();
      };

      p.draw = () => {
        // We do not clear the background to allow paint to accumulate
        
        const results = handResultsRef.current;
        if (results && results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
          const landmarks = results.multiHandLandmarks[0];

          // MediaPipe coordinates are 0-1. Map to screen.
          const width = p.width;
          const height = p.height;

          // Landmarks: 4: Thumb Tip, 8: Index Tip, 0: Wrist, 9: Middle Finger MCP
          const thumbTip = landmarks[4];
          const indexTip = landmarks[8];
          const wrist = landmarks[0];
          const middleMCP = landmarks[9];

          // Calculate Pinch (Distance between thumb and index)
          const pinchDistX = (thumbTip.x - indexTip.x) * width;
          const pinchDistY = (thumbTip.y - indexTip.y) * height;
          const pinchDistance = Math.sqrt(pinchDistX * pinchDistX + pinchDistY * pinchDistY);

          // Calculate Hand Size for depth/intensity control
          const sizeDistX = (wrist.x - middleMCP.x) * width;
          const sizeDistY = (wrist.y - middleMCP.y) * height;
          const handSize = Math.sqrt(sizeDistX * sizeDistX + sizeDistY * sizeDistY);
          
          // Position of the spray (midpoint of pinch)
          const sprayX = (1 - (thumbTip.x + indexTip.x) / 2) * width; // Mirror X
          const sprayY = ((thumbTip.y + indexTip.y) / 2) * height;

          // Visual cursor for hand position
          p.push();
          p.stroke(255, 150);
          p.strokeWeight(2);
          p.noFill();
          p.circle(sprayX, sprayY, 15);
          
          // Draw pinch strength indicator
          if (pinchDistance < 60) {
             p.fill(PALETTE[colorIndexRef.current]);
             p.noStroke();
             p.circle(sprayX, sprayY, 8);
          }
          p.pop();

          // SPRAY LOGIC
          // Threshold for pinch (pixels)
          if (pinchDistance < 60) {
            // Prompt Logic:
            // Hand Size Big (Close) -> Spray Weak
            // Hand Size Small (Far) -> Spray Strong
            
            // Normalize handSize roughly between 50 (far/small) and 300 (close/big)
            const normalizedSize = p.constrain(handSize, 50, 300);
            
            // Factor: 0 = Close/Big (Weak), 1 = Far/Small (Strong)
            const factor = p.map(normalizedSize, 50, 300, 1, 0); 
            
            // Parameters
            // Close (Weak): Small spread, fewer particles, more transparent?
            // Far (Strong): Wide spread, dense particles, opaque?
            
            const spreadRadius = p.map(factor, 0, 1, 10, 60); 
            const particleCount = p.map(factor, 0, 1, 5, 40); 
            const particleSizeBase = p.map(factor, 0, 1, 2, 6);
            const opacity = p.map(factor, 0, 1, 50, 255);
            
            const col = p.color(PALETTE[colorIndexRef.current]);
            col.setAlpha(opacity);
            
            p.noStroke();
            p.fill(col);

            for (let i = 0; i < particleCount; i++) {
              // Gaussian distribution for more realistic spray center
              // randomGaussian(mean, sd)
              const xOffset = p.randomGaussian(0, spreadRadius / 3);
              const yOffset = p.randomGaussian(0, spreadRadius / 3);
              
              // Constrain to radius circle if needed, but gaussian naturally tapers
              
              const px = sprayX + xOffset;
              const py = sprayY + yOffset;
              
              // Vary individual particle size slightly
              const pSize = p.random(particleSizeBase * 0.5, particleSizeBase * 1.5);
              
              p.circle(px, py, pSize);
            }
          }
        }
      };

      p.windowResized = () => {
        p.resizeCanvas(window.innerWidth, window.innerHeight);
      };

      p.mousePressed = () => {
        // Cycle color on mouse click
        setCurrentColorIndex((prev) => (prev + 1) % PALETTE.length);
      };

      p.keyPressed = () => {
        // Clear canvas on Space bar
        if (p.key === ' ') {
          p.clear();
        }
      };
    };

    initMediaPipe().then(() => {
      myP5 = new p5(sketch);
      p5InstanceRef.current = myP5;
    });

    return () => {
      if (myP5) myP5.remove();
      if (hands) hands.close();
      if (camera) camera.stop();
    };
  }, []);

  return (
    <div className="relative w-full h-full">
      {/* Video Feed */}
      <video
        ref={videoRef}
        className="absolute top-0 left-0 w-full h-full object-cover transform -scale-x-100 opacity-50"
        playsInline
        muted
        style={{ zIndex: 0 }}
      />
      
      {/* P5 Canvas Container */}
      <div 
        ref={containerRef} 
        className="absolute top-0 left-0 w-full h-full"
        style={{ zIndex: 10 }}
      />

      {/* Color Palette UI */}
      <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 flex gap-3 p-3 bg-black/50 backdrop-blur-md rounded-full border border-white/10 z-50">
        {PALETTE.map((color, index) => (
          <div
            key={color}
            className={`w-8 h-8 rounded-full cursor-pointer transition-all duration-300 border-2 ${
              index === currentColorIndex 
                ? 'scale-125 border-white shadow-[0_0_15px_rgba(255,255,255,0.5)]' 
                : 'scale-100 border-transparent hover:scale-110 opacity-70'
            }`}
            style={{ backgroundColor: color }}
            onClick={() => setCurrentColorIndex(index)}
          />
        ))}
      </div>
    </div>
  );
};

export default SprayCanvas;