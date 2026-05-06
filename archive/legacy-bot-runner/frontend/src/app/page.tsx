"use client";

import React, { useState } from 'react';
import { Icon } from '@/components/Icons';
import { BrainLogo } from '@/components/BrainLogo';
import { NoteCard, Note } from '@/components/NoteCard';
import { useRouter } from 'next/navigation';

const DUMMY_NOTES: Note[] = [
  { id: 1, type: 'text', time: 'Hace 10 min', text: 'Hablar con Marcos sobre el deploy del viernes. Confirmar si puede estar antes de las 18hs.', tags: ['trabajo', 'pendiente'], color: 'var(--blue)' },
  { id: 2, type: 'audio', time: 'Hace 1 hora', duration: '0:47', transcript: 'Las medidas del mueble de la cocina son: ancho 120cm, alto 90cm, profundidad 45cm. El carpintero dijo que necesita 3 semanas.', tags: ['obra', 'medidas'], color: 'var(--amber)' },
  { id: 3, type: 'text', time: 'Ayer', text: 'Idea para el pitch: empezar con la stat de que el 100% usa WhatsApp y el 80% pierde la info. Impacta más que cualquier feature.', tags: ['braintwo', 'ideas'], color: 'var(--teal)' },
  { id: 4, type: 'audio', time: 'Ayer', duration: '1:12', transcript: 'Resumen de la reunión con el cliente: aprobaron el presupuesto, el próximo hito es el 15. Necesitamos entregar el mockup esta semana.', tags: ['cliente', 'reunión'], color: 'var(--teal)' },
  { id: 5, type: 'text', time: 'Hace 2 días', text: 'Leer "Building a Second Brain" de Tiago Forte. Buscar el resumen de YouTube primero.', tags: ['lectura'], color: 'var(--red)' },
];

export default function Home() {
  const router = useRouter();
  const [filter, setFilter] = useState('todo');
  
  const filters = [
    { id: 'todo', label: 'Todo' },
    { id: 'audio', label: 'Audios' },
    { id: 'texto', label: 'Textos' },
    { id: 'pendiente', label: 'Pendientes' },
  ];

  const filtered = filter === 'todo' 
    ? DUMMY_NOTES 
    : filter === 'audio' 
      ? DUMMY_NOTES.filter(n => n.type === 'audio') 
      : filter === 'texto' 
        ? DUMMY_NOTES.filter(n => n.type === 'text') 
        : DUMMY_NOTES.filter(n => n.tags.includes('pendiente'));

  return (
    <div className="home-container">
      <style>{`
        .home-container {
          position: relative;
          min-height: 100vh;
          display: flex;
          flex-direction: column;
        }

        .header-area {
          padding: 24px 32px 16px;
          position: relative;
          z-index: 10;
        }

        .header-top {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 24px;
        }

        .greeting {
          font-size: 14px;
          color: var(--dim);
          letter-spacing: 0.2em;
          text-transform: uppercase;
        }

        .app-title {
          font-family: var(--font-bebas-neue);
          font-size: 42px;
          letter-spacing: 0.04em;
          background: linear-gradient(135deg, #fff, var(--blue));
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .header-actions {
          display: flex;
          gap: 16px;
        }

        .icon-btn {
          width: 44px;
          height: 44px;
          border-radius: 99px;
          background: var(--card2);
          border: 1px solid var(--border);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
        }

        .logo-btn {
          width: 44px;
          height: 44px;
          border-radius: 99px;
          background: linear-gradient(135deg, var(--blue), var(--teal));
          display: flex;
          align-items: center;
          justify-content: center;
          border: none;
        }

        .search-bar {
          background: var(--card2);
          border: 1px solid var(--border);
          border-radius: 16px;
          padding: 14px 20px;
          display: flex;
          align-items: center;
          gap: 12px;
          cursor: pointer;
          margin-bottom: 20px;
          transition: all 0.2s;
        }
        
        .search-bar:hover {
          border-color: var(--blue);
        }

        .filters-container {
          display: flex;
          gap: 10px;
          overflow-x: auto;
          padding-bottom: 8px;
        }

        .filter-btn {
          flex-shrink: 0;
          border-radius: 99px;
          font-size: 14px;
          font-weight: 600;
          padding: 8px 18px;
          cursor: pointer;
          font-family: var(--font-outfit);
          transition: all 0.2s;
        }

        .content-area {
          flex: 1;
          padding: 16px 32px 100px;
          display: flex;
          flex-direction: column;
          gap: 24px;
          max-width: 1200px;
          margin: 0 auto;
          width: 100%;
        }

        .stats-row {
          display: flex;
          gap: 16px;
        }

        .stat-card {
          flex: 1;
          background: var(--card2);
          border: 1px solid var(--border);
          border-radius: 16px;
          padding: 16px;
        }

        .stat-val {
          font-family: var(--font-bebas-neue);
          font-size: 36px;
          line-height: 1;
        }

        .stat-label {
          font-size: 12px;
          color: var(--dim);
          letter-spacing: 0.1em;
          text-transform: uppercase;
          margin-top: 4px;
        }

        .notes-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 16px;
        }

        @media (min-width: 1024px) {
          .notes-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }
        
        @media (min-width: 1440px) {
          .notes-grid {
            grid-template-columns: repeat(3, 1fr);
          }
        }

        .fab {
          position: fixed;
          bottom: 100px;
          right: 32px;
          z-index: 40;
          width: 64px;
          height: 64px;
          border-radius: 99px;
          background: linear-gradient(135deg, var(--blue), var(--teal));
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 8px 32px rgba(26, 143, 227, 0.4);
          transition: transform 0.2s;
        }

        .fab:hover {
          transform: scale(1.05);
        }

        @media (min-width: 768px) {
          .fab {
            bottom: 40px;
          }
        }
      `}</style>

      {/* Header */}
      <div className="header-area">
        <div className="header-top">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span className="greeting">Buenos días</span>
            <span className="app-title">Tu cerebro</span>
          </div>
          <div className="header-actions">
            <button className="icon-btn">
              <Icon name="bell" size={20} color="var(--muted)" />
            </button>
            <button className="logo-btn">
              <BrainLogo size={28} />
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="search-bar" onClick={() => router.push('/search')}>
          <Icon name="search" size={20} color="var(--dim)" />
          <span style={{ fontSize: 16, color: 'var(--dim)' }}>Buscá en lenguaje natural…</span>
        </div>

        {/* Filters */}
        <div className="filters-container">
          {filters.map(f => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className="filter-btn"
              style={{
                background: filter === f.id ? `linear-gradient(135deg, var(--blue), var(--teal))` : 'var(--card2)',
                border: filter === f.id ? 'none' : `1px solid var(--border)`,
                color: filter === f.id ? '#fff' : 'var(--muted)',
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="content-area">
        {/* Stats */}
        <div className="stats-row">
          <div className="stat-card">
            <div className="stat-val" style={{ color: 'var(--blue)' }}>{DUMMY_NOTES.length}</div>
            <div className="stat-label">ideas</div>
          </div>
          <div className="stat-card">
            <div className="stat-val" style={{ color: 'var(--amber)' }}>{DUMMY_NOTES.filter(n => n.type === 'audio').length}</div>
            <div className="stat-label">audios</div>
          </div>
          <div className="stat-card">
            <div className="stat-val" style={{ color: 'var(--red)' }}>1</div>
            <div className="stat-label">pendientes</div>
          </div>
        </div>

        {/* Notes Grid */}
        <div className="notes-grid">
          {filtered.map(n => (
            <NoteCard 
              key={n.id} 
              note={n} 
              onClick={() => {}} 
            />
          ))}
        </div>
      </div>

      {/* Floating Action Button */}
      <button className="fab" onClick={() => {}}>
        <Icon name="plus" size={28} color="#fff" />
      </button>

    </div>
  );
}
