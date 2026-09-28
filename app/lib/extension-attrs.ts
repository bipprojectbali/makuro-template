/** Removes attributes that browser extensions inject into server HTML before React hydrates it. */

// Mitigation for third-party extensions (bis_* + __processed_<uuid>__ come from a VPN/security
// extension): they mark every element before hydration, React reports the attribute diff as an
// error. Extend the pattern when another extension shows up in a hydration diff; the app itself
// never renders these names.
const INJECTED = /^(bis_[a-z_]+|__processed_[0-9a-f-]+__)$/;

type AttrElement = {
  attributes: ArrayLike<{ name: string }>;
  removeAttribute(name: string): void;
};

export function stripExtensionAttributes(root: {
  querySelectorAll(selector: string): Iterable<AttrElement>;
}): number {
  let removed = 0;
  for (const el of root.querySelectorAll('*')) {
    const names = Array.from(el.attributes, (a) => a.name).filter((n) => INJECTED.test(n));
    for (const name of names) el.removeAttribute(name);
    removed += names.length;
  }
  return removed;
}
