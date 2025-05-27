import React, { useEffect, useState } from 'react';
import api from '../api';
import { Link } from 'react-router-dom';
import '../index.css';

function SessionList() {
  const [sessions, setSessions] = useState([]);
  useEffect(() => { api.get('/sessions').then(res => setSessions(res.data)); }, []);
  return (
    <div className="container">
      <h2>Sessions</h2>
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {sessions.map(s => (
          <li key={s.id} className="session-item">
            <Link to={`/sessions/${s.id}`}>{s.id}</Link>
            <div className="meta">
              {s.user_id} | {s.branch} | {new Date(s.created_at).toLocaleString()}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default SessionList;