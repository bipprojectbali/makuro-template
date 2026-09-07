import { createTheme, type MantineColorsTuple } from '@mantine/core';

// Brand palette (10 shades, required by Mantine). Indigo/violet "makuro" brand.
const brand: MantineColorsTuple = [
  '#f2f0ff',
  '#e0dbff',
  '#bfb2ff',
  '#9b86ff',
  '#7c60fe',
  '#6a48fe',
  '#613bff',
  '#512de4',
  '#4826cc',
  '#3d1eb3',
];

/**
 * Central Mantine theme. Extend here (fonts, radius, component defaults) and it
 * applies app-wide via MantineProvider in app/root.tsx.
 */
export const theme = createTheme({
  primaryColor: 'brand',
  colors: { brand },
  primaryShade: { light: 6, dark: 4 },
  defaultRadius: 'md',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  headings: {
    fontWeight: '700',
  },
  cursorType: 'pointer',
  components: {
    Button: {
      defaultProps: { radius: 'md' },
    },
    Paper: {
      defaultProps: { radius: 'lg' },
    },
    TextInput: {
      defaultProps: { radius: 'md' },
    },
    PasswordInput: {
      defaultProps: { radius: 'md' },
    },
  },
});
