export async function detectDocumentPages(file: File): Promise<number> {
  if (file.type.startsWith('image/')) {
    return 1;
  }

  if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
    try {
      const buffer = await file.arrayBuffer();
      const text = new TextDecoder('latin1').decode(buffer);
      // Match individual /Type /Page dictionaries (excluding /Pages)
      const pageMatches = text.match(/\/Type\s*\/Page\b(?!s)/g);
      if (pageMatches && pageMatches.length > 0) {
        return pageMatches.length;
      }
      // Fallback: look for /Count N in root Pages dictionary
      const countMatches = [...text.matchAll(/\/Count\s+(\d+)/g)].map((m) =>
        parseInt(m[1], 10)
      );
      if (countMatches.length > 0) {
        return Math.max(...countMatches);
      }
    } catch {
      // Fallback estimate by file size if compressed object streams hide /Page
    }
    return Math.max(1, Math.min(40, Math.round(file.size / 65000)));
  }

  if (file.type.startsWith('text/') || file.name.toLowerCase().endsWith('.txt')) {
    const text = await file.text();
    const lines = text.split('\n').length;
    return Math.max(1, Math.ceil(lines / 48));
  }

  // DOCX / PPTX / other office documents rough page estimate
  return Math.max(1, Math.min(60, Math.round(file.size / 45000)));
}

export function readFileAsResizedImage(
  file: File,
  maxDimension = 1200
): Promise<string | null> {
  if (!file.type.startsWith('image/')) {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxDimension / Math.max(img.width, img.height));
        const width = Math.round(img.width * scale);
        const height = Math.round(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(null);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.88));
      };
      img.onerror = () => resolve(null);
      img.src = String(reader.result);
    };
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
}

export function applyDocumentScanFilter(
  sourceDataUrl: string,
  filter: 'original' | 'bw-scan' | 'high-contrast',
  rotationDeg = 0
): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const swapDims = rotationDeg % 180 !== 0;
      const w = swapDims ? img.height : img.width;
      const h = swapDims ? img.width : img.height;

      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(sourceDataUrl);
        return;
      }

      ctx.save();
      ctx.translate(w / 2, h / 2);
      ctx.rotate((rotationDeg * Math.PI) / 180);
      ctx.drawImage(img, -img.width / 2, -img.height / 2);
      ctx.restore();

      if (filter !== 'original') {
        const imageData = ctx.getImageData(0, 0, w, h);
        const data = imageData.data;

        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          if (filter === 'bw-scan') {
            // Crisp document grayscale with boosted paper whiteness
            const lum = 0.299 * r + 0.587 * g + 0.114 * b;
            const boosted = lum > 165 ? Math.min(255, lum * 1.18) : lum < 105 ? Math.max(0, lum * 0.72) : lum;
            data[i] = boosted;
            data[i + 1] = boosted;
            data[i + 2] = boosted;
          } else if (filter === 'high-contrast') {
            // Sharp contrast enhancement while retaining color
            const factor = 1.42;
            data[i] = Math.min(255, Math.max(0, factor * (r - 128) + 128 + 8));
            data[i + 1] = Math.min(255, Math.max(0, factor * (g - 128) + 128 + 8));
            data[i + 2] = Math.min(255, Math.max(0, factor * (b - 128) + 128 + 8));
          }
        }
        ctx.putImageData(imageData, 0, 0);
      }

      resolve(canvas.toDataURL('image/jpeg', 0.9));
    };
    img.onerror = () => resolve(sourceDataUrl);
    img.src = sourceDataUrl;
  });
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
