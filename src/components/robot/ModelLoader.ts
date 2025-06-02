
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export interface LoadedModels {
  head: THREE.Group;
  leftShoulder: THREE.Group;
  rightShoulder: THREE.Group;
  neck: THREE.Group;
  torso: THREE.Group;
  leftUpperArm: THREE.Group;
  rightUpperArm: THREE.Group;
  leftForearm: THREE.Group;
  rightForearm: THREE.Group;
  leftHand: THREE.Group;
  rightHand: THREE.Group;
  leftThigh: THREE.Group;
  rightThigh: THREE.Group;
  leftShin: THREE.Group;
  rightShin: THREE.Group;
}

export class ModelLoader {
  private loader: GLTFLoader;
  private loadedModels: Partial<LoadedModels> = {};

  constructor() {
    this.loader = new GLTFLoader();
  }

  async loadAllModels(): Promise<LoadedModels> {
    const modelPaths = {
    head: '/3D/head.glb',
    neck: '/3D/neck.glb',
    leftShoulder: '/3D/left shoulder.glb',
    rightShoulder: '/3D/right shoulder.glb',
    torso: '/3D/torso.glb',
    leftUpperArm: '/3D/left upper arm.glb',
    rightUpperArm: '/3D/right upper arm.glb',
    leftForearm: '/3D/left fore arm.glb',
    rightForearm: '/3D/right fore arm.glb',
    leftHand:'/3D/leftHand.glb',
    rightHand:'/3D/rightHand.glb',
    leftThigh:'3D/Custom/leftThigh.glb',
    rightThigh:'3D/Custom/rightThigh.glb',
    leftShin:'3D/Custom/leftShin.glb',
    rightShin:'3D/Custom/rightShin.glb'
    };


    const loadPromises = Object.entries(modelPaths).map(async ([key, path]) => {
      try {
        const gltf = await this.loadModel(path);
        const model = gltf.scene.clone();
        
        // Enable shadows for all meshes in the model
        model.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });

        this.loadedModels[key as keyof LoadedModels] = model;
        return { key, model };
      } catch (error) {
        console.warn(`Failed to load model ${path}:`, error);
        // Return null for failed loads, we'll handle fallbacks
        return { key, model: null };
      }
    });

    await Promise.all(loadPromises);

    // Validate that we have all required models
    const requiredModels = [
    'head', 'neck', 'leftShoulder', 'rightShoulder', 'torso',
    'leftUpperArm', 'rightUpperArm', 'leftForearm', 'rightForearm', 
    'leftHand', 'rightHand', 'leftThigh', 'rightThigh', 'leftShin', 'rightShin'
    ];
    const missingModels = requiredModels.filter(key => !this.loadedModels[key as keyof LoadedModels]);
    
    if (missingModels.length > 0) {
      console.warn('Some 3D models failed to load:', missingModels);
    }

    return this.loadedModels as LoadedModels;
  }

  private loadModel(path: string): Promise<any> {
    return new Promise((resolve, reject) => {
      this.loader.load(
        path,
        (gltf) => resolve(gltf),
        (progress) => {
          console.log(`Loading ${path}: ${(progress.loaded / progress.total * 100)}%`);
        },
        (error) => reject(error)
      );
    });
  }

  // Method to create fallback geometry if model loading fails
  createFallbackGeometry(type: string): THREE.BufferGeometry {
    switch (type) {
      case 'head':
        const headGeometry = new THREE.SphereGeometry(0.32, 32, 32);
        headGeometry.scale(1, 1.15, 0.95);
        return headGeometry;
      case 'neck':
        // Articulated neck design
        const neckGeometry = new THREE.CylinderGeometry(0.1, 0.3, 0.15, 16);
        neckGeometry.scale(1, 1.15, 0.95);
        break;
      case 'shoulder':
        const shoulderGeometry = new THREE.SphereGeometry(0.15, 20, 20);
        shoulderGeometry.scale(1.6, 0.7, 1.1);
        return shoulderGeometry;
      case 'torso':
        return new THREE.CapsuleGeometry(0.975, 1.98, 20, 40);
      case 'upperArm':
        return new THREE.CapsuleGeometry(0.10, 0.3, 16, 24);
      case 'forearm':
        return new THREE.CapsuleGeometry(0.09, 0.3, 16, 24);
      case 'hand':
        return new THREE.CapsuleGeometry(0.20, 0.28, 0.10, 12);
      default:
        return new THREE.BoxGeometry(0.2, 0.2, 0.2);
    }
  }
}
