
import * as THREE from 'three';
import { RobotMaterials } from './MaterialManager';

export class ShoulderManager {
  private group: THREE.Group;
  private materials: RobotMaterials;
  private shoulders: { [key: string]: THREE.Object3D } = {};
  private shoulderFrames: { [key: string]: THREE.Object3D } = {};
  private shoulderConnections: THREE.Object3D[] = [];

  constructor(group: THREE.Group, materials: RobotMaterials) {
    this.group = group;
    this.materials = materials;
    this.createShoulderStructures();
  }

  private createShoulderStructures() {
    this.createShoulderAssembly('left');
    this.createShoulderAssembly('right');
  }

  private createShoulderAssembly(side: 'left' | 'right') {
    const shoulderKey = `${side}Shoulder`;
    const frameKey = `${side}ShoulderFrame`;

    // Enhanced shoulder joint with better proportions
    const shoulderGeometry = new THREE.SphereGeometry(0.15, 24, 24);
    shoulderGeometry.scale(1.6, 1.0, 1.3); // More robust shoulder shape
    const shoulder = new THREE.Mesh(shoulderGeometry, this.materials.joint);
    shoulder.castShadow = true;
    shoulder.receiveShadow = true;

    // Shoulder frame/plate for better anatomical definition
    const frameGeometry = new THREE.CylinderGeometry(0.18, 0.22, 0.12, 16);
    const frame = new THREE.Mesh(frameGeometry, this.materials.panelLines);
    frame.castShadow = true;
    frame.receiveShadow = true;

    this.shoulders[shoulderKey] = shoulder;
    this.shoulderFrames[frameKey] = frame;

    this.group.add(shoulder);
    this.group.add(frame);
  }

  public updateShoulderPositions(landmarks: any, visibility: any) {
    if (!landmarks.pose || landmarks.pose.length < 33) return;

    this.updateSingleShoulder('left', landmarks.pose[11], visibility.leftShoulder);
    this.updateSingleShoulder('right', landmarks.pose[12], visibility.rightShoulder);
    
    // Create mesh frame connections between shoulders and neck
    this.createShoulderConnections(landmarks.pose, visibility);
  }

  private updateSingleShoulder(side: 'left' | 'right', landmark: any, isVisible: boolean) {
    const shoulderKey = `${side}Shoulder`;
    const frameKey = `${side}ShoulderFrame`;
    
    const shoulder = this.shoulders[shoulderKey];
    const frame = this.shoulderFrames[frameKey];

    if (!landmark || !landmark.visibility || landmark.visibility < 0.5 || !isVisible) {
      shoulder.visible = false;
      frame.visible = false;
      return;
    }

    const position = this.convertLandmarkToWorldPosition(landmark);
    
    shoulder.position.copy(position);
    shoulder.visible = true;

    // Position frame slightly behind the shoulder
    frame.position.copy(position);
    frame.position.z -= 0.08;
    frame.visible = true;
  }

  private createShoulderConnections(pose: any[], visibility: any) {
    // Clear existing connections
    this.shoulderConnections.forEach(connection => this.group.remove(connection));
    this.shoulderConnections = [];

    const leftShoulder = pose[11];
    const rightShoulder = pose[12];
    
    // Calculate neck position (midpoint between shoulders, slightly up)
    if (leftShoulder && rightShoulder && 
        leftShoulder.visibility > 0.5 && rightShoulder.visibility > 0.5) {
      
      const leftPos = this.convertLandmarkToWorldPosition(leftShoulder);
      const rightPos = this.convertLandmarkToWorldPosition(rightShoulder);
      const neckPos = new THREE.Vector3().addVectors(leftPos, rightPos).multiplyScalar(0.5);
      neckPos.y += 0.25;

      // Create mesh frame between shoulders
      this.createMeshConnection(leftPos, rightPos, 0.04);
      
      // Create mesh frames from shoulders to neck
      this.createMeshConnection(leftPos, neckPos, 0.03);
      this.createMeshConnection(rightPos, neckPos, 0.03);
    }
  }

  private createMeshConnection(start: THREE.Vector3, end: THREE.Vector3, thickness: number) {
    const direction = new THREE.Vector3().subVectors(end, start);
    const length = direction.length();
    const midpoint = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);

    // Create cylindrical mesh frame
    const geometry = new THREE.CylinderGeometry(thickness, thickness, length, 12);
    const mesh = new THREE.Mesh(geometry, this.materials.limbSegment);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    // Position and orient the connection
    mesh.position.copy(midpoint);
    mesh.lookAt(end);
    mesh.rotateX(Math.PI / 2);

    this.shoulderConnections.push(mesh);
    this.group.add(mesh);
  }

  private convertLandmarkToWorldPosition(landmark: any): THREE.Vector3 {
    return new THREE.Vector3(
      -(landmark.x - 0.5) * 4,
      -(landmark.y - 0.5) * 3,
      -landmark.z * 2
    );
  }

  public setVisibility(visible: boolean) {
    Object.values(this.shoulders).forEach(shoulder => {
      shoulder.visible = visible;
    });
    Object.values(this.shoulderFrames).forEach(frame => {
      frame.visible = visible;
    });
    this.shoulderConnections.forEach(connection => {
      connection.visible = visible;
    });
  }
}
