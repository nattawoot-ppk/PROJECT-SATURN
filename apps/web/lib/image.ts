/** Read an image file, downscale to maxSide px, return a JPEG data URL and aspect ratio (w/h). */
export function loadImageForUnderlay(file: File, maxSide = 1400): Promise<{ src: string; aspect: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file); const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
      const c = document.createElement("canvas"); c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
      c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve({ src: c.toDataURL("image/jpeg", 0.85), aspect: img.width / img.height });
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Could not read image")); };
    img.src = url;
  });
}
