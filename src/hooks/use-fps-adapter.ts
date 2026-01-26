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

  private doneGraphicParameters: Record<keyof TGraphicUniformParams, boolean> =
    {
      depthBufferThreshold: false,
      pointSize: true,
      thiningFactorK: false,
    };

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

    this.graphicParamsMeta = graphicParamsMeta;

    this.isRunning = false;
    this.rafId = null;
    this.lastTime = 0;
    this.frameCount = 0;
    this.fps = 0;

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

    this.rafId = requestAnimationFrame(this.optimize);
  }

  stopOptimization() {
    this.isRunning = false;
    this.doneGraphicParameters = {
      depthBufferThreshold: false,
      pointSize: true,
      thiningFactorK: false,
    };
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
    }
  }

  optimize = (currentTime: number) => {
    if (!this.isRunning) return;

    const deltaTime = currentTime - this.lastTime;

    if (deltaTime > 0) {
      this.frameCount++;

      const TIME_TO_UPDATE_FPS = 1_500;
      if (currentTime - this.measurementStart >= TIME_TO_UPDATE_FPS) {
        this.fps = Math.round(
          (this.frameCount * 1000) / (currentTime - this.measurementStart),
        );
        this.measurementStart = currentTime;
        this.frameCount = 0;

        // подгон depthBuffer

        if (!this.doneGraphicParameters.depthBufferThreshold) {
          this.adaptDepthBuffer();
        }
        if (this.doneGraphicParameters.depthBufferThreshold) {
          this.adaptThiningFactor();
        }

        if (this.onProgressCallback) {
          this.onProgressCallback({
            fps: this.fps,
            k: this.graphicParams.depthBufferThreshold,
            targetFPS: this.targetFPS,
            progress: this.calculateProgress(),
          });
        }

        if (
          this.isStable() ||
          (this.doneGraphicParameters.depthBufferThreshold &&
            this.doneGraphicParameters.thiningFactorK)
        ) {
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

    if (fpsDiff < 0) {
      // FPS меньше таргета
      depthBufferChange = -this.graphicParamsMeta.depthBufferThreshold.step;
    } else {
      // FPS больше таргета
      depthBufferChange = this.graphicParamsMeta.depthBufferThreshold.step;
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

    if (
      fpsDiff < 0 &&
      Math.abs(
        this.graphicParams.depthBufferThreshold -
          this.graphicParamsMeta.depthBufferThreshold.min,
      ) < FPS_THRESHOLD
    ) {
      this.doneGraphicParameters.depthBufferThreshold = true;
    }
    if (
      fpsDiff >= 0 &&
      Math.abs(
        this.graphicParams.depthBufferThreshold -
          this.graphicParamsMeta.depthBufferThreshold.max,
      ) < FPS_THRESHOLD
    ) {
      this.doneGraphicParameters.depthBufferThreshold = true;
    }
  }

  adaptThiningFactor() {
    const fpsDiff = this.fps - this.targetFPS;

    const FPS_THRESHOLD = 0.05; // погрешность в 5%
    if (Math.abs(fpsDiff) < this.targetFPS * FPS_THRESHOLD) {
      return;
    }

    /*
      FPS больше таргета - увеличиваем thiningFactorK и наоборот
    */
    let thiningFactorChange = 0;

    if (fpsDiff < 0) {
      // FPS меньше таргета
      thiningFactorChange = this.graphicParamsMeta.thiningFactorK.step;
    } else {
      // FPS больше таргета
      thiningFactorChange = -this.graphicParamsMeta.thiningFactorK.step;
    }

    this.graphicParams.thiningFactorK = Math.max(
      this.graphicParamsMeta.thiningFactorK.min,
      Math.min(
        this.graphicParamsMeta.thiningFactorK.max,
        this.graphicParams.thiningFactorK + thiningFactorChange,
      ),
    );
    this.updateParamCallback(
      "thiningFactorK",
      this.graphicParams.thiningFactorK,
    );

    if (
      fpsDiff < 0 &&
      Math.abs(
        this.graphicParams.thiningFactorK -
          this.graphicParamsMeta.thiningFactorK.max,
      ) < FPS_THRESHOLD
    ) {
      this.doneGraphicParameters.thiningFactorK = true;
    }
    if (
      fpsDiff >= 0 &&
      Math.abs(
        this.graphicParams.thiningFactorK -
          this.graphicParamsMeta.thiningFactorK.min,
      ) < FPS_THRESHOLD
    ) {
      this.doneGraphicParameters.thiningFactorK = true;
    }
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
    return fpsDiff < PARAMETER_SMOOTH_KOEFFICIENT; // В пределах 5%
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
