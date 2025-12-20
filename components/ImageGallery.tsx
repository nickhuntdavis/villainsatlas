import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface ImageGalleryProps {
  images: string[];
  buildingName: string;
}

export const ImageGallery: React.FC<ImageGalleryProps> = ({ images, buildingName }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [containerHeight, setContainerHeight] = useState<number>(400); // Default height
  const autoPlayTimerRef = useRef<NodeJS.Timeout | null>(null);
  const imageRefs = useRef<(HTMLImageElement | null)[]>([]);

  // Auto-play functionality (4 second intervals)
  useEffect(() => {
    if (images.length <= 1 || isPaused) {
      if (autoPlayTimerRef.current) {
        clearInterval(autoPlayTimerRef.current);
        autoPlayTimerRef.current = null;
      }
      return;
    }

    autoPlayTimerRef.current = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % images.length);
    }, 4000);

    return () => {
      if (autoPlayTimerRef.current) {
        clearInterval(autoPlayTimerRef.current);
      }
    };
  }, [images.length, isPaused]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (images.length <= 1) return;
      
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
        setIsPaused(true);
        setTimeout(() => setIsPaused(false), 10000);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        setCurrentIndex((prev) => (prev + 1) % images.length);
        setIsPaused(true);
        setTimeout(() => setIsPaused(false), 10000);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => {
      window.removeEventListener('keydown', handleKeyPress);
    };
  }, [images.length]);

  const goToNext = () => {
    setCurrentIndex((prev) => (prev + 1) % images.length);
    setIsPaused(true);
    // Resume auto-play after 10 seconds
    setTimeout(() => setIsPaused(false), 10000);
  };

  const goToPrevious = () => {
    setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
    setIsPaused(true);
    // Resume auto-play after 10 seconds
    setTimeout(() => setIsPaused(false), 10000);
  };

  const goToImage = (index: number) => {
    setCurrentIndex(index);
    setIsPaused(true);
    // Resume auto-play after 10 seconds
    setTimeout(() => setIsPaused(false), 10000);
  };

  // Update container height when images load to accommodate tallest image
  const handleImageLoad = (index: number, img: HTMLImageElement) => {
    // Calculate the rendered height (respecting max-width constraints)
    const maxWidth = img.parentElement?.clientWidth || 800;
    const naturalWidth = img.naturalWidth;
    const naturalHeight = img.naturalHeight;
    
    // Calculate height if image is constrained by width
    let renderedHeight = naturalHeight;
    if (naturalWidth > maxWidth) {
      renderedHeight = (naturalHeight / naturalWidth) * maxWidth;
    }
    
    // Cap at 512px max
    renderedHeight = Math.min(renderedHeight, 512);
    
    setContainerHeight((prev) => Math.max(prev, renderedHeight, 300));
  };

  if (images.length === 0) return null;

  return (
    <div 
      className="relative w-full overflow-hidden bg-[#020716] group"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* Images container - fixed height based on tallest image to prevent layout shifts */}
      <div 
        className="relative w-full flex items-center justify-center"
        style={{ 
          height: `${containerHeight}px`,
          minHeight: '300px',
          maxHeight: '512px'
        }}
      >
        {images.map((imageUrl, index) => (
          <div
            key={index}
            className={`absolute inset-0 flex items-center justify-center transition-opacity duration-500 ${
              index === currentIndex ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'
            }`}
          >
            <img
              ref={(el) => {
                if (el) {
                  imageRefs.current[index] = el;
                  // If image is already loaded, calculate height immediately
                  if (el.complete) {
                    handleImageLoad(index, el);
                  }
                }
              }}
              src={imageUrl}
              alt={`${buildingName} - Image ${index + 1}`}
              className="max-w-full max-h-full w-auto h-auto object-contain"
              onLoad={(e) => {
                const img = e.currentTarget;
                handleImageLoad(index, img);
              }}
              onError={(e) => {
                console.warn(`Image ${index + 1} failed to load for "${buildingName}"`);
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          </div>
        ))}
      </div>

      {/* Navigation arrows (only show if multiple images) */}
      {images.length > 1 && (
        <>
          <button
            onClick={goToPrevious}
            className="absolute left-4 top-1/2 -translate-y-1/2 z-20 p-2 bg-[#010E36]/80 hover:bg-[#010E36] text-white rounded-full transition-all opacity-0 group-hover:opacity-100"
            aria-label="Previous image"
            title="Previous image (Left arrow key)"
          >
            <ChevronLeft size={20} strokeWidth={2} />
          </button>
          <button
            onClick={goToNext}
            className="absolute right-4 top-1/2 -translate-y-1/2 z-20 p-2 bg-[#010E36]/80 hover:bg-[#010E36] text-white rounded-full transition-all opacity-0 group-hover:opacity-100"
            aria-label="Next image"
            title="Next image (Right arrow key)"
          >
            <ChevronRight size={20} strokeWidth={2} />
          </button>
        </>
      )}

      {/* Dot indicators (only show if multiple images) */}
      {images.length > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex gap-2">
          {images.map((_, index) => (
            <button
              key={index}
              onClick={() => goToImage(index)}
              className={`w-2 h-2 rounded-full transition-all ${
                index === currentIndex
                  ? 'bg-[#FF5D88] w-6'
                  : 'bg-white/40 hover:bg-white/60'
              }`}
              aria-label={`Go to image ${index + 1}`}
              title={`Image ${index + 1} of ${images.length}`}
            />
          ))}
        </div>
      )}
    </div>
  );
};

