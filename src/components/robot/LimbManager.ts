
import * as THREE from 'three';
import { RobotMaterials } from './MaterialManager';

export interface LimbSegment {
  upperSegment: THREE.Object3D;
  joint: THREE.Object3D;
  lowerSegment: THREE.Object3D;
}

export class LimbManager {
  private group: THREE.Group;
  private materials: RobotMaterials;
  private limbs: { [key: string]: LimbSegment } = {};

  constructor(group: THREE.Group, materials: RobotMaterials) {
    this.group = group;
    this.materials = materials;
    this.createLimbStructures();
  }

  private createLimbStructures() {
    // Create arm structures
    this.createArmStructure('left');
    this.createArmStructure('right');
    
    // Create leg structures
    this.createLegStructure('left');
    this.createLegStructure('right');
  }

  private createArmStructure(side: 'left' | 'right') {
    const armKey = `${side}Arm`;
    
    // Upper arm (shoulder to elbow)
    const upperArmGeometry = new THREE.CapsuleGeometry(0.08, 0.45, 12, 20);
    const upperArm = new THREE.Mesh(upperArmGeometry, this.materials.body);
    upperArm.castShadow = true;
    upperArm.receiveShadow = true;
    
    // Elbow joint
    const elbowGeometry = new THREE.SphereGeometry(0.09, 16, 16);
    const elbow = new THREE.Mesh(elbowGeometry, this.materials.joint);
    elbow.castShadow = true;
    elbow.receiveShadow = true;
    
    // Forearm (elbow to wrist)
    const forearmGeometry = new THREE.CapsuleGeometry(0.07, 0.40, 12, 20);
    const forearm = new THREE.Mesh(forearmGeometry, this.materials.body);
    forearm.castShadow = true;
    forearm.receiveShadow = true;
    
    this.limbs[armKey] = {
      upperSegment: upperArm,
      joint: elbow,
      lowerSegment: forearm
    };
    
    this.group.add(upperArm);
    this.group.add(elbow);
    this.group.add(forearm);
  }

  private createLegStructure(side: 'left' | 'right') {
    const legKey = `${side}Leg`;
    
    // Thigh (hip to knee)
    const thighGeometry = new THREE.CapsuleGeometry(0.10, 0.65, 12, 20);
    const thigh = new THREE.Mesh(thighGeometry, this.materials.body);
    thigh.castShadow = true;
    thigh.receiveShadow = true;
    
    // Knee joint
    const kneeGeometry = new THREE.SphereGeometry(0.11, 16, 16);
    kneeGeometry.scale(1, 0.7, 1); // Slightly flattened sphere for knee
    const knee = new THREE.Mesh(kneeGeometry, this.materials.joint);
    knee.castShadow = true;
    knee.receiveShadow = true;
    
    // Shin (knee to ankle)
    const shinGeometry = new THREE.CapsuleGeometry(0.08, 0.60, 12, 20);
    const shin = new THREE.Mesh(shinGeometry, this.materials.body);
    shin.castShadow = true;
    shin.receiveShadow = true;
    
    this.limbs[legKey] = {
      upperSegment: thigh,
      joint: knee,
      lowerSegment: shin
    };
    
    this.group.add(thigh);
    this.group.add(knee);
    this.group.add(shin);
  }

  public updateLimbPositions(landmarks: any, visibility: any) {
    if (!landmarks.pose || landmarks.pose.length < 33) return;

    // Update arm positions
    this.updateArmPosition('left', landmarks.pose, visibility);
    this.updateArmPosition('right', landmarks.pose, visibility);
    
    // Update leg positions
    this.updateLegPosition('left', landmarks.pose, visibility);
    this.updateLegPosition('right', landmarks.pose, visibility);
  }

  private updateArmPosition(side: 'left' | 'right', pose: any[], visibility: any) {
    const armKey = `${side}Arm`;
    const limb = this.limbs[armKey];
    if (!limb) return;

    const shoulderIdx = side === 'left' ? 11 : 12;
    const elbowIdx = side === 'left' ? 13 : 14;
    const wristIdx = side === 'left' ? 15 : 16;
    const isVisible = side === 'left' ? visibility.leftArm : visibility.rightArm;

    if (!isVisible || !pose[shoulderIdx] || !pose[elbowIdx] || !pose[wristIdx]) {
      limb.upperSegment.visible = false;
      limb.joint.visible = false;
      limb.lowerSegment.visible = false;
      return;
    }

    const shoulderPos = this.convertLandmarkToWorldPosition(pose[shoulderIdx]);
    const elbowPos = this.convertLandmarkToWorldPosition(pose[elbowIdx]);
    const wristPos = this.convertLandmarkToWorldPosition(pose[wristIdx]);

    // Update upper arm (shoulder to elbow)
    const upperArmMid = new THREE.Vector3().addVectors(shoulderPos, elbowPos).multiplyScalar(0.5);
    limb.upperSegment.position.copy(upperArmMid);
    limb.upperSegment.lookAt(elbowPos);
    limb.upperSegment.rotateX(Math.PI / 2);
    limb.upperSegment.visible = true;

    // Update elbow joint
    limb.joint.position.copy(elbowPos);
    limb.joint.visible = true;

    // Update forearm (elbow to wrist)
    const forearmMid = new THREE.Vector3().addVectors(elbowPos, wristPos).multiplyScalar(0.5);
    limb.lowerSegment.position.copy(forearmMid);
    limb.lowerSegment.lookAt(wristPos);
    limb.lowerSegment.rotateX(Math.PI / 2);
    limb.lowerSegment.visible = true;
  }

  private updateLegPosition(side: 'left' | 'right', pose: any[], visibility: any) {
    const legKey = `${side}Leg`;
    const limb = this.limbs[legKey];
    if (!limb) return;

    const hipIdx = side === 'left' ? 23 : 24;
    const kneeIdx = side === 'left' ? 25 : 26;
    const ankleIdx = side === 'left' ? 27 : 28;
    const isVisible = side === 'left' ? visibility.leftLeg : visibility.rightLeg;

    if (!isVisible || !pose[hipIdx] || !pose[kneeIdx] || !pose[ankleIdx]) {
      limb.upperSegment.visible = false;
      limb.joint.visible = false;
      limb.lowerSegment.visible = false;
      return;
    }

    const hipPos = this.convertLandmarkToWorldPosition(pose[hipIdx]);
    const kneePos = this.convertLandmarkToWorldPosition(pose[kneeIdx]);
    const anklePos = this.convertLandmarkToWorldPosition(pose[ankleIdx]);

    // Update thigh (hip to knee)
    const thighMid = new THREE.Vector3().addVectors(hipPos, kneePos).multiplyScalar(0.5);
    limb.upperSegment.position.copy(thighMid);
    limb.upperSegment.lookAt(kneePos);
    limb.upperSegment.rotateX(Math.PI / 2);
    limb.upperSegment.visible = true;

    // Update knee joint
    limb.joint.position.copy(kneePos);
    limb.joint.visible = true;

    // Update shin (knee to ankle)
    const shinMid = new THREE.Vector3().addVectors(kneePos, anklePos).multiplyScalar(0.5);
    limb.lowerSegment.position.copy(shinMid);
    limb.lowerSegment.lookAt(anklePos);
    limb.lowerSegment.rotateX(Math.PI / 2);
    limb.lowerSegment.visible = true;
  }

  private convertLandmarkToWorldPosition(landmark: any): THREE.Vector3 {
    return new THREE.Vector3(
      -(landmark.x - 0.5) * 4,
      -(landmark.y - 0.5) * 3,
      -landmark.z * 2
    );
  }

  public setVisibility(visible: boolean) {
    Object.values(this.limbs).forEach(limb => {
      limb.upperSegment.visible = visible;
      limb.joint.visible = visible;
      limb.lowerSegment.visible = visible;
    });
  }
}
