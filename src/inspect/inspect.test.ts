import { describe, it, expect } from 'vitest';
import { transformSync } from '@babel/core';
import { parseSrc, folderOf, folderInfo, splitHandlers, labelOf, FOLDER_INFO } from './inspectInfo';
import { buildGraph, inspectBabel } from '../../vite-plugins/inspect.mjs';

const run = (code: string, file = '/x/src/ui/Demo.tsx') => transformSync(code, { filename: file, babelrc: false, configFile: false, plugins: [inspectBabel()], parserOpts: { plugins: ['jsx', 'typescript'] } })!.code!;

describe('inspect helpers', () => {
  it('reads file and line', () => {
    expect(parseSrc('ui/PianoRoll.tsx:120')).toEqual({ file: 'ui/PianoRoll.tsx', line: 120 });
    expect(parseSrc('App.tsx:7')).toEqual({ file: 'App.tsx', line: 7 });
    expect(parseSrc(null)).toBeNull(); expect(parseSrc('nocolon')).toBeNull(); expect(parseSrc('a.tsx:x')).toBeNull();
  });
  it('names folders', () => {
    expect(folderOf('ui/Timeline.tsx')).toBe('ui'); expect(folderOf('App.tsx')).toBe('');
    for (const f of ['audio', 'music', 'project', 'input', 'export', 'shape', 'ui', 'styles', '']) expect(FOLDER_INFO[f].length).toBeGreaterThan(10);
    expect(folderInfo('audio/rig.ts')).toMatch(/Sound/);
  });
  it('splits handlers and labels elements', () => {
    expect(splitHandlers('onClick={play} | onChange={x}')).toEqual(['onClick={play}', 'onChange={x}']); expect(splitHandlers(null)).toEqual([]);
    const el = { tagName: 'BUTTON', getAttribute: (n: string) => (n === 'aria-label' ? 'Play (quick)' : null), textContent: 'x' };
    expect(labelOf(el)).toBe('button "Play (quick)"');
  });
});

describe('inspect babel plugin', () => {
  it('marks page elements with file and line, and their handlers', () => {
    const out = run('export const A = () => <div>\n<button onClick={() => play()} className="x">go</button></div>;');
    expect(out).toContain('data-src="ui/Demo.tsx:1"'); expect(out).toContain('data-src="ui/Demo.tsx:2"');
    expect(out).toContain('data-on="onClick={() => play()}"');
  });
  it('leaves components, tests and the inspect code alone', () => {
    expect(run('export const A = () => <Panel a={1} />;')).not.toContain('data-src');
    expect(run('export const A = () => <div />;', '/x/src/ui/a.test.tsx')).not.toContain('data-src');
    expect(run('export const A = () => <div />;', '/x/src/inspect/Inspector.tsx')).not.toContain('data-src');
    expect(run('export const A = () => <div />;', '/x/node_modules/foo/a.tsx')).not.toContain('data-src');
  });
});

describe('source map of the project', () => {
  const g = buildGraph(new URL('../', import.meta.url));
  it('knows the files and what they say about themselves', () => {
    expect(Object.keys(g.files).length).toBeGreaterThan(50);
    const withDesc = Object.entries(g.files).filter(([k]) => !k.includes('.test.') && !k.endsWith('.d.ts'));
    expect(withDesc.filter(([, f]) => f.desc.length > 10).length / withDesc.length).toBeGreaterThan(0.85);
  });
  it('links files in both directions', () => {
    expect(g.files['App.tsx'].imports).toContain('audio/engine.ts');
    expect(g.files['audio/engine.ts'].usedBy).toContain('App.tsx');
    expect(g.files['audio/rig.ts'].libs).toContain('tone');
    expect(g.files['music/chords.ts'].tests).toContain('music/chords.test.ts');
    for (const f of Object.values(g.files)) for (const i of f.imports) expect(g.files[i]).toBeTruthy();
  });
  it('does not list the inspect code itself', () => { expect(Object.keys(g.files).some(k => k.startsWith('inspect/'))).toBe(false); });
});
