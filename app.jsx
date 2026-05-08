const { useState, useEffect, useCallback, useRef } = React;

// --- AUDIO UTILS (Web Audio API) ---
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

const playSound = (type) => {
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }

  const osc = audioCtx.createOscillator();
  const gainNode = audioCtx.createGain();

  osc.connect(gainNode);
  gainNode.connect(audioCtx.destination);

  const now = audioCtx.currentTime;

  if (type === 'normal') {
    // Pop sound
    osc.type = 'sine';
    osc.frequency.setValueAtTime(400, now);
    osc.frequency.exponentialRampToValueAtTime(800, now + 0.1);
    gainNode.gain.setValueAtTime(0.5, now);
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
    osc.start(now);
    osc.stop(now + 0.1);
  } else if (type === 'yellow') {
    // Special chime sound
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(600, now);
    osc.frequency.linearRampToValueAtTime(1200, now + 0.2);
    gainNode.gain.setValueAtTime(0.5, now);
    gainNode.gain.linearRampToValueAtTime(0.01, now + 0.3);
    osc.start(now);
    osc.stop(now + 0.3);
  } else if (type === 'gray') {
    // Error sound
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.linearRampToValueAtTime(100, now + 0.2);
    gainNode.gain.setValueAtTime(0.5, now);
    gainNode.gain.linearRampToValueAtTime(0.01, now + 0.2);
    osc.start(now);
    osc.stop(now + 0.2);
  } else if (type === 'end') {
    // End game sound
    osc.type = 'square';
    osc.frequency.setValueAtTime(300, now);
    osc.frequency.linearRampToValueAtTime(200, now + 0.5);
    gainNode.gain.setValueAtTime(0.3, now);
    gainNode.gain.linearRampToValueAtTime(0.01, now + 0.5);
    osc.start(now);
    osc.stop(now + 0.5);
  }
};

// --- CONSTANTS ---
const GAME_DURATION = 40;
const COLORS = ['#ef4444', '#3b82f6', '#10b981', '#a855f7', '#f97316', '#ec4899'];

// --- COMPONENTS ---

// Floating text for points feedback (+10, -5, etc)
const FloatingText = ({ text, x, y, color }) => {
  return (
    <div
      className="floating-text"
      style={{ left: x, top: y, color: color }}
    >
      {text}
    </div>
  );
};

// Balloon component
const Balloon = ({ id, type, x, speed, onClick }) => {
  const [color, setColor] = useState('');

  useEffect(() => {
    if (type === 'normal') {
      setColor(COLORS[Math.floor(Math.random() * COLORS.length)]);
    }
  }, [type]);

  let className = "balloon";
  if (type === 'yellow') className += " balloon-yellow";
  else if (type === 'gray') className += " balloon-gray";
  else className += " balloon-normal";

  // Use inline style for speed and animation
  return (
    <div
      className="balloon-container floating-wobble"
      style={{
        left: `${x}%`,
        '--speed': `${speed}s`
      }}
      onPointerDown={(e) => {
        e.preventDefault();
        onClick(id, type, e.clientX, e.clientY);
      }}
    >
      <div className={className} style={type === 'normal' ? { background: color } : {}}></div>
    </div>
  );
};


// Main App
const App = () => {
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isGameOver, setIsGameOver] = useState(false);
  const [highScore, setHighScore] = useState(0);
  const [balloons, setBalloons] = useState([]);
  const [floatingTexts, setFloatingTexts] = useState([]);
  const [newRecord, setNewRecord] = useState(false);

  // Refs for intervals
  const gameLoopRef = useRef(null);
  const timerRef = useRef(null);
  const balloonIdRef = useRef(0);

  // Load high score on mount
  useEffect(() => {
    const saved = localStorage.getItem('balloonHighScore');
    if (saved) setHighScore(parseInt(saved, 10));
  }, []);

  const startGame = () => {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    setScore(0);
    setTimeLeft(GAME_DURATION);
    setIsPlaying(true);
    setIsGameOver(false);
    setBalloons([]);
    setFloatingTexts([]);
    setNewRecord(false);
    balloonIdRef.current = 0;
  };

  const endGame = useCallback(() => {
    setIsPlaying(false);
    setIsGameOver(true);
    setBalloons([]);
    playSound('end');
    clearInterval(gameLoopRef.current);
    clearInterval(timerRef.current);

    if (score > highScore) {
      setHighScore(score);
      setNewRecord(true);
      localStorage.setItem('balloonHighScore', score.toString());
    }
  }, [score, highScore]);

  // Main game logic
  useEffect(() => {
    if (isPlaying) {
      // Timer
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            endGame();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      // Balloon spawner
      gameLoopRef.current = setInterval(() => {
        spawnBalloon();
      }, 600); // spawn every 600ms
    }

    return () => {
      clearInterval(timerRef.current);
      clearInterval(gameLoopRef.current);
    };
  }, [isPlaying, endGame]);

  const spawnBalloon = () => {
    const rand = Math.random();
    let type = 'normal';

    // 60% normal, 20% yellow, 20% gray
    if (rand > 0.8) type = 'yellow';
    else if (rand > 0.6) type = 'gray';

    const newBalloon = {
      id: balloonIdRef.current++,
      type: type,
      x: Math.floor(Math.random() * 80) + 10, // 10% to 90% width
      speed: Math.random() * 2 + 3, // 3 to 5 seconds
      spawnTime: Date.now()
    };

    setBalloons((prev) => [...prev, newBalloon]);
  };

  // Remove balloons that have been off screen for a while
  useEffect(() => {
    if (!isPlaying) return;
    const cleanupInterval = setInterval(() => {
      const now = Date.now();
      setBalloons((prev) => prev.filter(b => now - b.spawnTime < (b.speed * 1000) + 1000));
    }, 2000);
    return () => clearInterval(cleanupInterval);
  }, [isPlaying]);

  const handleBalloonClick = (id, type, clientX, clientY) => {
    if (!isPlaying) return;

    setBalloons((prev) => {
      // Verificamos si el globo existe. Si no existe (doble click rápido), ignoramos.
      if (!prev.some((b) => b.id === id)) return prev;

      let pointsChange = 0;
      let textColor = '';

      if (type === 'normal') {
        pointsChange = 10;
        textColor = '#a7f3d0';
        playSound('normal');
      } else if (type === 'yellow') {
        pointsChange = 20;
        textColor = '#fde047';
        playSound('yellow');
      } else if (type === 'gray') {
        pointsChange = -(Math.floor(Math.random() * 6) + 5);
        textColor = '#fca5a5';
        playSound('gray');
      }

      setScore((s) => s + pointsChange);

      // Mostrar texto flotante
      const textId = Date.now() + Math.random();
      setFloatingTexts((ft) => [
        ...ft,
        { id: textId, text: pointsChange > 0 ? `+${pointsChange}` : pointsChange, x: clientX, y: clientY - 40, color: textColor }
      ]);

      setTimeout(() => {
        setFloatingTexts((ft) => ft.filter((t) => t.id !== textId));
      }, 1000);

      // Eliminamos el globo
      return prev.filter((b) => b.id !== id);
    });
  };

  return (
    <div className="game-area">
      {/* UI Header */}
      <div className="game-ui">
        <div className="stat-box">
          <span className="stat-label">Puntos</span>
          <span className="stat-value score-value">{score}</span>
        </div>
        <div className="stat-box">
          <span className="stat-label">Récord</span>
          <span className="stat-value">{highScore}</span>
        </div>
        <div className="stat-box">
          <span className="stat-label">Tiempo</span>
          <span className="stat-value time-value">00:{timeLeft.toString().padStart(2, '0')}</span>
        </div>
      </div>

      {/* Balloons */}
      {balloons.map((b) => (
        <Balloon key={b.id} {...b} onClick={handleBalloonClick} />
      ))}

      {/* Floating Texts */}
      {floatingTexts.map((ft) => (
        <FloatingText key={ft.id} {...ft} />
      ))}

      {/* Menus */}
      {!isPlaying && !isGameOver && (
        <div className="overlay">
          <div className="menu-card">
            <h1 className="menu-title">Pop!</h1>
            <p style={{ marginBottom: '10px', fontSize: '1.1rem', color: '#e2e8f0' }}>
              🔴 Normales: +10 pts<br />
              🟡 Amarillos: +20 pts<br />
              ⚫ Grises: -5 a -10 pts
            </p>
            <button className="btn-primary" onClick={startGame}>Jugar Ahora</button>
          </div>
        </div>
      )}

      {isGameOver && (
        <div className="overlay">
          <div className="menu-card">
            <h1 className="menu-title">¡Tiempo agotado!</h1>
            <p style={{ fontSize: '1.5rem', marginBottom: '10px' }}>
              Puntuación final: <strong style={{ color: '#a7f3d0' }}>{score}</strong>
            </p>
            {newRecord && (
              <p className="record-msg">¡Felicidades! ¡Has superado tu récord!</p>
            )}
            <button className="btn-primary" onClick={startGame}>Jugar de nuevo</button>
          </div>
        </div>
      )}
    </div>
  );
};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
