// The site runs the extension's own masking engine, so every example and the
// playground show exactly what MailHush 2.0 does. The engine only imports
// types from settings.ts, so nothing extension-specific is bundled.
import { createMasker } from '../../../../src/lib/engine';
import { detectors } from '../../../../src/lib/detectors';

export { detectors };
export type Style = 'label' | 'dots' | 'partial';
export interface Rule {
  pattern: string;
  replacement: string;
  regex?: boolean;
}

export const makeMasker = ({
  enabled = true,
  style = 'label' as Style,
  on = detectors.filter((d) => d.defaultEnabled).map((d) => d.id) as Iterable<string>,
  rules = [] as Rule[],
  labels = {} as Record<string, string>,
} = {}) => {
  const active = new Set(on);
  return createMasker({
    enabled,
    maskStyle: style,
    maskInputs: true,
    maskAttributes: true,
    maskTitle: true,
    excludedSites: [],
    detectors: Object.fromEntries(
      detectors.map((d) => [d.id, { enabled: active.has(d.id), style: 'default', label: labels[d.id] ?? d.label }]),
    ),
    rules: rules
      .filter((r) => r.pattern.trim())
      .map((r, i) => ({
        id: `rule-${i}`,
        pattern: r.pattern,
        replacement: r.replacement,
        regex: Boolean(r.regex),
        caseSensitive: false,
        enabled: true,
      })),
  } as Parameters<typeof createMasker>[0]);
};

export const mask = (text: string, options?: Parameters<typeof makeMasker>[0]) => makeMasker(options).mask(text);
