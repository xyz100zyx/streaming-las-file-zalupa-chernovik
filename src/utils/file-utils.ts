export async function readFileInChunks(
  file: File,
  onProgress?: (progress: number) => void,
  chunkSize = 256 * 1024 * 1024, // 256 МБ на чанк
): Promise<ArrayBuffer[]> {
  const chunks: ArrayBuffer[] = [];
  const totalSize = file.size;
  let offset = 0;

  while (offset < totalSize) {
    const size = Math.min(chunkSize, totalSize - offset);
    const chunk = await readFileSlice(file, offset, offset + size);
    chunks.push(chunk);

    offset += size;

    if (onProgress) {
      onProgress(offset / totalSize);
    }
  }

  return chunks;
}

async function readFileSlice(
  file: File,
  start: number,
  end: number,
): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    const slice = file.slice(start, end);

    reader.onload = () => {
      if (reader.result instanceof ArrayBuffer) {
        resolve(reader.result);
      } else {
        reject(new Error("Failed to read file slice"));
      }
    };

    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(slice);
  });
}
