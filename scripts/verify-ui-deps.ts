const required = [
  '@radix-ui/react-accordion', '@radix-ui/react-alert-dialog', '@radix-ui/react-aspect-ratio',
  '@radix-ui/react-avatar', '@radix-ui/react-checkbox', '@radix-ui/react-collapsible',
  '@radix-ui/react-context-menu', '@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu',
  '@radix-ui/react-hover-card', '@radix-ui/react-label', '@radix-ui/react-menubar',
  '@radix-ui/react-navigation-menu', '@radix-ui/react-popover', '@radix-ui/react-progress',
  '@radix-ui/react-radio-group', '@radix-ui/react-scroll-area', '@radix-ui/react-select',
  '@radix-ui/react-separator', '@radix-ui/react-slider', '@radix-ui/react-slot',
  '@radix-ui/react-switch', '@radix-ui/react-tabs', '@radix-ui/react-toast',
  '@radix-ui/react-toggle', '@radix-ui/react-toggle-group', '@radix-ui/react-tooltip',
  'cmdk', 'embla-carousel-react', 'input-otp', 'next-themes', 'react-day-picker',
  'react-resizable-panels', 'recharts', 'sonner', 'vaul',
];

const missing: string[] = [];
for (const dep of required) {
  try {
    require.resolve(dep, { paths: [process.cwd()] });
  } catch {
    missing.push(dep);
  }
}

if (missing.length) {
  console.error(`[ui-deps] Missing UI packages: ${missing.join(', ')}`);
  process.exit(1);
}

const tsc = Bun.spawn(['bunx', 'tsc', '--noEmit', '--pretty', 'false'], {
  stdout: 'inherit',
  stderr: 'inherit',
});
const exitCode = await tsc.exited;
if (exitCode !== 0) process.exit(exitCode);

console.log('[ui-deps] UI dependencies resolve and TypeScript module resolution passed.');