import { Leva } from "leva";
import { useUniformControls } from "../hooks";
import type { PointCloudRenderer } from "../pointCloud";
import "./SceneConfigControls.css";

export const SceneConfigControls = ({
  pointCloudRenderer,
}: {
  pointCloudRenderer: PointCloudRenderer;
}) => {
  useUniformControls(pointCloudRenderer);

  return (
    <div className="scene-config-controls">
      <Leva
        titleBar={{
          title: "Настройки отображения облака",
          filter: false,
          drag: false,
        }}
        fill={true}
        theme={{
          colors: {
            highlight1: "#ffffff",
            highlight2: "#ffffff",
          },
        }}
        hideCopyButton={true}
      />
    </div>
  );
};
