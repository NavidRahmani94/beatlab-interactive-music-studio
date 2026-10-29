import * as Tone from 'tone';
import { Rig, groupMelodyByStep } from './rig';
import { BeatLabProject } from './project';
import { encodeWav } from './wav';
import { STEPS } from './pattern';
import { MasterSettings, REVERB_SIZES } from './mixer';

export const EXPORT_SAMPLE_RATE = 44100;
export const EXPORT_MIN_TAIL_SECONDS = 3; // lets reverb/delay tails ring out
export const EXPORT_LEAD_IN = 0.05;       // tiny silence before the first hit

export type ExportResult = { blob: Blob; seconds: number; loops: number };

/** Longer master reverb -> longer tail, so the end of the file is never cut off. */
export function exportTailSeconds(master: MasterSettings): number {
  return master.reverbMix > 0 ? Math.max(EXPORT_MIN_TAIL_SECONDS, REVERB_SIZES[master.reverbSize].seconds + 1.5) : EXPORT_MIN_TAIL_SECONDS;
}

export function exportDurationSeconds(bpm: number, loops: number, tailSeconds = EXPORT_MIN_TAIL_SECONDS): number {
  return EXPORT_LEAD_IN + loops * STEPS * (60 / bpm / 4) + tailSeconds;
}

/**
 * Renders the project offline (faster than real time) with the SAME Rig as live playback and the same
 * Transport-driven step scheduling, then encodes real 16-bit stereo PCM WAV.
 * (Hits are triggered at the moment they are due, exactly like live — pre-scheduling every hit up front
 * makes Tone.MetalSynth throw "Start time must be strictly greater than previous start time".)
 */
export async function renderProjectToWav(project: BeatLabProject, loops: number): Promise<ExportResult> {
  const stepSeconds = 60 / project.bpm / 4;
  const totalSteps = loops * STEPS;
  const seconds = exportDurationSeconds(project.bpm, loops, exportTailSeconds(project.master));
  const melodyByStep = groupMelodyByStep(project.melody);

  const buffer = await Tone.Offline(async ({ transport }) => {
    const rig = new Rig();
    rig.setDrumKit(project.drumKit);
    rig.setMelodyInstrument(project.melodyInstrument);
    rig.setMaster(project.master);
    rig.setChannels(project.channels);
    rig.setTempo(project.bpm);
    await rig.ready();
    transport.bpm.value = project.bpm;
    let count = 0;
    transport.scheduleRepeat(time => {
      if (count >= totalSteps) return;
      rig.triggerStep(count % STEPS, time, project.drums, melodyByStep, stepSeconds);
      count++;
    }, '16n', 0, totalSteps * stepSeconds);
    transport.start(EXPORT_LEAD_IN);
  }, seconds, 2, EXPORT_SAMPLE_RATE);

  const audio = buffer.get();
  if (!audio) throw new Error('The browser did not return rendered audio.');
  const wav = encodeWav([audio.getChannelData(0), audio.getChannelData(1)], audio.sampleRate);
  return { blob: new Blob([wav], { type: 'audio/wav' }), seconds, loops };
}
