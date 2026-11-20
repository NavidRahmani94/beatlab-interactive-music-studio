// Lets TypeScript import a text file with `?raw` (Vite gives the file content as a string).
declare module '*?raw' { const text: string; export default text; }
