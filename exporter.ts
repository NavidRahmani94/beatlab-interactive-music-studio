import * as Tone from 'tone';
import { Rig } from './rig';
import { frameAt, usedBars } from './song';
import { BeatLabProject } from './project';
import { encodeWav } from './wav';
import { encodeMp3 } from './mp3';
import { STEPS } from './pattern';
import { MasterSettings, REVERB_SIZES } from './mixer';

export const EXPORT_SAMPLE_RATE = 44100;
export const EXPORT_MIN_TAIL_SECONDS = 3; // lets reverb/delay tails ring out
export const EXPORT_LEAD_IN = 0.05;       // tiny silence before the first hit

export const EXPORT_FORMATS = {
  wav16: { label: 'WAV 16-bit (CD quality)', ext: 'wav', mime: 'audio/wav', detail: '44.1 kHz stereo 16-bit' },
  wav24: { label: 'WAV 24-bit (studio)', ext: 'wav', mime: 'audio/wav', detail: '44.1 kHz stereo 24-bit' },
  mp3_192: { label: 'MP3 192 kbps (small)', ext: 'mp3', mime: 'audio/mpeg', detail: 'MP3 192 kbps stereo' },
  mp3_320: { label: 'MP3 320 kbps (best MP3)', ext: 'mp3', mime: 'audio/mpeg', detail: 'MP3 320 kbps stereo' }
} as const;
export type ExportFormat = keyof typeof EXPORT_FORMATS;
export const isExportFormat = (v: unknown): v is ExportFormat => typeof v === 'string' && Object.prototype.hasOwnProperty.call(EXPORT_FORMATS, v);

export type ExportResult = { blob: Blob; seconds: number; loops: number; bars: number; format: ExportFormat; ext: string; detail: string };
export type ExportOptions = { mode: 'song' | 'pattern'; pattern: number; format?: ExportFormat };

/** Turns rendered audio into the bytes of the chosen file format. */
export function encodeAudio(channels: Float32Array[], sampleRate: number, format: ExportFormat): Blob {
  const f = EXPORT_FORMATS[format];
  switch (format) {
    case 'wav16': return new Blob([encodeWav(channels, sampleRate, 16)], { type: f.mime });
    case 'wav24': return new Blob([encodeWav(channels, sampleRate, 24)], { type: f.mime });
    case 'mp3_192': return new Blob([encodeMp3(channels, sampleRate, 192)], { type: f.mime });
    case 'mp3_320': return new Blob([encodeMp3(channels, sampleRate, 320)], { type: f.mime });
  }
}

/** Longer master reverb -> longer tail, so the end of the file is never cut off. */
export function exportTailSeconds(master: MasterSettings): number {
  return master.reverbMix > 0 ? Math.max(EXPORT_MIN_TAIL_SECONDS, REVERB_SIZES[master.reverbSize].seconds + 1.5) : EXPORT_MIN_TAIL_SECONDS;
}

/** Length of the WAV for a number of bars (one bar = 16 steps). */
export function exportDurationSeconds(bpm: number, bars: number, tailSeconds = EXPORT_MIN_TAIL_SECONDS): number {
  return EXPORT_LEAD_IN + bars * STEPS * (60 / bpm / 4) + tailSeconds;
}

/**
 * Renders the project offline (faster than real time) with the SAME Rig as live playback and the same
 * Transport-driven step scheduling, then encodes real 16-bit stereo PCM WAV.
 * (Hits are triggered at the moment they are due, exactly like live — pre-scheduling every hit up front
 * makes Tone.MetalSynth throw "Start time must be strictly greater than previous start time".)
 */
export async function renderProjectToWav(project: BeatLabProject, loops: number, options: ExportOptions = { mode: 'song', pattern: 0, format: 'wav16' }): Promise<ExportResult> {
  const stepSeconds = 60 / project.bpm / 4;
  // SONG: the playlist up to its last used bar, repeated `loops` times. PATTERN: the chosen pattern for `loops` bars.
  const playlist = project.playlist.slice(0, usedBars(project.playlist));
  const bars = options.mode === 'song' ? playlist.length * loops : loops;
  const totalSteps = bars * STEPS;
  const seconds = exportDurationSeconds(project.bpm, bars, exportTailSeconds(project.master));

  const buffer = await Tone.Offline(async ({ transport }) => {
    const rig = new Rig();
    rig.setSynths(project.synths);
    rig.setDrumKit(project.drumKit);
    rig.setGroove(project.groove);
    rig.setTracks(project.tracks);
    rig.setMaster(project.master);
    rig.setChannels(project.channels);
    rig.setTempo(project.bpm);
    await rig.ready();
    transport.bpm.value = project.bpm;
    let count = 0;
    transport.scheduleRepeat(time => {
      if (count >= totalSteps) return;
      const frame = frameAt(count, playlist, options.mode, options.pattern);
      const pattern = frame.pattern === null ? null : project.patterns[frame.pattern] ?? null;
      rig.triggerStep(frame.step, time, pattern, count, stepSeconds);
      count++;
    }, '16n', 0, totalSteps * stepSeconds);
    transport.start(EXPORT_LEAD_IN);
  }, seconds, 2, EXPORT_SAMPLE_RATE);

  const audio = buffer.get();
  if (!audio) throw new Error('The browser did not return rendered audio.');
  const format = options.format ?? 'wav16';
  const blob = encodeAudio([audio.getChannelData(0), audio.getChannelData(1)], audio.sampleRate, format);
  return { blob, seconds, loops, bars, format, ext: EXPORT_FORMATS[format].ext, detail: EXPORT_FORMATS[format].detail };
}
