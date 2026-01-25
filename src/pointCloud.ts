import * as THREE from "three";
import type { LASChunk } from "./types";
import { defaultLewaParams } from "./hooks/use-uniform-controls";

export class PointCloudRenderer {
  private scene: THREE.Scene;
  private chunks: Map<number, THREE.Points> = new Map();
  private boundingBox: THREE.Box3 = new THREE.Box3();
  private pointSize: number = 0.5;
  private totalPointsCount!: number;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  setTotalPointsCount(totalPointsCount: number) {
    this.totalPointsCount = totalPointsCount;
  }

  addChunk(chunk: LASChunk, chunkIndex: number): void {
    if (chunk.count === 0) {
      console.log(`чанк ${chunkIndex} без точек`);
      return;
    }

    try {
      const geometry = new THREE.BufferGeometry();

      geometry.setAttribute(
        "position",
        new THREE.BufferAttribute(chunk.points, 3),
      );

      const colors = new Float32Array(chunk.colors.length);
      for (let i = 0; i < chunk.colors.length; i++) {
        colors[i] = chunk.colors[i] / 255;
      }
      geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
      console.log("color", geometry.getAttribute("color"));
      console.log("position", geometry.getAttribute("position"));

      geometry.computeBoundingBox();
      geometry.computeBoundingSphere();
      console.log("pc", this.totalPointsCount);

      const pointShaderMaterial = new THREE.ShaderMaterial({
        vertexShader: `
        uniform float pointSize;
        varying float vDistance;
        varying float vPs;
        varying vec3 vColor;

        uniform float totalPointsCount;
        uniform float depthBufferThreshold;
        uniform float thiningFactorK;

        attribute vec3 color;

        const float MIN_DEPTH_BUFFER_VALUE = 0.993200; // чуть за камерой 

        const float COEF_TO_MULTIPLY_LINEAR_DEPTH = 10000000.0; // линейный буффер слишком мал поэтому домножаем на 10 в какой-нить большой степени


        float getMaxThresholdDepthBuffer(){

          float MIN_MAX_DIFF = 0.006790; // 0.999999 - 0.993200

          float MAX_DEPTH_BUFFER_VALUE = MIN_DEPTH_BUFFER_VALUE + depthBufferThreshold * MIN_MAX_DIFF;

          return MAX_DEPTH_BUFFER_VALUE;
        }

        float calcPointSizeByDepth(float originalSize, float depthBuffer){


          float MAX_SIZE_KOEFFICIENT_FOR_DISTANT_POINTS = 3.0;

          if(depthBuffer < getMaxThresholdDepthBuffer()) {

            float mixCoefficient = (depthBuffer - MIN_DEPTH_BUFFER_VALUE) / (getMaxThresholdDepthBuffer() - MIN_DEPTH_BUFFER_VALUE);
            float minAvailableSize = originalSize * MAX_SIZE_KOEFFICIENT_FOR_DISTANT_POINTS;
            return originalSize * mix(minAvailableSize, minAvailableSize + 15.0, 1.0 - mixCoefficient);

          }

          float mixCoefficient = (depthBuffer - getMaxThresholdDepthBuffer()) / (0.999999 - getMaxThresholdDepthBuffer());
          
          // UPD: ПРИ ИЗМЕНЕНИИ ЗНАЧЕНИЙ В ЭТОЙ СТРОКЕ, ОБРАТИТИТЬ ВНИМАНИЕ НА MAX_SIZE_KOEFFICIENT_FOR_DISTANT_POINTS
          return originalSize * mix(0.0, 3.0, 1.0 - mixCoefficient);
        }


        const float MAX_POINTS_BUDGET  =   1200000.0;
        
        void main() {
            vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
            
            vDistance = abs(mvPosition.z);
            gl_PointSize = pointSize / vDistance;

            float TOTAL_POINTS_COUNT = totalPointsCount;

            float OFFSET_COEFFICIENT = TOTAL_POINTS_COUNT / MAX_POINTS_BUDGET;
          

            gl_Position = projectionMatrix * mvPosition;
            vPs = gl_PointSize;
            vColor = vColor;

            float linearDepth = (gl_Position.z / gl_Position.w + 1.0) * 0.5;

            float thresholdDepthBuffer = getMaxThresholdDepthBuffer();

            if(linearDepth > thresholdDepthBuffer && OFFSET_COEFFICIENT > 1.0){
              float normalizedDepthBuffer = (linearDepth - thresholdDepthBuffer) / (1.0 - thresholdDepthBuffer);

              float thinVertexId = 40.0 + thiningFactorK * 10.0;

              if (thiningFactorK > 0.0 && gl_VertexID % int(thinVertexId + normalizedDepthBuffer * pointSize * 2.0 * thinVertexId) != 0) {
                gl_Position = vec4(0.0, 0.0, -2.0, 1.0);
                gl_PointSize = 0.0;
                vPs = gl_PointSize;
                return;
              }
            }

            if(OFFSET_COEFFICIENT > 1.0){
              gl_PointSize = calcPointSizeByDepth(pointSize, linearDepth);
              vColor = color;
              vPs = gl_PointSize;
            } else {
              gl_PointSize = pointSize;
              vPs = gl_PointSize;
              vColor = color;
            }

            

        }
    `,
        fragmentShader: `
          varying vec3 vPosition;
          varying vec3 vMVPosition;
          varying vec3 vColor;
          varying float vPs;

          void main(){

            gl_FragColor = vec4(vColor, 1.0);
          }

        
        `,
        uniforms: {
          pointSize: { value: defaultLewaParams.pointSize },
          totalPointsCount: { value: this.totalPointsCount },
          depthBufferThreshold: {
            value: defaultLewaParams.depthBufferThreshold,
          },
          thiningFactorK: {
            value: defaultLewaParams.thiningFactorK,
          },
        },
      });

      const points = new THREE.Points(geometry, pointShaderMaterial);
      points.name = `las-chunk-${chunkIndex}`;
      points.userData.chunkIndex = chunkIndex;
      points.userData.pointCount = chunk.count;

      this.scene.add(points);
      this.chunks.set(chunkIndex, points);

      const min = new THREE.Vector3(...chunk.bounds.min);
      const max = new THREE.Vector3(...chunk.bounds.max);
      this.boundingBox.expandByPoint(min);
      this.boundingBox.expandByPoint(max);
    } catch (error) {
      console.log(
        "Не удалось добавиь чанк ",
        JSON.stringify(error),
        " ",
        JSON.stringify(chunk),
      );
    }
  }

  removeChunk(chunkIndex: number): void {
    const points = this.chunks.get(chunkIndex);
    if (points) {
      this.scene.remove(points);
      if (points.geometry) {
        points.geometry.dispose();
      }
      if (points.material) {
        if (Array.isArray(points.material)) {
          points.material.forEach((m) => m.dispose());
        } else {
          points.material.dispose();
        }
      }
      this.chunks.delete(chunkIndex);
      console.log(`Removed chunk ${chunkIndex}`);
    }
  }

  getBoundingBox(): THREE.Box3 {
    return this.boundingBox.clone();
  }

  getPointSize(): number {
    return this.pointSize;
  }

  getTotalPoints(): number {
    let total = 0;
    this.chunks.forEach((points) => {
      total += points.userData.pointCount || 0;
    });
    return total;
  }

  dispose(): void {
    this.chunks.forEach((_, chunkIndex) => {
      this.removeChunk(chunkIndex);
    });
    this.chunks.clear();
    this.boundingBox.makeEmpty();
  }

  getAllPointClouds() {
    const clouds: THREE.Points[] = [];

    this.chunks.forEach((i) => {
      clouds.push(i);
    });

    return clouds;
  }
}
