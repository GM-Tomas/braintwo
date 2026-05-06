"use client";

import React from 'react';
import { Icon } from './Icons';
import { usePathname, useRouter } from 'next/navigation';

export const Navigation = () => {
  const pathname = usePathname();
  const router = useRouter();

  const navItems = [
    { icon: 'home', label: 'Inicio', path: '/' },
    { icon: 'search', label: 'Buscar', path: '/search' },
    { icon: 'grid', label: 'Colecciones', path: '/collections' },
    { icon: 'bolt', label: 'IA', path: '/ai' },
  ];

  return (
    <>
      <style>{`
        .bt-nav {
          background: var(--card);
          border-top: 1px solid var(--border);
          display: flex;
          justify-content: space-around;
          align-items: center;
          padding: 10px 0 20px 0;
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          z-index: 50;
        }
        
        .bt-nav-btn {
          background: none;
          border: none;
          cursor: pointer;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 3px;
          padding: 8px;
          border-radius: 12px;
          transition: background 0.2s;
        }

        .bt-nav-btn:hover {
          background: var(--card2);
        }

        .bt-nav-label {
          font-size: 10px;
          letter-spacing: 0.05em;
        }

        @media (min-width: 768px) {
          .bt-nav {
            border-top: none;
            border-right: 1px solid var(--border);
            flex-direction: column;
            justify-content: flex-start;
            gap: 20px;
            padding: 40px 0;
            top: 0;
            bottom: 0;
            left: 0;
            width: 80px;
            height: 100vh;
          }
        }
      `}</style>
      <nav className="bt-nav">
        {navItems.map(item => {
          const isActive = pathname === item.path;
          return (
            <button 
              key={item.label} 
              onClick={() => router.push(item.path)} 
              className="bt-nav-btn"
            >
              <Icon name={item.icon} size={24} color={isActive ? "var(--teal)" : "var(--dim)"}/>
              <span className="bt-nav-label" style={{ color: isActive ? "var(--teal)" : "var(--dim)" }}>
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>
    </>
  );
};
