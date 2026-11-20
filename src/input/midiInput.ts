// The browser side of MIDI keyboards (Web MIDI: Chrome, Edge and other Chromium browsers; not Firefox / Safari).
import { MidiMsg, parseMidiMessage } from './midiLive';

export type MidiDevice = { id: string; name: string };
export type MidiConnection = { select: (id: string) => void; dispose: () => void };
export const midiSupported = (): boolean => typeof navigator !== 'undefined' && typeof (navigator as Navigator & { requestMIDIAccess?: unknown }).requestMIDIAccess === 'function';

/** Asks the browser for MIDI access (must be called from a click). `id` 'all' listens to every keyboard. */
export async function openMidi(onMsg: (m: MidiMsg) => void, onDevices: (d: MidiDevice[]) => void): Promise<MidiConnection> {
  if (!midiSupported()) throw new Error('This browser has no MIDI support. Use Chrome or Edge on a computer.');
  let access: MIDIAccess;
  try { access = await navigator.requestMIDIAccess({ sysex: false }); }
  catch { throw new Error('MIDI access was not allowed. Allow it in the browser and try again.'); }
  let selected = 'all';
  const wire = () => {
    const list: MidiDevice[] = [];
    access.inputs.forEach(input => {
      list.push({ id: input.id, name: input.name || 'MIDI input' });
      input.onmidimessage = e => { if (e.data && (selected === 'all' || selected === input.id)) onMsg(parseMidiMessage(e.data)); };
    });
    onDevices(list);
  };
  access.onstatechange = wire;
  wire();
  return {
    select: id => { selected = id; },
    dispose: () => { access.onstatechange = null; access.inputs.forEach(i => { i.onmidimessage = null; }); }
  };
}
