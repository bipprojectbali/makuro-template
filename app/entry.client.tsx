import { StrictMode } from 'react';
import { flushSync } from 'react-dom';
import { hydrateRoot } from 'react-dom/client';
import { HydratedRouter } from 'react-router/dom';
import { stripExtensionAttributes } from '~/lib/extension-attrs';

// Strip and hydrate in one uninterrupted task: a transition hydration yields every few ms and
// extensions re-tag elements in those gaps, so part of the tree still mismatches.
flushSync(() => {
  stripExtensionAttributes(document);
  hydrateRoot(
    document,
    <StrictMode>
      <HydratedRouter />
    </StrictMode>,
  );
});
