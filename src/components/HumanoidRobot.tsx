import * as THREE from 'three';
import { Landmark } from '../hooks/usePoseDetection';
import { MaterialManager } from './robot/MaterialManager';
import { FaceManager } from './robot/FaceManager';
import { FingerManager } from './robot/FingerManager';
import { VisibilityManager, VisibilityState } from './robot/VisibilityManager';
import { ModelLoader, LoadedModels } from './robot/ModelLoader';

export class HumanoidRobot {
  public group: THREE.Group;
  private materialManager: MaterialManager;
  private faceManager: FaceManager;
  private fingerManager: FingerManager;
  private visibilityManager: VisibilityManager;
  private modelLoader: ModelLoader;
  private loadedModels: LoadedModels | null = null;
  private bones: { [key: string]: THREE.Object3D };
  private connections: THREE.LineSegments[] = [];
  private idleTime: number = 0;
  private blinkTimer: number = 0;
  private defaultPositions: { [key: string]: THREE.Vector3 } = {};
  private currentEmotion: string = 'neutral';
  private panelLines: THREE.Object3D[] = [];
  private isModelsLoaded: boolean = false;

  constructor() {
    this.group = new THREE.Group();
    this.bones = {};
    
    this.materialManager = new MaterialManager();
    this.visibilityManager = new VisibilityManager();
    this.modelLoader = new ModelLoader();
    this.setupDefaultPositions();
    
    // Initialize with fallback geometries first
    this.buildRobotWithFallbacks();
    this.addRoboticDetails();
    this.faceManager = new FaceManager(this.group, this.materialManager.materials);
    this.fingerManager = new FingerManager(this.group, this.materialManager.materials);
    this.setIdlePosition();
    
    // Load 3D models asynchronously
    this.loadModelsAsync();
  }

  private async loadModelsAsync() {
    try {
      console.log('Loading 3D models...');
      this.loadedModels = await this.modelLoader.loadAllModels();
      console.log('3D models loaded successfully');
      this.replaceWithLoadedModels();
      this.isModelsLoaded = true;
    } catch (error) {
      console.warn('Failed to load 3D models, using fallback geometries:', error);
    }
  }

  private replaceWithLoadedModels() {
    if (!this.loadedModels) return;

    // Replace head with loaded model
    if (this.loadedModels.head && this.bones.head) {
      this.replaceBodyPart('head', this.loadedModels.head);
    }

    // Replace neck with loaded model
    if (this.loadedModels.neck && this.bones.neck) {
      this.replaceBodyPart('neck', this.loadedModels.neck);
    }

    if (this.loadedModels.leftShoulder && this.bones.leftShoulder) {
      this.replaceBodyPart('leftShoulder', this.loadedModels.leftShoulder);
    }
    if (this.loadedModels.rightShoulder && this.bones.rightShoulder) {
      this.replaceBodyPart('rightShoulder', this.loadedModels.rightShoulder);
    }
    // Replace torso with loaded model
    if (this.loadedModels.torso && this.bones.torso) {
      this.replaceBodyPart('torso', this.loadedModels.torso);
    }

    // Replace arms with loaded models
    if (this.loadedModels.leftUpperArm && this.bones.leftUpperArm) {
      this.replaceBodyPart('leftUpperArm', this.loadedModels.leftUpperArm);
    }
    if (this.loadedModels.rightUpperArm && this.bones.rightUpperArm) {
      this.replaceBodyPart('rightUpperArm', this.loadedModels.rightUpperArm);
    }
    if (this.loadedModels.leftForearm && this.bones.leftForearm) {
      this.replaceBodyPart('leftForearm', this.loadedModels.leftForearm);
    }
    if (this.loadedModels.rightForearm && this.bones.rightForearm) {
      this.replaceBodyPart('rightForearm', this.loadedModels.rightForearm);
    }
    if (this.loadedModels.leftHand && this.bones.leftHand) {
      this.replaceBodyPart('leftHand', this.loadedModels.leftHand);
    }
    if (this.loadedModels.rightHand && this.bones.rightHand) {
      this.replaceBodyPart('rightHand', this.loadedModels.rightHand);
    } 
    
    // Thigh loader
    if (this.loadedModels.leftThigh && this.bones.leftThigh) {
      this.replaceBodyPart('leftThigh', this.loadedModels.leftThigh);
    } 
    if (this.loadedModels.rightThigh && this.bones.rightThigh) {
      this.replaceBodyPart('rightThigh', this.loadedModels.rightThigh);
    } 
    if (this.loadedModels.leftShin && this.bones.leftShin) {
      this.replaceBodyPart('leftShin', this.loadedModels.leftShin);
    } 
    if (this.loadedModels.rightShin && this.bones.rightShin) {
      this.replaceBodyPart('rightShin', this.loadedModels.rightShin);
    } 

    console.log('Successfully replaced body parts with 3D models');
  }

  private replaceBodyPart(boneName: string, newModel: THREE.Group) {
    const oldBone = this.bones[boneName];
    if (!oldBone) return;

    // Store the old transform
    const position = oldBone.position.clone();
    const rotation = oldBone.rotation.clone();
    const scale = oldBone.scale.clone();
    const visible = oldBone.visible;

    // Remove old bone from group
    this.group.remove(oldBone);

    // Apply the old transform to the new model
    newModel.position.copy(position);
    newModel.rotation.copy(rotation);
    newModel.scale.copy(scale);
    newModel.visible = visible;

    // Add new model to group and update bones reference
    this.group.add(newModel);
    this.bones[boneName] = newModel;
  }

  private setupDefaultPositions() {
    this.defaultPositions = {
      head: new THREE.Vector3(0, 1.5, 0),
      neck: new THREE.Vector3(0, 1.2, 0),
      leftShoulder: new THREE.Vector3(-0.4, 1.0, 0),
      rightShoulder: new THREE.Vector3(0.4, 1.0, 0),
      torso: new THREE.Vector3(0, 0.5, 0),
      leftUpperArm: new THREE.Vector3(-0.6, 0.7, 0),
      rightUpperArm: new THREE.Vector3(0.6, 0.7, 0),
      leftForearm: new THREE.Vector3(-0.8, 0.3, 0),
      rightForearm: new THREE.Vector3(0.8, 0.3, 0),
      leftHand: new THREE.Vector3(-1.0, 0.1, 0),
      rightHand: new THREE.Vector3(1.0, 0.1, 0),
      leftHip: new THREE.Vector3(-0.2, 0, 0),
      rightHip: new THREE.Vector3(0.2, 0, 0),
      leftThigh: new THREE.Vector3(-0.2, -0.4, 0),
      rightThigh: new THREE.Vector3(0.2, -0.4, 0),
      leftShin: new THREE.Vector3(-0.2, -1.0, 0),
      rightShin: new THREE.Vector3(0.2, -1.0, 0),
      leftFoot: new THREE.Vector3(-0.2, -1.4, 0),
      rightFoot: new THREE.Vector3(0.2, -1.4, 0)
    };
  }

  private buildRobotWithFallbacks() {
    // Create fallback geometries that will be replaced by 3D models
    this.createRefinedBodyPart('head', 0.32, 0.38, 0.30, 'head');
    this.createRefinedBodyPart('neck', 0.15, 0.25, 0.15, 'neck');
    this.createRefinedBodyPart('leftShoulder', 0.18, 0.15, 0.15, 'shoulder');
    this.createRefinedBodyPart('rightShoulder', 0.18, 0.15, 0.15, 'shoulder');
    this.createRefinedBodyPart('torso', 1.95, 3.3,  1.05, 'torso');
    this.createRefinedBodyPart('leftUpperArm', 0.20, 0.55, 0.20, 'limb');
    this.createRefinedBodyPart('rightUpperArm', 0.20, 0.55, 0.20, 'limb');
    this.createRefinedBodyPart('leftForearm', 0.18, 0.50, 0.18, 'limb');
    this.createRefinedBodyPart('rightForearm', 0.18, 0.50, 0.18, 'limb');
    
    // Keep existing hand design as requested
    this.createHandPart('leftHand', 0.20, 0.28, 0.10);
    this.createHandPart('rightHand', 0.20, 0.28, 0.10);
    
    // Enhanced hip joints and legs (not replaced by 3D models)
    this.createRefinedBodyPart('leftHip', 0.12, 0.12, 0.12, 'joint');
    this.createRefinedBodyPart('rightHip', 0.12, 0.12, 0.12, 'joint');
    this.createRefinedBodyPart('leftThigh', 0.22, 0.75, 0.22, 'limb');
    this.createRefinedBodyPart('rightThigh', 0.22, 0.75, 0.22, 'limb');
    this.createRefinedBodyPart('leftShin', 0.20, 0.70, 0.20, 'limb');
    this.createRefinedBodyPart('rightShin', 0.20, 0.70, 0.20, 'limb');
    this.createRefinedBodyPart('leftFoot', 0.12, 0.06, 0.22, 'foot');
    this.createRefinedBodyPart('rightFoot', 0.12, 0.06, 0.22, 'foot');
  }

  private createRefinedBodyPart(name: string, width: number, height: number, depth: number, type: string) {
    let geometry: THREE.BufferGeometry;
    let material: THREE.Material;

    switch (type) {
      case 'head':
        // Enhanced head geometry with more human-like proportions
        geometry = new THREE.SphereGeometry(width, 32, 32);
        geometry.scale(1, 1.15, 0.95); // More refined head shape
        material = this.materialManager.materials.face;
        break;
      case 'neck':
        // Articulated neck design
        geometry = new THREE.CylinderGeometry(width * 0.8, width * 1.3, height, 16);
        material = this.materialManager.materials.neck;
        break;
      case 'shoulder':
        // Enhanced shoulder joints with engineering detail
        geometry = new THREE.SphereGeometry(width/2, 20, 20);
        geometry.scale(1.6, 0.7, 1.1); // More refined shoulder shape
        material = this.materialManager.materials.joint;
        break;
      case 'torso':
        // Enhanced torso with subtle muscle contours
        geometry = new THREE.CapsuleGeometry(width/2, height * 0.6, 20, 40);
        material = this.materialManager.materials.body;
        break;
      case 'joint':
        // Refined joint design
        geometry = new THREE.SphereGeometry(width, 20, 20);
        material = this.materialManager.materials.joint;
        break;
      case 'limb':
        // Enhanced limb segments with robotic styling
        geometry = new THREE.CapsuleGeometry(width/2, height, 16, 24);
        material = this.materialManager.materials.body;
        break;
      case 'foot':
        // Enhanced foot design
        geometry = new THREE.BoxGeometry(width, height, depth);
        geometry.translate(0, 0, depth/4);
        material = this.materialManager.materials.body;
        break;
      default:
        geometry = new THREE.CapsuleGeometry(width/2, height, 16, 24);
        material = this.materialManager.materials.body;
    }
    
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.visible = true;
    
    this.bones[name] = mesh;
    this.group.add(mesh);
  }

  private addRoboticDetails() {
    // Add subtle panel lines to major body parts
    this.addPanelLines('torso', [
      { x: 0, y: 0.3, z: 0.33, width: 0.5, height: 0.02 },
      { x: 0, y: -0.1, z: 0.33, width: 0.4, height: 0.02 },
      { x: 0, y: -0.4, z: 0.33, width: 0.6, height: 0.02 }
    ]);

    // Add energy glow accents to joints
    this.addEnergyGlow('leftShoulder', 0.1);
    this.addEnergyGlow('rightShoulder', 0.1);
    this.addEnergyGlow('neck', 0.08);
  }

  private addPanelLines(parentBone: string, lines: Array<{x: number, y: number, z: number, width: number, height: number}>) {
    if (!this.bones[parentBone]) return;

    lines.forEach(line => {
      const geometry = new THREE.PlaneGeometry(line.width, line.height);
      const mesh = new THREE.Mesh(geometry, this.materialManager.materials.panelLines);
      mesh.position.set(line.x, line.y, line.z);
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      
      this.panelLines.push(mesh);
      this.group.add(mesh);
    });
  }

  private addEnergyGlow(parentBone: string, radius: number) {
    if (!this.bones[parentBone]) return;

    const geometry = new THREE.RingGeometry(radius * 0.8, radius, 16);
    const mesh = new THREE.Mesh(geometry, this.materialManager.materials.energyGlow);
    mesh.position.copy(this.bones[parentBone].position);
    mesh.rotateX(Math.PI / 2);
    
    this.panelLines.push(mesh);
    this.group.add(mesh);
  }

  private createHandPart(name: string, width: number, height: number, depth: number) {
    const geometry = new THREE.BoxGeometry(width, height, depth);
    geometry.translate(0, height/2, 0);
    
    const material = this.materialManager.materials.hand;
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.visible = true;
    
    this.bones[name] = mesh;
    this.group.add(mesh);
  }

  private setIdlePosition() {
    Object.keys(this.defaultPositions).forEach(boneName => {
      if (this.bones[boneName]) {
        this.bones[boneName].position.copy(this.defaultPositions[boneName]);
        this.bones[boneName].rotation.set(0, 0, 0);
        this.bones[boneName].scale.set(1, 1, 1);
        this.bones[boneName].visible = true;
      }
    });

    this.faceManager.updateFacePosition(this.bones.head.position, true);
    this.createStructuralConnections();
  }

  private convertLandmarkToWorldPosition(landmark: any): THREE.Vector3 {
    return new THREE.Vector3(
      -(landmark.x - 0.5) * 4,
      -(landmark.y - 0.5) * 3,
      -landmark.z * 2
    );
  }

  public updatePose(landmarks: any) {
    if (!landmarks) {
      this.setIdlePosition();
      return;
    }

    console.log('Updating robot pose with landmarks:', landmarks);
    this.idleTime = 0;

    if (landmarks.pose && landmarks.pose.length >= 33) {
      const visibility = this.visibilityManager.calculateVisibility(landmarks.pose);
      this.updateBodyPositions(landmarks.pose, visibility);
      this.faceManager.updateFacePosition(this.bones.head.position, visibility.head);
      this.updatePanelLinesPositions();
    } else {
      this.setIdlePosition();
    }

    if (landmarks.hands && landmarks.hands.length > 0) {
      const visibility = this.visibilityManager.calculateVisibility(landmarks.pose || []);
      this.updateHandPositions(landmarks);
      this.fingerManager.updateFingerPositions(landmarks, visibility.leftHand, visibility.rightHand);
    } else {
      this.fingerManager.updateFingerPositions({ hands: [], pose: [] }, false, false);
    }

    this.createStructuralConnections();
  }

  private updatePanelLinesPositions() {
    // Update panel lines and energy glows to follow their parent bones
    // This ensures the robotic details move with the body parts
    if (this.bones.torso && this.panelLines.length > 0) {
      const torsoPos = this.bones.torso.position;
      const torsoRot = this.bones.torso.rotation;
      
      // Update panel line positions relative to torso
      this.panelLines.slice(0, 3).forEach((line, index) => {
        const yOffsets = [0.3, -0.1, -0.4];
        line.position.set(torsoPos.x, torsoPos.y + yOffsets[index], torsoPos.z + 0.33);
        line.rotation.copy(torsoRot);
      });
    }

    // Update energy glow positions
    ['leftShoulder', 'rightShoulder', 'neck'].forEach((boneName, index) => {
      const glowIndex = index + 3; // Panel lines take first 3 indices
      if (this.bones[boneName] && this.panelLines[glowIndex]) {
        this.panelLines[glowIndex].position.copy(this.bones[boneName].position);
      }
    });
  }

  public updateEmotion(emotion: string) {
    this.currentEmotion = emotion;
    this.faceManager.updateEmotion(emotion);
  }

  private updateBodyPositions(pose: Landmark[], visibility: VisibilityState) {
    let neckPosition = this.defaultPositions.neck.clone();
    let headPosition = this.defaultPositions.head.clone();
    let shoulderMidpoint = this.defaultPositions.neck.clone();
    
    // Update shoulders first
    this.updateShoulderPositions(pose, visibility);
    
    // Calculate neck position based on shoulder positions
    if (visibility.leftShoulder && visibility.rightShoulder) {
      const leftShoulderPos = this.convertLandmarkToWorldPosition(pose[11]);
      const rightShoulderPos = this.convertLandmarkToWorldPosition(pose[12]);
      shoulderMidpoint = new THREE.Vector3().addVectors(leftShoulderPos, rightShoulderPos).multiplyScalar(0.5);
      
      neckPosition = shoulderMidpoint.clone();
      neckPosition.y += 0.25;
      
      headPosition = neckPosition.clone();
      headPosition.y += 0.35;
    } else if (visibility.leftShoulder) {
      const leftShoulderPos = this.convertLandmarkToWorldPosition(pose[11]);
      neckPosition = leftShoulderPos.clone();
      neckPosition.x += 0.2; // Offset to center
      neckPosition.y += 0.25;
      
      headPosition = neckPosition.clone();
      headPosition.y += 0.35;
    } else if (visibility.rightShoulder) {
      const rightShoulderPos = this.convertLandmarkToWorldPosition(pose[12]);
      neckPosition = rightShoulderPos.clone();
      neckPosition.x -= 0.2; // Offset to center
      neckPosition.y += 0.25;
      
      headPosition = neckPosition.clone();
      headPosition.y += 0.35;
    }
    
    // Update neck and head
    this.bones.neck.position.copy(neckPosition);
    this.bones.neck.scale.set(2.8,2.8,2.8); 
    this.bones.neck.visible = visibility.neck;
    this.bones.head.position.copy(headPosition);
    this.bones.head.visible = visibility.head;

    // Update torso position
    if (visibility.torso && pose[11] && pose[12] && pose[23] && pose[24]) {
      const leftShoulder = this.convertLandmarkToWorldPosition(pose[11]);
      const rightShoulder = this.convertLandmarkToWorldPosition(pose[12]);
      const leftHip = this.convertLandmarkToWorldPosition(pose[23]);
      const rightHip = this.convertLandmarkToWorldPosition(pose[24]);
      
      const shoulderMid = new THREE.Vector3().addVectors(leftShoulder, rightShoulder).multiplyScalar(0.5);
      const hipMid = new THREE.Vector3().addVectors(leftHip, rightHip).multiplyScalar(0.5);
      const torsoPos = new THREE.Vector3().addVectors(shoulderMid, hipMid).multiplyScalar(0.5);
      
      this.bones.torso.position.copy(torsoPos);
      this.bones.torso.scale.set(2.8,2.8,3); 
      this.bones.torso.visible = true;
      
      this.updateJointPosition('leftHip', pose[23], visibility.leftLeg);
      this.updateJointPosition('rightHip', pose[24], visibility.rightLeg);
    } else {
      this.bones.torso.visible = false;
    }

    // Update limbs with visibility
    this.updateLimbPosition('leftUpperArm', pose[11], pose[13], visibility.leftArm);
    this.updateLimbPosition('rightUpperArm', pose[12], pose[14], visibility.rightArm);
    this.updateLimbPosition('leftForearm', pose[13], pose[15], visibility.leftArm);
    this.updateLimbPosition('rightForearm', pose[14], pose[16], visibility.rightArm);

    this.updateJointPosition('leftHand', pose[15], visibility.leftHand);
    this.updateJointPosition('rightHand', pose[16], visibility.rightHand);

    this.updateLimbPosition('leftThigh', pose[23], pose[25], visibility.leftLeg);
    this.bones.leftThigh.scale.set(1.5,1.5,1.5); 
    this.updateLimbPosition('rightThigh', pose[24], pose[26], visibility.rightLeg);
    this.bones.rightThigh.scale.set(1.5,1.5,1.5); 
    this.updateLimbPosition('leftShin', pose[25], pose[27], visibility.leftLeg);
    this.bones.leftShin.scale.set(1.5,1.5,1.5); 
    this.updateLimbPosition('rightShin', pose[26], pose[28], visibility.rightLeg);
    this.bones.rightShin.scale.set(1.5,1.5,1.5); 

    this.updateJointPosition('leftFoot', pose[27], visibility.leftLeg);
    this.updateJointPosition('rightFoot', pose[28], visibility.rightLeg);
  }

  private updateShoulderPositions(pose: Landmark[], visibility: VisibilityState) {
    // Update left shoulder
    if (visibility.leftShoulder && pose[11]) {
      const position = this.convertLandmarkToWorldPosition(pose[11]);
      this.bones.leftShoulder.position.copy(position);
      this.bones.leftShoulder.visible = true;
    } else {
      this.bones.leftShoulder.visible = false;
    }

    // Update right shoulder  
    if (visibility.rightShoulder && pose[12]) {
      const position = this.convertLandmarkToWorldPosition(pose[12]);
      this.bones.rightShoulder.position.copy(position);
      this.bones.rightShoulder.visible = true;
    } else {
      this.bones.rightShoulder.visible = false;
    }
  }

  private updateJointPosition(boneName: string, landmark: Landmark, isVisible: boolean) {
    if (landmark && landmark.visibility && landmark.visibility > 0.5 && isVisible) {
      const position = this.convertLandmarkToWorldPosition(landmark);
      this.bones[boneName].position.copy(position);
      this.bones[boneName].visible = true;
    } else {
      this.bones[boneName].visible = false;
    }
  }

  private updateLimbPosition(boneName: string, startLandmark: Landmark, endLandmark: Landmark, isVisible: boolean) {
    if (startLandmark && endLandmark && 
        startLandmark.visibility > 0.5 && endLandmark.visibility > 0.5 && isVisible) {
      
      const startPos = this.convertLandmarkToWorldPosition(startLandmark);
      const endPos = this.convertLandmarkToWorldPosition(endLandmark);
      
      const midPos = new THREE.Vector3().addVectors(startPos, endPos).multiplyScalar(0.5);
      this.bones[boneName].position.copy(midPos);
      
      const direction = new THREE.Vector3().subVectors(endPos, startPos);
      const length = direction.length();
      
      this.bones[boneName].scale.y = length / (boneName.includes('Upper') ? 1.1 : 1.1);// scale if needed
      
      this.bones[boneName].lookAt(endPos);
      this.bones[boneName].rotateX(Math.PI / 2);
      
      this.bones[boneName].visible = true;
    } else {
      this.bones[boneName].visible = false;
    }
  }

  private updateHandPositions(landmarks: any) {
    if (landmarks.hands && landmarks.pose) {
      landmarks.hands.forEach((hand: Landmark[], handIndex: number) => {
        const handName = handIndex === 0 ? 'leftHand' : 'rightHand';
        const wristIndex = handIndex === 0 ? 15 : 16;
        const bodyWrist = landmarks.pose[wristIndex];
        
        if (bodyWrist && bodyWrist.visibility > 0.5 && hand.length >= 21) {
          const wristPos = this.convertLandmarkToWorldPosition(bodyWrist);
          this.bones[handName].position.copy(wristPos);
          this.bones[handName].visible = true;
        }
      });
    }
  }

  private createStructuralConnections() {
    this.connections.forEach(connection => this.group.remove(connection));
    this.connections = [];

    const connectionPairs = [
      ['head', 'neck'],
      ['neck', 'leftShoulder'],
      ['neck', 'rightShoulder'],
      ['leftShoulder', 'torso'],
      ['rightShoulder', 'torso'],
      ['leftShoulder', 'rightShoulder'], // Connect shoulders
      ['torso', 'leftHip'],
      ['torso', 'rightHip'],
      ['leftHip', 'rightHip']
    ];

    connectionPairs.forEach(([start, end]) => {
      if (this.bones[start] && this.bones[end] && 
          this.bones[start].visible && this.bones[end].visible) {
        this.createConnection(this.bones[start].position, this.bones[end].position);
      }
    });
  }

  private createConnection(start: THREE.Vector3, end: THREE.Vector3) {
    const geometry = new THREE.BufferGeometry().setFromPoints([start, end]);
    const material = new THREE.LineBasicMaterial({ color: 0x404040, linewidth: 6 });
    const connection = new THREE.LineSegments(geometry, material);
    
    this.connections.push(connection);
    this.group.add(connection);
  }

  public update() {
    this.idleTime += 0.016;

    if (this.idleTime > 5) {
      this.playIdleAnimation();
    }

    this.blinkTimer += 0.016;
    if (this.blinkTimer > 3) {
      this.faceManager.blink();
      this.blinkTimer = 0;
    }
  }

  private playIdleAnimation() {
    const time = Date.now() * 0.001;
    
    if (this.bones.head && this.bones.head.visible) {
      const basePos = this.bones.neck.position.clone();
      basePos.y += 0.35;
      this.bones.head.position.copy(basePos);
      this.bones.head.position.x += Math.sin(time * 0.3) * 0.02;
      this.bones.head.rotation.y = Math.sin(time * 0.3) * 0.05;
    }

    if (this.bones.torso && this.bones.torso.visible) {
      this.bones.torso.scale.y = 1 + Math.sin(time * 2) * 0.02;
    }
  }
}