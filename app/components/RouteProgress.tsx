import { NavigationProgress, nprogress } from '@mantine/nprogress';
import { useIsFetching } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useNavigation } from 'react-router';

/**
 * Thin top progress bar while a route transition or background query is in
 * flight, so the app never looks frozen between click and content.
 */
export function RouteProgress() {
  const navigation = useNavigation();
  const fetching = useIsFetching();
  const busy = navigation.state !== 'idle' || fetching > 0;

  useEffect(() => {
    if (busy) nprogress.start();
    else nprogress.complete();
  }, [busy]);

  return <NavigationProgress size={3} aria-label="Memuat" />;
}
