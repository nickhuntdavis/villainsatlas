// scripts/optimize-existing-images.js
// Script to optimize existing images in Baserow by downloading, resizing/compressing, and re-uploading them.
// Usage:
//   BASEROW_TOKEN="..." BASEROW_TABLE_ID="772747" node scripts/optimize-existing-images.js

import dotenv from "dotenv";
import sharp from "sharp";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config({ path: ".env.local" });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASEROW_BASE = "https://api.baserow.io/api/database/rows/table";
const TABLE_ID = process.env.BASEROW_TABLE_ID || process.env.REACT_APP_BASEROW_TABLE_ID || "772747";
const BASEROW_TOKEN = process.env.BASEROW_TOKEN || process.env.REACT_APP_BASEROW_API_TOKEN;

if (!TABLE_ID || !BASEROW_TOKEN) {
  console.error(
    "Missing required env vars. Please set BASEROW_TABLE_ID and BASEROW_TOKEN."
  );
  process.exit(1);
}

// Check if sharp is available
try {
  await sharp({ create: { width: 1, height: 1, channels: 3, background: { r: 0, g: 0, b: 0 } } }).toBuffer();
} catch (err) {
  console.error("❌ Sharp library not found. Please install it:");
  console.error("   npm install sharp");
  process.exit(1);
}

// Create temp directory for downloads
const tempDir = path.join(__dirname, "../temp-images");
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

// Fetch all rows from Baserow
async function fetchAllRows() {
  let page = 1;
  const pageSize = 200;
  const rows = [];

  while (true) {
    const url = `${BASEROW_BASE}/${TABLE_ID}/?user_field_names=true&page=${page}&size=${pageSize}`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Token ${BASEROW_TOKEN}`,
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      throw new Error(`Baserow error ${res.status}: ${await res.text()}`);
    }

    const data = await res.json();
    rows.push(...data.results);

    if (!data.next) break;
    page += 1;
  }

  return rows;
}

// Download image from URL
async function downloadImage(url, filepath) {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    // Check if response is actually an image
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.startsWith('image/')) {
      throw new Error(`Not an image (content-type: ${contentType})`);
    }
    
    const buffer = await response.arrayBuffer();
    if (buffer.byteLength === 0) {
      throw new Error('Downloaded file is empty');
    }
    
    fs.writeFileSync(filepath, Buffer.from(buffer));
    return filepath;
  } catch (error) {
    // Clean up file if it was partially created
    if (fs.existsSync(filepath)) {
      fs.unlinkSync(filepath);
    }
    throw error;
  }
}

// Optimize image using sharp
async function optimizeImage(inputPath, outputPath) {
  try {
    // Check if file exists
    if (!fs.existsSync(inputPath)) {
      throw new Error(`Input file does not exist: ${inputPath}`);
    }
    
    const stats = fs.statSync(inputPath);
    const originalSize = stats.size;

    // Get image metadata
    const metadata = await sharp(inputPath).metadata();
    
    // Skip if already small (< 100KB)
    if (originalSize < 100 * 1024) {
      console.log(`   ⏭️  Already small (${(originalSize / 1024).toFixed(1)}KB), skipping`);
      return { optimized: false, originalSize, newSize: originalSize };
    }

    // Calculate new dimensions (max 800x800, maintain aspect ratio)
    let width = metadata.width;
    let height = metadata.height;
    const maxDimension = 800;

    if (width > maxDimension || height > maxDimension) {
      if (width > height) {
        width = maxDimension;
        height = Math.round((height / metadata.width) * maxDimension);
      } else {
        height = maxDimension;
        width = Math.round((width / metadata.height) * maxDimension);
      }
    }

    // Optimize: resize, convert to JPEG, compress
    await sharp(inputPath)
      .resize(width, height, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .jpeg({ quality: 85, mozjpeg: true })
      .toFile(outputPath);

    const newStats = fs.statSync(outputPath);
    const newSize = newStats.size;
    const savings = ((1 - newSize / originalSize) * 100).toFixed(1);

    console.log(`   ✅ Optimized: ${(originalSize / 1024).toFixed(1)}KB → ${(newSize / 1024).toFixed(1)}KB (${savings}% reduction)`);

    return { optimized: true, originalSize, newSize };
  } catch (error) {
    console.error(`   ❌ Optimization failed:`, error.message);
    throw error;
  }
}

// Upload optimized image to Baserow
async function uploadImageToBaserow(filepath) {
  const formData = new FormData();
  const fileBuffer = fs.readFileSync(filepath);
  const fileName = path.basename(filepath);
  
  // Create a File-like object for FormData (Node.js 18+)
  const file = new File([fileBuffer], fileName, { type: 'image/jpeg' });
  formData.append('file', file);

  const uploadUrl = 'https://api.baserow.io/api/user-files/upload-file/';
  const response = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      Authorization: `Token ${BASEROW_TOKEN}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Baserow upload error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return {
    name: data.name || fileName,
    url: data.url || data.thumbnails?.url || data.original || '',
    size: data.size || fs.statSync(filepath).size,
    mime_type: data.mime_type || 'image/jpeg',
  };
}

// Update Baserow row with optimized image
async function updateRowImage(rowId, fieldName, optimizedFile) {
  const url = `${BASEROW_BASE}/${TABLE_ID}/${rowId}/?user_field_names=true`;
  const payload = {
    [fieldName]: [optimizedFile],
  };

  const response = await fetch(url, {
    method: 'PATCH',
    headers: {
      Authorization: `Token ${BASEROW_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Baserow update error: ${response.status} - ${errorText}`);
  }

  return await response.json();
}

// Process a single image field
async function processImageField(row, fieldName, imageData) {
  if (!imageData || !Array.isArray(imageData) || imageData.length === 0) {
    return null;
  }

  const image = imageData[0];
  if (!image || !image.url) {
    return null;
  }

  const imageUrl = image.url;
  if (!imageUrl || typeof imageUrl !== 'string' || !imageUrl.startsWith('http')) {
    console.log(`   ⚠️  ${fieldName} has invalid URL: ${imageUrl ? imageUrl.substring(0, 50) : 'null'}`);
    return null;
  }

  try {
    // Download image
    const downloadPath = path.join(tempDir, `${row.id}-${fieldName}-${Date.now()}.jpg`);
    await downloadImage(imageUrl, downloadPath);

    // Verify file was downloaded
    if (!fs.existsSync(downloadPath)) {
      throw new Error('Download failed - file not created');
    }

    const fileStats = fs.statSync(downloadPath);
    if (fileStats.size === 0) {
      throw new Error('Downloaded file is empty');
    }

    // Optimize image
    const optimizedPath = path.join(tempDir, `${row.id}-${fieldName}-optimized-${Date.now()}.jpg`);
    const result = await optimizeImage(downloadPath, optimizedPath);

    if (!result.optimized) {
      // Clean up temp files
      if (fs.existsSync(downloadPath)) fs.unlinkSync(downloadPath);
      return null;
    }

    // Upload optimized image
    const uploadedFile = await uploadImageToBaserow(optimizedPath);

    // Clean up temp files
    if (fs.existsSync(downloadPath)) fs.unlinkSync(downloadPath);
    if (fs.existsSync(optimizedPath)) fs.unlinkSync(optimizedPath);

    return uploadedFile;
  } catch (error) {
    console.error(`   ❌ Error processing ${fieldName}: ${error.message}`);
    // Clean up any partial files
    const downloadPath = path.join(tempDir, `${row.id}-${fieldName}-*.jpg`);
    // Note: Individual cleanup happens in catch blocks
    return null;
  }
}

// Main function
async function main() {
  console.log("🚀 Starting image optimization for existing Baserow images...\n");

  try {
    // Fetch all rows
    console.log("📥 Fetching all buildings from Baserow...");
    const rows = await fetchAllRows();
    console.log(`✅ Found ${rows.length} buildings\n`);

    let totalProcessed = 0;
    let totalOptimized = 0;
    let totalSkipped = 0;
    let totalErrors = 0;

    // Process each row
    for (const row of rows) {
      const buildingName = row.name || `Building ${row.id}`;
      console.log(`\n🏢 Processing: "${buildingName}" (ID: ${row.id})`);

      // Debug: Log what image fields exist (only for first few buildings with images)
      if (rows.indexOf(row) < 5 && (row.image_url || (row.image_1 && Array.isArray(row.image_1) && row.image_1.length > 0))) {
        console.log(`   🔍 Debug - image_1: ${row.image_1 ? (Array.isArray(row.image_1) ? `${row.image_1.length} items, URL: ${row.image_1[0]?.url?.substring(0, 60) || 'no url'}` : typeof row.image_1) : 'null'}`);
        console.log(`   🔍 Debug - image_url: ${row.image_url ? (row.image_url.substring(0, 80)) : 'null'}`);
      }

      const hasImage1 = row.image_1 && Array.isArray(row.image_1) && row.image_1.length > 0;
      const hasImage2 = row.image_2 && Array.isArray(row.image_2) && row.image_2.length > 0;
      const hasImage3 = row.image_3 && Array.isArray(row.image_3) && row.image_3.length > 0;
      const hasImageUrl = row.image_url && row.image_url && typeof row.image_url === 'string' && row.image_url.trim().length > 0;
      
      if (!hasImage1 && !hasImage2 && !hasImage3 && !hasImageUrl) {
        console.log(`   ⏭️  No images found (checked image_1, image_2, image_3, image_url)`);
        continue;
      }

      let hasChanges = false;
      const updates = {};

      // Process image_1, image_2, image_3 (file fields)
      for (const fieldName of ['image_1', 'image_2', 'image_3']) {
        if (row[fieldName] && Array.isArray(row[fieldName]) && row[fieldName].length > 0) {
          console.log(`   📸 Processing ${fieldName}...`);
          totalProcessed++;
          
          const optimizedFile = await processImageField(row, fieldName, row[fieldName]);
          
          if (optimizedFile) {
            updates[fieldName] = [optimizedFile];
            hasChanges = true;
            totalOptimized++;
          } else {
            totalSkipped++;
          }

          // Small delay to avoid rate limits
          await new Promise(resolve => setTimeout(resolve, 300));
        }
      }

      // Also process legacy image_url field if it exists and no file fields are present
      if (row.image_url && (!row.image_1 || !Array.isArray(row.image_1) || row.image_1.length === 0)) {
        // Extract URL from markdown if needed
        let imageUrl = row.image_url;
        if (imageUrl.includes('![') || imageUrl.includes('](')) {
          // Extract URL from markdown format ![alt](url)
          const match = imageUrl.match(/\]\(([^)]+)\)/);
          if (match) {
            imageUrl = match[1];
          }
        }

        // Clean up URL - remove any whitespace
        imageUrl = imageUrl.trim();

        if (imageUrl && imageUrl.startsWith('http')) {
          console.log(`   📸 Processing image_url (legacy field): ${imageUrl.substring(0, 60)}...`);
          totalProcessed++;
          
          try {
            // Download and optimize
            const downloadPath = path.join(tempDir, `${row.id}-image_url-${Date.now()}.jpg`);
            await downloadImage(imageUrl, downloadPath);

            // Verify file was downloaded
            if (!fs.existsSync(downloadPath)) {
              throw new Error('Download failed - file not created');
            }

            const fileStats = fs.statSync(downloadPath);
            if (fileStats.size === 0) {
              throw new Error('Downloaded file is empty');
            }

            const optimizedPath = path.join(tempDir, `${row.id}-image_url-optimized-${Date.now()}.jpg`);
            const result = await optimizeImage(downloadPath, optimizedPath);

            if (result.optimized) {
              // Upload optimized image as image_1 (first file field)
              const uploadedFile = await uploadImageToBaserow(optimizedPath);
              updates.image_1 = [uploadedFile];
              hasChanges = true;
              totalOptimized++;
              
              // Clean up temp files
              if (fs.existsSync(downloadPath)) fs.unlinkSync(downloadPath);
              if (fs.existsSync(optimizedPath)) fs.unlinkSync(optimizedPath);
            } else {
              totalSkipped++;
              if (fs.existsSync(downloadPath)) fs.unlinkSync(downloadPath);
            }

            await new Promise(resolve => setTimeout(resolve, 300));
          } catch (error) {
            console.error(`   ❌ Error processing image_url: ${error.message}`);
            totalErrors++;
            // Clean up any partial files
            const downloadPath = path.join(tempDir, `${row.id}-image_url-*.jpg`);
            // Note: Can't use glob in Node without additional library, so we'll let cleanup handle it
          }
        } else if (imageUrl && imageUrl.length > 0) {
          console.log(`   ⚠️  image_url exists but is not a valid HTTP URL: ${imageUrl.substring(0, 50)}...`);
        }
      }

      // Update row if any images were optimized
      if (hasChanges) {
        try {
          await updateRowImage(row.id, Object.keys(updates)[0], updates[Object.keys(updates)[0]][0]);
          // Update other fields if multiple were optimized
          for (let i = 1; i < Object.keys(updates).length; i++) {
            const fieldName = Object.keys(updates)[i];
            await updateRowImage(row.id, fieldName, updates[fieldName][0]);
            await new Promise(resolve => setTimeout(resolve, 300));
          }
          console.log(`   ✅ Updated building in Baserow`);
        } catch (error) {
          console.error(`   ❌ Failed to update Baserow:`, error.message);
          totalErrors++;
        }
      } else {
        console.log(`   ⏭️  No images to optimize`);
      }

      // Delay between buildings
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Clean up temp directory
    console.log("\n🧹 Cleaning up temporary files...");
    if (fs.existsSync(tempDir)) {
      const files = fs.readdirSync(tempDir);
      for (const file of files) {
        fs.unlinkSync(path.join(tempDir, file));
      }
      fs.rmdirSync(tempDir);
    }

    // Summary
    console.log("\n" + "=".repeat(50));
    console.log("📊 Optimization Summary:");
    console.log(`   Total images processed: ${totalProcessed}`);
    console.log(`   Images optimized: ${totalOptimized}`);
    console.log(`   Images skipped: ${totalSkipped}`);
    console.log(`   Errors: ${totalErrors}`);
    console.log("=".repeat(50));
    console.log("\n✅ Image optimization complete!");

  } catch (error) {
    console.error("\n❌ Fatal error:", error);
    process.exit(1);
  }
}

main();

