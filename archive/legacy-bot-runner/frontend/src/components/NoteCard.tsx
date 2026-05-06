import React from 'react';
import { Tag } from './Tag';
import { Waveform } from './Waveform';
import { Icon } from './Icons';

export type Note = {
  id: number;
  type: 'text' | 'audio';
  time: string;
  duration?: string;
  transcript?: string;
  text?: string;
  tags: string[];
  color: string;
};

type NoteCardProps = {
  note: Note;
  onClick?: () => void;
};

export const NoteCard = ({ note, onClick }: NoteCardProps) => (
  <div 
    onClick={onClick} 
    style={{ 
      background: 'var(--card2)', 
      border: `1px solid var(--border)`, 
      borderRadius: 16, 
      padding: '14px 16px', 
      cursor: 'pointer', 
      position: 'relative', 
      overflow: 'hidden', 
      transition: 'transform 0.15s', 
      WebkitTapHighlightColor: 'transparent' 
    }}
    onPointerDown={e => e.currentTarget.style.transform = 'scale(0.98)'}
    onPointerUp={e => e.currentTarget.style.transform = 'none'}
    onPointerCancel={e => e.currentTarget.style.transform = 'none'}
  >
    {/* left accent bar */}
    <div style={{ position:'absolute', left:0, top:'15%', height:'70%', width:2, background: note.color, borderRadius:2 }}/>

    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        {note.type === 'audio' && (
          <div style={{ background: `${note.color}18`, border: `1px solid ${note.color}44`, borderRadius: 8, padding: '3px 8px', display: 'flex', alignItems: 'center', gap: 4 }}>
            <Icon name="mic" size={11} color={note.color}/>
            <span style={{ fontSize: 10, color: note.color, fontWeight: 600, letterSpacing: '0.05em' }}>{note.duration}</span>
          </div>
        )}
      </div>
      <span style={{ fontSize: 11, color: 'var(--dim)' }}>{note.time}</span>
    </div>

    {note.type === 'audio' && (
      <div style={{ marginBottom: 8 }}>
        <Waveform color={note.color} width={200} height={20} bars={28}/>
      </div>
    )}

    <p style={{ 
      fontSize: 14, 
      color: 'var(--text)', 
      lineHeight: 1.5, 
      marginBottom: 10, 
      display: '-webkit-box', 
      WebkitLineClamp: 2, 
      WebkitBoxOrient: 'vertical', 
      overflow: 'hidden' 
    }}>
      {note.type === 'audio' ? note.transcript : note.text}
    </p>

    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {note.tags.map(t => <Tag key={t} color={note.color} small>{t}</Tag>)}
    </div>
  </div>
);
