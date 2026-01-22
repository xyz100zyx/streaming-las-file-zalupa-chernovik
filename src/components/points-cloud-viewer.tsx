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

const MAX_POINTS_IN_MESH = 4_000_000;
const MAX_BUFFER_LENGTH = MAX_POINTS_IN_MESH * 3;

const createMinInstancedMesh = (
  allPositions: Float32Array,
  allColors: Uint8Array,
  offset: number,
) => {
  const SLICE_END = Math.min(allPositions.length, offset + MAX_BUFFER_LENGTH);

  const positions = allPositions.slice(offset, SLICE_END);
  const colors = allColors.slice(offset, SLICE_END);

  const pointCount = positions.length / 3;

  let minX = Infinity,
    maxX = -Infinity;
  let minY = Infinity,
    maxY = -Infinity;
  let minZ = Infinity,
    maxZ = -Infinity;

  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i];
    const y = positions[i + 1];
    const z = positions[i + 2];

    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
    minZ = Math.min(minZ, z);
    maxZ = Math.max(maxZ, z);
  }

  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  const centerZ = (minZ + maxZ) / 2;
  const center = new THREE.Vector3(centerX, centerY, centerZ);

  const sizeX = maxX - minX;
  const sizeY = maxY - minY;
  const sizeZ = maxZ - minZ;
  const maxDim = Math.max(sizeX, sizeY, sizeZ);

  const geometry = new THREE.PlaneGeometry(1, 1, 1); // простая сфера как точка
  const material = new THREE.MeshBasicMaterial({
    color: 0xffff00,
    alphaTest: 0.5,
  });
  const instancedMesh = new THREE.InstancedMesh(geometry, material, pointCount);

  const matrix = new THREE.Matrix4();
  for (let i = 0; i < pointCount; i++) {
    const x = positions[i * 3] - centerX;
    const y = positions[i * 3 + 1] - centerY;
    const z = positions[i * 3 + 2] - centerZ;

    matrix.makeTranslation(x, y, z);
    instancedMesh.setMatrixAt(i, matrix);
    instancedMesh.setColorAt(
      i,
      new THREE.Color().setFromVector3(
        new THREE.Vector3(colors[i * 3], colors[i * 3 + 1], colors[i * 3 + 2]),
      ),
    );
  }
  instancedMesh.instanceMatrix.needsUpdate = true;
  console.log({ instancedMesh, center, maxDim });
  return {
    mesh: instancedMesh,
    center,
    maxDim,
  };
};

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
    scene.background = new THREE.Color(0xc9c9c9);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(
      75,
      width / height,
      0.1,
      1_000_000,
    );
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

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(100, 100, 50);
    scene.add(directionalLight);

    const animate = () => {
      animationFrameRef.current = requestAnimationFrame(animate);
      renderer.render(scene, camera);
    };
    animate();

    return () => {
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
    const INSTANCED_MESH_COUNT =
      Math.floor(pointCount / MAX_POINTS_IN_MESH) || 1;

    let maxDim!: number;
    let center!: THREE.Vector3;
    let isCameraWasFit = false;
    for (let i = 0; i < INSTANCED_MESH_COUNT; i++) {
      const {
        center: c,
        maxDim: md,
        mesh: instancedMesh,
      } = createMinInstancedMesh(positions, colors, MAX_BUFFER_LENGTH * i);
      sceneRef.current.add(instancedMesh);
      maxDim = md;
      center = c;
    }

    if (!isCameraWasFit) {
      cameraRef.current!.position.set(0, 0, maxDim * 2);
      cameraRef.current!.lookAt(0, 0, 0);
      cameraRef.current!.far = maxDim * 10;
      cameraRef.current!.updateProjectionMatrix();

      controlsRef.current!.target.set(0, 0, 0);
      controlsRef.current!.update();
      isCameraWasFit = true;
    }

    const boxmesh = new THREE.Mesh(
      new THREE.BoxGeometry(4, 4, 4),
      new THREE.MeshBasicMaterial({ vertexColors: true }),
    );
    boxmesh.position.set(...center.toArray());
    boxmesh.position.z -= 100;

    sceneRef.current.add(boxmesh);

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
