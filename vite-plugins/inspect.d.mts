export function inspectBabel(): any;
export function inspectGraph(srcDir: string | URL): any;
export function buildGraph(srcDir: string | URL): { files: Record<string, { lines: number; desc: string; imports: string[]; usedBy: string[]; tests: string[]; libs: string[] }> };
