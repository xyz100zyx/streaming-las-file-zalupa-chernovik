import { useControls, button } from "leva";
import type { PointCloudRenderer } from "../pointCloud";

export const defaultLewaParams = {
  depthBufferThreshold: 0.5,
  pointSize: 2.0,
  thiningFactorK: 50,
};

export const useUniformControls = (pointCloudRenderer: PointCloudRenderer) => {
  const guiControls = useControls("Настройки", {
    maxDepthBuffer: {
      value: defaultLewaParams.depthBufferThreshold,
      min: 0,
      max: 1,
      step: 0.01,
      label: "Глубина буфера",
      onChange: (depthBufferThreshold) => {
        pointCloudRenderer?.getAllPointClouds()?.forEach((cloud) => {
          cloud.material.uniforms.depthBufferThreshold.value =
            depthBufferThreshold;
          cloud.material.needsUpdate = true;
        });
      },
    },
    pointSize: {
      value: defaultLewaParams.pointSize,
      min: 0.3,
      max: 4.0,
      step: 0.1,
      label: "Размер точек",
      onChange: (pointSize) => {
        console.log("pointSize", pointSize);
        pointCloudRenderer?.getAllPointClouds()?.forEach((cloud) => {
          cloud.material.uniforms.pointSize.value = pointSize;
          cloud.material.needsUpdate = true;
        });
      },
    },
    k: {
      value: defaultLewaParams.thiningFactorK,
      min: 0,
      max: 100,
      step: 1,
      label: "Коэффициент прореживания",
      onChange: (thiningFactorK) => {
        pointCloudRenderer?.getAllPointClouds()?.forEach((cloud) => {
          cloud.material.uniforms.thiningFactorK.value = thiningFactorK;
          cloud.material.needsUpdate = true;
        });
      },
    },

    reset: button(() => {
      resetToDefaults();
    }),
  });

  function resetToDefaults() {
    if (guiControls) {
      for (const key in defaultLewaParams) {
        if (guiControls[key] !== undefined) {
          guiControls[key] = defaultLewaParams[key];
        }
      }
    }
  }
};
