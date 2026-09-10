import { ActionIcon, Button, Tooltip, useMantineColorScheme } from '@mantine/core';
import { FiMoon, FiSun } from 'react-icons/fi';

/**
 * Two variants (sun / moon) are always rendered in the DOM. An anti-FOUC CSS
 * rule in <head> (keyed on data-mantine-color-scheme set by ColorSchemeScript
 * before first paint) hides the wrong one from the very first pixel — no flash
 * even on hard reload. React state is never used for the initial visual.
 */
export function ThemeToggle({ collapsed = false }: { collapsed?: boolean }) {
  const { setColorScheme } = useMantineColorScheme();

  function toggle() {
    // Read from the DOM attribute (always up-to-date, set by ColorSchemeScript
    // and updated by Mantine on every setColorScheme call).
    const isDark = document.documentElement.getAttribute('data-mantine-color-scheme') === 'dark';
    setColorScheme(isDark ? 'light' : 'dark');
  }

  if (collapsed) {
    return (
      <>
        {/* mk-cs-dark: visible when dark mode is active → offer switch to light */}
        <span className="mk-cs-dark" style={{ display: 'block' }}>
          <Tooltip label="Light mode" position="right" withArrow>
            <ActionIcon
              variant="default"
              size="lg"
              mx="auto"
              display="block"
              onClick={toggle}
              aria-label="Switch to light mode"
            >
              <FiSun size={16} />
            </ActionIcon>
          </Tooltip>
        </span>
        {/* mk-cs-light: visible when light mode is active → offer switch to dark */}
        <span className="mk-cs-light" style={{ display: 'block' }}>
          <Tooltip label="Dark mode" position="right" withArrow>
            <ActionIcon
              variant="default"
              size="lg"
              mx="auto"
              display="block"
              onClick={toggle}
              aria-label="Switch to dark mode"
            >
              <FiMoon size={16} />
            </ActionIcon>
          </Tooltip>
        </span>
      </>
    );
  }

  return (
    <>
      <span className="mk-cs-dark" style={{ display: 'block' }}>
        <Button
          fullWidth
          variant="default"
          size="xs"
          leftSection={<FiSun size={16} />}
          onClick={toggle}
        >
          Light mode
        </Button>
      </span>
      <span className="mk-cs-light" style={{ display: 'block' }}>
        <Button
          fullWidth
          variant="default"
          size="xs"
          leftSection={<FiMoon size={16} />}
          onClick={toggle}
        >
          Dark mode
        </Button>
      </span>
    </>
  );
}
