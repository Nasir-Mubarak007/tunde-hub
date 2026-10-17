/**
 * Browser side screenshot resizing for the spec 0001 pipeline.
 * Each picked screenshot becomes exactly three JPEG files, 320, 768 and
 * 1200 pixels wide, so the phone downloads the small one and the
 * desktop the large one. Rotation from phone cameras is corrected with
 * `imageOrientation: "from-image"` where the browser supports it.
 */

import { IMAGE_WIDTHS } from "../../domain/listingImage";

/** One resized file. Takes the bytes plus which width and position it carries. */
export interface ResizedScreenshot {
  readonly file: File;
  readonly position: number;
  readonly width: number;
}

/** Strips the extension. Takes a file name, returns the base. */
function baseNameOf(fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  if (dot <= 0) {
    return fileName.replace(/[^a-zA-Z0-9-_]+/g, "-").slice(0, 40) || "screenshot";
  }
  const base = fileName.slice(0, dot).replace(/[^a-zA-Z0-9-_]+/g, "-").slice(0, 40);
  return base.length === 0 ? "screenshot" : base;
}

/** Decodes an image file to a bitmap. Takes the file, returns the bitmap with EXIF applied. */
async function decodeToBitmap(file: File): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return await createImageBitmap(file);
  }
}

/** Draws the bitmap at the target width. Takes the bitmap plus the width, returns a JPEG blob. */
function renderToJpeg(bitmap: ImageBitmap, targetWidth: number): Promise<Blob> {
  const scale = targetWidth / bitmap.width;
  const targetHeight = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const context = canvas.getContext("2d");
  if (context === null) {
    throw new Error("Canvas 2d is unavailable in this browser.");
  }
  context.drawImage(bitmap, 0, 0, targetWidth, targetHeight);
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob === null) {
          reject(new Error("The browser refused to encode the resized image."));
          return;
        }
        resolve(blob);
      },
      "image/jpeg",
      0.82,
    );
  });
}

/**
 * Resizes one picked screenshot to its three width variants.
 * Takes the file plus its position, returns the three files.
 */
export async function resizeScreenshotToWidths(file: File, position: number): Promise<readonly ResizedScreenshot[]> {
  const bitmap = await decodeToBitmap(file);
  try {
    const base = baseNameOf(file.name);
    const out: ResizedScreenshot[] = [];
    for (const width of IMAGE_WIDTHS) {
      const blob = await renderToJpeg(bitmap, width);
      out.push({
        file: new File([blob], `${base}-p${position}-w${width}.jpg`, { type: "image/jpeg" }),
        position,
        width,
      });
    }
    return out;
  } finally {
    bitmap.close();
  }
}
