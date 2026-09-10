import '@mantine/core/styles.css';

import { ColorSchemeScript, MantineProvider, mantineHtmlProps } from '@mantine/core';
import { QueryClientProvider } from '@tanstack/react-query';
import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from 'react-router';
import type { Route } from './+types/root';
import { queryClient } from './lib/query';
import { theme } from './lib/theme';

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" {...mantineHtmlProps}>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="color-scheme" content="light dark" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <Meta />
        <Links />
        {/*
          ColorSchemeScript runs synchronously (blocking) in <head> and sets
          data-mantine-color-scheme on <html> BEFORE first paint. Its
          defaultColorScheme must match MantineProvider's to avoid a flip.
        */}
        <ColorSchemeScript defaultColorScheme="auto" />
        {/*
          Anti-FOUC: paint the correct background at first paint, before the
          main Mantine stylesheet is applied (in dev Vite injects that CSS via
          JS after paint, which otherwise causes a white flash on hard reload).
          The attribute above is already set by ColorSchemeScript at this point.
        */}
        <style
          // biome-ignore lint/security/noDangerouslySetInnerHtml: static anti-FOUC CSS
          dangerouslySetInnerHTML={{
            __html: `
:root { color-scheme: light; background-color: #fff; }
:root[data-mantine-color-scheme='dark'] { color-scheme: dark; background-color: #242424; }
:root[data-mantine-color-scheme='light'] { color-scheme: light; background-color: #fff; }
html, body { background-color: inherit; }

/* ThemeToggle: two variants always in DOM; CSS picks the visible one.
   ColorSchemeScript sets data-mantine-color-scheme before first paint,
   so the correct button is shown from the very first pixel — no flash. */
[data-mantine-color-scheme='dark'] .mk-cs-light { display: none !important; }
[data-mantine-color-scheme='light'] .mk-cs-dark  { display: none !important; }
:root:not([data-mantine-color-scheme]) .mk-cs-dark { display: none !important; }
`,
          }}
        />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <MantineProvider theme={theme} defaultColorScheme="auto">
        <Outlet />
      </MantineProvider>
    </QueryClientProvider>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = 'Oops!';
  let details = 'An unexpected error occurred.';
  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? '404' : 'Error';
    details = error.status === 404 ? 'Page not found.' : error.statusText || details;
  } else if (import.meta.env.DEV && error instanceof Error) {
    details = error.message;
  }
  return (
    <main style={{ padding: 24, fontFamily: 'system-ui' }}>
      <h1>{message}</h1>
      <p>{details}</p>
    </main>
  );
}
