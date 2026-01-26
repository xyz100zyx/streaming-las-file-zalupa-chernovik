import type { PointCloudRenderer } from "../pointCloud";
import "./SceneConfigControls.css";
import {
  graphicUniformParamsMeta,
  useUniformControls,
} from "./use-uniform-controls";
import { FPSAdapter } from "./FPSAdapter";

export const SceneConfigControls = ({
  pointCloudRenderer,
}: {
  pointCloudRenderer: PointCloudRenderer;
}) => {
  const {
    graphicUniformParams,
    updateGraphicUniformParam,
    resetGraphicUniformParams,
  } = useUniformControls(pointCloudRenderer);

  return (
    <div className="scene-config-controls">
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "8px",
          maxWidth: "200px",
        }}
      >
        <div>
          <div>
            <span style={{ color: "black" }}>
              {graphicUniformParamsMeta.depthBufferThreshold.label}
            </span>{" "}
            ={" "}
            <span style={{ color: "black" }}>
              {graphicUniformParams.depthBufferThreshold}
            </span>
          </div>
          <input
            type="range"
            value={graphicUniformParams.depthBufferThreshold}
            onChange={(e) => {
              updateGraphicUniformParam(
                "depthBufferThreshold",
                Number(e.target.value),
              );
            }}
            min={graphicUniformParamsMeta.depthBufferThreshold.min}
            max={graphicUniformParamsMeta.depthBufferThreshold.max}
            step={graphicUniformParamsMeta.depthBufferThreshold.step}
          />
        </div>
        <div>
          <div>
            <span style={{ color: "black" }}>
              {graphicUniformParamsMeta.pointSize.label}
            </span>{" "}
            ={" "}
            <span style={{ color: "black" }}>
              {graphicUniformParams.pointSize}
            </span>
          </div>
          <input
            type="range"
            value={graphicUniformParams.pointSize}
            onChange={(e) => {
              updateGraphicUniformParam("pointSize", Number(e.target.value));
            }}
            min={graphicUniformParamsMeta.pointSize.min}
            max={graphicUniformParamsMeta.pointSize.max}
            step={graphicUniformParamsMeta.pointSize.step}
          />
        </div>
        <div>
          <div>
            <span style={{ color: "black" }}>
              {graphicUniformParamsMeta.thiningFactorK.label}
            </span>{" "}
            ={" "}
            <span style={{ color: "black" }}>
              {graphicUniformParams.thiningFactorK}
            </span>
          </div>
          <input
            type="range"
            value={graphicUniformParams.thiningFactorK}
            onChange={(e) => {
              updateGraphicUniformParam(
                "thiningFactorK",
                Number(e.target.value),
              );
            }}
            min={graphicUniformParamsMeta.thiningFactorK.min}
            max={graphicUniformParamsMeta.thiningFactorK.max}
            step={graphicUniformParamsMeta.thiningFactorK.step}
          />
        </div>
        <button onClick={resetGraphicUniformParams}>Сбросить</button>
      </div>
      <FPSAdapter
        graphicUniformParams={graphicUniformParams}
        updategraphicUniformParam={updateGraphicUniformParam}
      />
    </div>
  );
};
