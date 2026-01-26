import { useRef, useState, useCallback } from "react";
import {
  graphicUniformParamsMeta,
  type TGraphicUniformParams,
  type TGraphicUniformParamsMeta,
} from "../components/use-uniform-controls";

class GraphicsOptimizer {
  private targetFPS!: number;
  private graphicParams!: TGraphicUniformParams;
  private graphicParamsMeta!: TGraphicUniformParamsMeta;

  private isRunning!: boolean;
  private rafId!: number | null;
  private lastTime!: number;
  private frameCount!: number;
  private fps!: number;
  private measurementStart!: number;

  private adaptationSpeed!: number;

  private onProgressCallback!:
    | ((params: {
        fps: number;
        k: number;
        targetFPS: number;
        progress: number;
      }) => void)
    | null;

  private onCompleteCallback!: ((k: number) => void) | null;

  private updateParamCallback!: <TKey extends keyof TGraphicUniformParams>(
    key: TKey,
    val: TGraphicUniformParams[TKey],
  ) => void;

  constructor(
    targetFPS = 60,
    graphicParams: TGraphicUniformParams,
    graphicParamsMeta: TGraphicUniformParamsMeta,
    updateGraphicParams: <TKey extends keyof TGraphicUniformParams>(
      key: TKey,
      val: TGraphicUniformParams[TKey],
    ) => void,
  ) {
    this.targetFPS = targetFPS;
    this.graphicParams = graphicParams;
    console.log("constructor", graphicParams);
    this.graphicParamsMeta = graphicParamsMeta;

    this.isRunning = false;
    this.rafId = null;
    this.lastTime = 0;
    this.frameCount = 0;
    this.fps = 0;

    // Параметры адаптации
    this.adaptationSpeed = 0.1;
    this.measurementStart = 0;

    this.onProgressCallback = null;
    this.onCompleteCallback = null;
    this.updateParamCallback = updateGraphicParams;
  }

  startOptimization(
    onProgress: typeof this.onProgressCallback,
    onComplete: typeof this.onCompleteCallback,
  ) {
    this.onProgressCallback = onProgress;
    this.onCompleteCallback = onComplete;
    this.isRunning = true;
    this.lastTime = performance.now();
    this.measurementStart = this.lastTime;
    this.frameCount = 0;

    this.optimize();
  }

  stopOptimization() {
    this.isRunning = false;
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
    }
  }

  optimize = (currentTime: number) => {
    if (!this.isRunning) return;

    const deltaTime = currentTime - this.lastTime;

    // Считаем FPS
    if (deltaTime > 0) {
      this.frameCount++;

      const TIME_TO_UPDATE_FPS = 500;
      if (currentTime - this.measurementStart >= TIME_TO_UPDATE_FPS) {
        this.fps = Math.round(
          (this.frameCount * 1000) / (currentTime - this.measurementStart),
        );
        this.measurementStart = currentTime;
        this.frameCount = 0;

        // подгон depthBuffer
        this.adaptDepthBuffer();

        // Отправляем прогресс
        if (this.onProgressCallback) {
          this.onProgressCallback({
            fps: this.fps,
            k: this.graphicParams.depthBufferThreshold,
            targetFPS: this.targetFPS,
            progress: this.calculateProgress(),
          });
        }

        // Проверяем завершение
        if (this.isStable()) {
          this.stopOptimization();
          if (this.onCompleteCallback) {
            this.onCompleteCallback(this.graphicParams.depthBufferThreshold);
          }
          return;
        }
      }
    }

    this.lastTime = currentTime;
    this.rafId = requestAnimationFrame(this.optimize);
  };

  adaptDepthBuffer() {
    const fpsDiff = this.fps - this.targetFPS;

    const FPS_THRESHOLD = 0.05; // погрешность в 5%
    if (Math.abs(fpsDiff) < this.targetFPS * FPS_THRESHOLD) {
      return;
    }

    /*
      FPS больше таргета - увеличиваем буффер и наоборот
    */
    let depthBufferChange = 0;

    const PARAMETER_SMOOTH_KOEFFICIENT = 0.5; // погрешность 5%

    if (fpsDiff < 0) {
      // FPS меньше таргета
      const ratio = Math.abs(fpsDiff) / this.targetFPS;
      depthBufferChange =
        -this.graphicParams.depthBufferThreshold * ratio * this.adaptationSpeed;
    } else {
      // FPS больше таргета
      const ratio = fpsDiff / this.targetFPS;
      depthBufferChange =
        this.graphicParams.depthBufferThreshold *
        ratio *
        this.adaptationSpeed *
        PARAMETER_SMOOTH_KOEFFICIENT;
    }

    this.graphicParams.depthBufferThreshold = Math.max(
      this.graphicParamsMeta.depthBufferThreshold.min,
      Math.min(
        this.graphicParamsMeta.depthBufferThreshold.max,
        this.graphicParams.depthBufferThreshold + depthBufferChange,
      ),
    );
    this.updateParamCallback(
      "depthBufferThreshold",
      this.graphicParams.depthBufferThreshold,
    );
  }

  adaptThiningFactor() {
    const fpsDiff = this.fps - this.targetFPS;

    const FPS_THRESHOLD = 0.05; // погрешность в 5%
    if (Math.abs(fpsDiff) < this.targetFPS * FPS_THRESHOLD) {
      return;
    }

    /*
      FPS больше таргета - увеличиваем буффер и наоборот
    */
    let depthBufferChange = 0;

    const PARAMETER_SMOOTH_KOEFFICIENT = 0.5; // погрешность 5%

    if (fpsDiff < 0) {
      // FPS меньше таргета
      const ratio = Math.abs(fpsDiff) / this.targetFPS;
      depthBufferChange =
        -this.graphicParams.depthBufferThreshold * ratio * this.adaptationSpeed;
    } else {
      // FPS больше таргета
      const ratio = fpsDiff / this.targetFPS;
      depthBufferChange =
        this.graphicParams.depthBufferThreshold *
        ratio *
        this.adaptationSpeed *
        PARAMETER_SMOOTH_KOEFFICIENT;
    }

    this.graphicParams.depthBufferThreshold = Math.max(
      this.graphicParamsMeta.depthBufferThreshold.min,
      Math.min(
        this.graphicParamsMeta.depthBufferThreshold.max,
        this.graphicParams.depthBufferThreshold + depthBufferChange,
      ),
    );
    this.updateParamCallback(
      "depthBufferThreshold",
      this.graphicParams.depthBufferThreshold,
    );
  }

  calculateProgress() {
    const PARAMETER_SMOOTH_KOEFFICIENT = 0.5; // погрешность 5%

    const fpsDiff = Math.abs(this.fps - this.targetFPS);
    const tolerance = this.targetFPS * PARAMETER_SMOOTH_KOEFFICIENT;
    return Math.min(1, 1 - fpsDiff / tolerance);
  }

  isStable() {
    const PARAMETER_SMOOTH_KOEFFICIENT = 0.5; // погрешность 5%

    const fpsDiff = Math.abs(this.fps - this.targetFPS);
    return fpsDiff < this.targetFPS * PARAMETER_SMOOTH_KOEFFICIENT; // В пределах 5%
  }
}

export function useGraphicsOptimizer(
  initialGraphicParams: TGraphicUniformParams,
  updateGraphicParams: <TKey extends keyof TGraphicUniformParams>(
    key: TKey,
    val: TGraphicUniformParams[TKey],
  ) => void,
) {
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [progress, setProgress] = useState(null);
  const optimizerRef = useRef<GraphicsOptimizer | null>(null);

  const startOptimization = useCallback(
    /* eslint-disable */
    (targetFPS: number, onComplete: (s: number) => void) => {
      if (optimizerRef.current) {
        optimizerRef.current.stopOptimization();
      }

      optimizerRef.current = new GraphicsOptimizer(
        targetFPS,
        initialGraphicParams,
        graphicUniformParamsMeta,
        updateGraphicParams,
      );

      const onProgress = (progressData: any) => {
        setProgress(progressData);
      };

      const onOptimizationComplete = (optimizedDepthBuffer: number) => {
        setIsOptimizing(false);
        setProgress(null);
        onComplete(optimizedDepthBuffer);
      };

      setIsOptimizing(true);
      optimizerRef.current.startOptimization(
        onProgress,
        onOptimizationComplete,
      );
    },
    [],
  );

  const stopOptimization = useCallback(() => {
    if (optimizerRef.current) {
      optimizerRef.current.stopOptimization();
      setIsOptimizing(false);
      setProgress(null);
    }
  }, []);

  return {
    isOptimizing,
    progress,
    startOptimization,
    stopOptimization,
  };
}
