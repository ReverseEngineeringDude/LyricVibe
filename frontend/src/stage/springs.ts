export interface SpringConfig {
  stiffness: number;
  damping: number;
  mass?: number;
}

export const SPRINGS = {
  // Ultra-smooth critically damped scroll spring
  scroll: { stiffness: 160, damping: 24, mass: 1 },
  // Fast snappy spring when user seeks
  seek: { stiffness: 320, damping: 30, mass: 1 },
  // Active lyric line scale up/down spring
  scale: { stiffness: 220, damping: 25, mass: 1 },
  // Line opacity transition spring
  opacity: { stiffness: 180, damping: 22, mass: 1 },
};

/**
 * Steps a 1D spring forward by dt seconds using semi-implicit Euler integration.
 * Clamps dt to prevent numerical explosion during background tab freezes.
 */
export function stepSpring(
  current: number,
  target: number,
  velocity: number,
  config: SpringConfig,
  dt: number
): [number, number] {
  // Cap max dt to 0.05s (20fps minimum) to prevent explosion on tab resume
  const clampedDt = Math.min(dt, 0.05);

  const mass = config.mass || 1.0;
  const displacement = current - target;
  const springForce = -config.stiffness * displacement;
  const dampingForce = -config.damping * velocity;
  const acceleration = (springForce + dampingForce) / mass;

  const nextVelocity = velocity + acceleration * clampedDt;
  const nextPosition = current + nextVelocity * clampedDt;

  // Settle threshold to avoid micro-jitter
  if (Math.abs(nextPosition - target) < 0.001 && Math.abs(nextVelocity) < 0.005) {
    return [target, 0];
  }

  return [nextPosition, nextVelocity];
}
