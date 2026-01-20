import type { LASChunk, WorkerMessage } from "./types";

export class WorkerPool {
  private workers: Worker[] = [];
  private tasks: Array<{
    chunk: ArrayBuffer;
    chunkIndex: number;
    startPoint: number;
    pointsPerChunk: number;
    pointSize: number;
    totalPoints: number;
    pointDataOffset: number;
    scale: [number, number, number];
    offset: [number, number, number];
    pointDataFormat: number;
    totalChunks: number;
    resolve: (chunk: LASChunk) => void;
    reject: (error: Error) => void;
  }> = [];
  private activeWorkers = 0;
  private maxWorkers: number;

  constructor(
    maxWorkers: number = Math.min(navigator.hardwareConcurrency || 4, 8),
  ) {
    this.maxWorkers = Math.max(1, maxWorkers);
  }

  public async processChunk(
    chunk: ArrayBuffer,
    chunkIndex: number,
    startPoint: number,
    pointsPerChunk: number,
    pointSize: number,
    totalPoints: number,
    pointDataOffset: number,
    scale: [number, number, number],
    offset: [number, number, number],
    pointDataFormat: number,
    totalChunks: number,
  ): Promise<LASChunk> {
    return new Promise((resolve, reject) => {
      this.tasks.push({
        chunk,
        chunkIndex,
        startPoint,
        pointsPerChunk,
        pointSize,
        totalPoints,
        pointDataOffset,
        scale,
        offset,
        pointDataFormat,
        totalChunks,
        resolve,
        reject,
      });

      this.processNextTask();
    });
  }

  private processNextTask() {
    if (this.tasks.length === 0 || this.activeWorkers >= this.maxWorkers) {
      return;
    }

    const task = this.tasks.shift()!;
    const worker = this.getWorker();
    this.activeWorkers++;

    const handleMessage = (event: MessageEvent<WorkerMessage>) => {
      const data = event.data;

      switch (data.type) {
        case "CHUNK_READY":
          console.log(`воркер завершился чанк=${data.chunkIndex}`);
          task.resolve(data.chunk);
          cleanup();
          break;
        case "ERROR":
          console.log(
            `ошибка воркера на чанке ${task.chunkIndex}:`,
            data.error,
          );
          task.reject(new Error(data.error));
          cleanup();
          break;
        case "COMPLETE":
          task.resolve({
            points: new Float32Array(0),
            colors: new Uint8Array(0),
            bounds: { min: [0, 0, 0], max: [0, 0, 0] },
            offset: task.startPoint,
            count: 0,
          });
          cleanup();
          break;
      }
    };

    const handleError = (error: ErrorEvent) => {
      task.reject(
        new Error(`ошибка чанка ${task.chunkIndex}: ${error.message}`),
      );
      cleanup();
    };

    const cleanup = () => {
      worker.removeEventListener("message", handleMessage as any);
      worker.removeEventListener("error", handleError as any);
      this.activeWorkers--;
      this.processNextTask();
    };

    worker.addEventListener("message", handleMessage);
    worker.addEventListener("error", handleError);

    const message = {
      arrayBuffer: task.chunk,
      chunkIndex: task.chunkIndex,
      startPoint: task.startPoint,
      pointsPerChunk: task.pointsPerChunk,
      pointSize: task.pointSize,
      totalPoints: task.totalPoints,
      pointDataOffset: task.pointDataOffset,
      scale: task.scale,
      offset: task.offset,
      pointDataFormat: task.pointDataFormat,
      totalChunks: task.totalChunks,
    };

    worker.postMessage(message, [task.chunk]);
  }

  private getWorker(): Worker {
    if (this.workers.length < this.maxWorkers) {
      const worker = new Worker(new URL("./lasWorker.ts", import.meta.url), {
        type: "module",
      });
      this.workers.push(worker);
    }

    return this.workers[this.activeWorkers % this.workers.length];
  }

  terminate() {
    this.workers.forEach((worker) => {
      try {
        worker.terminate();
      } catch (e) {
        // log err ?
      }
    });
    this.workers = [];
    this.tasks = [];
    this.activeWorkers = 0;
  }
}
