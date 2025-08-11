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
  // Track current narration position for resume on voice change
  const [narrationCharIndex, setNarrationCharIndex] = useState(0);
  const narrationTextRef = useRef('');
  // Narration logic
  // Narration state and logic
  const [narrating, setNarrating] = useState(false);
  const [narrationPaused, setNarrationPaused] = useState(false);
  const [voices, setVoices] = useState([]);
  const [selectedVoice, setSelectedVoice] = useState(null);
  const [voiceStack, setVoiceStack] = useState([]); // stack of voiceURIs, top is selected
  const [showVoiceList, setShowVoiceList] = useState(false);
  const [voiceListFade, setVoiceListFade] = useState(false);
  const voiceListTimeoutRef = useRef();
  const utterRef = useRef(null);

  // Load voices on mount
  useEffect(() => {
    if (!('speechSynthesis' in window)) return;
    function updateVoices() {
      const v = window.speechSynthesis.getVoices();
      setVoices(v);
      // Set default voice and stack if not set
      if (!selectedVoice && v.length > 0) {
        setSelectedVoice(v[0].voiceURI);
        setVoiceStack([v[0].voiceURI, ...v.filter(voice => voice.voiceURI !== v[0].voiceURI).map(voice => voice.voiceURI)]);
      } else if (selectedVoice && v.length > 0) {
        // Ensure stack is in sync with available voices
        setVoiceStack(stack => {
          // Remove any voices not in v
          const availableURIs = v.map(voice => voice.voiceURI);
          let filtered = stack.filter(uri => availableURIs.includes(uri));
          // Add any new voices to the end
          v.forEach(voice => {
            if (!filtered.includes(voice.voiceURI)) filtered.push(voice.voiceURI);
          });
          // Ensure selectedVoice is at the top
          if (filtered[0] !== selectedVoice) {
            filtered = [selectedVoice, ...filtered.filter(uri => uri !== selectedVoice)];
          }
          return filtered;
        });
      }
    }
    updateVoices();
    window.speechSynthesis.onvoiceschanged = updateVoices;
    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
    // eslint-disable-next-line
  }, []);

  function handleNarrateClick() {
    if (!('speechSynthesis' in window)) {
      alert('Sorry, your browser does not support speech synthesis.');
      return;
    }
    // If currently narrating and not paused, stop narration and reset button color
    if (narrating && !narrationPaused) {
      window.speechSynthesis.cancel();
      setNarrating(false);
      setNarrationPaused(false);
      return;
    }
    // If paused, resume
    if (narrating && narrationPaused) {
      window.speechSynthesis.resume();
      setNarrationPaused(false);
      return;
    }
    // If not narrating, start from beginning
    window.speechSynthesis.cancel();
    // Only narrate visible messages (not collapsed)
    const narrateMessages = messages.filter(msg => {
      const hide = (isFirstUser(msg.sender) && collapsePurple) || (!isFirstUser(msg.sender) && collapseBlue);
      return !hide;
    });
    if (narrateMessages.length === 0) return;
    const narrationText = narrateMessages.map(msg =>
      (showNames ? `${msg.sender} says: ` : '') + msg.text
    ).join('. ');
    narrationTextRef.current = narrationText;
    setNarrationCharIndex(0);
    const utter = new window.SpeechSynthesisUtterance(narrationText);
    utter.rate = 1;
    utter.pitch = 1;
    utter.volume = 1;
    // Set selected voice
    if (voices && voices.length > 0 && selectedVoice) {
      const v = voices.find(v => v.voiceURI === selectedVoice);
      if (v) utter.voice = v;
    }
    utter.onstart = () => {
      setNarrating(true);
      setNarrationPaused(false);
    };
    utter.onend = () => {
      setNarrating(false);
      setNarrationPaused(false);
      utterRef.current = null;
      setNarrationCharIndex(0);
    };
    utter.onerror = () => {
      setNarrating(false);
      setNarrationPaused(false);
      utterRef.current = null;
      setNarrationCharIndex(0);
    };
    utter.onboundary = e => {
      if (e.name === 'word' || e.name === 'sentence') {
        setNarrationCharIndex(e.charIndex);
      }
    };
    utterRef.current = utter;
    window.speechSynthesis.speak(utter);
  }

  // If user starts another narration, cancel previous
  useEffect(() => {
    return () => {
      window.speechSynthesis.cancel();
    };
  }, []);
  // Toggle auto-scroll logic extracted for reuse
  const [autoScrollSpeed, setAutoScrollSpeed] = useState(30); // px per second
  const autoScrollSpeedRef = useRef(autoScrollSpeed);
  const [showSpeedSlider, setShowSpeedSlider] = useState(false);
  const [speedSliderFade, setSpeedSliderFade] = useState(false);
  const speedSliderTimeoutRef = useRef();

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
  const [menuFade, setMenuFade] = useState(false);
  const menuTimeoutRef = useRef();
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
        <button onClick={handleParse}>Parse Chat</button>
      </div>
      {/* Fixed top-right controls */}
      <div style={{ position: 'fixed', top: 24, right: 32, zIndex: 1000, display: 'flex', alignItems: 'center', gap: 16 }}>
      {/* Narrate button and voice list in shared container with fade logic */}
      <div
        style={{ position: 'relative', display: 'inline-block' }}
        onMouseEnter={() => {
          if (voiceListTimeoutRef.current) clearTimeout(voiceListTimeoutRef.current);
          setVoiceListFade(false);
          setShowVoiceList(true);
        }}
        onMouseLeave={() => {
          voiceListTimeoutRef.current = setTimeout(() => {
            setVoiceListFade(true);
            setTimeout(() => setShowVoiceList(false), 200);
          }, 500);
        }}
      >
        <button
          style={{
            background: narrating ? '#22c55e' : '#111',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            padding: '8px 18px',
            fontSize: '1em',
            fontFamily: 'inherit',
            cursor: 'pointer',
            fontWeight: 500,
            transition: 'background 0.2s',
            boxShadow: '0 2px 8px #0003'
          }}
          onClick={handleNarrateClick}
          title={'Narrate all visible chat messages'}
        >
          Narrate
        </button>
        {showVoiceList && voices.length > 0 && (
          <div
            style={{
              position: 'absolute',
              left: '50%',
              top: '110%',
              transform: 'translateX(-50%)',
              background: '#222',
              padding: '12px 18px 10px 18px',
              borderRadius: 10,
              boxShadow: '0 2px 8px #0005',
              zIndex: 30,
              minWidth: 220,
              maxHeight: 320,
              overflowY: 'auto',
              color: '#fff',
              fontSize: '0.98em',
              fontFamily: 'inherit',
              fontWeight: 500,
              whiteSpace: 'normal',
              textAlign: 'left',
              marginTop: 4,
              opacity: voiceListFade ? 0 : 1,
              transition: 'opacity 0.18s'
            }}
            onMouseEnter={() => {
              if (voiceListTimeoutRef.current) clearTimeout(voiceListTimeoutRef.current);
              setVoiceListFade(false);
              setShowVoiceList(true);
            }}
            onMouseLeave={() => {
              voiceListTimeoutRef.current = setTimeout(() => {
                setVoiceListFade(true);
                setTimeout(() => setShowVoiceList(false), 200);
              }, 500);
            }}
          >
            <div style={{ fontWeight: 700, marginBottom: 8 }}>Select Narrator:</div>
            {voiceStack
              .map(uri => voices.find(v => v.voiceURI === uri))
              .filter(Boolean)
              .map(voice => (
                <div
                  key={voice.voiceURI}
                  style={{
                    padding: '6px 0',
                    cursor: 'pointer',
                    background: selectedVoice === voice.voiceURI ? '#333' : 'none',
                    borderRadius: 6,
                    marginBottom: 2
                  }}
                  onClick={() => {
                    // Move selected voice to top of stack
                    setVoiceStack(stack => [voice.voiceURI, ...stack.filter(uri => uri !== voice.voiceURI)]);
                    setSelectedVoice(voice.voiceURI);
                    if (narrating || narrationPaused) {
                      window.speechSynthesis.cancel();
                      // Resume from current char index
                      const text = narrationTextRef.current;
                      const start = narrationCharIndex;
                      const resumeText = text.slice(start);
                      if (!resumeText.trim()) return;
                      const utter = new window.SpeechSynthesisUtterance(resumeText);
                      utter.rate = 1;
                      utter.pitch = 1;
                      utter.volume = 1;
                      const v = voices.find(v => v.voiceURI === voice.voiceURI);
                      if (v) utter.voice = v;
                      utter.onstart = () => {
                        setNarrating(true);
                        setNarrationPaused(false);
                      };
                      utter.onend = () => {
                        setNarrating(false);
                        setNarrationPaused(false);
                        utterRef.current = null;
                        setNarrationCharIndex(0);
                      };
                      utter.onerror = () => {
                        setNarrating(false);
                        setNarrationPaused(false);
                        utterRef.current = null;
                        setNarrationCharIndex(0);
                      };
                      utter.onboundary = e => {
                        if (e.name === 'word' || e.name === 'sentence') {
                          setNarrationCharIndex(start + e.charIndex);
                        }
                      };
                      utterRef.current = utter;
                      window.speechSynthesis.speak(utter);
                    }
                  }}
                  title={voice.lang + (voice.default ? ' (default)' : '')}
                >
                  {voice.name} <span style={{ fontSize: '0.9em', color: '#aaa' }}>({voice.lang})</span>
                  {voice.default && <span style={{ color: '#22c55e', marginLeft: 6 }}>(default)</span>}
                </div>
              ))}
          </div>
        )}
      </div>
        <div
          style={{ position: 'relative', display: 'inline-block', minWidth: 0 }}
          onMouseEnter={() => {
            if (speedSliderTimeoutRef.current) clearTimeout(speedSliderTimeoutRef.current);
            setSpeedSliderFade(false);
            setShowSpeedSlider(true);
          }}
          onMouseLeave={() => {
            speedSliderTimeoutRef.current = setTimeout(() => {
              setSpeedSliderFade(true);
              setTimeout(() => setShowSpeedSlider(false), 200);
            }, 500);
          }}
        >
          <button
            style={{
              marginLeft: 0,
              background: autoScrollOn ? '#22c55e' : '#111',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              padding: '8px 18px',
              fontSize: '1em',
              fontFamily: 'inherit',
              cursor: 'pointer',
              fontWeight: 500,
              transition: 'background 0.2s',
              boxShadow: '0 2px 8px #0003'
            }}
            onClick={toggleAutoScroll}
          >Auto-Scroll</button>
          {showSpeedSlider && (
            <div
              style={{
                position: 'absolute',
                left: '50%',
                top: '110%',
                transform: 'translateX(-50%)',
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
                fontWeight: 500,
                opacity: speedSliderFade ? 0 : 1,
                transition: 'opacity 0.18s'
              }}
              onMouseEnter={() => {
                if (speedSliderTimeoutRef.current) clearTimeout(speedSliderTimeoutRef.current);
                setSpeedSliderFade(false);
                setShowSpeedSlider(true);
              }}
              onMouseLeave={() => {
                speedSliderTimeoutRef.current = setTimeout(() => {
                  setSpeedSliderFade(true);
                  setTimeout(() => setShowSpeedSlider(false), 200);
                }, 500);
              }}
            >
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
        <div
          style={{ position: 'relative', display: 'inline-block' }}
          onMouseEnter={() => {
            if (menuTimeoutRef.current) clearTimeout(menuTimeoutRef.current);
            setMenuFade(false);
            setMenuOpen(true);
          }}
          onMouseLeave={() => {
            menuTimeoutRef.current = setTimeout(() => {
              setMenuFade(true);
              setTimeout(() => setMenuOpen(false), 200);
            }, 500);
          }}
        >
          <button
            aria-label="Menu"
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6 }}
          >
            <span style={{ display: 'inline-block', width: 24, height: 24 }}>
              <span style={{ display: 'block', width: 24, height: 3, background: '#888', margin: '4px 0', borderRadius: 2 }}></span>
              <span style={{ display: 'block', width: 24, height: 3, background: '#888', margin: '4px 0', borderRadius: 2 }}></span>
              <span style={{ display: 'block', width: 24, height: 3, background: '#888', margin: '4px 0', borderRadius: 2 }}></span>
            </span>
          </button>
          {menuOpen && (
            <div
              style={{
                position: 'absolute',
                right: 0,
                top: '110%',
                background: '#222',
                padding: '12px 18px 10px 18px',
                borderRadius: 10,
                boxShadow: '0 2px 8px #0005',
                zIndex: 20,
                minWidth: 180,
                maxWidth: 320,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'stretch',
                color: '#fff',
                fontSize: '0.98em',
                fontFamily: 'inherit',
                fontWeight: 500,
                whiteSpace: 'normal',
                overflowWrap: 'break-word',
                textAlign: 'left',
                opacity: menuFade ? 0 : 1,
                transition: 'opacity 0.18s'
              }}
              onMouseEnter={() => {
                if (menuTimeoutRef.current) clearTimeout(menuTimeoutRef.current);
                setMenuFade(false);
                setMenuOpen(true);
              }}
              onMouseLeave={() => {
                menuTimeoutRef.current = setTimeout(() => {
                  setMenuFade(true);
                  setTimeout(() => setMenuOpen(false), 200);
                }, 2000);
              }}
            >
              <button
                style={{ display: 'block', width: '100%', background: 'none', border: 'none', padding: '10px 0', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', fontSize: '1em', color: '#fff', borderRadius: 6, transition: 'background 0.2s' }}
                onMouseOver={e => e.currentTarget.style.background = '#333'}
                onMouseOut={e => e.currentTarget.style.background = 'none'}
                onClick={() => { setCollapseBlue(v => !v); setMenuOpen(false); }}
              >Toggle blue bubbles</button>
              <button
                style={{ display: 'block', width: '100%', background: 'none', border: 'none', padding: '10px 0', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', fontSize: '1em', color: '#fff', borderRadius: 6, transition: 'background 0.2s' }}
                onMouseOver={e => e.currentTarget.style.background = '#333'}
                onMouseOut={e => e.currentTarget.style.background = 'none'}
                onClick={() => { setCollapsePurple(v => !v); setMenuOpen(false); }}
              >Toggle purple bubbles</button>
              <button
                style={{ display: 'block', width: '100%', background: 'none', border: 'none', padding: '10px 0', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', fontSize: '1em', color: '#fff', borderRadius: 6, transition: 'background 0.2s' }}
                onMouseOver={e => e.currentTarget.style.background = '#333'}
                onMouseOut={e => e.currentTarget.style.background = 'none'}
                onClick={() => { setShowNames(s => !s); setMenuOpen(false); }}
              >Toggle names</button>
              <button
                style={{ display: 'block', width: '100%', background: 'none', border: 'none', padding: '10px 0', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', fontSize: '1em', color: '#fff', borderRadius: 6, transition: 'background 0.2s' }}
                onMouseOver={e => e.currentTarget.style.background = '#333'}
                onMouseOut={e => e.currentTarget.style.background = 'none'}
                onClick={() => { setCollapseBlue(false); setCollapsePurple(false); setMenuOpen(false); }}
              >Expand all</button>
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
