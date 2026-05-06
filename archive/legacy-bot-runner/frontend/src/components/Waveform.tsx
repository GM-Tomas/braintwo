import React from 'react';

type WaveformProps = {
  color?: string;
  width?: number;
  height?: number;
  bars?: number;
};

export const Waveform = ({ color = "var(--teal)", width = 80, height = 24, bars = 20 }: WaveformProps) => (
  <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
    {Array.from({ length: bars }).map((_, i) => {
      const h = Math.max(3, Math.round(Math.sin(i * 0.7 + 1) * 8 + Math.sin(i * 1.3) * 5 + 10));
      return (
        <rect 
          key={i} 
          x={i * (width / bars)} 
          y={(height - h) / 2} 
          width={width / bars - 1} 
          height={h} 
          rx={1} 
          fill={color} 
          opacity={0.7 + Math.sin(i) * 0.3}
        />
      );
    })}
  </svg>
);
