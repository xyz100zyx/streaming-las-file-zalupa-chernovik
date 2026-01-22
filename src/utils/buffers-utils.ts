export function splitLargeBuffer(
  buffer: ArrayBuffer,
  maxChunkSize = 1024 * 1024 * 1024, // до 2гб
): ArrayBuffer[] {
  const chunks: ArrayBuffer[] = [];
  const totalBytes = buffer.byteLength;
  let offset = 0;

  while (offset < totalBytes) {
    const chunkSize = Math.min(maxChunkSize, totalBytes - offset);
    const chunk = buffer.slice(offset, offset + chunkSize);
    chunks.push(chunk);
    offset += chunkSize;
  }

  return chunks;
}

export function mergeBuffers(chunks: ArrayBuffer[]): ArrayBuffer {
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
  const result = new Uint8Array(totalLength);

  let offset = 0;
  for (const chunk of chunks) {
    result.set(new Uint8Array(chunk), offset);
    offset += chunk.byteLength;
  }

  return result.buffer;
}
