import React, { useRef, useEffect, useCallback } from "react";
import * as THREE from "three";
import { PointCloudRenderer } from "./pointCloud";
import { StreamingLASLoader as FinalLASLoader } from "./streaming-loader";
import "./PointCloudViewer.css";

export const PointCloudViewer: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const pointCloudRef = useRef<PointCloudRenderer | null>(null);

  const initThree = useCallback(() => {
    if (!canvasRef.current || !containerRef.current) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0a0a);

    const camera = new THREE.PerspectiveCamera(
      75,
      containerRef.current.clientWidth / containerRef.current.clientHeight,
      0.1,
      1000000,
    );

    const renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.current,
      antialias: true,
      logarithmicDepthBuffer: true,
      powerPreference: "high-performance",
      preserveDrawingBuffer: false,
      precision: "lowp",
    });

    renderer.setSize(
      containerRef.current.clientWidth,
      containerRef.current.clientHeight,
    );
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));

    sceneRef.current = scene;
    cameraRef.current = camera;
    rendererRef.current = renderer;
    pointCloudRef.current = new PointCloudRenderer(scene);

    camera.position.set(0, 0, 100);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld(true);

    let isDragging = false;
    let lastMouseX = 0;
    let lastMouseY = 0;

    const onMouseDown = (e: MouseEvent) => {
      isDragging = true;
      lastMouseX = e.clientX;
      lastMouseY = e.clientY;
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging || !camera) return;

      const deltaX = e.clientX - lastMouseX;
      const deltaY = e.clientY - lastMouseY;

      camera.rotation.y += deltaX * 0.01;
      camera.rotation.x += deltaY * 0.01;

      lastMouseX = e.clientX;
      lastMouseY = e.clientY;
    };

    const onMouseUp = () => {
      isDragging = false;
    };

    const onWheel = (e: WheelEvent) => {
      if (!camera) return;
      e.preventDefault();

      const zoomSpeed = 0.001;
      const zoomFactor = 1 + (e.deltaY * zoomSpeed) / 100;
      camera.position.multiplyScalar(zoomFactor);
    };

    canvasRef.current.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    canvasRef.current.addEventListener("wheel", onWheel, { passive: false });

    let prevTime = 0;
    const animate = (raft: number) => {
      requestAnimationFrame(animate);

      if (renderer && scene && camera) {
        renderer.render(scene, camera);
      }
      const time = raft - prevTime;
      prevTime = time;
      // oc.update(time);
    };
    animate(0);

    return () => {};
  }, []);

  const handleFileUpload = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file || !pointCloudRef.current) return;

      pointCloudRef.current.dispose();

      try {
        const loader = new FinalLASLoader();

        const result = await loader.loadLASFile(file);

        const { chunks } = result;

        for (let i = 0; i < chunks.length; i++) {
          const chunk = chunks[i];
          if (chunk.count > 0) {
            pointCloudRef.current?.addChunk(chunk, i);

            // отрисовка бразуером
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

          cameraRef.current.userData.initialPosition =
            cameraRef.current.position.clone();
          cameraRef.current.userData.initialLookAt = center.clone();
        }

        pointCloudRef.current?.setPointSize?.(28);
      } catch (error) {
        console.log("loading error", error);
      } finally {
        if (window.gc) {
          // @ts-ignore
          window.gc();
        }
      }
    },
    [],
  );

  const handleClear = useCallback(() => {
    pointCloudRef.current?.dispose();

    if (window.gc) {
      // @ts-ignore
      window.gc();
    }
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
    return handleClear;
  }, []);

  return (
    <div className="point-cloud-viewer">
      <div className="controls">
        <div className="control-group">
          <input
            type="file"
            accept=".las"
            onChange={handleFileUpload}
            id="las-file-input"
          />
        </div>
      </div>

      <div ref={containerRef} className="viewer-container">
        <canvas ref={canvasRef} />
      </div>
    </div>
  );
};
