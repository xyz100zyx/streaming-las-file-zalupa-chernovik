export interface LASHeader {
  pointCount: number;
  pointFormat: number;
  pointSize: number;
  offset: {
    x: number;
    y: number;
    z: number;
  };
  scale: {
    x: number;
    y: number;
    z: number;
  };
  min: [number, number, number];
  max: [number, number, number];
  pointsDataOffset: number;
}
