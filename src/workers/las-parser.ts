import type { LASHeader } from "../types";

class LASParser {
  private view: DataView;
  private offset: number = 0;
  private buffer!: ArrayBuffer;

  constructor(buffer: ArrayBuffer) {
    this.buffer = buffer;
    this.view = new DataView(buffer);
  }

  parseHeader(): LASHeader {
    const pointCount = this.view.getUint32(247, true);
    console.log({ pointCount });
    const pointFormat = this.view.getUint8(104) & 0x3f;
    const pointSize = this.view.getUint16(105, true);

    const min = [
      this.view.getFloat64(187, true), // X min
      this.view.getFloat64(203, true), // Y min
      this.view.getFloat64(219, true), // Z min
    ] as [number, number, number];

    const max = [
      this.view.getFloat64(163, true), // X max
      this.view.getFloat64(179, true), // Y max
      this.view.getFloat64(195, true), // Z max
    ] as [number, number, number];

    this.offset = this.view.getUint32(96, true); // Начало данных точек

    return {
      pointCount,
      pointFormat,
      pointSize,
      offset: {
        x: this.view.getFloat64(155, true),
        y: this.view.getFloat64(163, true),
        z: this.view.getFloat64(171, true),
      },
      scale: {
        x: this.view.getFloat64(131, true),
        y: this.view.getFloat64(139, true),
        z: this.view.getFloat64(147, true),
      },
      pointsDataOffset: this.offset,
      min,
      max,
    };
  }

  parsePoints(chunkStart: number, chunkEnd: number, header: LASHeader) {
    const { pointSize, offset, scale } = header;
    const pointsInChunk = Math.min(
      header.pointCount - chunkStart,
      chunkEnd - chunkStart,
    );

    const positions = new Float32Array(pointsInChunk * 3);
    const colors = new Uint8Array(pointsInChunk * 3);
    const intensities = new Uint16Array(pointsInChunk);

    let posIdx = 0;
    let colorIdx = 0;
    let intensityIdx = 0;

    for (let i = 0; i < pointsInChunk; i++) {
      try {
        const pointOffset = this.offset + (chunkStart + i) * pointSize;

        const x = this.view.getInt32(pointOffset, true) * scale.x + offset.x;
        const y =
          this.view.getInt32(pointOffset + 4, true) * scale.y + offset.y;
        const z =
          this.view.getInt32(pointOffset + 8, true) * scale.z + offset.z;

        positions[posIdx++] = x;
        positions[posIdx++] = y;
        positions[posIdx++] = z;

        intensities[intensityIdx++] = this.view.getUint16(
          pointOffset + 12,
          true,
        );

        // Чтение цвета (для форматов 2, 3, 5, 7, 8, 10)
        if (header.pointFormat >= 2) {
          const red = this.view.getUint16(pointOffset + 28, true) >> 8;
          const green = this.view.getUint16(pointOffset + 30, true) >> 8;
          const blue = this.view.getUint16(pointOffset + 32, true) >> 8;

          colors[colorIdx++] = red;
          colors[colorIdx++] = green;
          colors[colorIdx++] = blue;
        } else {
          // Без цвета - используем интенсивность
          const intensity = intensities[intensityIdx - 1] >> 8;
          colors[colorIdx++] = intensity;
          colors[colorIdx++] = intensity;
          colors[colorIdx++] = intensity;
        }
      } catch (e: unknown) {
        console.log("eror", e);
      }
    }

    return {
      positions,
      colors,
      intensities,
      count: pointsInChunk,
    };
  }
}

self.onmessage = async (event: MessageEvent) => {
  const { buffer, chunkStart, chunkEnd, header } = event.data;

  try {
    const parser = new LASParser(buffer);

    if (!header) {
      const parsedHeader = parser.parseHeader();
      self.postMessage({
        type: "header",
        data: parsedHeader,
      });
    } else {
      const result = parser.parsePoints(chunkStart, chunkEnd, header);

      self.postMessage(
        {
          type: "complete",
          data: {
            positions: result.positions.buffer,
            colors: result.colors.buffer,
            intensities: result.intensities.buffer,
            count: result.count,
          },
          chunkIndex: event.data.chunkIndex,
        },
        [
          result.positions.buffer,
          result.colors.buffer,
          result.intensities.buffer,
        ],
      );
    }
  } catch (error) {
    self.postMessage({
      type: "error",
      data: error instanceof Error ? error.message : "Unknown error",
    });
  }
};
