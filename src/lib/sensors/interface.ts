/**
 * Generic sensor observation interface for future physical robot BlackBox hardware.
 * Current implementation supplies simulated observations; real sensors should plug
 * in without replacing the evaluation architecture.
 */

export interface CameraFrame {
  width: number;
  height: number;
  format: "rgb" | "jpeg";
  /** Base64 or ArrayBuffer reference — simulated as empty for MVP. */
  dataRef: string;
  timestampMs: number;
}

export interface DepthSample {
  width: number;
  height: number;
  meters: Float32Array | number[];
  timestampMs: number;
}

export interface ImuSample {
  accel: [number, number, number];
  gyro: [number, number, number];
  timestampMs: number;
}

export interface PoseEstimate {
  position: [number, number, number];
  orientationQuat: [number, number, number, number];
  confidence: number;
  timestampMs: number;
}

export interface DetectedObject {
  label: string;
  position: [number, number, number];
  confidence: number;
}

export interface TaskObservation {
  taskId: string;
  status: "pending" | "active" | "success" | "fail";
  progress: number;
}

export interface SensorObservation {
  robotId: string;
  camera?: CameraFrame;
  depth?: DepthSample;
  imu?: ImuSample;
  pose?: PoseEstimate;
  detections?: DetectedObject[];
  tasks?: TaskObservation[];
  source: "simulated" | "physical";
}

export type SensorProvider = {
  poll(): Promise<SensorObservation>;
};
