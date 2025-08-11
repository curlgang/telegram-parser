import { useState, useEffect } from 'react';
import './App.css';

function parseTelegram(text) {
  const lines = text.split(/\r?\n/);
  const messages = [];
  let current = null;
  const headerRegex = /^([^,]+), \[(.+?)\]:$/;
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
  // Assign color and alignment based on sender
  const isFirstUser = sender === 'Yeen/Sparx'; // You can improve this logic as needed
  const bubbleClass = `chat-bubble ${isFirstUser ? 'purple left' : 'blue right'}`;

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

  // For demo: blue = right, purple = left
  const isFirstUser = sender => sender === 'Yeen/Sparx';

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
      </div>
      <div>
        {messages.map((msg, idx) => (
          <ChatBubble
            key={idx}
            {...msg}
            collapsed={
              (isFirstUser(msg.sender) && collapsePurple) ||
              (!isFirstUser(msg.sender) && collapseBlue)
            }
            showNames={showNames}
          />
        ))}
      </div>
    </div>
  );
}

export default App;
