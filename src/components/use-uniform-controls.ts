import type { PointCloudRenderer } from "../pointCloud";
import { useState } from "react";

export type TGraphicUniformParams = {
  depthBufferThreshold: number;
  pointSize: number;
  thiningFactorK: number;
};

export type TGraphicUniformParamsMeta = Record<
  keyof TGraphicUniformParams,
  {
    max: number;
    min: number;
    step: number;
    label: string;
  }
>;

export const defaultGraphicUniformParams: TGraphicUniformParams = {
  depthBufferThreshold: 0.92,
  pointSize: 0.6,
  thiningFactorK: 2,
};

export const graphicUniformParamsMeta: TGraphicUniformParamsMeta = {
  depthBufferThreshold: {
    min: 0,
    max: 1,
    step: 0.0001,
    label: "Глубина буфера",
  },
  pointSize: {
    min: 0.3,
    max: 4.0,
    step: 0.1,
    label: "Размер точек",
  },
  thiningFactorK: {
    min: 0,
    max: 5,
    step: 1,
    label: "Коэффициент прореживания",
  },
};

export const useUniformControls = (pointCloudRenderer: PointCloudRenderer) => {
  const [graphicUniformParams, setGraphicUniformParams] =
    useState<TGraphicUniformParams>(defaultGraphicUniformParams);

  const updateGraphicUniformParam = <
    TKey extends keyof typeof graphicUniformParams,
  >(
    key: TKey,
    val: (typeof graphicUniformParams)[TKey],
  ) => {
    pointCloudRenderer?.getAllPointClouds()?.forEach((cloud) => {
      cloud.material.uniforms[key].value = val;
      cloud.material.needsUpdate = true;
    });
    setGraphicUniformParams((prev) => ({
      ...prev,
      [key]: val,
    }));
  };

  function resetGraphicUniformParams() {
    for (const key in graphicUniformParams) {
      const typedKey = key as keyof TGraphicUniformParams;
      updateGraphicUniformParam(
        typedKey,
        defaultGraphicUniformParams[typedKey],
      );
    }
  }

  return {
    graphicUniformParams,
    updateGraphicUniformParam,
    resetGraphicUniformParams,
  };
};
