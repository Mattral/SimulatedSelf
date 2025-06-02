import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { PoseResults } from '../hooks/usePoseDetection';
import { HumanoidRobot } from './HumanoidRobot';

interface SkeletonRendererProps {
  landmarks: PoseResults | null;
  isHumanoidMode: boolean;
}

export class SkeletonRenderer {
  public group: THREE.Group;
  private posePoints: THREE.Mesh[] = [];
  private poseLines: THREE.LineSegments | null = null;
  private handPoints: THREE.Mesh[][] = [];
  private handLines: THREE.LineSegments[] = [];
  private humanoidRobot: HumanoidRobot | null = null;
  private isHumanoidMode: boolean = false;

  // MediaPipe Pose connections (33 landmarks)
  private readonly POSE_CONNECTIONS = [
    // Face
    [0, 1], [1, 2], [2, 3], [3, 7],
    [0, 4], [4, 5], [5, 6], [6, 8],
    [9, 10],
    // Body
    [11, 12], [11, 13], [13, 15], [15, 17], [15, 19], [15, 21],
    [12, 14], [14, 16], [16, 18], [16, 20], [16, 22],
    [11, 23], [12, 24], [23, 24],
    // Left leg
    [23, 25], [25, 27], [27, 29], [27, 31], [29, 31],
    // Right leg
    [24, 26], [26, 28], [28, 30], [28, 32], [30, 32]
  ];

  // MediaPipe Hand connections (21 landmarks per hand)
  private readonly HAND_CONNECTIONS = [
    // Thumb
    [0, 1], [1, 2], [2, 3], [3, 4],
    // Index finger
    [0, 5], [5, 6], [6, 7], [7, 8],
    // Middle finger
    [0, 9], [9, 10], [10, 11], [11, 12],
    // Ring finger
    [0, 13], [13, 14], [14, 15], [15, 16],
    // Pinky
    [0, 17], [17, 18], [18, 19], [19, 20]
  ];

  constructor() {
    this.group = new THREE.Group();
    this.initializeSkeleton();
    this.humanoidRobot = new HumanoidRobot();
    this.group.add(this.humanoidRobot.group);
    this.humanoidRobot.group.visible = false;
  }

  private initializeSkeleton() {
    // Create pose point geometries and materials
    const posePointGeometry = new THREE.SphereGeometry(0.02, 8, 6);
    const posePointMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00 });

    // Create 33 pose points
    for (let i = 0; i < 33; i++) {
      const point = new THREE.Mesh(posePointGeometry, posePointMaterial);
      point.visible = false;
      this.posePoints.push(point);
      this.group.add(point);
    }

    // Create hand point geometries and materials - INCREASED SIZE BY 1.5x
    const handPointGeometry = new THREE.SphereGeometry(0.051, 8, 6); // 0.034 * 1.5 = 0.051
    const leftHandMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    const rightHandMaterial = new THREE.MeshBasicMaterial({ color: 0x0000ff });

    // Create points for two hands
    for (let h = 0; h < 2; h++) {
      const handPointsArray: THREE.Mesh[] = [];
      const material = h === 0 ? leftHandMaterial : rightHandMaterial;
      
      for (let i = 0; i < 21; i++) {
        const point = new THREE.Mesh(handPointGeometry, material);
        point.visible = false;
        handPointsArray.push(point);
        this.group.add(point);
      }
      this.handPoints.push(handPointsArray);
    }

    console.log('Skeleton initialized with pose and hand points');
  }

  public setHumanoidMode(isHumanoid: boolean) {
    this.isHumanoidMode = isHumanoid;
    
    if (this.humanoidRobot) {
      this.humanoidRobot.group.visible = isHumanoid;
    }

    // Toggle landmark visibility
    this.posePoints.forEach(point => {
      if (point.visible) point.visible = !isHumanoid;
    });
    
    this.handPoints.forEach(hand => {
      hand.forEach(point => {
        if (point.visible) point.visible = !isHumanoid;
      });
    });

    if (this.poseLines) this.poseLines.visible = !isHumanoid;
    this.handLines.forEach(line => {
      if (line) line.visible = !isHumanoid;
    });
  }

  public updateEmotion(emotion: string) {
    if (this.humanoidRobot) {
      this.humanoidRobot.updateEmotion(emotion);
    }
  }

  private convertLandmarkToWorldPosition(landmark: any): THREE.Vector3 {
    return new THREE.Vector3(
      (landmark.x - 0.5) * 4, // Center and scale x
      -(landmark.y - 0.5) * 3, // Center, flip and scale y
      landmark.z * 2 // Scale depth
    );
  }

  public updatePose(landmarks: PoseResults) {
    console.log('Updating skeleton with landmarks:', landmarks);

    if (this.isHumanoidMode && this.humanoidRobot) {
      this.humanoidRobot.updatePose(landmarks);
      return;
    }

    // Update pose landmarks
    if (landmarks.pose && landmarks.pose.length === 33) {
      landmarks.pose.forEach((landmark, index) => {
        if (landmark.visibility && landmark.visibility > 0.5) {
          const point = this.posePoints[index];
          const position = this.convertLandmarkToWorldPosition(landmark);
          point.position.copy(position);
          point.visible = true;
        } else {
          this.posePoints[index].visible = false;
        }
      });

      this.updatePoseConnections(landmarks.pose);
    } else {
      this.posePoints.forEach(point => point.visible = false);
      if (this.poseLines) this.poseLines.visible = false;
    }

    // Update hands positioned at body wrists
    this.updateHandsAtBodyWrists(landmarks);
  }

  private updateHandsAtBodyWrists(landmarks: PoseResults) {
    if (landmarks.hands && landmarks.hands.length > 0 && landmarks.pose) {
      landmarks.hands.forEach((hand, handIndex) => {
        if (handIndex < 2 && hand.length === 21) {
          const wristIndex = handIndex === 0 ? 15 : 16;
          const bodyWrist = landmarks.pose![wristIndex];
          
          if (bodyWrist && bodyWrist.visibility && bodyWrist.visibility > 0.5) {
            const bodyWristPos = this.convertLandmarkToWorldPosition(bodyWrist);
            
            hand.forEach((landmark, landmarkIndex) => {
              const point = this.handPoints[handIndex][landmarkIndex];
              
              if (landmarkIndex === 0) {
                point.position.copy(bodyWristPos);
              } else {
                const wristLandmark = hand[0];
                const wristPos = this.convertLandmarkToWorldPosition(wristLandmark);
                
                const handLandmarkPos = this.convertLandmarkToWorldPosition(landmark);
                const offset = new THREE.Vector3().subVectors(handLandmarkPos, wristPos);
                
                offset.multiplyScalar(0.3);
                
                point.position.copy(bodyWristPos).add(offset);
              }
              
              point.visible = true;
            });

            this.updateHandConnections(hand, handIndex, bodyWristPos);
          }
        }
      });

      for (let h = landmarks.hands.length; h < 2; h++) {
        this.handPoints[h].forEach(point => point.visible = false);
        if (this.handLines[h]) {
          this.handLines[h].visible = false;
        }
      }
    } else {
      this.handPoints.forEach(hand => {
        hand.forEach(point => point.visible = false);
      });
      this.handLines.forEach(line => {
        if (line) line.visible = false;
      });
    }
  }

  private updatePoseConnections(pose: any[]) {
    const positions: number[] = [];
    
    this.POSE_CONNECTIONS.forEach(([startIdx, endIdx]) => {
      const start = pose[startIdx];
      const end = pose[endIdx];
      
      if (start && end && 
          (!start.visibility || start.visibility > 0.5) && 
          (!end.visibility || end.visibility > 0.5)) {
        
        const startPos = this.convertLandmarkToWorldPosition(start);
        const endPos = this.convertLandmarkToWorldPosition(end);
        
        positions.push(startPos.x, startPos.y, startPos.z);
        positions.push(endPos.x, endPos.y, endPos.z);
      }
    });

    if (positions.length > 0) {
      if (this.poseLines) {
        this.group.remove(this.poseLines);
      }

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      
      const material = new THREE.LineBasicMaterial({ color: 0x00ff00, linewidth: 2 });
      this.poseLines = new THREE.LineSegments(geometry, material);
      this.poseLines.visible = true;
      this.group.add(this.poseLines);
    }
  }

  private updateHandConnections(hand: any[], handIndex: number, basePosition: THREE.Vector3) {
    const positions: number[] = [];
    
    this.HAND_CONNECTIONS.forEach(([startIdx, endIdx]) => {
      const startPoint = this.handPoints[handIndex][startIdx];
      const endPoint = this.handPoints[handIndex][endIdx];
      
      if (startPoint.visible && endPoint.visible) {
        positions.push(startPoint.position.x, startPoint.position.y, startPoint.position.z);
        positions.push(endPoint.position.x, endPoint.position.y, endPoint.position.z);
      }
    });

    if (positions.length > 0) {
      if (this.handLines[handIndex]) {
        this.group.remove(this.handLines[handIndex]);
      }

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      
      const color = handIndex === 0 ? 0xff0000 : 0x0000ff;
      const material = new THREE.LineBasicMaterial({ color, linewidth: 2 });
      this.handLines[handIndex] = new THREE.LineSegments(geometry, material);
      this.handLines[handIndex].visible = true;
      this.group.add(this.handLines[handIndex]);
    }
  }

  public update() {
    if (this.humanoidRobot) {
      this.humanoidRobot.update();
    }
  }
}
