export interface WorkerMessage {
  type: "progress" | "complete" | "error" | "header";
  data: any;
  chunkIndex?: number;
  totalChunks?: number;
}
