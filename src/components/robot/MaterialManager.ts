import * as THREE from 'three';

export interface RobotMaterials {
  body: THREE.Material;
  joint: THREE.Material;
  hand: THREE.Material;
  face: THREE.Material;
  eye: THREE.Material;
  neck: THREE.Material;
  fingerLandmark: THREE.Material;
  panelLines: THREE.Material;
  energyGlow: THREE.Material;
  jointSocket: THREE.Material;
  limbSegment: THREE.Material;
}

export class MaterialManager {
  public materials: RobotMaterials;

  constructor() {
    this.materials = this.createMaterials();
  }

  private createMaterials(): RobotMaterials {
    return {
      // Enhanced body material with robotic plating appearance
      body: new THREE.MeshPhysicalMaterial({
        color: 0xf8f8f8,
        metalness: 0.2,
        roughness: 0.3,
        clearcoat: 0.8,
        clearcoatRoughness: 0.1,
        transparent: true,
        opacity: 0.98,
        envMapIntensity: 1.0
      }),
      
      // Articulated joint material with metallic finish
      joint: new THREE.MeshPhysicalMaterial({
        color: 0x707070,
        metalness: 0.9,
        roughness: 0.15,
        clearcoat: 0.6,
        clearcoatRoughness: 0.05,
        envMapIntensity: 1.2
      }),
      
      // Keep existing hand material unchanged as requested
      hand: new THREE.MeshPhysicalMaterial({
        color: 0xe8e8e8,
        metalness: 0.2,
        roughness: 0.6,
        clearcoat: 0.05
      }),
      
      // Enhanced face material for futuristic appearance
      face: new THREE.MeshPhysicalMaterial({
        color: 0xfafafa,
        metalness: 0.05,
        roughness: 0.4,
        clearcoat: 0.7,
        clearcoatRoughness: 0.1,
        envMapIntensity: 0.8
      }),
      
      // Enhanced eye material with glow
      eye: new THREE.MeshPhysicalMaterial({
        color: 0x00aaff,
        emissive: 0x003366,
        emissiveIntensity: 0.3,
        metalness: 0.1,
        roughness: 0.2,
        clearcoat: 1.0,
        clearcoatRoughness: 0.1
      }),
      
      // Enhanced neck material with engineering details
      neck: new THREE.MeshPhysicalMaterial({
        color: 0x909090,
        metalness: 0.7,
        roughness: 0.25,
        clearcoat: 0.5,
        clearcoatRoughness: 0.1,
        envMapIntensity: 1.1
      }),
      
      // Keep existing finger landmark material unchanged
      fingerLandmark: new THREE.MeshBasicMaterial({ 
        color: 0xf0f0f0
      }),
      
      // Enhanced panel lines material for surface details
      panelLines: new THREE.MeshPhysicalMaterial({
        color: 0x505050,
        metalness: 0.8,
        roughness: 0.3,
        clearcoat: 0.3
      }),
      
      // Energy glow material for LED-like accents
      energyGlow: new THREE.MeshPhysicalMaterial({
        color: 0x00ccff,
        emissive: 0x0088cc,
        emissiveIntensity: 0.4,
        transparent: true,
        opacity: 0.7,
        metalness: 0.1,
        roughness: 0.2
      }),

      // New joint socket material for shoulder/hip connections
      jointSocket: new THREE.MeshPhysicalMaterial({
        color: 0x606060,
        metalness: 0.95,
        roughness: 0.1,
        clearcoat: 0.8,
        clearcoatRoughness: 0.05,
        envMapIntensity: 1.3
      }),

      // Enhanced limb segment material with subtle variation
      limbSegment: new THREE.MeshPhysicalMaterial({
        color: 0xf5f5f5,
        metalness: 0.15,
        roughness: 0.35,
        clearcoat: 0.7,
        clearcoatRoughness: 0.15,
        envMapIntensity: 0.9
      })
    };
  }
}
