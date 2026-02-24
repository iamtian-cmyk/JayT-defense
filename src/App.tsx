/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Shield, Target, Trophy, RotateCcw, Languages, Info, Volume2, VolumeX, Pause, Play } from 'lucide-react';

// --- Types & Constants ---

type Language = 'en' | 'zh';

interface Point {
  x: number;
  y: number;
}

interface Entity {
  id: string;
  x: number;
  y: number;
}

interface EnemyMissile extends Entity {
  startX: number;
  startY: number;
  targetX: number;
  targetY: number;
  progress: number;
  speed: number;
}

interface InterceptorMissile extends Entity {
  startX: number;
  startY: number;
  targetX: number;
  targetY: number;
  progress: number;
  speed: number;
}

interface Explosion extends Entity {
  radius: number;
  maxRadius: number;
  expanding: boolean;
  life: number;
}

interface City extends Entity {
  destroyed: boolean;
}

interface Battery extends Entity {
  destroyed: boolean;
  ammo: number;
  maxAmmo: number;
  recoil: number;
}

const WIN_SCORE = 650;
const ENEMY_SCORE = 30;
const EXPLOSION_SPEED = 2.0;
const INTERCEPTOR_SPEED = 0.02;
const ENEMY_SPEED_MIN = 0.0011;
const ENEMY_SPEED_MAX = 0.0011;

const TRANSLATIONS = {
  en: {
    title: "JayT Nova Defense",
    score: "Score",
    ammo: "Ammo",
    win: "Mission Accomplished!",
    lose: "Defense Failed",
    restart: "Play Again",
    start: "Start Game",
    instructions: "Click anywhere to launch interceptors. Protect your cities and batteries!",
    victory: "You have saved the civilization!",
    defeat: "The defenses have fallen...",
    points: "Points",
    left: "L",
    mid: "M",
    right: "R",
    pause: "Paused",
    resume: "Resume"
  },
  zh: {
    title: "JayT 新星防御",
    score: "得分",
    ammo: "弹药",
    win: "任务完成！",
    lose: "防御失败",
    restart: "再玩一次",
    start: "开始游戏",
    instructions: "点击屏幕发射拦截导弹。保护你的城市和炮台！",
    victory: "你成功拯救了文明！",
    defeat: "防线已全面崩溃...",
    points: "分数",
    left: "左",
    mid: "中",
    right: "右",
    pause: "已暂停",
    resume: "继续游戏"
  }
};

// --- Main Component ---

export default function App() {
  const [lang, setLang] = useState<Language>('zh');
  const [gameState, setGameState] = useState<'menu' | 'playing' | 'won' | 'lost'>('menu');
  const [isPaused, setIsPaused] = useState(false);
  const [score, setScore] = useState(0);
  const [muted, setMuted] = useState(false);
  
  const isPausedRef = useRef(false);
  const scoreRef = useRef(0);
  const gameStateRef = useRef<'menu' | 'playing' | 'won' | 'lost'>('menu');
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const requestRef = useRef<number>(null);

  // Sync refs with state
  useEffect(() => { isPausedRef.current = isPaused; }, [isPaused]);
  useEffect(() => { 
    scoreRef.current = score; 
  }, [score]);
  useEffect(() => { gameStateRef.current = gameState; }, [gameState]);
  
  // Game Entities Refs
  const enemiesRef = useRef<EnemyMissile[]>([]);
  const interceptorsRef = useRef<InterceptorMissile[]>([]);
  const explosionsRef = useRef<Explosion[]>([]);
  const citiesRef = useRef<City[]>([]);
  const batteriesRef = useRef<Battery[]>([]);
  const starsRef = useRef<{x: number, y: number, size: number, twinkle: number}[]>([]);
  const lastTimeRef = useRef<number>(0);
  const spawnTimerRef = useRef<number>(0);

  const t = TRANSLATIONS[lang];

  // --- Initialization ---

  const initGame = useCallback(() => {
    if (!containerRef.current) return;
    const { width, height } = containerRef.current.getBoundingClientRect();
    
    // Init Cities
    const cities: City[] = [];
    const citySpacing = width / 8;
    for (let i = 0; i < 6; i++) {
      // Avoid batteries positions
      let x = (i + 1) * citySpacing;
      if (i >= 3) x += citySpacing; // Skip middle battery
      cities.push({
        id: `city-${i}`,
        x,
        y: height - 20,
        destroyed: false
      });
    }
    citiesRef.current = cities;

    // Init Batteries
    batteriesRef.current = [
      { id: 'bat-left', x: 40, y: height - 30, destroyed: false, ammo: 20, maxAmmo: 20, recoil: 0 },
      { id: 'bat-mid', x: width / 2, y: height - 30, destroyed: false, ammo: 50, maxAmmo: 50, recoil: 0 },
      { id: 'bat-right', x: width - 40, y: height - 30, destroyed: false, ammo: 20, maxAmmo: 20, recoil: 0 },
    ];

    enemiesRef.current = [];
    interceptorsRef.current = [];
    explosionsRef.current = [];
    
    // Init Stars
    const stars = [];
    for (let i = 0; i < 150; i++) {
      stars.push({
        x: Math.random() * width,
        y: Math.random() * height,
        size: Math.random() * 1.5 + 0.5,
        twinkle: Math.random() * Math.PI * 2
      });
    }
    starsRef.current = stars;

    setScore(0);
    spawnTimerRef.current = 0;
  }, []);

  const startGame = () => {
    initGame();
    setIsPaused(false);
    setGameState('playing');
  };

  // --- Game Loop ---

  const update = (time: number) => {
    if (gameStateRef.current !== 'playing' || isPausedRef.current) {
      return;
    }
    
    const deltaTime = time - lastTimeRef.current;
    lastTimeRef.current = time;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const { width, height } = canvas;

    // 1. Spawn Enemies
    spawnTimerRef.current += deltaTime;
    const spawnRate = Math.max(1000, 3500 - (scoreRef.current / 100) * 250);
    if (spawnTimerRef.current > spawnRate) {
      spawnTimerRef.current = 0;
      const startX = Math.random() * width;
      
      // Pick a target (city or battery)
      const targets = [...citiesRef.current.filter(c => !c.destroyed), ...batteriesRef.current.filter(b => !b.destroyed)];
      if (targets.length > 0) {
        const target = targets[Math.floor(Math.random() * targets.length)];
        enemiesRef.current.push({
          id: Math.random().toString(36).substr(2, 9),
          startX,
          startY: 0,
          x: startX,
          y: 0,
          targetX: target.x,
          targetY: target.y,
          progress: 0,
          speed: ENEMY_SPEED_MIN + Math.random() * (ENEMY_SPEED_MAX - ENEMY_SPEED_MIN) + (score / 5000) * 0.001
        });
      }
    }

    // 2. Update Enemies
    enemiesRef.current.forEach((enemy, index) => {
      enemy.progress += enemy.speed * (deltaTime / 16);
      enemy.x = enemy.startX + (enemy.targetX - enemy.startX) * enemy.progress;
      enemy.y = enemy.startY + (enemy.targetY - enemy.startY) * enemy.progress;

      // Check if reached target
      if (enemy.progress >= 1) {
        // Impact!
        explosionsRef.current.push({
          id: `impact-${enemy.id}`,
          x: enemy.targetX,
          y: enemy.targetY,
          radius: 0,
          maxRadius: 60,
          expanding: true,
          life: 1
        });
        
        // Destroy city or battery
        const city = citiesRef.current.find(c => c.x === enemy.targetX && c.y === enemy.targetY);
        if (city) city.destroyed = true;
        const battery = batteriesRef.current.find(b => b.x === enemy.targetX && b.y === enemy.targetY);
        if (battery) battery.destroyed = true;

        enemiesRef.current.splice(index, 1);
      }
    });

    // 3. Update Interceptors
    interceptorsRef.current.forEach((inter, index) => {
      inter.progress += INTERCEPTOR_SPEED * (deltaTime / 16);
      inter.x = inter.startX + (inter.targetX - inter.startX) * inter.progress;
      inter.y = inter.startY + (inter.targetY - inter.startY) * inter.progress;

      if (inter.progress >= 1) {
        const destroyedCount = batteriesRef.current.filter(b => b.destroyed).length;
        // Reduce explosion radius as batteries are lost (80 -> 65 -> 50)
        const currentMaxRadius = Math.max(50, 80 - destroyedCount * 15);
        
        explosionsRef.current.push({
          id: `exp-${inter.id}`,
          x: inter.targetX,
          y: inter.targetY,
          radius: 0,
          maxRadius: currentMaxRadius,
          expanding: true,
          life: 1
        });
        interceptorsRef.current.splice(index, 1);
      }
    });

    // 4. Update Explosions
    explosionsRef.current.forEach((exp, index) => {
      if (exp.expanding) {
        exp.radius += EXPLOSION_SPEED * (deltaTime / 16);
        if (exp.radius >= exp.maxRadius) exp.expanding = false;
      } else {
        exp.radius -= EXPLOSION_SPEED * 0.5 * (deltaTime / 16);
        if (exp.radius <= 0) {
          explosionsRef.current.splice(index, 1);
          return;
        }
      }

      // Check collision with enemies
      enemiesRef.current.forEach((enemy, eIndex) => {
        const dist = Math.hypot(enemy.x - exp.x, enemy.y - exp.y);
        if (dist < exp.radius) {
          // Destroy enemy
          setScore(prev => {
            const destroyedCount = batteriesRef.current.filter(b => b.destroyed).length;
            // Reduce score per kill as batteries are lost (30 -> 20 -> 10)
            const currentEnemyScore = Math.max(10, ENEMY_SCORE - destroyedCount * 10);
            const newScore = prev + currentEnemyScore;
            if (newScore >= WIN_SCORE) {
              setGameState('won');
              gameStateRef.current = 'won';
            }
            return newScore;
          });
          enemiesRef.current.splice(eIndex, 1);
          // Create a small explosion at enemy location
          explosionsRef.current.push({
            id: `enemy-exp-${enemy.id}`,
            x: enemy.x,
            y: enemy.y,
            radius: 5,
            maxRadius: 35,
            expanding: true,
            life: 0.5
          });
        }
      });
    });

    // 5. Update Batteries (Recoil)
    batteriesRef.current.forEach(bat => {
      if (bat.recoil > 0) bat.recoil -= 0.1 * (deltaTime / 16);
      if (bat.recoil < 0) bat.recoil = 0;
    });

    // 6. Check Game Over
    if (batteriesRef.current.every(b => b.destroyed)) {
      setGameState('lost');
      gameStateRef.current = 'lost';
    }

    draw(time);
    requestRef.current = requestAnimationFrame(update);
  };

  const draw = (time: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = canvas;
    ctx.clearRect(0, 0, width, height);

    // Draw Background Gradient
    const bgGradient = ctx.createLinearGradient(0, 0, 0, height);
    bgGradient.addColorStop(0, '#020617'); // Deep slate 950
    bgGradient.addColorStop(0.5, '#0f172a'); // Slate 900
    bgGradient.addColorStop(1, '#1e1b4b'); // Deep indigo 950
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, width, height);

    // Draw Stars
    starsRef.current.forEach(star => {
      const opacity = 0.3 + Math.sin(time / 1000 + star.twinkle) * 0.7;
      ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
      ctx.fill();
    });

    // Draw Subtle Atmospheric Glow
    const atmosGlow = ctx.createRadialGradient(width/2, height, 0, width/2, height, height * 0.8);
    atmosGlow.addColorStop(0, 'rgba(59, 130, 246, 0.05)');
    atmosGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = atmosGlow;
    ctx.fillRect(0, 0, width, height);

    // Draw Nebula Clouds
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const nebula1 = ctx.createRadialGradient(width * 0.2, height * 0.3, 0, width * 0.2, height * 0.3, width * 0.4);
    nebula1.addColorStop(0, 'rgba(139, 92, 246, 0.03)'); // Violet
    nebula1.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = nebula1;
    ctx.fillRect(0, 0, width, height);

    const nebula2 = ctx.createRadialGradient(width * 0.8, height * 0.6, 0, width * 0.8, height * 0.6, width * 0.5);
    nebula2.addColorStop(0, 'rgba(16, 185, 129, 0.02)'); // Emerald
    nebula2.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = nebula2;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();

    // Draw Ground
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, height - 20, width, 20);
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1;
    ctx.strokeRect(0, height - 20, width, 20);

    // Draw Cities
    citiesRef.current.forEach(city => {
      if (city.destroyed) return;
      ctx.fillStyle = '#4ade80';
      ctx.fillRect(city.x - 15, city.y - 15, 30, 15);
      ctx.fillStyle = '#22c55e';
      ctx.fillRect(city.x - 10, city.y - 20, 10, 5);
      ctx.fillRect(city.x + 5, city.y - 25, 5, 10);
    });

    // Draw Batteries
    batteriesRef.current.forEach(bat => {
      if (bat.destroyed) {
        // Destroyed state: smoking crater
        ctx.fillStyle = '#333';
        ctx.beginPath();
        ctx.ellipse(bat.x, bat.y, 20, 8, 0, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(bat.x, bat.y - 2, 8, 0, Math.PI * 2);
        ctx.fill();
        
        // Smoke particles (simulated with small circles)
        ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
        for(let i=0; i<3; i++) {
          ctx.beginPath();
          ctx.arc(bat.x + Math.sin(time/200 + i)*10, bat.y - 15 - i*10, 4, 0, Math.PI * 2);
          ctx.fill();
        }
        return;
      }

      // Sci-fi Turret Design
      ctx.save();
      ctx.translate(bat.x, bat.y);

      // Outer Glow
      const glow = ctx.createRadialGradient(0, -10, 0, 0, -10, 30);
      glow.addColorStop(0, 'rgba(59, 130, 246, 0.3)');
      glow.addColorStop(1, 'rgba(59, 130, 246, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(0, -10, 30, 0, Math.PI * 2);
      ctx.fill();

      // Base
      ctx.fillStyle = '#1e293b';
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-25, 0);
      ctx.lineTo(25, 0);
      ctx.lineTo(15, -15);
      ctx.lineTo(-15, -15);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Rotating Head (simplified, just a dome)
      ctx.fillStyle = '#334155';
      ctx.beginPath();
      ctx.arc(0, -15, 12, Math.PI, 0);
      ctx.fill();
      ctx.stroke();

      // Cannon with recoil
      const recoilOffset = bat.recoil * 10;
      ctx.fillStyle = '#64748b';
      ctx.fillRect(-4, -25 + recoilOffset, 8, -15);
      ctx.strokeStyle = '#60a5fa';
      ctx.strokeRect(-4, -25 + recoilOffset, 8, -15);

      // Energy Core
      const pulse = Math.sin(time / 200) * 0.5 + 0.5;
      ctx.fillStyle = `rgba(96, 165, 250, ${0.5 + pulse * 0.5})`;
      ctx.beginPath();
      ctx.arc(0, -15, 4, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
      
      // Ammo indicator (Modern Style)
      ctx.fillStyle = 'white';
      ctx.font = 'bold 12px monospace';
      ctx.textAlign = 'center';
      ctx.shadowBlur = 5;
      ctx.shadowColor = '#3b82f6';
      ctx.fillText(bat.ammo.toString(), bat.x, bat.y + 20);
      ctx.shadowBlur = 0;
    });

    // Draw Enemy Missiles
    enemiesRef.current.forEach(enemy => {
      // Trail Glow
      ctx.shadowBlur = 8;
      ctx.shadowColor = '#ef4444';
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.3)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(enemy.startX, enemy.startY);
      ctx.lineTo(enemy.x, enemy.y);
      ctx.stroke();
      
      // Main Trail
      ctx.shadowBlur = 0;
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(enemy.startX, enemy.startY);
      ctx.lineTo(enemy.x, enemy.y);
      ctx.stroke();
      
      // Missile Head (Cooler)
      ctx.save();
      ctx.translate(enemy.x, enemy.y);
      const angle = Math.atan2(enemy.targetY - enemy.startY, enemy.targetX - enemy.startX);
      ctx.rotate(angle);
      
      // Pulsing Glow
      const pulse = Math.sin(time / 150) * 0.5 + 0.5;
      ctx.fillStyle = `rgba(255, 50, 50, ${0.2 + pulse * 0.3})`;
      ctx.beginPath();
      ctx.arc(0, 0, 6 + pulse * 4, 0, Math.PI * 2);
      ctx.fill();

      // Missile Body (Diamond/Arrow shape)
      ctx.fillStyle = '#fca5a5';
      ctx.beginPath();
      ctx.moveTo(8, 0);
      ctx.lineTo(-4, -4);
      ctx.lineTo(-2, 0);
      ctx.lineTo(-4, 4);
      ctx.closePath();
      ctx.fill();
      
      ctx.restore();
    });

    // Draw Interceptor Missiles
    interceptorsRef.current.forEach(inter => {
      ctx.strokeStyle = '#3b82f6';
      ctx.beginPath();
      ctx.moveTo(inter.startX, inter.startY);
      ctx.lineTo(inter.x, inter.y);
      ctx.stroke();
      
      ctx.fillStyle = 'white';
      ctx.beginPath();
      ctx.arc(inter.x, inter.y, 4, 0, Math.PI * 2);
      ctx.fill();
    });

    // Draw Explosions
    explosionsRef.current.forEach(exp => {
      const gradient = ctx.createRadialGradient(exp.x, exp.y, 0, exp.x, exp.y, exp.radius);
      gradient.addColorStop(0, 'white');
      gradient.addColorStop(0.3, '#fbbf24');
      gradient.addColorStop(0.6, '#f97316');
      gradient.addColorStop(1, 'rgba(239, 68, 68, 0)');
      
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(exp.x, exp.y, exp.radius, 0, Math.PI * 2);
      ctx.fill();
    });
  };

  // --- Interaction ---

  const handleCanvasClick = (e: React.MouseEvent | React.TouchEvent) => {
    if (gameState !== 'playing' || isPaused) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    
    let clientX, clientY;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = (e as React.MouseEvent).clientX;
      clientY = (e as React.MouseEvent).clientY;
    }

    const x = clientX - rect.left;
    const y = clientY - rect.top;

    // Find nearest battery with ammo
    let nearestBat: Battery | null = null;
    let minDist = Infinity;

    batteriesRef.current.forEach(bat => {
      if (!bat.destroyed && bat.ammo > 0) {
        const dist = Math.hypot(bat.x - x, bat.y - y);
        if (dist < minDist) {
          minDist = dist;
          nearestBat = bat;
        }
      }
    });

    if (nearestBat) {
      const destroyedCount = batteriesRef.current.filter(b => b.destroyed).length;
      const burstCount = destroyedCount > 0 ? 3 : 1;
      
      // Deduct ammo once for the burst
      nearestBat.ammo -= 1;
      nearestBat.recoil = 1; // Trigger recoil
      
      for (let i = 0; i < burstCount; i++) {
        // Add slight spread if burst
        const offsetX = burstCount > 1 ? (i - 1) * 30 : 0;
        const offsetY = burstCount > 1 ? (Math.abs(i - 1)) * 10 : 0;

        interceptorsRef.current.push({
          id: Math.random().toString(36).substr(2, 9),
          startX: nearestBat.x,
          startY: nearestBat.y - 20,
          x: nearestBat.x,
          y: nearestBat.y - 20,
          targetX: x + offsetX,
          targetY: y + offsetY,
          progress: 0,
          speed: INTERCEPTOR_SPEED
        });
      }
    }
  };

  // --- Lifecycle ---

  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current && canvasRef.current) {
        const { width, height } = containerRef.current.getBoundingClientRect();
        canvasRef.current.width = width;
        canvasRef.current.height = height;
        initGame();
      }
    };

    window.addEventListener('resize', handleResize);
    handleResize();

    return () => window.removeEventListener('resize', handleResize);
  }, [initGame]);

  useEffect(() => {
    if (gameState === 'playing' && !isPaused) {
      lastTimeRef.current = performance.now();
      requestRef.current = requestAnimationFrame(update);
    } else {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    }
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [gameState, isPaused]);

  // --- UI Components ---

  return (
    <div className="relative w-full h-screen bg-[#0a0a0a] overflow-hidden font-sans text-white select-none" ref={containerRef}>
      {/* Game Canvas */}
      <canvas
        ref={canvasRef}
        onClick={handleCanvasClick}
        onTouchStart={handleCanvasClick}
        className="block w-full h-full cursor-crosshair"
      />

      {/* Top HUD */}
      <div className="absolute top-0 left-0 w-full p-4 flex justify-between items-start pointer-events-none">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 bg-black/40 backdrop-blur-md px-4 py-2 rounded-full border border-white/10">
            <Target className="w-4 h-4 text-emerald-400" />
            <span className="text-sm font-mono tracking-wider uppercase opacity-70">{t.score}</span>
            <span className="text-xl font-bold font-mono text-emerald-400">{score.toString().padStart(5, '0')}</span>
          </div>
          <div className="text-[10px] font-mono opacity-50 px-4">
            TARGET: {WIN_SCORE}
          </div>
        </div>

        <div className="flex gap-2 pointer-events-auto">
          <button 
            onClick={() => gameState === 'playing' && setIsPaused(!isPaused)}
            className={`p-2 bg-black/40 backdrop-blur-md rounded-full border border-white/10 hover:bg-white/10 transition-colors ${gameState !== 'playing' ? 'opacity-30 cursor-not-allowed' : ''}`}
            disabled={gameState !== 'playing'}
          >
            {isPaused ? <Play className="w-5 h-5 text-emerald-400" /> : <Pause className="w-5 h-5" />}
          </button>
          <button 
            onClick={() => setLang(l => l === 'en' ? 'zh' : 'en')}
            className="p-2 bg-black/40 backdrop-blur-md rounded-full border border-white/10 hover:bg-white/10 transition-colors"
          >
            <Languages className="w-5 h-5" />
          </button>
          <button 
            onClick={() => setMuted(!muted)}
            className="p-2 bg-black/40 backdrop-blur-md rounded-full border border-white/10 hover:bg-white/10 transition-colors"
          >
            {muted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Ammo HUD */}
      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex gap-8 pointer-events-none">
        {batteriesRef.current.map((bat, i) => (
          <div key={bat.id} className="flex flex-col items-center gap-1">
            <div className={`w-12 h-1 rounded-full ${bat.destroyed ? 'bg-red-500/30' : 'bg-blue-500/30'}`}>
              <motion.div 
                className={`h-full rounded-full ${bat.destroyed ? 'bg-red-500' : 'bg-blue-400'}`}
                initial={{ width: '100%' }}
                animate={{ width: `${(bat.ammo / bat.maxAmmo) * 100}%` }}
              />
            </div>
            <span className="text-[10px] font-mono opacity-50 uppercase">
              {i === 0 ? t.left : i === 1 ? t.mid : t.right}
            </span>
          </div>
        ))}
      </div>

      {/* Overlays */}
      <AnimatePresence>
        {isPaused && gameState === 'playing' && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-black/40 backdrop-blur-sm pointer-events-auto"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="text-center"
            >
              <h2 className="text-6xl font-black italic uppercase mb-8 text-white/90">{t.pause}</h2>
              <button 
                onClick={() => setIsPaused(false)}
                className="px-12 py-4 bg-emerald-500 text-white font-bold uppercase tracking-widest rounded-full hover:bg-emerald-400 transition-colors shadow-lg shadow-emerald-500/20"
              >
                {t.resume}
              </button>
            </motion.div>
          </motion.div>
        )}

        {gameState === 'menu' && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm p-6 text-center"
          >
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              <h1 className="text-5xl md:text-7xl font-black tracking-tighter mb-2 italic uppercase text-transparent bg-clip-text bg-gradient-to-b from-white to-white/40">
                {t.title}
              </h1>
              <p className="text-emerald-400 font-mono text-sm mb-8 tracking-widest uppercase">
                {t.instructions}
              </p>
              
              <button 
                onClick={startGame}
                className="group relative px-8 py-4 bg-white text-black font-bold uppercase tracking-widest rounded-full overflow-hidden hover:scale-105 active:scale-95 transition-all"
              >
                <span className="relative z-10">{t.start}</span>
                <div className="absolute inset-0 bg-emerald-400 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
              </button>
            </motion.div>
          </motion.div>
        )}

        {(gameState === 'won' || gameState === 'lost') && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/90 backdrop-blur-md p-6 text-center"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="max-w-md w-full"
            >
              {gameState === 'won' ? (
                <Trophy className="w-20 h-20 text-yellow-400 mx-auto mb-6" />
              ) : (
                <Shield className="w-20 h-20 text-red-500 mx-auto mb-6" />
              )}
              
              <h2 className={`text-4xl font-black mb-2 uppercase italic ${gameState === 'won' ? 'text-yellow-400' : 'text-red-500'}`}>
                {gameState === 'won' ? t.win : t.lose}
              </h2>
              
              <p className="text-white/60 mb-8">
                {gameState === 'won' ? t.victory : t.defeat}
              </p>

              <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-8">
                <div className="text-xs font-mono uppercase opacity-50 mb-1">{t.score}</div>
                <div className="text-5xl font-black font-mono">{score}</div>
              </div>

              <button 
                onClick={startGame}
                className="flex items-center justify-center gap-2 w-full py-4 bg-white text-black font-bold uppercase tracking-widest rounded-full hover:bg-emerald-400 transition-colors"
              >
                <RotateCcw className="w-5 h-5" />
                {t.restart}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Decorative Grid */}
      <div className="absolute inset-0 pointer-events-none opacity-5">
        <div className="w-full h-full" style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
      </div>
    </div>
  );
}
