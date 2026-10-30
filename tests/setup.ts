import '@testing-library/jest-dom/vitest';
import 'fake-indexeddb/auto';
import * as tf from '@tensorflow/tfjs';
import { beforeAll } from 'vitest';

beforeAll(async () => {
  // jsdom has no WebGL; use the deterministic CPU backend for model tests.
  await tf.setBackend('cpu');
  await tf.ready();
});

// jsdom does not implement canvas; the overlay drawing code tolerates a null context.
HTMLCanvasElement.prototype.getContext = (() => null) as typeof HTMLCanvasElement.prototype.getContext;
