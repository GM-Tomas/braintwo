import React from 'react';

export const BrainLogo = ({ size = 48 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 150 150" fill="none">
    <defs>
      <linearGradient id="appBG" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="var(--blue)"/>
        <stop offset="100%" stopColor="var(--teal)"/>
      </linearGradient>
      <radialGradient id="appCore" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="#fff" stopOpacity="0.9"/>
        <stop offset="60%" stopColor="var(--teal)" stopOpacity="0.7"/>
        <stop offset="100%" stopColor="var(--blue)" stopOpacity="0.4"/>
      </radialGradient>
    </defs>
    <circle cx="75" cy="73" r="52" fill="none" stroke="url(#appBG)" strokeWidth="0.8" opacity="0.4"/>
    <g stroke="url(#appBG)" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d="M73 30 C55 28,38 38,32 55 C28 62,28 70,32 76 C28 82,30 92,38 98 C42 110,56 118,72 116 L73 30Z"/>
      <path d="M77 30 C95 28,112 38,118 55 C122 62,122 70,118 76 C122 82,120 92,112 98 C108 110,94 118,78 116 L77 30Z"/>
      <path d="M75 30 L75 116" strokeOpacity="0.3"/>
      <path d="M45 52 Q55 56,58 68" strokeOpacity="0.5"/>
      <path d="M40 78 Q52 82,60 92" strokeOpacity="0.5"/>
      <path d="M105 52 Q95 56,92 68" strokeOpacity="0.5"/>
      <path d="M110 78 Q98 82,90 92" strokeOpacity="0.5"/>
    </g>
    <circle cx="48" cy="58" r="4" fill="url(#appBG)"/>
    <circle cx="62" cy="72" r="3.2" fill="url(#appBG)"/>
    <circle cx="56" cy="90" r="3.6" fill="url(#appBG)"/>
    <circle cx="88" cy="72" r="3.2" fill="url(#appBG)"/>
    <circle cx="102" cy="58" r="4" fill="url(#appBG)"/>
    <circle cx="94" cy="90" r="3.6" fill="url(#appBG)"/>
    <circle cx="75" cy="73" r="7" fill="url(#appCore)"/>
  </svg>
);
