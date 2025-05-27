import React, { useEffect, useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../api';
import TimelineScrubber from './TimelineScrubber';
import { Play, Pause } from 'lucide-react';
import { Light as SyntaxHighlighter } from 'react-syntax-highlighter';
import json from 'react-syntax-highlighter/dist/esm/languages/hljs/json';

import '../index.css';
import MiniTimeline from './MiniTimeline';

// Register JSON language
SyntaxHighlighter.registerLanguage('json', json);

// Map event types to shortcut keys
const TYPE_SHORTCUTS = {
  console: 'c',
  'db-query': 'd',
  'http-request': 'h',
  'http-response': 'p',
  'http-error': 'e',
  snapshot: 's'
};

function SessionViewer() {
  const { id } = useParams();
  const [events, setEvents] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [allTypes, setAllTypes] = useState([]);
  const [selectedTypes, setSelectedTypes] = useState(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [fade, setFade] = useState(true);
  const [showToast, setShowToast] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(500);
  const playRef = useRef(null);
  

  // Fetch events
  useEffect(() => {
    api.get(`/sessions/${id}/blob`).then(res => {
      const eventTypes = res.data.map(e => e.type);
      const types = Array.from(
        new Set([...Object.keys(TYPE_SHORTCUTS), ...eventTypes])
      );
      setAllTypes(types);
      setSelectedTypes(new Set(types));
      setEvents(res.data);
    });
  }, [id]);

  // autoplay effect
  useEffect(() => {
    if (isPlaying) {
      playRef.current = setInterval(() => {
        setCurrentIndex(idx => {
          const filtered = events.filter(e => selectedTypes.has(e.type) && JSON.stringify(e).toLowerCase().includes(searchTerm.toLowerCase()));
          return idx < filtered.length - 1 ? idx + 1 : idx;
        });
      }, speed);
    } else {
      clearInterval(playRef.current);
    }
    return () => clearInterval(playRef.current);
  }, [isPlaying, speed, events, selectedTypes, searchTerm]);

  // Fade animation
  useEffect(() => {
    setFade(false);
    const t = setTimeout(() => setFade(true), 50);
    return () => clearTimeout(t);
  }, [currentIndex, selectedTypes, searchTerm]);

  // Keyboard navigation and shortcuts
  useEffect(() => {
    const handleKey = e => {
      const key = e.key.toLowerCase();
      if (key === 'arrowright') {
        setCurrentIndex(idx => Math.min(idx + 1, filtered.length - 1));
      } else if (key === 'arrowleft') {
        setCurrentIndex(idx => Math.max(idx - 1, 0));
      } else {
        Object.entries(TYPE_SHORTCUTS).forEach(([type, shortcut]) => {
          if (key === shortcut) {
            const nextIndex = filtered.findIndex(
              (ev, i) => i > currentIndex && ev.type === type
            );
            if (nextIndex !== -1) setCurrentIndex(nextIndex);
          }
        });
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  });

  // Toggle type filter
  const toggleType = type => {
    const next = new Set(selectedTypes);
    next.has(type) ? next.delete(type) : next.add(type);
    setSelectedTypes(next);
    setCurrentIndex(0);
  };

  // Apply filters and search
  const filtered = events.filter(
    e =>
      selectedTypes.has(e.type) &&
      JSON.stringify(e)
        .toLowerCase()
        .includes(searchTerm.toLowerCase())
  );
  const event = filtered[currentIndex] || {};

   // Prepare the highlighted HTML
  const rawJson = JSON.stringify(event, null, 2)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  const highlighted = searchTerm
    ? rawJson.replace(
        new RegExp(`(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'),
        '<mark>$1</mark>'
      )
    : rawJson;

  // Download JSON
  const downloadEvent = () => {
    const blob = new Blob([JSON.stringify(event, null, 2)], {
      type: 'application/json'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `session-${id}-event-${currentIndex + 1}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Copy JSON to clipboard with toast
  const copyEvent = () => {
    const text = JSON.stringify(event, null, 2);
    navigator.clipboard
      .writeText(text)
      .then(() => {
        setShowToast(true);
        setTimeout(() => setShowToast(false), 2000);
      })
      .catch(err => console.error('Failed to copy:', err));
  };

  return (
    <div className="container">
      {showToast && (
        <div
          style={{
            position: 'fixed',
            bottom: 20,
            right: 20,
            background: 'var(--link-color)',
            color: 'var(--bg-color)',
            padding: '8px 12px',
            borderRadius: 4,
            boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
            zIndex: 1000
          }}
        >
          Copied to clipboard!
        </div>
      )}

      <Link to="/">← Back</Link>
      <h2>Session {id}</h2>

      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
        <button onClick={() => setIsPlaying(p => !p)} className="theme-toggle-button" style={{ marginRight: 8 }}>
          {isPlaying ? <Pause /> : <Play />}
        </button>
        <select value={speed} onChange={e => setSpeed(Number(e.target.value))} style={{ marginRight: 16 }}>
          <option value={200}>200ms</option>
          <option value={500}>500ms</option>
          <option value={1000}>1s</option>
          <option value={2000}>2s</option>
        </select>
      </div>

      <div className="filter-panel">
        <input
          type="text"
          placeholder="Search events..."
          value={searchTerm}
          onChange={e => {
            setSearchTerm(e.target.value);
            setCurrentIndex(0);
          }}
          style={{
            width: '97%',
            padding: '8px',
            marginBottom: '12px',
            background: 'var(--filter-bg)',
            border: '1px solid var(--card-border)',
            borderRadius: '4px',
            color: 'var(--text-color)'
          }}
        />
        <strong>Filter Events:</strong>
        <br />
        {allTypes.map(type => {
          const shortcut = TYPE_SHORTCUTS[type];
          return (
            <label
              key={type}
              style={{ marginRight: 12, display: 'inline-block' }}
            >
              <input
                type="checkbox"
                checked={selectedTypes.has(type)}
                onChange={() => toggleType(type)}
              />{' '}
              {type}
              {shortcut && (
                <span
                  style={{
                    color: 'var(--link-color)',
                    marginLeft: 4,
                    fontStyle: 'italic'
                  }}
                >
                  ({shortcut.toUpperCase()})
                </span>
              )}
            </label>
          );
        })}
      </div>

      <div style={{ marginBottom: 22 }}>
        <strong>
          Event {currentIndex + 1} of {filtered.length}
        </strong>
        {event.timestamp && (
          <span
            style={{
              marginLeft: 16,
              fontSize: 14,
              color: 'var(--text-color)'
            }}
          >
            {new Date(event.timestamp).toLocaleString()}
          </span>
        )}
        <button
          onClick={downloadEvent}
          style={{
            float: 'right',
            background: 'var(--link-color)',
            border: 'none',
            color: 'var(--bg-color)',
            padding: '8px 8px',
            borderRadius: 4,
            cursor: 'pointer',
            marginLeft: 8
          }}
        >
          Download JSON
        </button>
        <button
          onClick={copyEvent}
          style={{
            float: 'right',
            background: 'var(--link-color)',
            border: 'none',
            color: 'var(--bg-color)',
            padding: '8px 8px',
            borderRadius: 4,
            cursor: 'pointer'
          }}
        >
          Copy JSON
        </button>
      </div>

      <MiniTimeline
        events={filtered}
        currentIndex={currentIndex}
        onSelect={setCurrentIndex}
      />

      <TimelineScrubber
        length={filtered.length}
        currentIndex={currentIndex}
        onChange={setCurrentIndex}
      />

      <div className="event-container" style={{ opacity: fade ? 1 : 0 }}>
        {/* Dangerously inject highlighted JSON */}
        <pre
          className="event-json"
          dangerouslySetInnerHTML={{ __html: highlighted }}
        />
      </div>
    </div>
  );
}

export default SessionViewer;
