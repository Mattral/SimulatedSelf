
// Animation durations
export const DURATIONS = {
  FAST: 200,
  MEDIUM: 500,
  SLOW: 800,
};

// Animation easings
export const EASINGS = {
  LINEAR: "linear",
  EASE: "ease",
  EASE_IN: "ease-in",
  EASE_OUT: "ease-out",
  EASE_IN_OUT: "ease-in-out",
};

// Animation delays
export const DELAYS = {
  NONE: 0,
  SHORT: 100,
  MEDIUM: 300,
  LONG: 600,
};

// Common animation variants
export const VARIANTS = {
  FADE_IN: {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { duration: DURATIONS.MEDIUM / 1000 } },
  },
  SCALE_IN: {
    hidden: { opacity: 0, scale: 0.9 },
    visible: { 
      opacity: 1, 
      scale: 1, 
      transition: { duration: DURATIONS.MEDIUM / 1000 } 
    },
  },
  SLIDE_UP: {
    hidden: { opacity: 0, y: 20 },
    visible: { 
      opacity: 1, 
      y: 0, 
      transition: { duration: DURATIONS.MEDIUM / 1000 } 
    },
  },
  SLIDE_DOWN: {
    hidden: { opacity: 0, y: -20 },
    visible: { 
      opacity: 1, 
      y: 0, 
      transition: { duration: DURATIONS.MEDIUM / 1000 } 
    },
  },
  SLIDE_LEFT: {
    hidden: { opacity: 0, x: 50 },
    visible: { 
      opacity: 1, 
      x: 0, 
      transition: { duration: DURATIONS.MEDIUM / 1000 } 
    },
  },
  SLIDE_RIGHT: {
    hidden: { opacity: 0, x: -50 },
    visible: { 
      opacity: 1, 
      x: 0, 
      transition: { duration: DURATIONS.MEDIUM / 1000 } 
    },
  },
  STAGGER_CHILDREN: {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  },
};

// Helper function to stagger animations
export const createStaggerVariants = (
  childVariant: any,
  staggerTime: number = 0.1
) => {
  return {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: staggerTime,
      },
    },
    child: childVariant,
  };
};
