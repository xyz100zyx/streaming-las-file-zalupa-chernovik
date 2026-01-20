import React, { useRef, useEffect, useState, useCallback } from "react";
import * as THREE from "three";

import { PointCloudRenderer } from "./pointCloud";
import "./PointCloudViewer.css";
import { OrbitControls } from "three/examples/jsm/Addons.js";
import { StreamingLASLoader } from "./streaming-loader";

export const PointCloudViewer: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const pointCloudRef = useRef<PointCloudRenderer | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentChunk, setCurrentChunk] = useState(0);
  const [totalChunks, setTotalChunks] = useState(0);

  console.log({
    progress: progress,
    currentChunk: currentChunk,
    totalChunks: totalChunks,
  });

  const initThree = useCallback(() => {
    if (!canvasRef.current || !containerRef.current) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x111111);

    const camera = new THREE.PerspectiveCamera(
      60,
      containerRef.current.clientWidth / containerRef.current.clientHeight,
      0.1,
      100000,
    );

    const renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.current,
      antialias: true,
      logarithmicDepthBuffer: true,
      powerPreference: "high-performance",
      precision: "lowp",
    });

    renderer.setSize(
      containerRef.current.clientWidth,
      containerRef.current.clientHeight,
    );
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    sceneRef.current = scene;
    cameraRef.current = camera;
    rendererRef.current = renderer;
    pointCloudRef.current = new PointCloudRenderer(scene);

    const oc = new OrbitControls(camera, renderer.domElement);

    camera.position.set(0, 0, 100);
    camera.lookAt(0, 0, 0);

    const animate = () => {
      requestAnimationFrame(animate);

      if (renderer && scene && camera) {
        renderer.render(scene, camera);
      }
      oc.update();
    };

    animate();
  }, []);

  const handleFileUpload = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      pointCloudRef.current?.dispose();

      setIsLoading(true);
      setProgress(0);
      setCurrentChunk(0);
      setTotalChunks(0);

      try {
        const loader = new StreamingLASLoader();

        const result = await loader.loadLASFile(file, (chunkProgress) => {
          setProgress(chunkProgress);
          setCurrentChunk(Math.floor(chunkProgress * 100));
        });

        const { chunks } = result;

        setTotalChunks(chunks.length);

        for (let i = 0; i < chunks.length; i++) {
          const chunk = chunks[i];
          if (chunk.count > 0) {
            pointCloudRef.current?.addChunk(chunk, i);
            setCurrentChunk(i);

            if (i % 5 === 0) {
              await new Promise((resolve) => setTimeout(resolve, 0));
            }
          }
        }

        if (cameraRef.current && pointCloudRef.current) {
          const bbox = pointCloudRef.current.getBoundingBox();
          const center = bbox.getCenter(new THREE.Vector3());
          const size = bbox.getSize(new THREE.Vector3());
          const maxDim = Math.max(size.x, size.y, size.z);

          cameraRef.current.position.copy(center);
          cameraRef.current.position.z += maxDim * 1.5;
          cameraRef.current.lookAt(center);
        }
      } catch (error) {
        console.error("err: ", error);
      } finally {
        setIsLoading(false);
        if (event.target) event.target.value = "";
      }
    },
    [],
  );

  // cleanup & dispose
  const handleClear = useCallback(() => {
    pointCloudRef.current?.dispose();
    setCurrentChunk(0);
    setTotalChunks(0);
  }, []);

  useEffect(() => {
    const cleanup = initThree();
    return () => {
      cleanup?.();
      pointCloudRef.current?.dispose();
      rendererRef.current?.dispose();
    };
  }, [initThree]);

  useEffect(() => {
    setTimeout(() => {
      console.log(cameraRef.current?.position, " camera pos");
    }, 5_000);
    return () => {
      handleClear();
    };
  }, []);

  return (
    <div className="point-cloud-viewer">
      <div className="controls">
        <div className="control-group">
          <label className="file-upload-label">
            <input
              type="file"
              accept=".las"
              onChange={handleFileUpload}
              disabled={isLoading}
            />
            {isLoading && "Загрузка..."}
          </label>
        </div>
      </div>

      <div ref={containerRef} className="viewer-container">
        <canvas ref={canvasRef} />
      </div>
    </div>
  );
};
