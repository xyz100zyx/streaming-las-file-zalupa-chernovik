import type { FC } from "react";
import { useState } from "react";
import { useGraphicsOptimizer } from "../hooks/use-fps-adapter";
import "./FPSAdapter.css";
import type { TGraphicUniformParams } from "./use-uniform-controls";

export const FPSAdapter: FC<{
  graphicUniformParams: TGraphicUniformParams;
  updategraphicUniformParam: <TKey extends keyof TGraphicUniformParams>(
    key: TKey,
    p: TGraphicUniformParams[TKey],
  ) => void;
}> = ({ graphicUniformParams, updategraphicUniformParam }) => {
  const [selectedFPS, setSelectedFPS] = useState<number | null>(null);

  const { isOptimizing, progress, startOptimization, stopOptimization } =
    useGraphicsOptimizer(graphicUniformParams, updategraphicUniformParam);

  const handleFPSSelect = (fps: number) => {
    setSelectedFPS(fps);

    startOptimization(fps, (optimizedK) => {
      console.log({ optimizedK });
      alert("done");
      setSelectedFPS(null);
    });
  };

  return (
    <div className="graphics-settings">
      <div className="fps-selector">
        <h3>Настройки графики</h3>

        <div className="fps-buttons">
          <button
            className={`fps-button ${selectedFPS === 30 ? "active" : ""}`}
            onClick={() => handleFPSSelect(30)}
            disabled={isOptimizing}
          >
            30 FPS
            <span className="fps-subtitle">
              (Оптимальная производительность)
            </span>
          </button>

          <button
            className={`fps-button ${selectedFPS === 60 ? "active" : ""}`}
            onClick={() => handleFPSSelect(60)}
            disabled={isOptimizing}
          >
            60 FPS
            <span className="fps-subtitle">(Баланс качества)</span>
          </button>
        </div>
      </div>

      {/* Loader при оптимизации */}
      {isOptimizing && (
        <div className="optimization-overlay">
          <div className="optimization-loader">
            <div className="spinner"></div>
            <h3>Оптимизация графики...</h3>
            <p>Подбираем оптимальные настройки для {selectedFPS} FPS</p>

            {progress && (
              <div className="optimization-progress">
                <div className="progress-bar">
                  <div
                    className="progress-fill"
                    style={{ width: `${progress.progress * 100}%` }}
                  />
                </div>
                <div className="progress-info">
                  <span>Текущий FPS: {progress.fps}</span>
                  <span>Ожидаемый FPS: {progress.targetFPS}</span>
                </div>
              </div>
            )}

            <button
              className="cancel-button"
              onClick={() => {
                stopOptimization();
                setSelectedFPS(null);
              }}
            >
              Отменить
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
