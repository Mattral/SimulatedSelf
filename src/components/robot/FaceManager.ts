
import * as THREE from 'three';
import { RobotMaterials } from './MaterialManager';

export interface FaceFeatures {
  leftEye: THREE.Object3D;
  rightEye: THREE.Object3D;
  leftEyebrow: THREE.Object3D;
  rightEyebrow: THREE.Object3D;
  nose: THREE.Object3D;
  mouth: THREE.Object3D;
  leftEyeSocket: THREE.Object3D;
  rightEyeSocket: THREE.Object3D;
  noseRidge: THREE.Object3D;
}

export class FaceManager {
  public frontFace: FaceFeatures;
  private group: THREE.Group;
  private materials: RobotMaterials;
  private currentEmotion: string = 'neutral';

  constructor(group: THREE.Group, materials: RobotMaterials) {
    this.group = group;
    this.materials = materials;
    this.frontFace = this.createFaceSet(0.31);
  }

  private createFaceSet(zOffset: number): FaceFeatures {
    // Enhanced human-like eyes with sockets
    const eyeGeometry = new THREE.SphereGeometry(0.055, 24, 24);
    const eyeMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x87ceeb,
      emissive: 0x001133,
      emissiveIntensity: 0.2,
      metalness: 0.1,
      roughness: 0.2,
      clearcoat: 1.0,
      clearcoatRoughness: 0.1
    });

    // Eye sockets for depth
    const eyeSocketGeometry = new THREE.SphereGeometry(0.07, 20, 20);
    eyeSocketGeometry.scale(1, 0.8, 0.6);
    const eyeSocketMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xe8e8e8,
      metalness: 0.1,
      roughness: 0.7,
      clearcoat: 0.3
    });

    // More defined eyebrows
    const eyebrowGeometry = new THREE.CapsuleGeometry(0.015, 0.095, 8, 8);
    const eyebrowMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x505050,
      metalness: 0.6,
      roughness: 0.4,
      clearcoat: 0.4
    });

    // Enhanced nose with ridge
    const noseGeometry = new THREE.ConeGeometry(0.02, 0.08, 8);
    const noseMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xf0f0f0,
      metalness: 0.05,
      roughness: 0.6,
      clearcoat: 0.3
    });

    // Nose ridge for more definition
    const noseRidgeGeometry = new THREE.CapsuleGeometry(0.008, 0.06, 6, 6);
    const noseRidgeMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xe8e8e8,
      metalness: 0.1,
      roughness: 0.7,
      clearcoat: 0.2
    });

    // Enhanced mouth slot
    const mouthGeometry = new THREE.CapsuleGeometry(0.025, 0.085, 8, 8);
    mouthGeometry.rotateZ(Math.PI / 2);
    const mouthMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x404040,
      metalness: 0.3,
      roughness: 0.6,
      clearcoat: 0.3
    });

    const features: FaceFeatures = {
      leftEye: new THREE.Mesh(eyeGeometry, eyeMaterial),
      rightEye: new THREE.Mesh(eyeGeometry, eyeMaterial),
      leftEyeSocket: new THREE.Mesh(eyeSocketGeometry, eyeSocketMaterial),
      rightEyeSocket: new THREE.Mesh(eyeSocketGeometry, eyeSocketMaterial),
      leftEyebrow: new THREE.Mesh(eyebrowGeometry, eyebrowMaterial),
      rightEyebrow: new THREE.Mesh(eyebrowGeometry, eyebrowMaterial),
      nose: new THREE.Mesh(noseGeometry, noseMaterial),
      noseRidge: new THREE.Mesh(noseRidgeGeometry, noseRidgeMaterial),
      mouth: new THREE.Mesh(mouthGeometry, mouthMaterial)
    };
    
    Object.values(features).forEach(feature => {
      feature.visible = true;
      feature.castShadow = true;
      feature.receiveShadow = true;
      this.group.add(feature);
    });

    return features;
  }

  public updateFacePosition(headPos: THREE.Vector3, isVisible: boolean) {
    this.updateFaceSet(this.frontFace, headPos, 0.31, isVisible);
    this.applyFacialExpression(this.currentEmotion);
  }

  private updateFaceSet(features: FaceFeatures, headPos: THREE.Vector3, zOffset: number, isVisible: boolean) {
    // Eye sockets first (behind eyes)
    features.leftEyeSocket.position.set(headPos.x - 0.085, headPos.y + 0.06, headPos.z + zOffset - 0.02);
    features.rightEyeSocket.position.set(headPos.x + 0.085, headPos.y + 0.06, headPos.z + zOffset - 0.02);
    
    // Eyes
    features.leftEye.position.set(headPos.x - 0.085, headPos.y + 0.06, headPos.z + zOffset);
    features.rightEye.position.set(headPos.x + 0.085, headPos.y + 0.06, headPos.z + zOffset);
    
    // Eyebrows
    features.leftEyebrow.position.set(headPos.x - 0.085, headPos.y + 0.125, headPos.z + zOffset);
    features.rightEyebrow.position.set(headPos.x + 0.085, headPos.y + 0.125, headPos.z + zOffset);
    
    // Nose and nose ridge
    features.nose.position.set(headPos.x, headPos.y - 0.01, headPos.z + zOffset + 0.03);
    features.noseRidge.position.set(headPos.x, headPos.y + 0.02, headPos.z + zOffset + 0.025);
    features.noseRidge.rotation.x = Math.PI / 2;
    
    Object.values(features).forEach(feature => {
      feature.visible = isVisible;
    });
  }

  public updateEmotion(emotion: string) {
    this.currentEmotion = emotion;
    this.applyFacialExpression(emotion);
  }

  private applyFacialExpression(emotion: string) {
    this.applyExpressionToFace(this.frontFace, emotion, 0.31);
  }

  private applyExpressionToFace(features: FaceFeatures, emotion: string, zOffset: number) {
    const headPos = features.leftEye.position.clone();
    headPos.z -= zOffset;
    
    switch (emotion) {
      case 'happy':
        features.mouth.position.set(headPos.x, headPos.y - 0.10, headPos.z + zOffset);
        features.mouth.rotation.z = 0.3;
        features.leftEyebrow.rotation.z = -0.2;
        features.rightEyebrow.rotation.z = 0.2;
        features.leftEye.scale.set(0.9, 1.1, 1);
        features.rightEye.scale.set(0.9, 1.1, 1);
        break;
        
      case 'sad':
        features.mouth.position.set(headPos.x, headPos.y - 0.14, headPos.z + zOffset);
        features.mouth.rotation.z = -0.3;
        features.leftEyebrow.rotation.z = 0.3;
        features.rightEyebrow.rotation.z = -0.3;
        features.leftEye.scale.set(1, 0.8, 1);
        features.rightEye.scale.set(1, 0.8, 1);
        break;
        
      case 'angry':
        features.mouth.position.set(headPos.x, headPos.y - 0.12, headPos.z + zOffset);
        features.mouth.rotation.z = 0;
        features.leftEyebrow.position.y = headPos.y + 0.08;
        features.rightEyebrow.position.y = headPos.y + 0.08;
        features.leftEyebrow.rotation.z = 0.4;
        features.rightEyebrow.rotation.z = -0.4;
        break;
        
      case 'surprised':
        features.mouth.position.set(headPos.x, headPos.y - 0.12, headPos.z + zOffset);
        features.mouth.scale.set(1.5, 1.5, 1);
        features.leftEyebrow.position.y = headPos.y + 0.14;
        features.rightEyebrow.position.y = headPos.y + 0.14;
        features.leftEye.scale.set(1.3, 1.3, 1);
        features.rightEye.scale.set(1.3, 1.3, 1);
        break;
        
      default:
        features.mouth.position.set(headPos.x, headPos.y - 0.12, headPos.z + zOffset);
        features.mouth.rotation.z = 0;
        features.mouth.scale.set(1, 1, 1);
        features.leftEyebrow.rotation.z = 0;
        features.rightEyebrow.rotation.z = 0;
        features.leftEye.scale.set(1, 1, 1);
        features.rightEye.scale.set(1, 1, 1);
    }
  }

  public blink() {
    [this.frontFace.leftEye, this.frontFace.rightEye].forEach(eye => {
      const originalScale = eye.scale.y;
      eye.scale.y = 0.1;
      
      setTimeout(() => {
        eye.scale.y = originalScale;
      }, 150);
    });
  }
}
