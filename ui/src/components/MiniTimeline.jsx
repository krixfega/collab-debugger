import React from 'react';

// Map event types to colors
const TYPE_COLORS = {
  console: '#61dafb',
  'db-query': '#e06c75',
  'http-request': '#98c379',
  'http-response': '#56b6c2',
  'http-error': '#e06c75',
  snapshot: '#c678dd',
  'session-start': '#d19a66',
  'session-end': '#d19a66'
};

export default function MiniTimeline({ events, currentIndex, onSelect }) {
  const length = events.length;
  if (length === 0) return null;

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: 8,
        backgroundColor: '#333',
        borderRadius: 4,
        margin: '12px 0'
      }}
    >
      {events.map((e, i) => {
        const left = (i / (length - 1)) * 100;
        return (
          <div
            key={i}
            onClick={() => onSelect(i)}
            style={{
              position: 'absolute',
              left: `${left}%`,
              width: 2,
              height: '100%',
              backgroundColor: TYPE_COLORS[e.type] || '#888',
              cursor: 'pointer',
              transform: 'translateX(-50%)'
            }}
            title={`${e.type} @ ${new Date(e.timestamp).toLocaleTimeString()}`}
          />
        );
      })}

      {/* current-event marker */}
      <div
        style={{
          position: 'absolute',
          left: `${(currentIndex / (length - 1)) * 100}%`,
          top: 0,
          bottom: 0,
          width: 2,
          backgroundColor: '#fff',
          transform: 'translateX(-50%)'
        }}
      />
    </div>
  );
}