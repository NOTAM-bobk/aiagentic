"use client";

/**
 * Generated images arrive as base64 data URLs. They are shrunk in the browser
 * before they are kept: a project stores them in localStorage, mounts them in
 * the preview runtime, and uploads them on deploy, so a 4MB PNG is not an
 * option. JPEG for photos, PNG when the path asks for transparency.
 */

const MAX_EDGE = 1100;
// base64 of roughly 240KB: small enough that three images still fit in localStorage.
const MAX_CHARS = 320_000;

export function splitDataUrl(value: string): { mime: string; base64: string } | null {
  const match = /^data:([^;,]+);base64,([\s\S]+)$/.exec(value.trim());
  if (!match) return null;
  return { mime: match[1].toLowerCase(), base64: match[2].replace(/\s+/g, "") };
}

/** Raw base64 for runtimes that take bytes instead of text. */
export function base64FromDataUrl(value: string): string {
  return splitDataUrl(value)?.base64 ?? "";
}

function load(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = "sync";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("The generated image could not be decoded."));
    image.src = dataUrl;
  });
}

function draw(image: HTMLImageElement, edge: number, mime: string): string {
  const canvas = document.createElement("canvas");
  const longest = Math.max(image.naturalWidth, image.naturalHeight) || edge;
  const scale = Math.min(1, edge / longest);
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const context = canvas.getContext("2d");
  if (!context) return "";
  if (mime === "image/jpeg") {
    // JPEG has no alpha; without this a transparent PNG turns black.
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
  }
  context.imageSmoothingQuality = "high";
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL(mime, 0.82);
}

export async function shrinkImage(
  dataUrl: string,
  path: string,
): Promise<{ dataUrl: string; mime: string }> {
  const parts = splitDataUrl(dataUrl);
  if (!parts) return { dataUrl, mime: "image/jpeg" };
  if (typeof document === "undefined") return { dataUrl, mime: parts.mime };

  try {
    const image = await load(dataUrl);
    const mime = /\.png$/i.test(path) ? "image/png" : "image/jpeg";
    let output = draw(image, MAX_EDGE, mime);
    if (!output) return { dataUrl, mime: parts.mime };
    if (output.length > MAX_CHARS) output = draw(image, Math.round(MAX_EDGE * 0.72), mime);
    if (!output) return { dataUrl, mime: parts.mime };
    return { dataUrl: output, mime };
  } catch {
    return { dataUrl, mime: parts.mime };
  }
}
