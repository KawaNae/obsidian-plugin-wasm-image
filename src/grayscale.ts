export function convertToGrayscale(rgba: Uint8Array): Uint8Array {
  const result = new Uint8Array(rgba.length);
  
  for (let i = 0; i < rgba.length; i += 4) {
    // Luminanceフォーミュラ: Y = 0.299*R + 0.587*G + 0.114*B
    const gray = Math.round(
      0.299 * rgba[i] +     // R
      0.587 * rgba[i + 1] + // G
      0.114 * rgba[i + 2]   // B
    );
    
    result[i] = gray;     // R
    result[i + 1] = gray; // G
    result[i + 2] = gray; // B
    result[i + 3] = rgba[i + 3]; // A (alpha)
  }
  
  return result;
}