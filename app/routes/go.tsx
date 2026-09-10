import { redirectToHome } from '@server/guard';
import type { Route } from './+types/go';

/**
 * Transient redirector used right after authentication. The role is unknown at
 * OAuth callback time, so login funnels here and we resolve the role server-side
 * then redirect to that role's home. This route never renders.
 */
export async function loader({ request }: Route.LoaderArgs) {
  return redirectToHome(request);
}

export default function Go() {
  return null;
}
