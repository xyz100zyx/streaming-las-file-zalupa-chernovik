self.onmessage = async (event: MessageEvent) => {
  const {
    arrayBuffer,
    chunkIndex,
    startPoint,
    pointsPerChunk,
    pointSize,
    totalPoints,
    pointDataOffset,
  } = event.data;

  try {
    const dataView = new DataView(arrayBuffer);

    const pointsToRead = Math.min(pointsPerChunk, totalPoints - startPoint);

    console.log(`worker ${chunkIndex}, точек=${pointsToRead}`);

    if (pointsToRead <= 0) {
      self.postMessage({
        type: "COMPLETE",
        chunkIndex,
      });
      return;
    }

    const positions = new Float32Array(pointsToRead * 3);
    const colors = new Uint8Array(pointsToRead * 3);

    let minX = Infinity,
      minY = Infinity,
      minZ = Infinity;
    let maxX = -Infinity,
      maxY = -Infinity,
      maxZ = -Infinity;

    let pointsRead = 0;

    const scaleX = event.data.scale[0];
    const scaleY = event.data.scale[1];
    const scaleZ = event.data.scale[2];
    const offsetX = event.data.offset[0];
    const offsetY = event.data.offset[1];
    const offsetZ = event.data.offset[2];

    for (let i = 0; i < pointsToRead; i++) {
      const pointIndex = startPoint + i;
      const byteOffset = pointDataOffset + pointIndex * pointSize;

      // если вышли за границы то стоп
      if (byteOffset + pointSize > dataView.byteLength) {
        console.log("вышли за границы буффера");
        break;
      }

      try {
        const xInt = dataView.getInt32(byteOffset, true);
        const yInt = dataView.getInt32(byteOffset + 4, true);
        const zInt = dataView.getInt32(byteOffset + 8, true);

        const x = xInt * scaleX + offsetX;
        const y = yInt * scaleY + offsetY;
        const z = zInt * scaleZ + offsetZ;

        // Читаем цвет format 6
        const red = 255,
          green = 255,
          blue = 255;
        // if (event.data.pointDataFormat >= 2) {
        //   // format 6 => 31 байт на точку
        //   if (pointSize >= 28) {
        //     red = Math.min(255, dataView.getUint16(byteOffset + 20, true) >> 8);
        //     green = Math.min(
        //       255,
        //       dataView.getUint16(byteOffset + 22, true) >> 8,
        //     );
        //     blue = Math.min(
        //       255,
        //       dataView.getUint16(byteOffset + 24, true) >> 8,
        //     );
        //   }
        // }

        const idx = pointsRead * 3;
        positions[idx] = x;
        positions[idx + 1] = y;
        positions[idx + 2] = z;

        colors[idx] = red;
        colors[idx + 1] = green;
        colors[idx + 2] = blue;

        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        minZ = Math.min(minZ, z);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
        maxZ = Math.max(maxZ, z);

        pointsRead++;
      } catch (error) {
        console.log(
          `worker ${chunkIndex} ошибка парсинга точки ${pointIndex}:`,
          error,
        );
        continue;
      }
    }

    console.log(`worker ${chunkIndex} success, точек=${pointsRead} points`);

    if (pointsRead === 0) {
      self.postMessage({
        type: "COMPLETE",
        chunkIndex,
      });
      return;
    }

    // длина массива должна быть равно кол-ву точек * xyz
    const finalPositions = new Float32Array(pointsRead * 3);
    const finalColors = new Uint8Array(pointsRead * 3);

    finalPositions.set(positions.subarray(0, pointsRead * 3));
    finalColors.set(colors.subarray(0, pointsRead * 3));

    self.postMessage({
      type: "CHUNK_READY",
      chunk: {
        points: finalPositions,
        colors: finalColors,
        bounds: {
          min: [minX, minY, minZ],
          max: [maxX, maxY, maxZ],
        },
        offset: startPoint,
        count: pointsRead,
      },
      chunkIndex,
    });

    self.postMessage({
      type: "PROGRESS",
      progress: (chunkIndex + 1) / event.data.totalChunks,
      chunkIndex,
    });
  } catch (error) {
    console.log(`ошибка worker ${chunkIndex}:`, error);
    self.postMessage({
      type: "ERROR",
      error: error instanceof Error ? error.message : "Unknown error",
      chunkIndex,
    });
  }
};
