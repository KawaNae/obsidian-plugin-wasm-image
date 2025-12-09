export async function isAnimatedGif(file: File | Blob): Promise<boolean> {
    const buffer = await file.arrayBuffer();
    const u8 = new Uint8Array(buffer);

    // GIF header check
    if (u8[0] !== 0x47 || u8[1] !== 0x49 || u8[2] !== 0x46 || u8[3] !== 0x38) {
        return false; // Not a GIF-89a or GIF-87a (GIFA...)
    }

    let frames = 0;
    let offset = 6; // Skip Header

    // Logical Screen Descriptor
    // Width (2), Height (2), Packed (1), BgIdx (1), PixelAspect (1)
    if (offset + 7 > u8.length) return false;

    const packed = u8[offset + 4];
    const gctFlag = (packed & 0x80) !== 0;
    const gctSize = 2 << (packed & 0x07);

    offset += 7;

    if (gctFlag) {
        offset += 3 * gctSize;
    }

    // Parse Blocks
    while (offset < u8.length) {
        const blockType = u8[offset];
        offset++;

        if (blockType === 0x3B) { // Trailer (End of GIF)
            break;
        }
        else if (blockType === 0x2C) { // Image Descriptor
            frames++;
            if (frames > 1) return true; // Found 2nd frame, it's animated

            // Skip Image Descriptor (9 bytes)
            // Left(2), Top(2), Width(2), Height(2), Packed(1)
            if (offset + 9 > u8.length) break;

            const imgPacked = u8[offset + 8];
            const lctFlag = (imgPacked & 0x80) !== 0;
            const lctSize = 2 << (imgPacked & 0x07);

            offset += 9;

            if (lctFlag) {
                offset += 3 * lctSize;
            }

            // Skip Image Data
            // LZW Minimum Code Size (1 byte)
            offset++;

            // Data Sub-blocks
            while (offset < u8.length) {
                const blockSize = u8[offset];
                offset++;
                if (blockSize === 0) break; // Block Terminator
                offset += blockSize;
            }
        }
        else if (blockType === 0x21) { // Extension
            // Extension Label
            const label = u8[offset];
            offset++;

            // Extension blocks also follow data sub-block pattern (size + data...)
            // Graphic Control Extension (0xF9) is fixed size 4 usually, but follows block logic
            if (label === 0xF9) {
                // Graphic Control Extension often precedes Image Descriptor
            }

            while (offset < u8.length) {
                const blockSize = u8[offset];
                offset++;
                if (blockSize === 0) break;
                offset += blockSize;
            }
        }
        else {
            // Unknown block, might be corrupt or read error
            break;
        }
    }

    return frames > 1;
}
