
import * as THREE from 'three';
import { Landmark } from '../../hooks/usePoseDetection';
import { RobotMaterials } from './MaterialManager';

export class FingerManager {
  private group: THREE.Group;
  private materials: RobotMaterials;
  private fingerLandmarks: { [key: string]: THREE.Mesh[] } = {};
  private fingerConnections: { [key: string]: THREE.LineSegments[] } = {};

  constructor(group: THREE.Group, materials: RobotMaterials) {
    this.group = group;
    this.materials = materials;
    this.createLandmarkStyleFingers();
  }

  private createLandmarkStyleFingers() {
    const hands = ['left', 'right'];

    hands.forEach(hand => {
      this.fingerLandmarks[hand] = [];
      this.fingerConnections[hand] = [];
      
      for (let i = 0; i < 21; i++) {
        const geometry = new THREE.SphereGeometry(0.035, 12, 12);
        const material = this.materials.fingerLandmark;
        const landmark = new THREE.Mesh(geometry, material);
        
        landmark.castShadow = true;
        landmark.visible = false;
        
        this.fingerLandmarks[hand].push(landmark);
        this.group.add(landmark);
      }
    });
  }

  public updateFingerPositions(landmarks: any, isLeftHandVisible: boolean, isRightHandVisible: boolean) {
    if (!landmarks.hands || !landmarks.pose) {
      this.hideAllFingers();
      return;
    }

    landmarks.hands.forEach((hand: Landmark[], handIndex: number) => {
      const handName = handIndex === 0 ? 'left' : 'right';
      const isHandVisible = handIndex === 0 ? isLeftHandVisible : isRightHandVisible;
      const wristIndex = handIndex === 0 ? 15 : 16;
      const bodyWrist = landmarks.pose[wristIndex];
      
      if (bodyWrist && bodyWrist.visibility > 0.5 && hand.length >= 21 && isHandVisible) {
        this.updateSingleHandFingers(hand, handName, bodyWrist, handIndex);
      } else {
        this.hideHandFingers(handName);
      }
    });

    // Hide unused hands
    for (let h = landmarks.hands.length; h < 2; h++) {
      const handName = h === 0 ? 'left' : 'right';
      this.hideHandFingers(handName);
    }
  }

  private updateSingleHandFingers(hand: Landmark[], handName: string, bodyWrist: Landmark, handIndex: number) {
    const wristPos = this.convertLandmarkToWorldPosition(bodyWrist);
    const handLandmarks = this.fingerLandmarks[handName];
    
    if (handLandmarks) {
      // Calculate hand rotation from landmarks
      const handRotation = this.calculateHandRotation(hand);
      
      hand.forEach((landmark, landmarkIndex) => {
        if (landmarkIndex < handLandmarks.length) {
          const landmarkPos = this.convertLandmarkToWorldPosition(landmark);
          
          if (landmarkIndex === 0) {
            // Position wrist at body wrist position
            handLandmarks[landmarkIndex].position.copy(wristPos);
            // Apply calculated rotation to wrist (palm)
            handLandmarks[landmarkIndex].rotation.copy(handRotation);
          } else {
            const wristLandmark = hand[0];
            const wristLandmarkPos = this.convertLandmarkToWorldPosition(wristLandmark);
            const offset = new THREE.Vector3().subVectors(landmarkPos, wristLandmarkPos);
            
            // Apply hand rotation to finger positions
            offset.applyEuler(handRotation);
            offset.multiplyScalar(0.8);
            handLandmarks[landmarkIndex].position.copy(wristPos).add(offset);
            
            // Apply rotation to each finger landmark for proper orientation
            handLandmarks[landmarkIndex].rotation.copy(handRotation);
          }
          
          handLandmarks[landmarkIndex].visible = true;
        }
      });

      this.createFingerConnections(hand, handName, wristPos, handRotation);
    }
  }

  private calculateHandRotation(hand: Landmark[]): THREE.Euler {
    if (hand.length < 21) return new THREE.Euler(0, 0, 0);

    // Key landmarks for orientation calculation
    const wrist = hand[0];
    const middleFingerMcp = hand[9];
    const indexFingerMcp = hand[5];
    const pinkyMcp = hand[17];

    // Convert to world positions
    const wristPos = this.convertLandmarkToWorldPosition(wrist);
    const middlePos = this.convertLandmarkToWorldPosition(middleFingerMcp);
    const indexPos = this.convertLandmarkToWorldPosition(indexFingerMcp);
    const pinkyPos = this.convertLandmarkToWorldPosition(pinkyMcp);

    // Calculate vectors for orientation
    const palmForward = new THREE.Vector3().subVectors(middlePos, wristPos).normalize();
    const palmSide = new THREE.Vector3().subVectors(indexPos, pinkyPos).normalize();
    const palmNormal = new THREE.Vector3().crossVectors(palmSide, palmForward).normalize();

    // Create rotation matrix from these vectors
    const rotationMatrix = new THREE.Matrix3();
    rotationMatrix.set(
      palmSide.x, palmForward.x, palmNormal.x,
      palmSide.y, palmForward.y, palmNormal.y,
      palmSide.z, palmForward.z, palmNormal.z
    );

    // Convert to Euler angles
    const rotation = new THREE.Euler();
    rotation.setFromRotationMatrix(new THREE.Matrix4().setFromMatrix3(rotationMatrix));

    // Apply additional correction for palm orientation
    const correctionRotation = new THREE.Euler(
      rotation.x + Math.PI / 6,  // Slight tilt correction
      rotation.y,
      rotation.z
    );

    return correctionRotation;
  }

  private createFingerConnections(hand: Landmark[], handName: string, basePosition: THREE.Vector3, handRotation: THREE.Euler) {
    // Clear existing connections
    this.fingerConnections[handName].forEach(connection => {
      if (connection) this.group.remove(connection);
    });
    this.fingerConnections[handName] = [];

    const handConnections = [
      [0, 1], [1, 2], [2, 3], [3, 4],
      [0, 5], [5, 6], [6, 7], [7, 8],
      [0, 9], [9, 10], [10, 11], [11, 12],
      [0, 13], [13, 14], [14, 15], [15, 16],
      [0, 17], [17, 18], [18, 19], [19, 20]
    ];

    const positions: number[] = [];
    
    handConnections.forEach(([startIdx, endIdx]) => {
      const startLandmark = this.fingerLandmarks[handName][startIdx];
      const endLandmark = this.fingerLandmarks[handName][endIdx];
      
      if (startLandmark.visible && endLandmark.visible) {
        positions.push(startLandmark.position.x, startLandmark.position.y, startLandmark.position.z);
        positions.push(endLandmark.position.x, endLandmark.position.y, endLandmark.position.z);
      }
    });

    if (positions.length > 0) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      
      const material = new THREE.LineBasicMaterial({ 
        color: 0xf0f0f0,
        linewidth: 4
      });
      const connections = new THREE.LineSegments(geometry, material);
      connections.visible = true;
      
      this.fingerConnections[handName].push(connections);
      this.group.add(connections);
    }
  }

  private hideHandFingers(handName: string) {
    if (this.fingerLandmarks[handName]) {
      this.fingerLandmarks[handName].forEach(landmark => landmark.visible = false);
    }
    
    this.fingerConnections[handName].forEach(connection => {
      if (connection) this.group.remove(connection);
    });
    this.fingerConnections[handName] = [];
  }

  private hideAllFingers() {
    Object.keys(this.fingerLandmarks).forEach(handName => {
      this.hideHandFingers(handName);
    });
  }

  private convertLandmarkToWorldPosition(landmark: any): THREE.Vector3 {
    return new THREE.Vector3(
      -(landmark.x - 0.5) * 4,
      -(landmark.y - 0.5) * 3,
      -landmark.z * 2
    );
  }
}
