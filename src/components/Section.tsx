import type { ReactNode } from 'react';

interface SectionProps {
  title?: string;
  noPull?: boolean;
  children: ReactNode;
}

export const Section = ({ title, noPull, children }: SectionProps) => (
  <div style={noPull ? undefined : { margin: '0 -10px' }}>
    {title && (
      <div style={{
        padding: noPull ? '12px 0 4px' : '12px 12px 4px',
        fontSize: '11px',
        fontWeight: 'bold',
        textTransform: 'uppercase' as const,
        color: 'var(--gpSystemLighterGrey)',
        letterSpacing: '0.04em',
      }}>
        {title}
      </div>
    )}
    {children}
  </div>
);
