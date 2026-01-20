export interface LASHeader {
  versionMajor: number;
  versionMinor: number;
  offsetToPointData: number;
  pointDataRecordLength: number;
  pointDataFormat: number;
  numberOfPoints: number;
  scale: [number, number, number];
  offset: [number, number, number];
  max: [number, number, number];
  min: [number, number, number];
}

export interface LASPoint {
  x: number;
  y: number;
  z: number;
  intensity: number;
  classification: number;
  returnNumber: number;
  numberOfReturns: number;
  scanDirectionFlag: boolean;
  edgeOfFlightLine: boolean;
  red: number;
  green: number;
  blue: number;
}

export interface LASChunk {
  points: Float32Array;
  colors: Uint8Array;
  bounds: {
    min: [number, number, number];
    max: [number, number, number];
  };
  offset: number;
  count: number;
}

export type WorkerMessage =
  | { type: "PROGRESS"; progress: number; chunkIndex: number }
  | { type: "CHUNK_READY"; chunk: LASChunk; chunkIndex: number }
  | { type: "ERROR"; error: string }
  | { type: "COMPLETE"; totalChunks: number };
