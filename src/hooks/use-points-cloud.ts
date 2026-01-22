import { useState, useCallback, useEffect } from "react";
import type { LASHeader, PointData } from "../types";

export interface UsePointCloudResult {
  header: LASHeader | null;
  pointData: PointData | null;
  isLoading: boolean;
  progress: number;
  error: string | null;
  loadFile: (file: File) => Promise<void>;
}

type TChunk = {
  start: number;
  end: number;
};

export function usePointCloud(maxWorkers = 4): UsePointCloudResult {
  const [header, setHeader] = useState<LASHeader | null>(null);
  const [pointData, setPointData] = useState<PointData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [chunks, setChunks] = useState<TChunk[] | null>(null);
  const [file, setFile] = useState<File | null>(null);

  const combineResults = useCallback((chunkResults: any[]) => {
    const totalPoints = chunkResults.reduce((sum, r) => sum + r.count, 0);

    const positions = new Float32Array(totalPoints * 3);
    const colors = new Uint8Array(totalPoints * 3);
    const intensities = new Uint16Array(totalPoints);

    let positionOffset = 0;
    let colorOffset = 0;
    let intensityOffset = 0;

    for (const result of chunkResults) {
      positions.set(result.positions, positionOffset);
      colors.set(result.colors, colorOffset);
      intensities.set(result.intensities, intensityOffset);

      positionOffset += result.positions.length;
      colorOffset += result.colors.length;
      intensityOffset += result.intensities.length;
    }

    setPointData({
      positions,
      colors,
      intensities,
    });

    setIsLoading(false);
  }, []);

  const readPointsData = useCallback(async () => {
    if (header && file) {
      const totalPoints = header.pointCount;
      const pointsPerChunk = Math.ceil(totalPoints / maxWorkers);
      const chunks: { start: number; end: number }[] = [];
      console.log({ totalPoints, pointsPerChunk, chunks });

      for (let i = 0; i < maxWorkers; i++) {
        const start = i * pointsPerChunk;
        const end = Math.min(start + pointsPerChunk, totalPoints);
        if (start < end) {
          chunks.push({ start, end });
        }
      }
      setChunks(chunks);

      const workers: Worker[] = [];
      const results = Array(chunks.length).fill(null);
      let completedChunks = 0;

      for (let i = 0; i < chunks.length; i++) {
        const worker = new Worker(
          new URL("../workers/las-parser.ts", import.meta.url),
          { type: "module" },
        );

        worker.onmessage = (event) => {
          if (event.data.type === "complete") {
            results[event.data.chunkIndex] = {
              positions: new Float32Array(event.data.data.positions),
              colors: new Uint8Array(event.data.data.colors),
              intensities: new Uint16Array(event.data.data.intensities),
              count: event.data.data.count,
            };

            completedChunks++;
            setProgress(completedChunks / chunks.length);

            // Если все чанки обработаны - собираем результат
            if (completedChunks === chunks.length) {
              combineResults(results);
              workers.forEach((w) => w.terminate());
            }
          } else if (event.data.type === "error") {
            setError(event.data.data);
            workers.forEach((w) => w.terminate());
            setIsLoading(false);
          }
        };

        worker.onerror = (err) => {
          setError(err.message);
          workers.forEach((w) => w.terminate());
          setIsLoading(false);
        };

        workers.push(worker);
      }

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const byteStart =
          header.pointsDataOffset + chunk.start * header.pointSize;
        const byteEnd = header.pointsDataOffset + chunk.end * header.pointSize;

        const chunkSlice = file.slice(byteStart, byteEnd);
        const chunkBuffer = await chunkSlice.arrayBuffer();

        workers[i].postMessage({
          buffer: chunkBuffer,
          chunkStart: 0, // Внутри чанка начинаем с 0
          chunkEnd: chunk.end - chunk.start,
          header: header,
          chunkIndex: i,
        });
      }
    }
  }, [combineResults, file, header, maxWorkers]);

  const loadFile = useCallback(async (file: File) => {
    setIsLoading(true);
    setError(null);
    setProgress(0);

    setFile(file);

    try {
      const headerSlice = file.slice(0, 375);
      const headerBuffer = await headerSlice.arrayBuffer();

      const headerWorker = new Worker(
        new URL("../workers/las-parser.ts", import.meta.url),
        { type: "module" },
      );

      const header = await new Promise<LASHeader>((resolve, reject) => {
        headerWorker.onmessage = (event) => {
          if (event.data.type === "header") {
            console.log({ eventData: event.data });
            resolve(event.data.data);
          } else if (event.data.type === "error") {
            reject(new Error(event.data.data));
          }
          headerWorker.terminate();
        };
        headerWorker.onerror = reject;

        headerWorker.postMessage({
          buffer: headerBuffer,
          header: null,
        });
      });

      setHeader(header);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    readPointsData();
  }, [readPointsData]);

  return {
    header,
    pointData,
    isLoading,
    progress,
    error,
    loadFile,
  };
}
