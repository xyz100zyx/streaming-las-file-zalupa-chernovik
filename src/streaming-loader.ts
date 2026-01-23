import type { LASChunk, LASHeader } from "./types";

export class StreamingLASLoader {
  private pointsPerChunk: number = 200_000; // Оптимально для потока
  private pointCount: number = 0;

  private totalPointsCount!: number

  getTotalPointsCount(){
    return this.totalPointsCount
  }

  async loadLASFile(
    file: File,
    onProgress?: (progress: number) => void,
  ): Promise<{
    chunks: LASChunk[];
    header: LASHeader;
  }> {
    console.log("START");

    const HEADER_BYTESIZE = 375;
    const headerBuffer = await this.readFileSlice(file, 0, HEADER_BYTESIZE);
    const header = this.parseHeader(headerBuffer);
    console.log({ header });
    this.totalPointsCount = header.numberOfPoints

    console.log("header meta:", {
      points: header.numberOfPoints.toLocaleString(),
      format: header.pointDataFormat,
      pointSize: header.pointDataRecordLength,
      offset: header.offsetToPointData,
    });

    if (header.numberOfPoints === 0) {
      const estimatedPoints = Math.floor(
        (file.size - header.offsetToPointData) / header.pointDataRecordLength,
      );
      if (estimatedPoints > 0) {
        header.numberOfPoints = estimatedPoints;
      }
    }

    const totalPoints = header.numberOfPoints;
    this.totalPointsCount = totalPoints;
    const pointSize = header.pointDataRecordLength;
    const pointDataOffset = header.offsetToPointData;
    const totalChunks = Math.ceil(totalPoints / this.pointsPerChunk);

    const chunks: LASChunk[] = [];

    console.log("чанки кол-во ".concat(String(totalChunks)));

    for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
      const startPoint = chunkIndex * this.pointsPerChunk;
      const pointsInChunk = Math.min(
        this.pointsPerChunk,
        totalPoints - startPoint,
      );

      const startByte = pointDataOffset + startPoint * pointSize;
      const endByte = Math.min(
        startByte + pointsInChunk * pointSize,
        file.size,
      );

      // если пустой чанк пропускаем
      if (startByte >= endByte) continue;

      const chenkSizeMb = (endByte - startByte) / 1024 / 1024;

      console.log("chunk iter=", chunkIndex + 1 / totalChunks);
      console.log("chunk size=", chenkSizeMb);

      const chunkBuffer = await this.readFileSlice(file, startByte, endByte);

      const chunk = this.parseChunk(
        chunkBuffer,
        header,
        startPoint,
        pointsInChunk,
      );

      if (chunk.count > 0) {
        chunks.push(chunk);
        console.log("точек=", chunk.count);
      }

      if (onProgress) {
        onProgress((chunkIndex + 1) / totalChunks);
      }

      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    const totalLoadedPoints = chunks.reduce(
      (sum, chunk) => sum + chunk.count,
      0,
    );
    console.log("всех точек загружено=", totalLoadedPoints);

    return { chunks, header };
  }

  private async readFileSlice(
    file: File,
    start: number,
    end: number,
  ): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      if (start >= end || start >= file.size) {
        resolve(new ArrayBuffer(0));
        return;
      }

      const actualEnd = Math.min(end, file.size);
      const blob = file.slice(start, actualEnd);

      const reader = new FileReader();

      reader.onload = () => {
        if (reader.result instanceof ArrayBuffer) {
          resolve(reader.result);
        } else {
          reject(new Error("Ошибка при чтении слайса"));
        }
      };

      reader.onerror = () => {
        if (actualEnd - start > 10 * 1024 * 1024) {
          this.readFileSliceInParts(file, start, actualEnd)
            .then(resolve)
            .catch(reject);
        } else {
          reject(
            new Error(`Ошибка при чтении слайса=${reader.error?.message}`),
          );
        }
      };

      reader.readAsArrayBuffer(blob);
    });
  }

  private async readFileSliceInParts(
    file: File,
    start: number,
    end: number,
  ): Promise<ArrayBuffer> {
    const partSize = 5 * 1024 * 1024; // 5мб
    const parts: ArrayBuffer[] = [];

    for (let current = start; current < end; current += partSize) {
      const partEnd = Math.min(current + partSize, end);
      const blob = file.slice(current, partEnd);

      const partBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as ArrayBuffer);
        reader.onerror = reject;
        reader.readAsArrayBuffer(blob);
      });

      parts.push(partBuffer);

      // пусть браузер подышит
      await new Promise((resolve) => setTimeout(resolve, 10));
    }

    const totalSize = parts.reduce((sum, part) => sum + part.byteLength, 0);
    const result = new Uint8Array(totalSize);
    let offset = 0;

    for (const part of parts) {
      result.set(new Uint8Array(part), offset);
      offset += part.byteLength;
    }

    return result.buffer;
  }

  private parseHeader(buffer: ArrayBuffer): LASHeader {
    const dataView = new DataView(buffer);

    const signature = String.fromCharCode(
      dataView.getUint8(0),
      dataView.getUint8(1),
      dataView.getUint8(2),
      dataView.getUint8(3),
    );

    if (signature !== "LASF") {
      throw new Error("Неверный лас-файл");
    }

    const versionMajor = dataView.getUint8(24);
    const versionMinor = dataView.getUint8(25);
    const isLAS14 = versionMajor === 1 && versionMinor === 4;

    let numberOfPoints: number;
    let min: [number, number, number];
    let max: [number, number, number];

    // лас 1.4 extended point count
    if (isLAS14) {
      const legacyCount = dataView.getUint32(107, true);
      const extendedCount = dataView.getBigUint64(247, true);
      numberOfPoints = Number(
        extendedCount > 0n ? extendedCount : BigInt(legacyCount),
      );

      min = [
        dataView.getFloat64(187, true), // X min
        dataView.getFloat64(203, true), // Y min
        dataView.getFloat64(219, true), // Z min
      ];

      max = [
        dataView.getFloat64(179, true), // X max
        dataView.getFloat64(195, true), // Y max
        dataView.getFloat64(211, true), // Z max
      ];
    } else {
      numberOfPoints = dataView.getUint32(107, true);

      min = [
        dataView.getFloat64(203, true),
        dataView.getFloat64(211, true),
        dataView.getFloat64(219, true),
      ];

      max = [
        dataView.getFloat64(179, true),
        dataView.getFloat64(187, true),
        dataView.getFloat64(195, true),
      ];
    }

    return {
      versionMajor,
      versionMinor,
      offsetToPointData: dataView.getUint32(96, true),
      pointDataRecordLength: dataView.getUint16(105, true),
      pointDataFormat: dataView.getUint8(104) & 0x3f,
      numberOfPoints,
      scale: [
        dataView.getFloat64(131, true),
        dataView.getFloat64(139, true),
        dataView.getFloat64(147, true),
      ],
      offset: [
        dataView.getFloat64(155, true),
        dataView.getFloat64(163, true),
        dataView.getFloat64(171, true),
      ],
      max,
      min,
    };
  }

  private parseChunk(
    buffer: ArrayBuffer,
    header: LASHeader,
    startPoint: number,
    count: number,
  ): LASChunk {
    const dataView = new DataView(buffer);
    const pointSize = header.pointDataRecordLength;

    const positions = new Float32Array((count * 3) / 1);
    const colors = new Uint8Array((count * 3) / 1);

    let minX = Infinity,
      minY = Infinity,
      minZ = Infinity;
    let maxX = -Infinity,
      maxY = -Infinity,
      maxZ = -Infinity;
    let pointsRead = 0;

    const hasColor = header.pointDataFormat >= 2;

    for (let i = 0; i < count; i++) {
      const byteOffset = i * pointSize;

      // если за пределами буффера то стоп
      if (byteOffset + pointSize > buffer.byteLength) {
        break;
      }

      try {
        const x = this.readCoord(
          dataView,
          byteOffset,
          header.scale[0],
          header.offset[0],
        );
        const y = this.readCoord(
          dataView,
          byteOffset + 4,
          header.scale[1],
          header.offset[1],
        );
        const z = this.readCoord(
          dataView,
          byteOffset + 8,
          header.scale[2],
          header.offset[2],
        );
        const intensity = dataView.getUint16(byteOffset + 12, true);

        let red = 255,
          green = 255,
          blue = 255;

        // if (hasColor && pointSize >= 14) {
        if (true) {
          red = Math.min(255, dataView.getUint16(byteOffset + 30, true) >> 8);
          green = Math.min(255, dataView.getUint16(byteOffset + 32, true) >> 8);
          blue = Math.min(255, dataView.getUint16(byteOffset + 34, true) >> 8);
        }
        // if (this.pointCount % 7 === 0) {
        if (true) {
          const idx = pointsRead * 3;
          positions[idx] = x;
          positions[idx + 1] = y;
          positions[idx + 2] = z;

          colors[idx] = red;
          colors[idx + 1] = green;
          colors[idx + 2] = blue;

          // новые границы геометрии
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          minZ = Math.min(minZ, z);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
          maxZ = Math.max(maxZ, z);
        }
        this.pointCount++;
        pointsRead++;
      } catch (error) {
        console.log("битая точка ошибка=", JSON.stringify(error));
        continue;
      }
    }

    const finalPositions = positions.slice(0, pointsRead * 3);
    const finalColors = colors.slice(0, pointsRead * 3);

    return {
      points: finalPositions,
      colors: finalColors,
      bounds: {
        min: [minX, minY, minZ],
        max: [maxX, maxY, maxZ],
      },
      offset: startPoint,
      count: pointsRead,
    };
  }

  private readCoord(
    dataView: DataView,
    offset: number,
    scale: number,
    offsetVal: number,
  ): number {
    const intValue = dataView.getInt32(offset, true);
    return intValue * scale + offsetVal;
  }
}
