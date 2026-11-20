// Camera + hand model. The hand model is MediaPipe's "Hand Landmarker" (Google, runs fully in this browser; the camera picture never leaves the computer).
// The library, its WebAssembly and the model file (~8 MB) are fetched from public CDNs only when the person switches AIR CONTROL on, so the rest of the
// app (and the offline standalone file) does not need them. The first time needs internet; the browser then keeps them in its cache.
import type { LM } from './handGestures';

const VERSION = '0.10.21';
const CDN = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VERSION}`;
const MODEL = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

export type HandTracker = {
  /** Landmarks of every hand in the picture (0..1, as the camera sees it, not mirrored). Null when the video has no new picture yet. */
  detect(video: HTMLVideoElement, nowMs: number): LM[][] | null;
  close(): void;
};

type Landmarker = { detectForVideo(v: HTMLVideoElement, t: number): { landmarks: LM[][] }; close(): void };

/** Tests can put their own tracker here (a fake camera has no hands to find). */
declare global { interface Window { __BEATLAB_HAND_MOCK__?: () => Promise<HandTracker> } }

export async function loadHandTracker(onStatus: (text: string) => void): Promise<HandTracker> {
  if (typeof window !== 'undefined' && window.__BEATLAB_HAND_MOCK__) return window.__BEATLAB_HAND_MOCK__();
  onStatus('Loading the hand model (first time ~8 MB, needs internet)…');
  let mod: { FilesetResolver: { forVisionTasks(p: string): Promise<unknown> }; HandLandmarker: { createFromOptions(f: unknown, o: unknown): Promise<Landmarker> } };
  try { mod = await import(/* @vite-ignore */ `${CDN}/vision_bundle.mjs`); }
  catch { throw new Error('Could not download the hand-tracking library. Check your internet connection (it is needed the first time) and try again.'); }
  const fileset = await mod.FilesetResolver.forVisionTasks(`${CDN}/wasm`);
  const make = (delegate: 'GPU' | 'CPU') => mod.HandLandmarker.createFromOptions(fileset, { baseOptions: { modelAssetPath: MODEL, delegate }, runningMode: 'VIDEO', numHands: 2, minHandDetectionConfidence: 0.5, minHandPresenceConfidence: 0.5, minTrackingConfidence: 0.5 });
  let lm: Landmarker;
  try { lm = await make('GPU'); } catch { try { lm = await make('CPU'); } catch { throw new Error('Could not load the hand model. Check your internet connection and try again.'); } }
  let lastVideoTime = -1; let lastTs = 0;
  return {
    detect(video, nowMs) {
      if (video.readyState < 2 || video.videoWidth === 0) return null;
      if (video.currentTime === lastVideoTime) return null;      // no new picture
      lastVideoTime = video.currentTime; lastTs = Math.max(lastTs + 1, Math.round(nowMs));
      return lm.detectForVideo(video, lastTs).landmarks;
    },
    close() { try { lm.close(); } catch { /* already closed */ } }
  };
}

/** The camera. Rejects with a short, human message. */
export async function openCamera(): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) throw new Error('This browser has no camera access here. Camera needs https:// or localhost.');
  try { return await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' }, audio: false }); }
  catch (e) {
    const name = (e as DOMException)?.name;
    if (name === 'NotAllowedError' || name === 'SecurityError') throw new Error('Camera permission was refused. Allow the camera for this page (lock icon next to the address) and switch AIR CONTROL on again.');
    if (name === 'NotFoundError' || name === 'OverconstrainedError') throw new Error('No camera was found on this computer.');
    if (name === 'NotReadableError') throw new Error('The camera is used by another program. Close it there and try again.');
    throw new Error('The camera could not be started.');
  }
}

/** Lines between the 21 points, for drawing the hand skeleton. */
export const HAND_LINES: [number, number][] = [[0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8], [5, 9], [9, 10], [10, 11], [11, 12], [9, 13], [13, 14], [14, 15], [15, 16], [13, 17], [17, 18], [18, 19], [19, 20], [0, 17]];
