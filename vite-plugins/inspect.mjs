// FILE: Build-time helpers for the Inspect mode. (1) a Babel plugin that writes the source file and line (and the event handlers) onto every page element, (2) a virtual module with a map of how the source files connect.
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const CODE = /\.(ts|tsx|js)$/;
const compact = s => s.replace(/\s+/g, ' ').trim();

/** Babel plugin: <button onClick={play}> becomes <button onClick={play} data-src="ui/Foo.tsx:12" data-on="onClick={play}">. Only plain page elements (lower-case tags), never the inspect code itself or tests. */
export function inspectBabel() {
  return ({ types: t }) => ({
    name: 'beatlab-inspect',
    visitor: {
      JSXOpeningElement(path, state) {
        const file = String(state.filename || '').replace(/\\/g, '/');
        const i = file.lastIndexOf('/src/');
        if (i < 0) return;
        const rel = file.slice(i + 5);
        if (rel.startsWith('inspect/') || rel.includes('.test.')) return;
        const name = path.node.name;
        if (!t.isJSXIdentifier(name) || !/^[a-z]/.test(name.name)) return;
        if (path.node.attributes.some(a => t.isJSXAttribute(a) && a.name.name === 'data-src')) return;
        const line = path.node.loc ? path.node.loc.start.line : 0;
        const add = [t.jsxAttribute(t.jsxIdentifier('data-src'), t.stringLiteral(rel + ':' + line))];
        const code = state.file.code;
        const handlers = path.node.attributes
          .filter(a => t.isJSXAttribute(a) && t.isJSXIdentifier(a.name) && /^on[A-Z]/.test(a.name.name) && a.value)
          .map(a => compact(code.slice(a.start, a.end)).slice(0, 90));
        if (handlers.length) add.push(t.jsxAttribute(t.jsxIdentifier('data-on'), t.stringLiteral(handlers.join(' | ').slice(0, 200))));
        path.node.attributes.push(...add);
      },
    },
  });
}

function walk(dir, out = []) {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) walk(p, out); else if (CODE.test(n) && !n.endsWith('.d.ts')) out.push(p);
  }
  return out;
}

/** What each source file says about itself (first "// FILE:" comment), what it imports, who imports it, its tests and the libraries it uses. */
export function buildGraph(srcDir) {
  const root = typeof srcDir === 'string' ? srcDir : fileURLToPath(srcDir);
  const files = {};
  const all = walk(root).map(p => relative(root, p).replace(/\\/g, '/')).filter(r => !r.startsWith('inspect/'));
  const set = new Set(all);
  const resolve = (from, spec) => {
    const base = join(dirname(from), spec).replace(/\\/g, '/');
    for (const c of [base, base + '.ts', base + '.tsx', base + '.js', base + '/index.ts']) if (set.has(c)) return c;
    return null;
  };
  for (const rel of all) {
    const text = readFileSync(join(root, rel), 'utf8');
    const lines = text.split('\n');
    const first = lines.findIndex(l => /^\/\/ FILE:/.test(l));
    let desc = '';
    if (first >= 0) { desc = lines[first].replace(/^\/\/ FILE:\s*/, ''); for (let k = first + 1; k < lines.length && /^\/\/ /.test(lines[k]) && k < first + 3; k++) desc += ' ' + lines[k].replace(/^\/\/\s*/, ''); }
    else {   // no "// FILE:" line: use the comment lines at the very top of the file
      for (let k = 0; k < lines.length && k < 4; k++) { const m = lines[k].match(/^(?:\/\/+|\/\*+|\s*\*+)\s?(.*?)(?:\*\/)?\s*$/); if (!m || !m[1].trim()) break; desc += ' ' + m[1].trim(); }
    }
    const imports = new Set(), libs = new Set();
    for (const m of text.matchAll(/(?:from\s+|import\s*\(\s*|import\s+)['"]([^'"]+)['"]/g)) {
      const spec = m[1].replace(/\?raw$/, '');
      if (spec.startsWith('.')) { const r = resolve(rel, spec); if (r) imports.add(r); } else libs.add(spec.split('/')[0].startsWith('@') ? spec.split('/').slice(0, 2).join('/') : spec.split('/')[0]);
    }
    files[rel] = { lines: lines.length, desc: compact(desc).slice(0, 300), imports: [...imports].filter(f => !f.includes('.test.')), usedBy: [], tests: [], libs: [...libs].sort() };
  }
  for (const [rel, f] of Object.entries(files)) {
    if (rel.includes('.test.')) continue;
    for (const i of f.imports) files[i].usedBy.push(rel);
  }
  for (const rel of all) {
    if (!rel.includes('.test.')) continue;
    const text = readFileSync(join(root, rel), 'utf8');
    for (const m of text.matchAll(/from\s+['"](\.[^'"]+)['"]/g)) { const r = resolve(rel, m[1]); if (r && !r.includes('.test.')) files[r].tests.push(rel); }
  }
  for (const f of Object.values(files)) { f.usedBy.sort(); f.tests = [...new Set(f.tests)].sort(); f.imports.sort(); }
  return { files };
}

/** Vite plugin: `import graph from 'virtual:beatlab-graph'` gives the map made by buildGraph. */
export function inspectGraph(srcDir) {
  const ID = 'virtual:beatlab-graph', RID = '\0' + ID;
  return {
    name: 'beatlab-graph',
    resolveId(id) { return id === ID ? RID : null; },
    load(id) { return id === RID ? 'export default ' + JSON.stringify(buildGraph(srcDir)) : null; },
    handleHotUpdate({ server }) { const m = server.moduleGraph.getModuleById(RID); if (m) server.moduleGraph.invalidateModule(m); },
  };
}
