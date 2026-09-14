import { Box } from '@mantine/core';
import { auth } from '@server/auth';
import { landingStats } from '@server/landing-stats';
import { homeFor } from '@server/permissions';
import { resolveUserRole } from '@server/roles';
import { getBranding } from '@server/settings-branding';
import { Hero } from '~/components/landing/Hero';
import { LandingHeader } from '~/components/landing/LandingHeader';
import { CtaSection, LandingFooter, QuickStartSection } from '~/components/landing/QuickStartCta';
import {
  ArchitectureSection,
  ConsoleSection,
  FaqSection,
  FeaturesSection,
  SecuritySection,
} from '~/components/landing/Sections';
import type { Route } from './+types/home';

export function meta({ loaderData }: Route.MetaArgs) {
  const name = loaderData?.branding.appName ?? 'Makuro';
  const tagline = loaderData?.branding.appTagline ?? 'Fullstack Template';
  const title = `${name} — ${tagline}`;
  const description = `${name}: template fullstack Bun + Elysia + React Router SSR + Drizzle + Better Auth dengan konsol admin lengkap (user, sesi, log, audit, rate limit, settings) dan deploy satu binary. Siap produksi, MIT.`;
  return [
    { title },
    { name: 'description', content: description },
    { property: 'og:title', content: title },
    { property: 'og:description', content: description },
    { property: 'og:type', content: 'website' },
    { property: 'og:site_name', content: name },
    { name: 'twitter:card', content: 'summary' },
    { name: 'twitter:title', content: title },
    { name: 'twitter:description', content: description },
  ];
}

/** Public page: branding + live numbers, plus a session check so CTAs point to the right place. */
export async function loader({ request }: Route.LoaderArgs) {
  const [branding, stats, session] = await Promise.all([
    getBranding(),
    landingStats(),
    auth.api.getSession({ headers: request.headers }).catch(() => null),
  ]);
  const role = session?.user ? await resolveUserRole(session.user) : null;
  return {
    branding,
    stats,
    signedIn: Boolean(session?.user),
    homePath: role ? homeFor(role) : '/login',
  };
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const { branding, stats, signedIn, homePath } = loaderData;
  return (
    <Box>
      <LandingHeader appName={branding.appName} signedIn={signedIn} homePath={homePath} />
      <Hero
        appName={branding.appName}
        tagline={branding.appTagline}
        stats={stats}
        signedIn={signedIn}
        homePath={homePath}
      />
      <FeaturesSection />
      <ConsoleSection />
      <SecuritySection />
      <ArchitectureSection />
      <QuickStartSection />
      <FaqSection />
      <CtaSection signedIn={signedIn} homePath={homePath} />
      <LandingFooter
        appName={branding.appName}
        version={stats.version}
        supportUrl={branding.supportUrl}
      />
    </Box>
  );
}
