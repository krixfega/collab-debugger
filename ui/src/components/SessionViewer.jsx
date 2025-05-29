import { io } from 'socket.io-client';
import React, { useEffect, useState, useRef } from 'react';
import { useParams, Link, useLocation, useNavigate } from 'react-router-dom';
import api from '../api';
import TimelineScrubber from './TimelineScrubber';
import MiniTimeline from './MiniTimeline';
import { Play, Pause, RotateCcw, RotateCw } from 'lucide-react';
import { Light as SyntaxHighlighter } from 'react-syntax-highlighter';
import jsonLang from 'react-syntax-highlighter/dist/esm/languages/hljs/json';
import { atomOneDark } from 'react-syntax-highlighter/dist/esm/styles/hljs';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid
} from 'recharts';
import '../index.css';

const SOCKET_URL = import.meta.env.VITE_WS_URL || 'http://localhost:4000';

// Register JSON syntax highlighting
SyntaxHighlighter.registerLanguage('json', jsonLang);

export default function SessionViewer() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  // --- State ---
  const [events, setEvents] = useState([]);
  const [sessionMeta, setSessionMeta] = useState({ user_id: '', branch: '', created_at: '' });
  const [tags, setTags] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(`session-tags-${id}`)) || [];
    } catch {
      return [];
    }
  });
  const [newTag, setNewTag] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [fade, setFade] = useState(true);
  const [showToast, setShowToast] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(500);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');

  // Refs
  const playRef = useRef(null);
  const historyRef = useRef({ past: [], future: [] });
  const socketRef = useRef(null);

  // Navigate with history + update deep-link
  const navigateTo = index => {
    historyRef.current.past.push(currentIndex);
    historyRef.current.future = [];
    setCurrentIndex(index);
    navigate({ search: `?event=${index + 1}` }, { replace: true });
  };
  const undo = () => {
    const { past, future } = historyRef.current;
    if (past.length) {
      const prev = past.pop();
      future.push(currentIndex);
      setCurrentIndex(prev);
      navigate({ search: `?event=${prev + 1}` }, { replace: true });
    }
  };
  const redo = () => {
    const { past, future } = historyRef.current;
    if (future.length) {
      const next = future.pop();
      past.push(currentIndex);
      setCurrentIndex(next);
      navigate({ search: `?event=${next + 1}` }, { replace: true });
    }
  };

  // Fetch metadata, events, comments
  useEffect(() => {
    api.get('/sessions').then(res => {
      const meta = res.data.find(s => s.id === id);
      if (meta) setSessionMeta(meta);
    });
    api.get(`/sessions/${id}/blob`).then(res => {
      setEvents(res.data);
      historyRef.current = { past: [], future: [] };
      const evParam = parseInt(new URLSearchParams(location.search).get('event'), 10);
      setCurrentIndex(!isNaN(evParam) && evParam > 0 && evParam <= res.data.length ? evParam - 1 : 0);
    });
    api.get(`/sessions/${id}/comments`).then(res => setComments(res.data));
  }, [id, location.search]);

  // Persist tags
  useEffect(() => {
    localStorage.setItem(`session-tags-${id}`, JSON.stringify(tags));
  }, [tags, id]);

  // Auto-play
  useEffect(() => {
    if (isPlaying) {
      playRef.current = setInterval(() => {
        setCurrentIndex(idx => {
          const filt = events.filter(e => JSON.stringify(e).toLowerCase().includes(searchTerm.toLowerCase()));
          return idx < filt.length - 1 ? idx + 1 : idx;
        });
      }, speed);
    } else {
      clearInterval(playRef.current);
    }
    return () => clearInterval(playRef.current);
  }, [isPlaying, speed, events, searchTerm]);

  // Fade animation
  useEffect(() => {
    setFade(false);
    const t = setTimeout(() => setFade(true), 50);
    return () => clearTimeout(t);
  }, [currentIndex, searchTerm]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKey = e => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault(); undo();
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'Z'))) {
        e.preventDefault(); redo();
      } else if (e.key === 'ArrowRight') {
        navigateTo(Math.min(currentIndex + 1, filtered.length - 1));
      } else if (e.key === 'ArrowLeft') {
        navigateTo(Math.max(currentIndex - 1, 0));
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  });

  // Filter events & current event
  const filtered = events.filter(e => JSON.stringify(e).toLowerCase().includes(searchTerm.toLowerCase()));
  const event = filtered[currentIndex] || {};

  // Download & Copy handlers
  const downloadEvent = () => {
    const blob = new Blob([JSON.stringify(event, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `session-${id}-event-${currentIndex + 1}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };
  const copyEvent = () => {
    navigator.clipboard.writeText(JSON.stringify(event, null, 2)).then(() => {
      setShowToast(true);
      setTimeout(() => setShowToast(false), 2000);
    });
  };

  // WebSocket connection
  useEffect(() => {
    socketRef.current = io(SOCKET_URL);
    socketRef.current.emit('join-session', { sessionId: id, userId: sessionMeta.user_id });
    socketRef.current.on('scrub-to', ({ index }) => navigateTo(index));
    socketRef.current.on('new-comment', comment => setComments(cs => [...cs, comment]));
    return () => socketRef.current.disconnect();
  }, [id, sessionMeta.user_id]);

  // Post a new comment
  const postComment = e => {
    e.preventDefault();
    api.post(`/sessions/${id}/comments`, { event_index: currentIndex, user_id: sessionMeta.user_id, text: newComment })
      .then(({ data }) => socketRef.current.emit('new-comment', data));
    setNewComment('');
  };

  return (
    <div className="container">
      {showToast && (
        <div className="toast">Copied to clipboard!</div>
      )}

      {/* Navigation */}
      <Link to="/">← Back</Link>
      <h2>Session {id}</h2>

      {/* Metadata */}
      <div className="metadata">
        <strong>User:</strong> {sessionMeta.user_id || 'N/A'} | 
        <strong>Branch:</strong> {sessionMeta.branch || 'N/A'} | 
        <strong>Created:</strong> {sessionMeta.created_at ? new Date(sessionMeta.created_at).toLocaleString() : 'N/A'}
      </div>

      {/* Tags */}
      <div className="filter-panel">
        <strong>Tags:</strong>
        {tags.map((tag, idx) => (
          <span key={idx} className="tag">
            {tag}
            <button onClick={() => setTags(tags.filter((_, i) => i !== idx))}>×</button>
          </span>
        ))}
        <div className="add-tag">
          <input placeholder="Add tag" value={newTag} onChange={e => setNewTag(e.target.value)} />
          <button onClick={() => { if (newTag.trim()) { setTags([...tags, newTag.trim()]); setNewTag(''); } }}>Add Tag</button>
        </div>
      </div>

      {/* Controls */}
      <div className="controls">
        <button onClick={undo}><RotateCcw /></button>
        <button onClick={redo}><RotateCw /></button>
        <button onClick={() => setIsPlaying(p => !p)} className="theme-toggle-button">
          {isPlaying ? <Pause /> : <Play />}
        </button>
        <select value={speed} onChange={e => setSpeed(Number(e.target.value))}>
          <option value={200}>200ms</option>
          <option value={500}>500ms</option>
          <option value={1000}>1s</option>
          <option value={2000}>2s</option>
        </select>
        <input className="search" placeholder="Search events..." value={searchTerm} onChange={e => { setSearchTerm(e.target.value); historyRef.current = { past: [], future: [] }; navigateTo(0); }} />
      </div>

      {/* Count & Actions */}
      <div className="counter">
        Event {currentIndex + 1} of {filtered.length}
        {event.timestamp && <span className="time">{new Date(event.timestamp).toLocaleString()}</span>}
        <button onClick={downloadEvent}>Download JSON</button>
        <button onClick={copyEvent}>Copy JSON</button>
      </div>

      {/* Performance Metrics */}
      <div className="metrics-pane">
        <h3>Performance Metrics</h3>
        <LineChart width={700} height={250} data={events.filter(e => e.type === 'snapshot' && e.name === 'memory-usage').map(e => ({ time: new Date(e.timestamp).toLocaleTimeString(), heapMB: +(e.data.heapUsed/(1024*1024)).toFixed(2) }))} margin={{ top:5,right:20,left:0,bottom:5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" />
          <XAxis dataKey="time" stroke="var(--text-color)" />
          <YAxis stroke="var(--text-color)" unit="MB" />
          <Tooltip contentStyle={{ backgroundColor: 'var(--card-bg)', borderColor:'var(--card-border)' }} />
          <Line type="monotone" dataKey="heapMB" stroke="var(--link-color)" dot={false} />
        </LineChart>
      </div>

      {/* Timeline & Scrubber */}
      <MiniTimeline events={filtered} currentIndex={currentIndex} onSelect={navigateTo} />
      <TimelineScrubber length={filtered.length} currentIndex={currentIndex} onChange={navigateTo} />

      {/* Event Viewer */}
      <div className="event-container" style={{ opacity: fade ? 1 : 0 }}>
        <SyntaxHighlighter language="json" style={atomOneDark} showLineNumbers>
          {JSON.stringify(event,null,2)}
        </SyntaxHighlighter>
      </div>

      {/* Comments */}
      <aside className="comments-panel">
        <h4>Annotations</h4>
        {comments.map(c => (
          <div key={c.id} className="comment">
            <small>{c.user_id} @ {new Date(c.created_at).toLocaleTimeString()}</small>
            <p>{c.text}</p>
          </div>
        ))}
        <form className="comment-form" onSubmit={postComment}>
          <input placeholder="Add note" value={newComment} onChange={e => setNewComment(e.target.value)} />
          <button type="submit">Comment</button>
        </form>
      </aside>
    </div>
  );
}