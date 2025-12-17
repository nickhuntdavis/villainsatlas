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
    // Generate 30-50 hearts with varying properties
    const heartCount = Math.floor(Math.random() * 21) + 30; // 30-50 hearts
    const newHearts: HeartParticle[] = [];

    for (let i = 0; i < heartCount; i++) {
      newHearts.push({
        id: i,
        left: Math.random() * 100, // Random horizontal position (0-100%)
        size: Math.random() * 20 + 16, // Random size between 16-36px
        rotation: Math.random() * 360, // Random rotation (0-360deg)
        duration: Math.random() * 2 + 3, // Random fall duration (3-5 seconds)
        delay: Math.random() * 0.5, // Random delay (0-0.5 seconds)
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
          from {
            transform: translateY(-50px) rotate(${initialRotation}deg);
            opacity: 1;
          }
          to {
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
            className="text-red-500 fill-red-500"
            style={{
              filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))',
            }}
          />
        </div>
      ))}
    </div>
  );
};

