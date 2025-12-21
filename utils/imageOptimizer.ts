/**
 * Image Optimization Utility
 * 
 * Optimizes images before upload to reduce file size and improve performance.
 * - Resizes images to max dimensions (800px width/height, maintains aspect ratio)
 * - Compresses JPEG/PNG images
 * - Optionally converts to WebP format
 */

interface OptimizeImageOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number; // 0-1, default 0.85
  format?: 'original' | 'webp' | 'jpeg';
}

const DEFAULT_OPTIONS: Required<OptimizeImageOptions> = {
  maxWidth: 800,
  maxHeight: 800,
  quality: 0.85,
  format: 'original',
};

/**
 * Optimize an image file by resizing and compressing
 * @param file Original image file
 * @param options Optimization options
 * @returns Optimized File object
 */
export async function optimizeImage(
  file: File,
  options: OptimizeImageOptions = {}
): Promise<File> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // Only optimize image files
  if (!file.type.startsWith('image/')) {
    console.warn(`File "${file.name}" is not an image, skipping optimization`);
    return file;
  }

  // Skip optimization for very small files (< 100KB) to avoid unnecessary processing
  if (file.size < 100 * 1024) {
    console.log(`File "${file.name}" is already small (${(file.size / 1024).toFixed(1)}KB), skipping optimization`);
    return file;
  }

  try {
    // Create image from file
    const image = await createImageFromFile(file);
    
    // Calculate new dimensions
    const { width, height } = calculateDimensions(
      image.width,
      image.height,
      opts.maxWidth,
      opts.maxHeight
    );

    // If image is already smaller than max dimensions and file is reasonable size, skip
    if (
      image.width <= opts.maxWidth &&
      image.height <= opts.maxHeight &&
      file.size < 500 * 1024 // Less than 500KB
    ) {
      console.log(`Image "${file.name}" is already optimized, skipping`);
      return file;
    }

    // Create canvas and draw resized image
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      throw new Error('Could not get canvas context');
    }

    // Use high-quality image rendering
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(image, 0, 0, width, height);

    // Convert to blob with specified format and quality
    const blob = await canvasToBlob(canvas, file.type, opts.quality, opts.format);
    
    // Create new File object with optimized blob
    const optimizedFile = new File(
      [blob],
      getOptimizedFileName(file.name, opts.format),
      {
        type: blob.type,
        lastModified: Date.now(),
      }
    );

    const originalSizeKB = (file.size / 1024).toFixed(1);
    const optimizedSizeKB = (optimizedFile.size / 1024).toFixed(1);
    const savings = ((1 - optimizedFile.size / file.size) * 100).toFixed(1);
    
    console.log(
      `✅ Optimized "${file.name}": ${originalSizeKB}KB → ${optimizedSizeKB}KB (${savings}% reduction)`
    );

    return optimizedFile;
  } catch (error) {
    console.error(`Failed to optimize image "${file.name}":`, error);
    // Return original file if optimization fails
    return file;
  }
}

/**
 * Create an Image object from a File
 */
function createImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`Failed to load image from file: ${file.name}`));
    };
    
    img.src = url;
  });
}

/**
 * Calculate new dimensions maintaining aspect ratio
 */
function calculateDimensions(
  originalWidth: number,
  originalHeight: number,
  maxWidth: number,
  maxHeight: number
): { width: number; height: number } {
  let width = originalWidth;
  let height = originalHeight;

  // Scale down if exceeds max dimensions
  if (width > maxWidth || height > maxHeight) {
    const aspectRatio = width / height;
    
    if (width > height) {
      // Landscape: constrain by width
      width = Math.min(width, maxWidth);
      height = width / aspectRatio;
      
      // If height still exceeds, constrain by height
      if (height > maxHeight) {
        height = maxHeight;
        width = height * aspectRatio;
      }
    } else {
      // Portrait: constrain by height
      height = Math.min(height, maxHeight);
      width = height * aspectRatio;
      
      // If width still exceeds, constrain by width
      if (width > maxWidth) {
        width = maxWidth;
        height = width / aspectRatio;
      }
    }
  }

  return {
    width: Math.round(width),
    height: Math.round(height),
  };
}

/**
 * Convert canvas to blob with specified format and quality
 */
function canvasToBlob(
  canvas: HTMLCanvasElement,
  originalType: string,
  quality: number,
  format: 'original' | 'webp' | 'jpeg'
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    let outputType = originalType;
    
    // Determine output format
    if (format === 'webp' && canvas.toBlob) {
      // Check if WebP is supported
      outputType = 'image/webp';
    } else if (format === 'jpeg' || originalType === 'image/png') {
      // Convert PNG to JPEG for better compression
      outputType = 'image/jpeg';
    }

    // Use toBlob with quality for JPEG/WebP
    if (outputType === 'image/jpeg' || outputType === 'image/webp') {
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Failed to create blob from canvas'));
          }
        },
        outputType,
        quality
      );
    } else {
      // For PNG, use default quality (PNG doesn't support quality parameter)
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Failed to create blob from canvas'));
          }
        },
        outputType
      );
    }
  });
}

/**
 * Get optimized file name with appropriate extension
 */
function getOptimizedFileName(originalName: string, format: 'original' | 'webp' | 'jpeg'): string {
  if (format === 'webp') {
    return originalName.replace(/\.(jpg|jpeg|png)$/i, '.webp');
  } else if (format === 'jpeg') {
    return originalName.replace(/\.png$/i, '.jpg');
  }
  return originalName;
}

/**
 * Batch optimize multiple images
 */
export async function optimizeImages(
  files: File[],
  options: OptimizeImageOptions = {}
): Promise<File[]> {
  const optimizedFiles = await Promise.all(
    files.map(file => optimizeImage(file, options))
  );
  return optimizedFiles;
}

