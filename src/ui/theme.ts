// Tuned for dark-background terminals; not guaranteed legible on light themes.
export const colors = {
  risk: {
    low: '#6b9b6f',
    medium: '#d9a441',
    high: '#c85450',
  },
  role: {
    user: '#e8e6df',
    assistant: '#a8a49c',
    system: '#6b6f76',
  },
  accent: '#d99a4e',
  dim: '#6b6f76',
  border: '#3a3d44',
  danger: '#c85450',
  success: '#6b9b6f',
} as const;

// Shared "rule" border: a single accent line on one side instead of a full box.
export function ruleBorder(side: 'top' | 'left') {
  return side === 'top'
    ? { borderStyle: 'single' as const, borderRight: false, borderBottom: false, borderLeft: false, borderTopColor: colors.border }
    : { borderStyle: 'single' as const, borderTop: false, borderRight: false, borderBottom: false, borderLeftColor: colors.border };
}
