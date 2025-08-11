import { useState, useEffect, useRef } from 'react';
import './App.css';

function parseTelegram(text) {
  const lines = text.split(/\r?\n/);
  const messages = [];
  let current = null;
  // Support both Telegram and Telegram Lite timestamp formats
  // Telegram: Name, [Aug 10, 2025 at 12:43:22 PM]:
  // Telegram Lite: Name, [8/10/25 2:27 AM]
  const headerRegex = /^([^,]+), \[(.+?)\](?::)?$/;
  for (let line of lines) {
    const headerMatch = line.match(headerRegex);
    if (headerMatch) {
      if (current) messages.push(current);
      current = {
        sender: headerMatch[1],
        timestamp: headerMatch[2],
        text: ''
      };
    } else if (current) {
      if (current.text) current.text += '\n';
      current.text += line;
    }
  }
  if (current) messages.push(current);
  return messages.filter(m => m.text.trim() !== '');
}

function ChatBubble({ sender, timestamp, text, collapsed, showNames }) {
  // Assign color and alignment based on sender (isFirstUser is passed as a prop)
  const bubbleClass = `chat-bubble ${arguments[0].isFirstUser ? 'purple left' : 'blue right'}`;

  if (collapsed) {
    return (
      <div className={bubbleClass + ' collapsed-bubble'}>
        <div className="collapsed-line" />
      </div>
    );
  }

  return (
    <div className={bubbleClass}>
      {showNames && (
        <div className="chat-header">
          <strong>{sender}</strong> <span className="chat-time">[{timestamp}]</span>
        </div>
      )}
      <div className="chat-text">{text.split('\n').map((l,i) => <div key={i}>{l}</div>)}</div>
    </div>
  );
}

function App() {
  // Toggle auto-scroll logic extracted for reuse
  const [autoScrollSpeed, setAutoScrollSpeed] = useState(30); // px per second
  const autoScrollSpeedRef = useRef(autoScrollSpeed);
  const [showSpeedSlider, setShowSpeedSlider] = useState(false);

  useEffect(() => {
    autoScrollSpeedRef.current = autoScrollSpeed;
  }, [autoScrollSpeed]);

  function toggleAutoScroll() {
    if (window.__autoScrollRAF) {
      cancelAnimationFrame(window.__autoScrollRAF);
      window.__autoScrollRAF = null;
      window.__autoScrollLast = null;
      window.__autoScrollRemainder = null;
      setAutoScrollOn(false);
    } else {
      window.__autoScrollRemainder = 0;
      function step(ts) {
        if (!window.__autoScrollLast) window.__autoScrollLast = ts;
        const elapsed = ts - window.__autoScrollLast;
        let px = (autoScrollSpeedRef.current * elapsed) / 1000 + (window.__autoScrollRemainder || 0);
        const pxInt = Math.floor(px);
        window.__autoScrollRemainder = px - pxInt;
        if (pxInt > 0) window.scrollBy(0, pxInt);
        window.__autoScrollLast = ts;
        window.__autoScrollRAF = requestAnimationFrame(step);
      }
      window.__autoScrollRAF = requestAnimationFrame(step);
      setAutoScrollOn(true);
    }
  }

  useEffect(() => {
    function handleSpace(e) {
      if (e.code === 'Space' && !e.repeat && document.activeElement.tagName !== 'TEXTAREA' && document.activeElement.tagName !== 'INPUT') {
        e.preventDefault();
        toggleAutoScroll();
      }
    }
    window.addEventListener('keydown', handleSpace);
    return () => window.removeEventListener('keydown', handleSpace);
  }, []);
  const [autoScrollOn, setAutoScrollOn] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [collapseBlue, setCollapseBlue] = useState(false);
  const [collapsePurple, setCollapsePurple] = useState(false);
  const [showNames, setShowNames] = useState(true);

  useEffect(() => {
    document.title = 'Telegram Chat Parser';
  }, []);

  const handleParse = () => {
    setMessages(parseTelegram(input));
    setCollapseBlue(false);
    setCollapsePurple(false);
  };

  // Assign user1 to the sender of the first message, user2 to the sender of the next message with a different name
  let user1 = null, user2 = null;
  for (const msg of messages) {
    if (!user1) user1 = msg.sender;
    else if (!user2 && msg.sender !== user1) {
      user2 = msg.sender;
      break;
    }
  }
  const isFirstUser = sender => sender === user1;

  return (
    <div>
      <h1>Telegram Chat Parser</h1>
      <textarea
        value={input}
        onChange={e => setInput(e.target.value)}
        placeholder="Paste your Telegram chat text here..."
        rows={10}
        style={{ width: '100%', marginBottom: 12 }}
      />
      <br />
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 24 }}>
        <div style={{ position: 'relative', marginRight: 12 }}>
          <button
            aria-label="Menu"
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6 }}
            onClick={() => setMenuOpen(m => !m)}
          >
            <span style={{ display: 'inline-block', width: 24, height: 24 }}>
              <span style={{ display: 'block', width: 24, height: 3, background: '#888', margin: '4px 0', borderRadius: 2 }}></span>
              <span style={{ display: 'block', width: 24, height: 3, background: '#888', margin: '4px 0', borderRadius: 2 }}></span>
              <span style={{ display: 'block', width: 24, height: 3, background: '#888', margin: '4px 0', borderRadius: 2 }}></span>
            </span>
          </button>
          {menuOpen && (
            <div style={{ position: 'absolute', left: 0, top: 32, background: '#fff', border: '1px solid #ddd', borderRadius: 8, boxShadow: '0 2px 8px #0001', zIndex: 10, minWidth: 180 }}>
              <button
                style={{ display: 'block', width: '100%', background: 'none', border: 'none', padding: '10px 16px', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', fontSize: '1em', color: '#111' }}
                onClick={() => { setCollapseBlue(v => !v); setMenuOpen(false); }}
              >Toggle blue bubbles</button>
              <button
                style={{ display: 'block', width: '100%', background: 'none', border: 'none', padding: '10px 16px', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', fontSize: '1em', color: '#111' }}
                onClick={() => { setCollapsePurple(v => !v); setMenuOpen(false); }}
              >Toggle purple bubbles</button>
              <button
                style={{ display: 'block', width: '100%', background: 'none', border: 'none', padding: '10px 16px', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', fontSize: '1em', color: '#111' }}
                onClick={() => { setShowNames(s => !s); setMenuOpen(false); }}
              >Toggle names</button>
              <button
                style={{ display: 'block', width: '100%', background: 'none', border: 'none', padding: '10px 16px', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', fontSize: '1em', color: '#111' }}
                onClick={() => { setCollapseBlue(false); setCollapsePurple(false); setMenuOpen(false); }}
              >Expand all</button>
            </div>
          )}
        </div>
        <button onClick={handleParse}>Parse Chat</button>
        <div style={{ position: 'relative', display: 'inline-block' }}
          onMouseEnter={() => setShowSpeedSlider(true)}
          onMouseLeave={() => setShowSpeedSlider(false)}
        >
          <button
            style={{
              marginLeft: 12,
              background: autoScrollOn ? '#22c55e' : '#111',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              padding: '8px 18px',
              fontSize: '1em',
              fontFamily: 'inherit',
              cursor: 'pointer',
              fontWeight: 500,
              transition: 'background 0.2s'
            }}
            onClick={toggleAutoScroll}
          >Auto-Scroll</button>
          {showSpeedSlider && (
            <div style={{
              position: 'absolute',
              left: 0,
              top: '110%',
              background: '#222',
              padding: '12px 18px 10px 18px',
              borderRadius: 10,
              boxShadow: '0 2px 8px #0005',
              zIndex: 20,
              minWidth: 180,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              color: '#fff',
              fontSize: '0.98em',
              fontFamily: 'inherit',
              fontWeight: 500
            }}>
              <label htmlFor="scroll-speed-slider" style={{ marginBottom: 6 }}>Scroll Speed: {autoScrollSpeed} px/sec</label>
              <input
                id="scroll-speed-slider"
                type="range"
                min={5}
                max={200}
                value={autoScrollSpeed}
                onChange={e => setAutoScrollSpeed(Number(e.target.value))}
                style={{ width: 120 }}
              />
            </div>
          )}
        </div>
      </div>
      <div>
        {messages.map((msg, idx) => {
          const hide = (isFirstUser(msg.sender) && collapsePurple) || (!isFirstUser(msg.sender) && collapseBlue);
          if (hide) return null;
          return (
            <ChatBubble
              key={idx}
              {...msg}
              showNames={showNames}
              isFirstUser={isFirstUser(msg.sender)}
            />
          );
        })}
      </div>
    </div>
  );
}

export default App;
