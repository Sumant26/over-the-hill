import * as THREE from 'three';

export interface SurfaceProperties {
  name: string;
  friction: number;
  sinkDepth: number; // Max tire sink in meters
  dragMultiplier: number;
  color: THREE.Color;
}

export const SURFACE_TYPES: Record<string, SurfaceProperties> = {
  ROCK: {
    name: 'rock',
    friction: 1.0,
    sinkDepth: 0.0,
    dragMultiplier: 1.0,
    color: new THREE.Color('#787c88') // Warm mountain slate gray
  },
  DIRT: {
    name: 'dirt',
    friction: 0.8,
    sinkDepth: 0.03,
    dragMultiplier: 1.1,
    color: new THREE.Color('#6c4e36') // Warm earthy trail loam
  },
  GRASS: {
    name: 'grass',
    friction: 0.75,
    sinkDepth: 0.02,
    dragMultiplier: 1.15,
    color: new THREE.Color('#ecc044') // Radiant golden alpine wheat / amber grass
  },
  MUD: {
    name: 'mud',
    friction: 0.35,
    sinkDepth: 0.18,
    dragMultiplier: 2.8,
    color: new THREE.Color('#463222') // Damp silt mud bog
  },
  WATER: {
    name: 'water',
    friction: 0.2,
    sinkDepth: 0.4,
    dragMultiplier: 4.0,
    color: new THREE.Color('#2d6d8f') // Alpine glacial mountain lake
  }
};
