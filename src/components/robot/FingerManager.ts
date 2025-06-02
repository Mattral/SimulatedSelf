
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
      hand.forEach((landmark, landmarkIndex) => {
        if (landmarkIndex < handLandmarks.length) {
          const landmarkPos = this.convertLandmarkToWorldPosition(landmark);
          
          if (landmarkIndex === 0) {
            handLandmarks[landmarkIndex].position.copy(wristPos);
          } else {
            const wristLandmark = hand[0];
            const wristLandmarkPos = this.convertLandmarkToWorldPosition(wristLandmark);
            const offset = new THREE.Vector3().subVectors(landmarkPos, wristLandmarkPos);
            
            offset.multiplyScalar(0.8);
            handLandmarks[landmarkIndex].position.copy(wristPos).add(offset);
          }
          
          handLandmarks[landmarkIndex].visible = true;
        }
      });

      this.createFingerConnections(hand, handName, wristPos);
    }
  }

  private createFingerConnections(hand: Landmark[], handName: string, basePosition: THREE.Vector3) {
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
