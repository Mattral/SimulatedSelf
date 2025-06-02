
import { Landmark } from '../../hooks/usePoseDetection';

export interface VisibilityState {
  head: boolean;
  neck: boolean;
  leftShoulder: boolean;
  rightShoulder: boolean;
  torso: boolean;
  leftArm: boolean;
  rightArm: boolean;
  leftLeg: boolean;
  rightLeg: boolean;
  leftHand: boolean;
  rightHand: boolean;
}

export class VisibilityManager {
  private readonly CONFIDENCE_THRESHOLD = 0.5;

  public calculateVisibility(pose: Landmark[]): VisibilityState {
    if (!pose || pose.length < 33) {
      return this.getDefaultHiddenState();
    }

    const leftShoulderVisible = this.isVisible(pose[11]);
    const rightShoulderVisible = this.isVisible(pose[12]);
    const neckVisible = leftShoulderVisible || rightShoulderVisible;

    return {
      head: this.isVisible(pose[0]) || this.isVisible(pose[9]) || this.isVisible(pose[10]),
      neck: neckVisible,
      leftShoulder: leftShoulderVisible,
      rightShoulder: rightShoulderVisible,
      torso: this.isVisible(pose[11]) && this.isVisible(pose[12]) && 
             this.isVisible(pose[23]) && this.isVisible(pose[24]),
      leftArm: this.isVisible(pose[11]) && this.isVisible(pose[13]),
      rightArm: this.isVisible(pose[12]) && this.isVisible(pose[14]),
      leftLeg: this.isVisible(pose[23]) && this.isVisible(pose[25]),
      rightLeg: this.isVisible(pose[24]) && this.isVisible(pose[26]),
      leftHand: this.isVisible(pose[15]),
      rightHand: this.isVisible(pose[16])
    };
  }

  private isVisible(landmark: Landmark): boolean {
    return landmark && landmark.visibility !== undefined && 
           landmark.visibility > this.CONFIDENCE_THRESHOLD;
  }

  private getDefaultHiddenState(): VisibilityState {
    return {
      head: false,
      neck: false,
      leftShoulder: false,
      rightShoulder: false,
      torso: false,
      leftArm: false,
      rightArm: false,
      leftLeg: false,
      rightLeg: false,
      leftHand: false,
      rightHand: false
    };
  }
}
