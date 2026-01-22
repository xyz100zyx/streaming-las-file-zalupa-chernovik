import { useRef, useEffect } from "react";
import * as THREE from "three";
import { usePointCloud } from "../hooks/use-points-cloud";
import { OrbitControls } from "three/examples/jsm/Addons.js";
import { LoadingProgress } from "./loading-progress";

interface PointCloudViewerProps {
  file: File | null;
  pointSize?: number;
  maxWorkers?: number;
}

export function PointCloudViewer({
  file,
  pointSize = 2.0,
  maxWorkers = 4,
}: PointCloudViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const meshRef = useRef<THREE.InstancedMesh | null>(null);
  const animationFrameRef = useRef<number>(0);

  const { pointData, header, isLoading, progress, error, loadFile } =
    usePointCloud(maxWorkers);

  useEffect(() => {
    if (!containerRef.current) return;

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xffffff);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 100000);
    camera.position.z = 100;
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance",
      logarithmicDepthBuffer: true,
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controlsRef.current = controls;

    window.controls = controls;

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(100, 100, 50);
    scene.add(directionalLight);

    const animate = () => {
      animationFrameRef.current = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!containerRef.current || !camera || !renderer) return;

      const width = containerRef.current.clientWidth;
      const height = containerRef.current.clientHeight;

      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animationFrameRef.current);

      if (meshRef.current) {
        scene.remove(meshRef.current);
        meshRef.current.dispose();
      }

      controls.dispose();
      renderer.dispose();
      if (containerRef.current && renderer.domElement) {
        containerRef.current.removeChild(renderer.domElement);
      }
    };
  }, []);

  useEffect(() => {
    if (file) {
      loadFile(file);
    }
  }, [file, loadFile]);

  useEffect(() => {
    if (!pointData || !sceneRef.current || !header) return;

    const positions = pointData.positions;
    const colors = pointData.colors;
    const pointCount = positions.length / 3;

    if (meshRef.current) {
      sceneRef.current.remove(meshRef.current);
      meshRef.current.dispose();
    }

    const sphereGeometry = new THREE.SphereGeometry(pointSize, 8, 8);

    const material = new THREE.MeshLambertMaterial({
      vertexColors: true,
      color: "red",
    });

    const mesh = new THREE.InstancedMesh(sphereGeometry, material, pointCount);
    meshRef.current = mesh;

    const matrix = new THREE.Matrix4();
    const color = new THREE.Color();
    console.log({ pointCount, positions, colors });
    for (let i = 0; i < pointCount; i++) {
      const x = positions[i * 3];
      const y = positions[i * 3 + 1];
      const z = positions[i * 3 + 2];

      matrix.makeTranslation(x, y, z);
      mesh.setMatrixAt(i, matrix);

      // Цвет
      //   const r = colors[i * 3] / 255;
      //   const g = colors[i * 3 + 1] / 255;
      //   const b = colors[i * 3 + 2] / 255;

      const r = 255;
      const g = 0;
      const b = 0;

      color.setRGB(r, g, b);
      mesh.setColorAt(i, color);
    }

    mesh.computeBoundingBox();
    mesh.computeBoundingSphere();

    // снижаем детализацию для далеких объектов
    mesh.frustumCulled = true;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) {
      mesh.instanceColor.needsUpdate = true;
    }

    sceneRef.current.add(mesh);

    if (header && cameraRef.current && controlsRef.current) {
      const bbox = mesh.boundingBox;
      const center = bbox!.getCenter(new THREE.Vector3());

      const size = bbox!.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);

      cameraRef.current.position.copy(center);
      cameraRef.current.position.z += maxDim * 1.5;
      console.log({ positionUpdated: cameraRef.current.position, center });
      cameraRef.current.lookAt(center);

      window.controls.target.copy(center);
      window.controls.update();

      console.log({ camPos: cameraRef.current.position, cameraLookat: center });

      cameraRef.current.userData.initialPosition =
        cameraRef.current.position.clone();
      cameraRef.current.userData.initialLookAt = center.clone();

      // const [minX, minY, minZ] = header.min;
      // const [maxX, maxY, maxZ] = header.max;

      // const center = new THREE.Vector3(
      //   (minX + maxX) / 2,
      //   (minY + maxY) / 2,
      //   (minZ + maxZ) / 2,
      // );

      // const size = new THREE.Vector3(
      //   maxX - minX,
      //   maxY - minY,
      //   maxZ - minZ,
      // ).length();

      // cameraRef.current.position.copy(center);
      // cameraRef.current.position.z += size;
      // cameraRef.current.lookAt(center);
      // console.log({ camPos: cameraRef.current.position, cameraLookat: center });
      // controlsRef.current.target.copy(center);
      // controlsRef.current.update();
    }
    console.log();

    if (pointCount > 1000000) {
      console.log(
        `Rendering ${pointCount.toLocaleString()} points with InstancedMesh`,
      );
    }
  }, [pointData, header, pointSize]);

  return (
    <>
      <div
        ref={containerRef}
        style={{
          width: "100%",
          height: "100vh",
          position: "relative",
        }}
      />
      <LoadingProgress
        progress={progress}
        isLoading={isLoading}
        error={error}
      />
    </>
  );
}
