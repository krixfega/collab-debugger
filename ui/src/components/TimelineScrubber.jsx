import React from 'react';
import '../index.css';

function TimelineScrubber({ length, currentIndex, onChange }) {
  return (
    <input
      type="range"
      min={0}
      max={Math.max(0, length - 1)}
      value={currentIndex}
      onChange={e => onChange(Number(e.target.value))}
    />
  );
}

export default TimelineScrubber;