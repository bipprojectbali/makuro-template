import {
  Box,
  Group,
  Paper,
  RingProgress,
  SegmentedControl,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { useState } from 'react';
import {
  linePath,
  SHOWCASE_COPY,
  SHOWCASE_DATA,
  SHOWCASE_RANGES,
  type ShowcaseRange,
} from './login-showcase.content';

const CHART_W = 260;
const CHART_H = 90;

/** Faded square grid for a panel corner; purely decorative. */
function CornerGrid({ corner }: { corner: 'top-right' | 'bottom-left' }) {
  const top = corner === 'top-right';
  return (
    <Box
      aria-hidden
      pos="absolute"
      w={220}
      h={220}
      top={top ? -20 : undefined}
      right={top ? -20 : undefined}
      bottom={top ? undefined : -20}
      left={top ? undefined : -20}
      style={{
        opacity: 0.18,
        pointerEvents: 'none',
        backgroundImage:
          'linear-gradient(var(--mantine-color-white) 1px, transparent 1px), linear-gradient(90deg, var(--mantine-color-white) 1px, transparent 1px)',
        backgroundSize: '36px 36px',
        maskImage: `radial-gradient(circle at ${top ? 'top right' : 'bottom left'}, black, transparent 70%)`,
      }}
    />
  );
}

function AnalyticsCard() {
  const [range, setRange] = useState<ShowcaseRange>('weekly');
  const data = SHOWCASE_DATA[range];
  const line = linePath(data.values, CHART_W, CHART_H);
  return (
    <Paper radius="md" p="md" shadow="md" mr={48}>
      <Group justify="space-between" align="center" wrap="wrap" gap="xs" mb="xs">
        <Text fw={700} size="sm">
          {SHOWCASE_COPY.analyticsTitle}
        </Text>
        <SegmentedControl
          size="xs"
          radius="xl"
          value={range}
          onChange={(v) => setRange(v as ShowcaseRange)}
          data={SHOWCASE_RANGES}
          aria-label={SHOWCASE_COPY.rangeAriaLabel}
        />
      </Group>
      <svg
        aria-hidden
        viewBox={`-4 -6 ${CHART_W + 8} ${CHART_H + 12}`}
        width="100%"
        height={CHART_H + 12}
        preserveAspectRatio="none"
      >
        <path
          d={`${line} L ${CHART_W},${CHART_H} L 0,${CHART_H} Z`}
          fill="var(--mantine-primary-color-light)"
          style={{ transition: 'd 400ms ease' }}
        />
        <path
          d={line}
          fill="none"
          stroke="var(--mantine-primary-color-filled)"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
          style={{ transition: 'd 400ms ease' }}
        />
      </svg>
      <Text size="xs" c="dimmed" mt={4}>
        {data.summary}
      </Text>
    </Paper>
  );
}

function DonutCard() {
  return (
    <Paper aria-hidden radius="md" p="sm" shadow="lg" pos="absolute" right={0} bottom={0} w={150}>
      <Text fw={700} size="sm" mb={4}>
        {SHOWCASE_COPY.donutTitle}
      </Text>
      <Group justify="center">
        <RingProgress
          size={96}
          thickness={10}
          roundCaps
          sections={[
            { value: SHOWCASE_COPY.donutValue, color: 'var(--mantine-primary-color-filled)' },
          ]}
          label={
            <Text ta="center" fw={700} size="lg">
              {SHOWCASE_COPY.donutValue}%
            </Text>
          }
        />
      </Group>
    </Paper>
  );
}

/** Decorative right-hand panel of the login card: preview cards plus brand heading. */
export function LoginShowcase({ appName, tagline }: { appName: string; tagline: string | null }) {
  return (
    <Box
      pos="relative"
      w="100%"
      h="100%"
      p="xl"
      bg="var(--mantine-primary-color-9)"
      style={{
        borderRadius: 'var(--mantine-radius-lg)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
      }}
    >
      <CornerGrid corner="top-right" />
      <CornerGrid corner="bottom-left" />
      <Stack gap="xl" pos="relative" maw={380} w="100%" mx="auto">
        <Box pos="relative" pb={72}>
          <AnalyticsCard />
          <DonutCard />
        </Box>
        <Stack gap="xs" ta="center">
          <Text
            size="xs"
            fw={600}
            tt="uppercase"
            c="white"
            opacity={0.7}
            style={{ letterSpacing: 1 }}
          >
            {appName}
          </Text>
          <Title order={2} c="white" fw={800}>
            {SHOWCASE_COPY.heading}
          </Title>
          <Text size="sm" c="white" opacity={0.7}>
            {tagline || SHOWCASE_COPY.defaultTagline}
          </Text>
        </Stack>
      </Stack>
    </Box>
  );
}
