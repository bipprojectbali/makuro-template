// Bun text import (`with { type: 'text' }`) — the README is bundled into the binary this way.
declare module '*.md' {
  const content: string;
  export default content;
}
