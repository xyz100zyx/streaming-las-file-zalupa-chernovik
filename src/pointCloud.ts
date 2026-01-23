import * as THREE from "three";
import type { LASChunk } from "./types";

export class PointCloudRenderer {
  private scene: THREE.Scene;
  private chunks: Map<number, THREE.Points> = new Map();
  private boundingBox: THREE.Box3 = new THREE.Box3();
  private pointSize: number = 0.5;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
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

      const pointShaderMaterial = new THREE.ShaderMaterial({
        vertexShader: `
        uniform float pointSize;
        varying float vDistance;
        varying float vPs;

        float calcPointSizeByDepth(float originalSize, float depthBuffer){
          float KOEF_TO_MULTIPLY_BUFFER_DIFFERENCE = 1000.0; // разница буффера от единицы слишком мала поэтому домножаем на 10 в какой-нибудь степени
          return originalSize + (1.0 - depthBuffer) * KOEF_TO_MULTIPLY_BUFFER_DIFFERENCE;
        }
        
        void main() {
            vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
            
            vDistance = abs(mvPosition.z);
            gl_PointSize = pointSize / vDistance;

          

            gl_Position = projectionMatrix * mvPosition;
            vPs = gl_PointSize;

            float linearDepth = (gl_Position.z / gl_Position.w + 1.0) * 0.5;

            const float MIN_DEPTH_BUFFER_VALUE = 0.999755;
            const float COEF_TO_MULTIPLY_LINEAR_DEPTH = 10000000.0; // линейный буффер слишком мал поэтому домножаем на 10 в какой-нить большой степени

            if(linearDepth > MIN_DEPTH_BUFFER_VALUE){
              if (gl_VertexID % int(20.0 * (linearDepth + fract(linearDepth * COEF_TO_MULTIPLY_LINEAR_DEPTH))) != 0) {
                gl_Position = vec4(0.0, 0.0, -2.0, 1.0);
                gl_PointSize = 0.0;
                return;
              }
            }

            gl_PointSize = calcPointSizeByDepth(gl_PointSize, linearDepth);

        }
    `,
        fragmentShader: `
          varying vec3 vPosition;
          varying vec3 vMVPosition;
          varying vec3 vColor;
          varying float vPs;

          void main(){
        
          // if(vPs * 10.0 < 0.04) {
          //   // discard;
          //   vec3 gColor = vec3(0.0, 1.0, 0.0);
          //   vec3 mixedColor = mix(gColor, vec3(1.0, 0.0, 0.0), vPs * 10.0);
          //   gl_FragColor = vec4(vec3(1.0, 0.0, 0.0), vPs);
          //   if(vPs * 10.0 < 0.21){
          //     discard;
          //   }
          // } else {
          //     gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0);
          //   }

            gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0);
          }

        
        `,
        uniforms: {
          pointSize: { value: 2.0 },
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
}
