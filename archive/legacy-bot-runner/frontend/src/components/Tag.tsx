import React from 'react';

type TagProps = {
  color?: string;
  bg?: string;
  children: React.ReactNode;
  small?: boolean;
};

export const Tag = ({ color = "var(--blue)", bg, children, small }: TagProps) => (
  <span style={{
    display: 'inline-flex', 
    alignItems: 'center', 
    gap: 4,
    fontSize: small ? 10 : 11,
    fontWeight: 600, 
    letterSpacing: '0.08em', 
    textTransform: 'uppercase',
    color,
    background: bg || `${color}18`,
    border: `1px solid ${color}44`,
    borderRadius: 99, 
    padding: small ? '2px 8px' : '3px 10px',
  }}>
    {children}
  </span>
);
