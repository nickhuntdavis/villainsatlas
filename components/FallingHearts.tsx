import React, { useEffect, useState } from 'react';
import { Heart } from 'lucide-react';

interface HeartParticle {
  id: number;
  left: number;
  size: number;
  rotation: number;
  duration: number;
  delay: number;
}

interface FallingHeartsProps {
  onComplete?: () => void;
}

export const FallingHearts: React.FC<FallingHeartsProps> = ({ onComplete }) => {
  const [hearts, setHearts] = useState<HeartParticle[]>([]);

  useEffect(() => {
    // Generate hearts in 4 staggered sets
    const newHearts: HeartParticle[] = [];
    let heartId = 0;

    // Set 1: 150 hearts - appear first (0-0.5s delay)
    for (let i = 0; i < 150; i++) {
      newHearts.push({
        id: heartId++,
        left: Math.random() * 100,
        size: Math.random() * 20 + 16,
        rotation: Math.random() * 360,
        duration: Math.random() * 4 + 6,
        delay: Math.random() * 0.5, // 0-0.5s delay
      });
    }

    // Set 2: 100 hearts - appear later (1-1.5s delay)
    for (let i = 0; i < 100; i++) {
      newHearts.push({
        id: heartId++,
        left: Math.random() * 100,
        size: Math.random() * 20 + 16,
        rotation: Math.random() * 360,
        duration: Math.random() * 4 + 6,
        delay: 1 + Math.random() * 0.5, // 1-1.5s delay
      });
    }

    // Set 3: 50 hearts - appear even later (2-2.5s delay)
    for (let i = 0; i < 50; i++) {
      newHearts.push({
        id: heartId++,
        left: Math.random() * 100,
        size: Math.random() * 20 + 16,
        rotation: Math.random() * 360,
        duration: Math.random() * 4 + 6,
        delay: 2 + Math.random() * 0.5, // 2-2.5s delay
      });
    }

    // Set 4: 25 hearts - final wave (3-3.5s delay)
    for (let i = 0; i < 25; i++) {
      newHearts.push({
        id: heartId++,
        left: Math.random() * 100,
        size: Math.random() * 20 + 16,
        rotation: Math.random() * 360,
        duration: Math.random() * 4 + 6,
        delay: 3 + Math.random() * 0.5, // 3-3.5s delay
      });
    }

    setHearts(newHearts);

    // Call onComplete after the longest animation duration
    const maxDuration = Math.max(...newHearts.map(h => h.duration + h.delay));
    const timeout = setTimeout(() => {
      if (onComplete) {
        onComplete();
      }
    }, maxDuration * 1000);

    return () => clearTimeout(timeout);
  }, [onComplete]);

  // Create unique keyframe animations for each heart
  useEffect(() => {
    const styleElements: HTMLElement[] = [];
    
    hearts.forEach((heart, index) => {
      const styleId = `falling-heart-${index}`;
      const styleElement = document.createElement('style');
      styleElement.id = styleId;
      const initialRotation = heart.rotation;
      const finalRotation = initialRotation + 360;
      styleElement.textContent = `
        @keyframes fall-${index} {
          0% {
            transform: translateY(-100px) rotate(${initialRotation}deg);
            opacity: 1;
          }
          60% {
            opacity: 0.8;
          }
          80% {
            opacity: 0.4;
          }
          100% {
            transform: translateY(calc(100vh + 50px)) rotate(${finalRotation}deg);
            opacity: 0;
          }
        }
      `;
      document.head.appendChild(styleElement);
      styleElements.push(styleElement);
    });
    
    return () => {
      // Clean up all style elements
      styleElements.forEach(el => {
        if (el.parentNode) {
          el.parentNode.removeChild(el);
        }
      });
    };
  }, [hearts]);

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {hearts.map((heart, index) => (
        <div
          key={heart.id}
          className="absolute top-0"
          style={{
            left: `${heart.left}%`,
            animation: `fall-${index} ${heart.duration}s ${heart.delay}s ease-in forwards`,
          }}
        >
          <Heart
            size={heart.size}
            className="fill-current"
            style={{
              color: '#FF5D88',
              filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))',
            }}
          />
        </div>
      ))}
    </div>
  );
};

