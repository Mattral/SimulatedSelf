import React, { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import * as THREE from 'three';
import { SkeletonRenderer } from './SkeletonRenderer';

interface Scene3DProps {
  className?: string;
  isHumanoidMode?: boolean;
}

export const Scene3D = forwardRef<any, Scene3DProps>(({ className, isHumanoidMode = false }, ref) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene>();
  const rendererRef = useRef<THREE.WebGLRenderer>();
  const cameraRef = useRef<THREE.PerspectiveCamera>();
  const skeletonRef = useRef<SkeletonRenderer>();
  const animationFrameRef = useRef<number>();
  
  // Camera control state
  const cameraControlsRef = useRef({
    isRotating: false,
    previousMouseX: 0,
    previousMouseY: 0,
    rotationX: 0,
    rotationY: 0,
    targetRotationX: 0,
    targetRotationY: 0,
    distance: 11,
    targetDistance: 11,
    center: new THREE.Vector3(0, 0, 0)
  });

  useImperativeHandle(ref, () => ({
    updateSkeletonPose: (landmarks: any) => {
      if (skeletonRef.current) {
        skeletonRef.current.updatePose(landmarks);
      }
    },
    setHumanoidMode: (isHumanoid: boolean) => {
      if (skeletonRef.current) {
        skeletonRef.current.setHumanoidMode(isHumanoid);
      }
    },
    updateEmotion: (emotion: string) => {
      if (skeletonRef.current) {
        skeletonRef.current.updateEmotion(emotion);
      }
    }
  }));

  // Update humanoid mode when prop changes
  useEffect(() => {
    if (skeletonRef.current) {
      skeletonRef.current.setHumanoidMode(isHumanoidMode);
    }
  }, [isHumanoidMode]);

  useEffect(() => {
    if (!mountRef.current) return;

    const mount = mountRef.current;
    const controls = cameraControlsRef.current;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x222222);
    scene.fog = new THREE.Fog(0x0a0a0a, 10, 50);
    
    const camera = new THREE.PerspectiveCamera(60, mount.clientWidth / mount.clientHeight, 0.1, 100);
    
    const renderer = new THREE.WebGLRenderer({ 
      antialias: true, 
      alpha: true,
      powerPreference: "high-performance"
    });
    
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.5;
    
    mount.appendChild(renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);

    const mainLight = new THREE.DirectionalLight(0xffffff, 2.0);
    mainLight.position.set(5, 10, 5);
    mainLight.castShadow = true;
    mainLight.shadow.mapSize.width = 2048;
    mainLight.shadow.mapSize.height = 2048;
    mainLight.shadow.camera.near = 0.5;
    mainLight.shadow.camera.far = 50;
    scene.add(mainLight);

    const fillLight = new THREE.DirectionalLight(0x4444ff, 0.3);
    fillLight.position.set(-5, 5, -5);
    scene.add(fillLight);

    const backLight = new THREE.DirectionalLight(0xffffff, 0.2);
    backLight.position.set(0, 3, -10);
    scene.add(backLight);

    const gridHelper = new THREE.GridHelper(10, 20, 0x333333, 0x111111);
    gridHelper.position.y = -2;
    gridHelper.material.transparent = true;
    gridHelper.material.opacity = 0.5;
    scene.add(gridHelper);

    const axesHelper = new THREE.AxesHelper(1);
    axesHelper.position.set(-4, -1.8, 0);
    scene.add(axesHelper);

    const groundGeometry = new THREE.PlaneGeometry(20, 20);
    const groundMaterial = new THREE.MeshLambertMaterial({ 
      color: 0x1a1a1a,
      transparent: true,
      opacity: 0.3
    });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -2.01;
    ground.receiveShadow = true;
    scene.add(ground);

    const skeleton = new SkeletonRenderer();
    skeleton.setHumanoidMode(isHumanoidMode);
    scene.add(skeleton.group);

    camera.position.set(0, 1, controls.distance);
    camera.lookAt(controls.center);

    const handleMouseDown = (event: MouseEvent) => {
      event.preventDefault();
      controls.isRotating = true;
      controls.previousMouseX = event.clientX;
      controls.previousMouseY = event.clientY;
      mount.style.cursor = 'grabbing';
    };

    const handleMouseMove = (event: MouseEvent) => {
      if (!controls.isRotating) return;
      
      const deltaX = event.clientX - controls.previousMouseX;
      const deltaY = event.clientY - controls.previousMouseY;
      
      controls.targetRotationY -= deltaX * 0.005;
      controls.targetRotationX -= deltaY * 0.005;
      controls.targetRotationX = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, controls.targetRotationX));
      
      controls.previousMouseX = event.clientX;
      controls.previousMouseY = event.clientY;
    };

    const handleMouseUp = () => {
      controls.isRotating = false;
      mount.style.cursor = 'grab';
    };

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      
      const zoomSpeed = 0.1;
      const delta = event.deltaY > 0 ? 1 : -1;
      
      controls.targetDistance += delta * zoomSpeed;
      controls.targetDistance = Math.max(2, Math.min(15, controls.targetDistance));
    };

    const handleTouchStart = (event: TouchEvent) => {
      if (event.touches.length === 1) {
        event.preventDefault();
        controls.isRotating = true;
        controls.previousMouseX = event.touches[0].clientX;
        controls.previousMouseY = event.touches[0].clientY;
      }
    };

    const handleTouchMove = (event: TouchEvent) => {
      if (event.touches.length === 1 && controls.isRotating) {
        event.preventDefault();
        const deltaX = event.touches[0].clientX - controls.previousMouseX;
        const deltaY = event.touches[0].clientY - controls.previousMouseY;
        
        controls.targetRotationY -= deltaX * 0.005;
        controls.targetRotationX -= deltaY * 0.005;
        controls.targetRotationX = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, controls.targetRotationX));
        
        controls.previousMouseX = event.touches[0].clientX;
        controls.previousMouseY = event.touches[0].clientY;
      }
    };

    const handleTouchEnd = () => {
      controls.isRotating = false;
    };

    mount.addEventListener('mousedown', handleMouseDown);
    mount.addEventListener('mousemove', handleMouseMove);
    mount.addEventListener('mouseup', handleMouseUp);
    mount.addEventListener('wheel', handleWheel, { passive: false });
    mount.addEventListener('touchstart', handleTouchStart, { passive: false });
    mount.addEventListener('touchmove', handleTouchMove, { passive: false });
    mount.addEventListener('touchend', handleTouchEnd);
    
    mount.style.cursor = 'grab';

    const animate = () => {
      animationFrameRef.current = requestAnimationFrame(animate);

      const lerp = (start: number, end: number, factor: number) => {
        return start + (end - start) * factor;
      };

      controls.rotationX = lerp(controls.rotationX, controls.targetRotationX, 0.1);
      controls.rotationY = lerp(controls.rotationY, controls.targetRotationY, 0.1);
      controls.distance = lerp(controls.distance, controls.targetDistance, 0.1);

      const x = controls.center.x + Math.sin(controls.rotationY) * Math.cos(controls.rotationX) * controls.distance;
      const y = controls.center.y + Math.sin(controls.rotationX) * controls.distance + 1;
      const z = controls.center.z + Math.cos(controls.rotationY) * Math.cos(controls.rotationX) * controls.distance;

      camera.position.set(x, y, z);
      camera.lookAt(controls.center);

      skeleton.update();

      renderer.render(scene, camera);
    };

    const handleResize = () => {
      const width = mount.clientWidth;
      const height = mount.clientHeight;
      
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(mount);

    sceneRef.current = scene;
    rendererRef.current = renderer;
    cameraRef.current = camera;
    skeletonRef.current = skeleton;

    animate();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      
      resizeObserver.disconnect();
      
      mount.removeEventListener('mousedown', handleMouseDown);
      mount.removeEventListener('mousemove', handleMouseMove);
      mount.removeEventListener('mouseup', handleMouseUp);
      mount.removeEventListener('wheel', handleWheel);
      mount.removeEventListener('touchstart', handleTouchStart);
      mount.removeEventListener('touchmove', handleTouchMove);
      mount.removeEventListener('touchend', handleTouchEnd);
      
      if (mount.contains(renderer.domElement)) {
        mount.removeChild(renderer.domElement);
      }
      
      renderer.dispose();
      scene.clear();
    };
  }, [isHumanoidMode]);

  return <div ref={mountRef} className={className} />;
});

Scene3D.displayName = 'Scene3D';
