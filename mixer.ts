export const CHANNEL_NAMES = ['kick', 'snare', 'hat', 'clap', 'melody'] as const;
export type ChannelName = typeof CHANNEL_NAMES[number];
export type ChannelSettings = { volumeDb: number; muted: boolean; solo: boolean; pan: number; reverbSend: number; delaySend: number };
export type Channels = Record<ChannelName, ChannelSettings>;

export const VOLUME_MIN_DB = -40;
export const VOLUME_MAX_DB = 6;
export const MAX_FEEDBACK = 0.9;

export const CHANNEL_LABELS: Record<ChannelName, string> = { kick: 'KICK', snare: 'SNARE', hat: 'HI-HAT', clap: 'CLAP', melody: 'MELODY' };

export function defaultChannels(): Channels {
  const base = (): ChannelSettings => ({ volumeDb: 0, muted: false, solo: false, pan: 0, reverbSend: 0, delaySend: 0 });
  return {
    kick: base(),
    snare: { ...base(), pan: -0.1 },
    hat: { ...base(), pan: 0.25 },
    clap: { ...base(), pan: -0.2, reverbSend: 0.2 },
    melody: { ...base(), reverbSend: 0.2, delaySend: 0.15 }
  };
}

// ---------- small clamping helpers (NaN-safe) ----------
export function clampVolumeDb(value: number): number {
  return Number.isFinite(value) ? Math.max(VOLUME_MIN_DB, Math.min(VOLUME_MAX_DB, Math.round(value))) : 0;
}
export function clampSend(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.min(1, Math.round(value * 100) / 100)) : 0;
}
export function clampPan(value: number): number {
  return Number.isFinite(value) ? Math.max(-1, Math.min(1, Math.round(value * 100) / 100)) : 0;
}
export function clampFeedback(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.min(MAX_FEEDBACK, Math.round(value * 100) / 100)) : 0;
}

/** Returns a new Channels object with one channel patched (values are clamped). */
export function patchChannel(channels: Channels, name: ChannelName, patch: Partial<ChannelSettings>): Channels {
  const c = channels[name];
  return {
    ...channels,
    [name]: {
      volumeDb: patch.volumeDb === undefined ? c.volumeDb : clampVolumeDb(patch.volumeDb),
      muted: patch.muted === undefined ? c.muted : patch.muted,
      solo: patch.solo === undefined ? c.solo : patch.solo,
      pan: patch.pan === undefined ? c.pan : clampPan(patch.pan),
      reverbSend: patch.reverbSend === undefined ? c.reverbSend : clampSend(patch.reverbSend),
      delaySend: patch.delaySend === undefined ? c.delaySend : clampSend(patch.delaySend)
    }
  };
}

/** A channel is silent when it is muted, or when ANOTHER channel is soloed. */
export function effectiveMuted(channels: Channels, name: ChannelName): boolean {
  const anySolo = CHANNEL_NAMES.some(n => channels[n].solo);
  return channels[name].muted || (anySolo && !channels[name].solo);
}

// ---------- master bus ----------
const own = (obj: object, key: unknown): key is string => typeof key === 'string' && Object.prototype.hasOwnProperty.call(obj, key);

export const REVERB_SIZES = {
  room: { label: 'Room', seconds: 1.5 },
  hall: { label: 'Hall', seconds: 3 },
  cathedral: { label: 'Cathedral', seconds: 7 }
} as const;
export type ReverbSize = keyof typeof REVERB_SIZES;
export const isReverbSize = (v: unknown): v is ReverbSize => own(REVERB_SIZES, v);

export const DELAY_DIVISIONS = {
  sixteenth: { label: '1/16', beats: 0.25 },
  eighth: { label: '1/8', beats: 0.5 },
  dottedEighth: { label: 'Dotted 1/8', beats: 0.75 },
  quarter: { label: '1/4', beats: 1 }
} as const;
export type DelayDivision = keyof typeof DELAY_DIVISIONS;
export const isDelayDivision = (v: unknown): v is DelayDivision => own(DELAY_DIVISIONS, v);

export type MasterSettings = {
  volumeDb: number;            // overall level
  reverbMix: number;           // 0..1: how much master reverb is blended into the whole mix
  reverbSize: ReverbSize;      // room / hall / cathedral
  delayDivision: DelayDivision;// echo time (tempo-synced) used by the per-channel delay sends
  delayFeedback: number;       // 0..MAX_FEEDBACK: number of repeats
};

export function defaultMaster(): MasterSettings {
  return { volumeDb: 0, reverbMix: 0.12, reverbSize: 'hall', delayDivision: 'dottedEighth', delayFeedback: 0.35 };
}

export function patchMaster(master: MasterSettings, patch: Partial<MasterSettings>): MasterSettings {
  return {
    volumeDb: patch.volumeDb === undefined ? master.volumeDb : clampVolumeDb(patch.volumeDb),
    reverbMix: patch.reverbMix === undefined ? master.reverbMix : clampSend(patch.reverbMix),
    reverbSize: patch.reverbSize === undefined ? master.reverbSize : isReverbSize(patch.reverbSize) ? patch.reverbSize : master.reverbSize,
    delayDivision: patch.delayDivision === undefined ? master.delayDivision : isDelayDivision(patch.delayDivision) ? patch.delayDivision : master.delayDivision,
    delayFeedback: patch.delayFeedback === undefined ? master.delayFeedback : clampFeedback(patch.delayFeedback)
  };
}

/** Echo time in seconds for a tempo. */
export function delaySeconds(bpm: number, division: DelayDivision): number { return (60 / bpm) * DELAY_DIVISIONS[division].beats; }
