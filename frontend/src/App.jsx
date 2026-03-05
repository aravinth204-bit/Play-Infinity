import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
// Build ID: 2026-03-05-MEGAUPDATE
import ReactPlayer from 'react-player';
import { Home, Music, Search, User, Play, Pause, SkipBack, SkipForward, Heart, MoreHorizontal, ArrowLeft, Shuffle, Repeat, Upload, List, Headphones, Book, Download, Clock, Settings, LogOut, Bell, ChevronRight, ChevronUp, ChevronDown, Plus, X, FolderPlus, Mic2, Share2, Wifi, WifiOff, History, Gauge, CheckCircle2 } from 'lucide-react';
import { formatTime } from './utils';

const AnimatedHeart = ({ isFavorite, onClick, className = '', size = 16 }) => {
  const [particles, setParticles] = useState([]);
  const [isPopping, setIsPopping] = useState(false);

  const handleClick = (e) => {
    if (e) e.stopPropagation();
    onClick(e);
    if (!isFavorite) {
      setIsPopping(true);
      setTimeout(() => setIsPopping(false), 300);

      const newParticles = Array.from({ length: 8 }).map((_, i) => ({
        id: Date.now() + i,
        dx: (Math.random() - 0.5) * 80 + 'px',
        dy: (Math.random() - 1) * 80 + 'px',
      }));
      setParticles(p => [...p, ...newParticles]);
      setTimeout(() => setParticles([]), 800);
    }
  };

  return (
    <div className={`relative inline-flex items-center justify-center cursor-pointer ${className}`} onClick={handleClick}>
      <Heart
        size={size}
        fill={isFavorite ? '#8cd92b' : 'transparent'}
        className={`${isFavorite ? 'text-[#8cd92b] drop-shadow-[0_0_8px_rgba(140,217,43,0.5)]' : 'text-gray-500 hover:text-white'} ${isPopping ? 'animate-pop' : ''} transition-all`}
      />
      {particles.map(p => (
        <Heart
          key={p.id}
          size={size * 0.6}
          fill="#8cd92b"
          className="absolute text-[#8cd92b] pointer-events-none animate-float z-50"
          style={{ '--dx': p.dx, '--dy': p.dy }}
        />
      ))}
    </div>
  );
};

const SkeletonRow = () => (
  <div className="flex items-center gap-3 p-2">
    <div className="w-12 h-12 rounded-md skeleton shrink-0" />
    <div className="flex-1 space-y-2">
      <div className="h-4 w-3/4 rounded-sm skeleton" />
      <div className="h-3 w-1/2 rounded-sm skeleton" />
    </div>
  </div>
);

// Global audio element for background play
const backgroundAudio = typeof window !== 'undefined' ? new Audio() : null;
if (backgroundAudio) {
  backgroundAudio.id = "play-infinity-core-audio";
  backgroundAudio.style.display = 'none';
  backgroundAudio.setAttribute('playsinline', 'true');
  backgroundAudio.crossOrigin = "anonymous"; // CRITICAL for Equalizer analysis
}

const DesktopSongRow = React.memo(function DesktopSongRow({
  song,
  index,
  onSelect,
  isFavorite,
  onToggleFavorite
}) {
  return (
    <div
      onClick={onSelect}
      className="flex items-center gap-4 hover:bg-[#1a1c2a] p-3 rounded-2xl cursor-pointer transition-all border border-transparent hover:border-[#262837] group hover:scale-[1.01] active:scale-[0.99]"
    >
      {index != null && (
        <span className="text-gray-500 font-bold text-sm w-6 text-center opacity-70 group-hover:text-[#8cd92b] transition-colors">{String(index + 1).padStart(2, '0')}</span>
      )}
      <img src={song.thumbnail} alt={song.title} className="w-12 h-12 rounded-xl object-cover shadow-sm" />
      <div className="flex-1 overflow-hidden pr-4">
        <h4 className="font-semibold text-white text-sm truncate">{song.title}</h4>
        <p className="text-xs text-gray-400 truncate mt-1">{song.artist}</p>
      </div>
      <div className="text-xs text-gray-500 w-12 text-right mr-4">{formatTime(song.durationSeconds)}</div>
      <AnimatedHeart size={16} isFavorite={isFavorite} onClick={onToggleFavorite} />
      <div className="text-gray-500 hover:text-white transition-colors ml-4 mr-2"><MoreHorizontal size={16} /></div>
    </div>
  );
});

export default function App() {
  const [activeTab, setActiveTab] = useState('Home');
  const [currentSong, setCurrentSong] = useState(null);
  const [useIframeFallback, setUseIframeFallback] = useState(false);
  const [songs, setSongs] = useState([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);

  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [queue, setQueue] = useState([]);
  const [isFetchingQueue, setIsFetchingQueue] = useState(false);
  const playerRef = useRef(null);
  const sessionPlayedIds = useRef(new Set());
  const playedTitleTokenSetsRef = useRef([]);
  const [trendingSongs, setTrendingSongs] = useState([]);

  const [searchHistory, setSearchHistory] = useState(() => {
    const saved = localStorage.getItem('musicHistory');
    return saved ? JSON.parse(saved) : [];
  });

  const [favorites, setFavorites] = useState(() => {
    const saved = localStorage.getItem('musicFavorites');
    return saved ? JSON.parse(saved) : [];
  });

  const [playlists, setPlaylists] = useState(() => {
    const saved = localStorage.getItem('musicPlaylists');
    return saved ? JSON.parse(saved) : [
      { id: '1', name: 'Your Top Hits', isAuto: true, songs: [] },
      { id: '2', name: 'Trending Vibes', isAuto: true, songs: [] }
    ];
  });

  const [showPlaylistModal, setShowPlaylistModal] = useState({ isOpen: false, songInfo: null });
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [currentViewPlaylist, setCurrentViewPlaylist] = useState(null);

  // Additional feature states
  const [sleepTimer, setSleepTimer] = useState(null);
  const [sleepMinutesLeft, setSleepMinutesLeft] = useState(0);
  const [showSleepModal, setShowSleepModal] = useState(false);
  const [isLyricsVisible, setIsLyricsVisible] = useState(false);
  const sleepTimerRef = useRef(null);

  // FEATURE: Dynamic UI & Audio Visualizer
  const [dominantColor, setDominantColor] = useState('#1ed760');
  const [audioData, setAudioData] = useState(new Uint8Array(32).fill(0));
  const analyserRef = useRef(null);
  const audioCtxRef = useRef(null);
  const sourceRef = useRef(null);

  // FEATURE: Toast Notifications
  const [toasts, setToasts] = useState([]);
  const showToast = useCallback((message, type = 'info', icon = null) => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type, icon }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000);
  }, []);

  // FEATURE: Offline Indicator
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // FEATURE: Playback Speed
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);

  // FEATURE: Listen History (separate from search history)
  const [listenHistory, setListenHistory] = useState(() => {
    try { return JSON.parse(localStorage.getItem('listenHistory') || '[]'); } catch { return []; }
  });

  // FEATURE: Queue Persistence
  useEffect(() => {
    try {
      const savedQueue = JSON.parse(localStorage.getItem('savedQueue') || '[]');
      const savedSong = JSON.parse(localStorage.getItem('savedCurrentSong') || 'null');
      if (savedQueue.length > 0) setQueue(savedQueue);
      // Don't auto-play saved song — just restore it silently
      if (savedSong) setCurrentSong(savedSong);
    } catch { }
  }, []);

  // ──────────────────────────────────────────────────────
  // FEATURE: Tamil-only filter — block non-Tamil songs
  // ──────────────────────────────────────────────────────
  const NON_TAMIL_KEYWORDS = [
    // Hindi indicators
    'hindi', 'bollywood', 'bhojpuri', 'rajasthani', 'haryanvi', 'punjabi', 'urdu',
    // Telugu
    'telugu', 'tollywood', 'andhra',
    // Malayalam
    'malayalam', 'mollywood',
    // Kannada
    'kannada', 'sandalwood',
    // Other
    'sinhala', 'korean', 'naa songs', 'naa oru', 'naa peru'
  ];

  const isTamilSong = (song) => {
    const text = ((song.title || '') + ' ' + (song.artist || '') + ' ' + (song.channelTitle || '')).toLowerCase();
    return !NON_TAMIL_KEYWORDS.some(kw => text.includes(kw));
  };

  const applyTamilFilter = (songs) => songs.filter(isTamilSong);

  const applyBaseFilter = (songs) => {
    const BLOCKED = [
      'jukebox', 'mashup', 'collection', 'nonstop', 'full album', 'short',
      'reels', 'reel', 'status', 'news', 'teaser', 'trailer', 'karaoke',
      'whatsapp', 'ringtone', '8d', 'interview', 'podcast', 'reaction',
      'cover', 'promo', 'making of', 'behind the scenes', 'top 10', 'top 50',
      'best of', 'all songs', 'hit list', 'audio jukebox', 'songs list'
    ];
    return songs.filter(s => {
      const t = (s.title || '').toLowerCase();
      return !BLOCKED.some(kw => t.includes(kw));
    });
  };


  // ──────────────────────────────────────────────────────
  // FEATURE: Music Director Collections
  // ──────────────────────────────────────────────────────
  const MUSIC_DIRECTORS = [
    { id: 'anirudh', name: 'Anirudh', query: 'Anirudh Ravichander tamil hit songs -jukebox -mashup -collection -nonstop -shorts -reels -status', color: 'from-[#f97316] to-[#ef4444]', emoji: '🎸', subtitle: 'Music Director' },
    { id: 'arrahman', name: 'A.R. Rahman', query: 'AR Rahman tamil hit songs -jukebox -mashup -collection -nonstop -shorts -reels -status', color: 'from-[#6366f1] to-[#8b5cf6]', emoji: '🎹', subtitle: 'Music Director' },
    { id: 'harris', name: 'Harris Jayaraj', query: 'Harris Jayaraj tamil hit songs -jukebox -mashup -collection -nonstop -shorts -reels -status', color: 'from-[#0ea5e9] to-[#6366f1]', emoji: '🎻', subtitle: 'Music Director' },
    { id: 'yuvan', name: 'Yuvan Shankar Raja', query: 'Yuvan Shankar Raja tamil hit songs -jukebox -mashup -collection -nonstop -shorts -reels -status', color: 'from-[#10b981] to-[#0ea5e9]', emoji: '🎵', subtitle: 'Music Director' },
    { id: 'deva', name: 'Deva', query: 'Deva tamil hit songs -jukebox -mashup -collection -nonstop -shorts -reels -status', color: 'from-[#ec4899] to-[#f97316]', emoji: '🥁', subtitle: 'Music Director' },
    { id: 'ilayaraja', name: 'Ilaiyaraaja', query: 'Ilaiyaraaja evergreen tamil hit songs -jukebox -mashup -collection -nonstop -shorts -reels -status', color: 'from-[#f59e0b] to-[#ec4899]', emoji: '🎼', subtitle: 'Music Director' },
    { id: 'gv', name: 'G.V. Prakash', query: 'GV Prakash Kumar tamil hit songs -jukebox -mashup -collection -nonstop -shorts -reels -status', color: 'from-[#14b8a6] to-[#22c55e]', emoji: '🎤', subtitle: 'Music Director' },
    { id: 'sid', name: 'Sid Sriram', query: 'Sid Sriram tamil hit songs -jukebox -mashup -collection -nonstop -shorts -reels -status', color: 'from-[#a855f7] to-[#ec4899]', emoji: '🎧', subtitle: 'Top Singer' },
  ];

  // ──────────────────────────────────────────────────────
  // FEATURE: Era Collections (80s, 90s, 2k)
  // ──────────────────────────────────────────────────────
  // ──────────────────────────────────────────────────────
  // ERA COLLECTION QUERIES — curated Tamil-only, no reels/shorts/other languages
  // Trending Now  : 2024-2025 popular Tamil film songs
  // 2K Kids       : Tamil movies released after 2015
  // 90s Hits      : Tamil songs 1990–2014
  // 80s Classics  : Tamil songs before 1990
  // ──────────────────────────────────────────────────────
  const ERA_COLLECTIONS = [
    {
      id: 'trending_now',
      name: 'Trending Now',
      query: 'tamil songs 2024 2025 Anirudh GV Prakash Yuvan trending hit -jukebox -mashup -nonstop -shorts -reels -status -interview -teaser -trailer -ringtone',
      color: 'from-[#ff007f] to-[#ff7f00]',
      emoji: '🔥',
      subtitle: 'Current Hits'
    },
    {
      id: '2k_kids',
      name: '2K Kids',
      query: 'tamil hit songs 2016 2017 2018 2019 2020 2021 2022 2023 Mersal Bigil Master Beast Vikram Jailer -jukebox -mashup -nonstop -shorts -reels -status -interview -teaser -trailer -ringtone',
      color: 'from-[#00f2fe] to-[#4facfe]',
      emoji: '🎧',
      subtitle: 'After 2015'
    },
    {
      id: '90s_hits',
      name: '90s Hits',
      query: 'tamil evergreen songs 1990s 2000s Roja Bombay Kadhal Desam Gentleman Kadhalan Muthu Enthiran -jukebox -mashup -nonstop -shorts -reels -status -interview -teaser -trailer -ringtone',
      color: 'from-[#f6d365] to-[#fda085]',
      emoji: '📼',
      subtitle: '1990 – 2015'
    },
    {
      id: '80s_classics',
      name: '80s Classics',
      query: 'tamil classic songs Ilaiyaraaja 1980s Moodu Pani Ninaithale Innikkum Ninaive Oru Sangeetham Punnagai Mannan Agni Natchathiram -jukebox -mashup -nonstop -shorts -reels -status -interview -teaser -trailer -ringtone',
      color: 'from-[#d4fc79] to-[#96e6a1]',
      emoji: '📻',
      subtitle: 'Before 1990'
    },
  ];

  const [directorSongs, setDirectorSongs] = useState([]);
  const [selectedDirector, setSelectedDirector] = useState(null);
  const [directorLoading, setDirectorLoading] = useState(false);

  const fetchDirectorSongs = async (director) => {
    setSelectedDirector(director);
    setActiveTab('DirectorSongs');
    setDirectorLoading(true);
    setDirectorSongs([]);
    try {
      const cacheKey = `director_${director.id}`;
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        setDirectorSongs(JSON.parse(cached));
        setDirectorLoading(false);
        return;
      }
      const apiEndpoint = 'https://play-infinity.vercel.app/api/search';
      const res = await fetch(`${apiEndpoint}?q=${encodeURIComponent(director.query)}`);
      const data = await res.json();
      let results = Array.isArray(data) ? data : (data.videos || []);
      results = applyBaseFilter(applyTamilFilter(results));
      sessionStorage.setItem(cacheKey, JSON.stringify(results));
      setDirectorSongs(results);
    } catch (err) {
      console.error('Director songs fetch error:', err);
    } finally {
      setDirectorLoading(false);
    }
  };



  const getColorFromImage = (url) => {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = "Anonymous";
      img.src = url;
      img.onload = () => {
        try {
          const size = 50;
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          canvas.width = size;
          canvas.height = size;
          ctx.drawImage(img, 0, 0, size, size);
          const data = ctx.getImageData(0, 0, size, size).data;

          let bestR = 30, bestG = 215, bestB = 96; // fallback green
          let bestScore = -1;

          // Sample pixels and find the most vibrant/bright non-dark one
          for (let i = 0; i < data.length; i += 4) {
            const r = data[i], g = data[i + 1], b = data[i + 2];
            const brightness = (r * 299 + g * 587 + b * 114) / 1000;
            const max = Math.max(r, g, b);
            const min = Math.min(r, g, b);
            const saturation = max === 0 ? 0 : (max - min) / max;
            // Prefer bright + saturated colors, skip near-black
            if (brightness > 60 && saturation > 0.2) {
              const score = brightness * 0.4 + saturation * 200;
              if (score > bestScore) {
                bestScore = score;
                bestR = r; bestG = g; bestB = b;
              }
            }
          }

          // If still too dark, boost it
          const brightness = (bestR * 299 + bestG * 587 + bestB * 114) / 1000;
          if (brightness < 80) {
            const boost = 80 / Math.max(brightness, 1);
            bestR = Math.min(255, Math.round(bestR * boost));
            bestG = Math.min(255, Math.round(bestG * boost));
            bestB = Math.min(255, Math.round(bestB * boost));
          }

          resolve(`rgb(${bestR}, ${bestG}, ${bestB})`);
        } catch {
          resolve('#1ed760');
        }
      };
      img.onerror = () => resolve('#1ed760');
    });
  };

  const normalizeTitleKey = (title = '') => {
    const stopWords = new Set([
      'official', 'video', 'audio', 'lyric', 'lyrics', 'song', 'songs', 'full', 'hd', '4k', 'version',
      'sad', 'mix', 'remix', 'slowed', 'reverb', 'topic', 'movie', 'film', 'tamil', 'telugu', 'hindi',
      'malayalam', 'kannada', 'jukebox', 'shorts'
    ]);

    return title
      .toLowerCase()
      .replace(/\[[^\]]*\]|\([^)]*\)/g, ' ')
      .replace(/[^\p{L}\p{N} ]/gu, ' ')
      .split(/\s+/)
      .filter(word => word && word.length > 2 && !stopWords.has(word))
      .join(' ');
  };

  const titleTokenSet = (title = '') => new Set(normalizeTitleKey(title).split(' ').filter(Boolean));

  const tokenSimilarity = (aSet, bSet) => {
    if (!aSet || !bSet || aSet.size === 0 || bSet.size === 0) return 0;
    let overlap = 0;
    for (const word of aSet) {
      if (bSet.has(word)) overlap++;
    }
    return overlap / Math.min(aSet.size, bSet.size);
  };

  const isLikelySameSong = (candidateTitle = '', currentTitle = '') => {
    const aWords = titleTokenSet(candidateTitle);
    const bWords = titleTokenSet(currentTitle);
    if (aWords.size === 0 || bWords.size === 0) return false;

    let overlapCount = 0;
    for (const w of aWords) {
      if (bWords.has(w)) overlapCount++;
    }

    const similarity = tokenSimilarity(aWords, bWords);
    return (overlapCount >= 2 && similarity >= 0.5) || similarity >= 0.75;
  };

  const addPlayedTitleTokens = (title = '') => {
    const tokens = titleTokenSet(title);
    if (tokens.size === 0) return;

    const alreadyExists = playedTitleTokenSetsRef.current.some(existing => tokenSimilarity(existing, tokens) >= 0.8);
    if (alreadyExists) return;

    playedTitleTokenSetsRef.current = [tokens, ...playedTitleTokenSetsRef.current].slice(0, 80);
  };

  const favoriteIds = useMemo(() => new Set(favorites.map(s => s.id)), [favorites]);
  const fallbackSongs = useMemo(() => {
    if (songs.length > 0) return songs;
    const historyIds = new Set(searchHistory.map(h => h.id));
    return [...searchHistory, ...trendingSongs.filter(t => !historyIds.has(t.id))].slice(0, 30);
  }, [songs, searchHistory, trendingSongs]);



  // FEATURE: Offline detection
  useEffect(() => {
    const goOnline = () => { setIsOnline(true); showToast('Back online! 🌐', 'success'); };
    const goOffline = () => { setIsOnline(false); showToast('No internet connection 📵', 'error'); };
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => { window.removeEventListener('online', goOnline); window.removeEventListener('offline', goOffline); };
  }, [showToast]);

  // FEATURE: Listen History persistence
  useEffect(() => {
    localStorage.setItem('listenHistory', JSON.stringify(listenHistory.slice(0, 50)));
  }, [listenHistory]);

  // FEATURE: Queue persistence
  useEffect(() => {
    localStorage.setItem('savedQueue', JSON.stringify(queue.slice(0, 30)));
  }, [queue]);

  useEffect(() => {
    if (currentSong) localStorage.setItem('savedCurrentSong', JSON.stringify(currentSong));
  }, [currentSong]);

  // Visualization Loop
  useEffect(() => {
    let animationFrame;
    const update = () => {
      if (isPlaying && analyserRef.current) {
        const binCount = analyserRef.current.frequencyBinCount || 32;
        const dataArray = new Uint8Array(binCount);
        analyserRef.current.getByteFrequencyData(dataArray);

        const sum = dataArray.reduce((acc, val) => acc + val, 0);
        if (sum < 10) {
          // Rhythmic fallback for CORS scenarios
          const mock = new Uint8Array(32).map((_, i) => {
            const pulse = Math.sin(Date.now() / 150 + i * 0.5) * 20;
            const wave = Math.sin(Date.now() / 1000 + i * 0.2) * 10;
            return 80 + pulse + wave + Math.random() * 15;
          });
          setAudioData(mock);
        } else {
          setAudioData(dataArray);
        }
      } else {
        // Subtle resting pulse when paused or no analyser
        const restingMode = new Uint8Array(32).map((_, i) => {
          return 25 + Math.sin(Date.now() / 1000 + i * 0.3) * 8;
        });
        setAudioData(restingMode);
      }
      animationFrame = requestAnimationFrame(update);
    };
    update();
    return () => cancelAnimationFrame(animationFrame);
  }, [isPlaying]);

  useEffect(() => {
    localStorage.setItem('musicHistory', JSON.stringify(searchHistory));
  }, [searchHistory]);

  useEffect(() => {
    localStorage.setItem('musicFavorites', JSON.stringify(favorites));
  }, [favorites]);

  useEffect(() => {
    localStorage.setItem('musicPlaylists', JSON.stringify(playlists));
  }, [playlists]);

  // Update auto playlists
  useEffect(() => {
    setPlaylists(prev => prev.map(p => {
      if (p.name === 'Your Top Hits') return { ...p, songs: searchHistory.slice(0, 15) };
      if (p.name === 'Trending Vibes') return { ...p, songs: trendingSongs.slice(0, 15) };
      return p;
    }));
  }, [searchHistory, trendingSongs]);

  const toggleFavorite = (e, song) => {
    if (e) e.stopPropagation();
    const alreadyFav = favorites.some(s => s.id === song.id);
    if (alreadyFav) {
      showToast('Removed from Liked Songs', 'info');
      setFavorites(prev => prev.filter(s => s.id !== song.id));
    } else {
      showToast('Added to Liked Songs ❤️', 'success');
      setFavorites(prev => [song, ...prev].slice(0, 100));
    }
  };

  const createPlaylist = () => {
    if (!newPlaylistName.trim()) return;
    const newPlaylist = {
      id: Date.now().toString(),
      name: newPlaylistName.trim(),
      isAuto: false,
      songs: []
    };
    setPlaylists(prev => [...prev, newPlaylist]);
    setNewPlaylistName('');
    showToast(`Playlist "${newPlaylistName.trim()}" created! 🎵`, 'success');
  };

  const addToPlaylist = (playlistId, song) => {
    const pl = playlists.find(p => p.id === playlistId);
    setPlaylists(prev => prev.map(p => {
      if (p.id === playlistId) {
        if (p.songs.some(s => s.id === song.id)) { showToast('Already in playlist!', 'info'); return p; }
        return { ...p, songs: [song, ...p.songs] };
      }
      return p;
    }));
    if (pl && !pl.songs.some(s => s.id === song.id)) showToast(`Added to "${pl?.name}" 🎶`, 'success');
    setShowPlaylistModal({ isOpen: false, songInfo: null });
  };

  useEffect(() => {
    if (sleepTimer) {
      setSleepMinutesLeft(sleepTimer);
      sleepTimerRef.current = setInterval(() => {
        setSleepMinutesLeft(prev => {
          if (prev <= 1) {
            clearInterval(sleepTimerRef.current);
            setIsPlaying(false);
            setSleepTimer(null);
            return 0;
          }
          return prev - 1;
        });
      }, 60000); // 1 minute
    } else {
      if (sleepTimerRef.current) clearInterval(sleepTimerRef.current);
      setSleepMinutesLeft(0);
    }
    return () => clearInterval(sleepTimerRef.current);
  }, [sleepTimer]);



  useEffect(() => {
    const fetchTrending = async () => {
      try {
        const cached = sessionStorage.getItem('trendingSongs_v2');
        if (cached) {
          setTrendingSongs(JSON.parse(cached));
          return;
        }
        const apiEndpoint = `https://play-infinity.vercel.app/api/search`;
        // Fetch actual 2024-2025 trending Tamil film songs — strict exclusions
        const trendingQuery = 'trending tamil songs 2024 2025 Anirudh Yuvan GV Prakash Sid Sriram -jukebox -mashup -nonstop -shorts -reels -status -interview -teaser -trailer -ringtone -whatsapp';
        const res = await fetch(`${apiEndpoint}?q=${encodeURIComponent(trendingQuery)}`);
        const data = await res.json();
        let songsList = Array.isArray(data) ? data : (data.videos || []);

        // Strict Tamil-only + base quality filter
        songsList = applyBaseFilter(applyTamilFilter(songsList));

        const shuffled = songsList.sort(() => 0.5 - Math.random()).slice(0, 20);
        setTrendingSongs(shuffled);
        sessionStorage.setItem('trendingSongs_v2', JSON.stringify(shuffled));
      } catch (err) {
        console.error("Fetch trending error:", err);
        if (window.location.protocol.startsWith('http')) {
          console.log("Trending failed:", err.message);
        }
      }
    };
    fetchTrending();
  }, []);

  const searchYoutube = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setLoading(true);
    try {
      // Fetch from local dev proxy or Vercel serverless function
      const apiEndpoint = `https://play-infinity.vercel.app/api/search`;
      const res = await fetch(`${apiEndpoint}?q=${encodeURIComponent(searchQuery + ' tamil song')}`);
      const data = await res.json();
      let results = Array.isArray(data) ? data : (data.videos || []);

      // Strict Tamil-only filter
      results = applyBaseFilter(applyTamilFilter(results));

      setSongs(results);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchQueue = async (song) => {
    setIsFetchingQueue(true);
    try {
      const minQueueTarget = 20;
      const apiEndpoint = `https://play-infinity.vercel.app/api/search`;
      const currentSongTitle = song.title || '';

      const titleLower = song.title.toLowerCase();
      const searchLower = searchQuery.toLowerCase();

      // Vibe keyword detection
      const kuthuKeywords = ["kuthu", "dance", "mass", "folk", "fast", "dappankuthu", "seena thana", "appadi podu", "kalyana vayasu", "vaathi coming", "aaluma doluma", "verithanam", "machi open the bottle", "nakku mukka", "sodakku", "rowdy baby", "kutti story"];
      const melodyKeywords = ["love", "kadhal", "melody", "romantic", "bgm", "po nee po", "munbe vaa", "hosanna", "nenjukkul", "vaseegara", "minnale", "ilayaraja", "ar rahman", "thamarai", "kurumugil"];
      const sadKeywords = ["sad", "sogam", "pain", "broken", "kanneer", "feeling", "lonely"];

      let moodQuery = "";

      if (kuthuKeywords.some(w => searchLower.includes(w) || titleLower.includes(w))) {
        moodQuery = "tamil mass kuthu audio songs -jukebox";
      } else if (melodyKeywords.some(w => searchLower.includes(w) || titleLower.includes(w))) {
        moodQuery = "tamil melody love romantic audio songs -jukebox";
      } else if (sadKeywords.some(w => searchLower.includes(w) || titleLower.includes(w))) {
        moodQuery = "tamil sad feelings audio songs -jukebox";
      } else {
        let artist = song.artist?.replace(/ - Topic|VEVO/gi, '').split(',')[0].trim();
        if (artist && artist.toLowerCase() !== 'various artists' && artist.length > 2) {
          moodQuery = `${artist} tamil audio songs -jukebox`;
        } else {
          const fallbacks = [
            "tamil mass kuthu audio songs -jukebox",
            "tamil melody love romantic audio songs -jukebox",
            "tamil latest hit audio songs -jukebox"
          ];
          moodQuery = fallbacks[Math.floor(Math.random() * fallbacks.length)];
        }
      }

      const res = await fetch(`${apiEndpoint}?q=${encodeURIComponent(moodQuery)}`);
      let data = await res.json();
      if (!Array.isArray(data)) {
        data = data.videos || [];
      }

      const getSignificantWords = (str) => {
        return str.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(' ')
          .filter(w => w.length > 3 && !['lyric', 'video', 'audio', 'song', 'songs', 'tamil', 'official', 'full', 'theme', 'topic'].includes(w));
      };

      const currentWords = getSignificantWords(song.title);

      let newQueue = [];
      if (data && data.length > 0) {
        const filteredQueue = data.filter(s => {
          if (s.id === song.id) return false;
          if (s.durationSeconds && s.durationSeconds > 420) return false;
          if (s.durationSeconds && s.durationSeconds < 90) return false;
          if (isLikelySameSong(s.title, currentSongTitle)) return false;

          const lowerTitle = s.title.toLowerCase();
          const badWords = ["jukebox", "mashup", "collections", "nonstop", "full album", "news", "interview", "podcast", "vlog", "speech", "review", "reaction", "trailer", "teaser", "promo", "audio launch", "press", "telugu", "hindi", "malayalam", "kannada", "whatsapp status"];
          for (let word of badWords) {
            if (lowerTitle.includes(word)) return false;
          }

          const sWords = getSignificantWords(s.title);
          let matchCount = 0;
          for (let w of currentWords) {
            if (sWords.includes(w)) matchCount++;
          }

          if (matchCount >= 2) return false;
          if (currentWords.length === 1 && matchCount === 1) return false;
          return true;
        });

        const relaxedPool = data
          .filter(s => s.id !== song.id && (s.durationSeconds == null || s.durationSeconds < 420))
          .filter(s => !s.durationSeconds || s.durationSeconds >= 90)
          .filter(s => !isLikelySameSong(s.title, currentSongTitle))
          .sort(() => 0.5 - Math.random());

        const merged = [
          ...filteredQueue,
          ...relaxedPool.filter(s => !filteredQueue.some(f => f.id === s.id))
        ];

        newQueue = merged.slice(0, 40);
      }

      if (newQueue.length === 0) {
        const fallbacks = [...songs, ...searchHistory, ...trendingSongs].filter(s => s.id !== song.id);
        const uniqueFallbacks = Array.from(new Map(fallbacks.map(item => [item.id, item])).values());
        newQueue = uniqueFallbacks.sort(() => 0.5 - Math.random()).slice(0, 30);
      }

      if (newQueue.length < minQueueTarget) {
        const extraFallbacks = [...songs, ...searchHistory, ...trendingSongs].filter(s => s.id !== song.id);
        const uniqueExtras = Array.from(new Map(extraFallbacks.map(item => [item.id, item])).values());
        const missing = uniqueExtras
          .filter(s => !newQueue.some(q => q.id === s.id))
          .filter(s => !isLikelySameSong(s.title, currentSongTitle));
        newQueue = [...newQueue, ...missing].slice(0, 40);
      }

      if (newQueue.length < minQueueTarget) {
        try {
          const topUpRes = await fetch(`${apiEndpoint}?q=${encodeURIComponent('tamil trending latest hit video songs')}`);
          let topUpData = await topUpRes.json();
          if (!Array.isArray(topUpData)) topUpData = topUpData.videos || [];
          const cleanTopUp = topUpData
            .filter(s => s.id !== song.id && (s.durationSeconds == null || s.durationSeconds < 420))
            .filter(s => !s.durationSeconds || s.durationSeconds >= 90)
            .filter(s => !newQueue.some(q => q.id === s.id))
            .filter(s => !isLikelySameSong(s.title, currentSongTitle));
          newQueue = [...newQueue, ...cleanTopUp].slice(0, 40);
        } catch (topUpError) {
          console.warn('Queue top-up fetch failed:', topUpError);
        }
      }

      setQueue(prevQueue => {
        const normalizeArtist = (artist = '') =>
          artist.toLowerCase().replace(/ - topic|vevo/gi, '').replace(/[^a-z0-9 ]/g, ' ').trim();
        const normalizeTitle = (title = '') => normalizeTitleKey(title).split(' ').filter(Boolean).slice(0, 6).join(' ');

        const existingIds = new Set(prevQueue.map(s => s.id));
        existingIds.add(song.id);
        if (currentSong) existingIds.add(currentSong.id);

        sessionPlayedIds.current.forEach(id => existingIds.add(id));

        const existingArtistCounts = prevQueue.reduce((acc, item) => {
          const key = normalizeArtist(item.artist);
          if (key) acc.set(key, (acc.get(key) || 0) + 1);
          return acc;
        }, new Map());
        const seenTitles = new Set(prevQueue.map(item => normalizeTitle(item.title)));
        seenTitles.add(normalizeTitle(song.title));
        const seenTitleTokens = [
          ...prevQueue.map(item => titleTokenSet(item.title)),
          titleTokenSet(song.title),
          ...playedTitleTokenSetsRef.current
        ];
        const maxPerArtist = 2;

        const diversifiedNew = [];
        for (const candidate of newQueue) {
          if (existingIds.has(candidate.id)) continue;

          const titleKey = normalizeTitle(candidate.title);
          if (seenTitles.has(titleKey)) continue;
          const candidateTokens = titleTokenSet(candidate.title);
          const tooSimilarInQueue = seenTitleTokens.some(tokens => tokenSimilarity(candidateTokens, tokens) >= 0.66);
          if (tooSimilarInQueue) continue;

          const artistKey = normalizeArtist(candidate.artist);
          if (artistKey && (existingArtistCounts.get(artistKey) || 0) >= maxPerArtist) continue;

          diversifiedNew.push(candidate);
          seenTitles.add(titleKey);
          seenTitleTokens.push(candidateTokens);
          if (artistKey) {
            existingArtistCounts.set(artistKey, (existingArtistCounts.get(artistKey) || 0) + 1);
          }
        }

        if (diversifiedNew.length < minQueueTarget) {
          for (const candidate of newQueue) {
            if (diversifiedNew.length >= minQueueTarget) break;
            if (existingIds.has(candidate.id) || diversifiedNew.some(item => item.id === candidate.id)) continue;
            const titleKey = normalizeTitle(candidate.title);
            if (seenTitles.has(titleKey)) continue;
            if (isLikelySameSong(candidate.title, currentSongTitle)) continue;
            const candidateTokens = titleTokenSet(candidate.title);
            const tooSimilarInQueue = seenTitleTokens.some(tokens => tokenSimilarity(candidateTokens, tokens) >= 0.66);
            if (tooSimilarInQueue) continue;
            diversifiedNew.push(candidate);
            seenTitles.add(titleKey);
            seenTitleTokens.push(candidateTokens);
          }
        }

        return [...prevQueue, ...diversifiedNew].slice(0, 50);
      });
    } catch (err) {
      console.error(err);
    } finally {
      setIsFetchingQueue(false);
    }
  };

  const streamEndpointBase = 'https://play-infinity.vercel.app/api/stream';

  // List of public Piped instances as backbridge for background play
  const pipedInstances = [
    'https://pipedapi.kavin.rocks',
    'https://api.piped.victr.me',
    'https://piped-api.lunar.icu',
    'https://api.piped.projectsegfau.lt',
    'https://pipedapi.metafates.me',
    'https://api-piped.mha.fi'
  ];

  const fetchPipedStream = async (videoId) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout

    const fetchInstance = async (instance) => {
      const response = await fetch(`${instance}/streams/${videoId}`, { signal: controller.signal });
      if (!response.ok) throw new Error('Fail');
      const data = await response.json();
      const audioStreams = data.audioStreams || [];
      const bestAudio = audioStreams
        .filter(s => s.mimeType.includes('audio/mp4'))
        .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))[0] || audioStreams[0];
      if (bestAudio?.url) return bestAudio.url;
      throw new Error('No audio');
    };

    try {
      const result = await Promise.any(pipedInstances.map(instance => fetchInstance(instance)));
      clearTimeout(timeoutId);
      return result;
    } catch (e) {
      console.warn("All Piped instances failed or timed out", e);
      clearTimeout(timeoutId);
      return null;
    }
  };
  const playSong = async (song, fromQueue = false) => {
    // Extract color for dynamic background
    getColorFromImage(song.thumbnail).then(color => setDominantColor(color));

    // Audio Visualization Setup
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
        analyserRef.current = audioCtxRef.current.createAnalyser();
        analyserRef.current.fftSize = 64;
        analyserRef.current.smoothingTimeConstant = 0.8;
      }

      if (backgroundAudio && !sourceRef.current && audioCtxRef.current) {
        try {
          sourceRef.current = audioCtxRef.current.createMediaElementSource(backgroundAudio);
          sourceRef.current.connect(analyserRef.current);
          analyserRef.current.connect(audioCtxRef.current.destination);
        } catch (e) {
          console.warn("Source connection handled:", e);
        }
      }
      if (audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume();
      }
    } catch (err) {
      console.warn("Audio visualization setup failed:", err);
    }

    setCurrentSong(song);
    setIsPlaying(true);
    setActiveTab('Music');
    setUseIframeFallback(false);

    sessionPlayedIds.current.add(song.id);
    addPlayedTitleTokens(song.title);

    // Track listen history
    setListenHistory(prev => {
      const filtered = prev.filter(s => s.id !== song.id);
      return [{ ...song, playedAt: Date.now() }, ...filtered].slice(0, 50);
    });

    setSearchHistory(prev => {
      const filtered = prev.filter(s => s.id !== song.id);
      return [song, ...filtered].slice(0, 20);
    });

    if (!fromQueue) {
      setQueue([]);
      fetchQueue(song);
    } else {
      setQueue(prev => prev.filter(s => s.id !== song.id && !isLikelySameSong(s.title, song.title)));
      if (queue.length <= 15) {
        fetchQueue(song);
      }
    }

    const directUrl = await fetchPipedStream(song.id);
    if (directUrl) {
      setDirectStreamUrl(directUrl);
    } else {
      setDirectStreamUrl(null);
    }
  };

  const togglePlay = () => {
    if (!currentSong) return;
    setIsPlaying(!isPlaying);
  };

  // FEATURE: Share Song
  const shareSong = async (song) => {
    if (!song) return;
    const shareData = {
      title: song.title,
      text: `🎵 Listening to "${song.title}" by ${song.artist} on ISAI`,
      url: `https://www.youtube.com/watch?v=${song.id}`
    };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(`${shareData.text}\n${shareData.url}`);
        showToast('Link copied to clipboard! 📋', 'success');
      }
    } catch { }
  };


  const handleProgress = (state) => {
    setProgress(state.playedSeconds);
  };

  const handleDuration = (val) => {
    setDuration(val);
  };

  const handleSeek = (e) => {
    if (!playerRef.current) return;
    const value = parseFloat(e.target.value);
    setProgress(value);
    playerRef.current.seekTo(value, "seconds");
  };

  const playNext = () => {
    if (queue.length > 0) {
      playSong(queue[0], true);
    } else if (isFetchingQueue) {
      return;
    } else if (fallbackSongs.length > 0) {
      const idx = fallbackSongs.findIndex(s => s.id === currentSong?.id);
      if (idx !== -1 && idx < fallbackSongs.length - 1) {
        playSong(fallbackSongs[idx + 1]);
      } else {
        playSong(fallbackSongs[0]); // loop back
      }
    }
  };

  const playPrev = () => {
    if (fallbackSongs.length === 0) return;
    const idx = fallbackSongs.findIndex(s => s.id === currentSong?.id);
    if (idx > 0) {
      playSong(fallbackSongs[idx - 1]);
    } else {
      playSong(fallbackSongs[0]);
    }
  };

  const [directStreamUrl, setDirectStreamUrl] = useState(null);
  const currentStreamUrl = directStreamUrl || (currentSong ? `${streamEndpointBase}?videoId=${currentSong.id}` : '');

  // Mobile Background Playback & MediaSession API Logic
  const silentAudioRef = useRef(null);
  const playNextRef = useRef(playNext);
  const playPrevRef = useRef(playPrev);

  playNextRef.current = playNext;
  playPrevRef.current = playPrev;

  const setupMediaSession = useCallback(() => {
    if ('mediaSession' in navigator && currentSong) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: currentSong.title,
        artist: currentSong.artist || 'Unknown Artist',
        album: 'ISAI (இசை)',
        artwork: [
          { src: '/logo.png', sizes: '96x96', type: 'image/png' },
          { src: '/logo.png', sizes: '128x128', type: 'image/png' },
          { src: '/logo.png', sizes: '256x256', type: 'image/png' },
          { src: '/logo.png', sizes: '512x512', type: 'image/png' },
        ]
      });

      try {
        navigator.mediaSession.setActionHandler('play', () => {
          setIsPlaying(true);
          if (backgroundAudio) backgroundAudio.play().catch(() => { });
          silentAudioRef.current?.play().catch(() => { });
          navigator.mediaSession.playbackState = 'playing';
        });

        navigator.mediaSession.setActionHandler('pause', () => {
          setIsPlaying(false);
          if (backgroundAudio) backgroundAudio.pause();
          silentAudioRef.current?.pause();
          navigator.mediaSession.playbackState = 'paused';
        });

        navigator.mediaSession.setActionHandler('previoustrack', () => {
          if (playPrevRef.current) playPrevRef.current();
          navigator.mediaSession.playbackState = 'playing';
        });

        navigator.mediaSession.setActionHandler('nexttrack', () => {
          if (playNextRef.current) playNextRef.current();
          navigator.mediaSession.playbackState = 'playing';
        });

        navigator.mediaSession.setActionHandler('seekbackward', (details) => {
          const skipTime = details.seekOffset || 10;
          const newPos = Math.max(backgroundAudio ? backgroundAudio.currentTime - skipTime : progress - skipTime, 0);
          if (backgroundAudio) backgroundAudio.currentTime = newPos;
          if (playerRef.current) playerRef.current.seekTo(newPos, "seconds");
          setProgress(newPos);
        });

        navigator.mediaSession.setActionHandler('seekforward', (details) => {
          const skipTime = details.seekOffset || 10;
          const newPos = Math.min(backgroundAudio ? backgroundAudio.currentTime + skipTime : progress + skipTime, duration || 999);
          if (backgroundAudio) backgroundAudio.currentTime = newPos;
          if (playerRef.current) playerRef.current.seekTo(newPos, "seconds");
          setProgress(newPos);
        });

        navigator.mediaSession.setActionHandler('seekto', (details) => {
          if (playerRef.current) {
            playerRef.current.seekTo(details.seekTime, "seconds");
          }
          if (backgroundAudio) {
            backgroundAudio.currentTime = details.seekTime;
          }
          setProgress(details.seekTime);
        });

        navigator.mediaSession.setActionHandler('stop', () => {
          setIsPlaying(false);
          if (backgroundAudio) backgroundAudio.pause();
          silentAudioRef.current?.pause();
          navigator.mediaSession.playbackState = 'none';
        });
      } catch (e) {
        console.warn("MediaSession handlers failed:", e);
      }
    }
  }, [currentSong, setIsPlaying]);

  useEffect(() => {
    setUseIframeFallback(false);
    setupMediaSession();
  }, [currentSong, setupMediaSession]);

  useEffect(() => {
    if ('mediaSession' in navigator) {
      navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
    }
    // Update native audio directly to bypass React cycle in background
    if (backgroundAudio) {
      if (isPlaying && !useIframeFallback) {
        backgroundAudio.play().catch(() => { });
        if (silentAudioRef.current) silentAudioRef.current.play().catch(() => { });
      } else {
        backgroundAudio.pause();
        if (silentAudioRef.current) silentAudioRef.current.pause();
      }
    }
  }, [isPlaying, useIframeFallback]);

  // Audio Context Unlock for Mobile
  useEffect(() => {
    const unlock = () => {
      if (silentAudioRef.current) {
        silentAudioRef.current.play().then(() => {
          silentAudioRef.current.pause();
          window.removeEventListener('click', unlock);
          window.removeEventListener('touchstart', unlock);
        }).catch(() => { });
      }
    };
    window.addEventListener('click', unlock);
    window.addEventListener('touchstart', unlock);
    return () => {
      window.removeEventListener('click', unlock);
      window.removeEventListener('touchstart', unlock);
    };
  }, []);

  useEffect(() => {
    if (!('mediaSession' in navigator) || !navigator.mediaSession.setPositionState || !currentSong || !duration) return;
    try {
      navigator.mediaSession.setPositionState({
        duration,
        playbackRate: 1,
        position: Math.min(progress, duration)
      });
    } catch { }
  }, [progress, duration, currentSong]);

  const displaySongs = fallbackSongs;
  const hasActiveSearchResults = searchQuery.trim().length > 0 && songs.length > 0;
  const shouldShowQueue = Boolean(currentSong) && !hasActiveSearchResults;

  // FEATURE: Keyboard shortcuts
  useEffect(() => {
    const handler = (e) => {
      const tag = e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.code === 'Space') { e.preventDefault(); if (currentSong) setIsPlaying(p => !p); }
      if (e.code === 'ArrowRight') { e.preventDefault(); const np = Math.min(progress + 10, duration); setProgress(np); if (backgroundAudio) backgroundAudio.currentTime = np; }
      if (e.code === 'ArrowLeft') { e.preventDefault(); const np = Math.max(progress - 10, 0); setProgress(np); if (backgroundAudio) backgroundAudio.currentTime = np; }
      if (e.code === 'KeyN') { e.preventDefault(); playNext(); }
      if (e.code === 'KeyB') { e.preventDefault(); playPrev(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [currentSong, progress, duration]);

  // FEATURE: Swipe gestures on Now Playing
  const swipeTouchStartX = useRef(null);
  const swipeTouchStartY = useRef(null);

  // backgroundAudio setup and event handlers
  useEffect(() => {
    if (backgroundAudio) {
      backgroundAudio.onended = () => playNext();
      backgroundAudio.ontimeupdate = () => setProgress(backgroundAudio.currentTime);
      backgroundAudio.onloadeddata = () => setDuration(backgroundAudio.duration);
      backgroundAudio.onerror = (e) => {
        console.error("Audio player error:", e);
        if (!useIframeFallback) setUseIframeFallback(true);
      };
    }
  }, [playNext, useIframeFallback]);

  useEffect(() => {
    if (backgroundAudio && currentStreamUrl && !useIframeFallback) {
      backgroundAudio.src = currentStreamUrl;
      if (isPlaying) backgroundAudio.play().catch(e => console.error("URL change play failed", e));
    }
  }, [currentStreamUrl, useIframeFallback, isPlaying]);

  // No native player needed for web PWA

  return (
    <div className="flex items-center justify-center bg-gray-900 overflow-hidden font-['Outfit']" style={{ height: '100dvh' }}>

      {/* Invisible HTML5 Audio to keep browser session alive for iOS/Android Background playing */}
      <audio ref={silentAudioRef} loop playsInline src="data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=" />

      {/* Native Audio Proxy & YouTube Player Fallback */}
      {currentSong && (
        <div className="absolute top-[-9999px] left-[-9999px] w-[50px] h-[50px] opacity-0 pointer-events-none overflow-hidden">
          {useIframeFallback ? (
            <ReactPlayer
              ref={playerRef}
              url={currentSong.url}
              playing={isPlaying}
              onProgress={handleProgress}
              onDuration={handleDuration}
              onEnded={() => playNext()}
              onError={(e) => {
                console.error("Iframe error:", e);
                playNext();
              }}
              volume={1}
              width="50px"
              height="50px"
            />
          ) : (
            <div className="bg-green-500 w-10 h-10">CORE MODE</div>
          )}
        </div>
      )}

      {/* App Container - Mobile Layout (Dark Theme) */}
      <div className="w-full h-full max-w-[450px] bg-[#121212] shadow-[0_20px_50px_rgba(0,0,0,0.5)] relative overflow-hidden flex flex-col md:hidden text-[#a0a3b1] sm:rounded-none sm:scale-100">

        {/* Toast Notifications */}
        <div className="absolute top-4 left-0 right-0 z-[100] flex flex-col items-center gap-2 pointer-events-none px-4">
          {toasts.map(toast => (
            <div key={toast.id} className={`flex items-center gap-3 px-4 py-3 rounded-2xl shadow-xl backdrop-blur-xl text-sm font-bold animate-slide-up-premium pointer-events-auto border ${toast.type === 'success' ? 'bg-[#1a2e1a]/90 border-[#8cd92b]/30 text-[#8cd92b]' : toast.type === 'error' ? 'bg-[#2e1a1a]/90 border-red-500/30 text-red-400' : 'bg-[#1a1a2e]/90 border-white/10 text-white/80'}`}>
              {toast.type === 'success' ? <CheckCircle2 size={16} /> : toast.type === 'error' ? <WifiOff size={16} /> : <Bell size={16} />}
              <span>{toast.message}</span>
            </div>
          ))}
        </div>

        {/* Offline Banner */}
        {!isOnline && (
          <div className="absolute top-0 left-0 right-0 z-[90] bg-red-600/90 backdrop-blur-sm text-white text-xs font-bold text-center py-2 flex items-center justify-center gap-2">
            <WifiOff size={12} /> No internet connection
          </div>
        )}


        {/* Mobile Main Content Area */}
        {activeTab !== 'Music' && (
          <div className="flex-1 overflow-y-auto no-scrollbar pb-20 overscroll-contain scroll-smooth">
            {/* HOME VIEW */}
            {activeTab === 'Home' && (() => {
              const hour = new Date().getHours();
              const greeting = hour < 12 ? 'Good Morning ☀️' : hour < 17 ? 'Good Afternoon 🌤️' : hour < 21 ? 'Good Evening 🌆' : 'Good Night 🌙';
              return (
                <div className="overflow-x-hidden animate-fade-in">
                  {/* Hero Header with dynamic gradient */}
                  <div className="relative px-5 pt-12 pb-6 overflow-hidden" style={{ background: `linear-gradient(160deg, ${dominantColor}55 0%, #1a1a1a 60%, #121212 100%)` }}>
                    {/* Decorative blobs */}
                    <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full blur-3xl opacity-30 pointer-events-none" style={{ background: dominantColor }} />
                    <div className="absolute top-20 -left-10 w-32 h-32 rounded-full blur-2xl opacity-20 pointer-events-none" style={{ background: dominantColor }} />

                    {/* Top Bar */}
                    <div className="flex items-center justify-between mb-6 relative z-10">
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <img src="/logo.png" alt="Logo" className="w-11 h-11 rounded-2xl shadow-lg shrink-0" />
                          {isPlaying && <span className="absolute -top-1 -right-1 w-3 h-3 bg-[#8cd92b] rounded-full border-2 border-[#121212] animate-pulse" />}
                        </div>
                        <div>
                          <p className="text-white/50 text-[11px] font-semibold uppercase tracking-widest">{greeting}</p>
                          <p className="text-white text-xl font-black tracking-tight">ISAI <span className="text-[#8cd92b]">இசை</span></p>
                        </div>
                      </div>
                      <div className="flex gap-2 relative z-10">
                        <button onClick={() => setActiveTab('Search')} className="w-10 h-10 bg-white/10 backdrop-blur-sm text-white rounded-full flex items-center justify-center hover:bg-white/20 transition-all active:scale-90 border border-white/10">
                          <Search size={18} />
                        </button>
                        <button onClick={() => setActiveTab('History')} className="w-10 h-10 bg-white/10 backdrop-blur-sm text-white rounded-full flex items-center justify-center hover:bg-white/20 transition-all active:scale-90 border border-white/10">
                          <History size={18} />
                        </button>
                      </div>
                    </div>

                    {/* Currently Playing Hero Card (if song is playing) */}
                    {currentSong && (
                      <div onClick={() => setActiveTab('Music')} className="relative bg-black/30 backdrop-blur-xl rounded-3xl p-4 flex items-center gap-4 cursor-pointer border border-white/10 active:scale-[0.98] transition-all shadow-xl">
                        <div className={`relative shrink-0 ${isPlaying ? 'animate-slow-pulse' : ''}`}>
                          <img src={currentSong.thumbnail} alt="" className="w-16 h-16 rounded-2xl object-cover shadow-lg" />
                          {isPlaying && (
                            <div className="absolute inset-0 bg-black/40 rounded-2xl flex items-center justify-center">
                              <div className="flex gap-[3px] items-end h-5">
                                {[0, 1, 2, 3].map(b => <div key={b} className="w-[3px] rounded-full bg-[#8cd92b]" style={{ height: `${6 + Math.sin(Date.now() / 200 + b) * 6}px`, animation: `bounce ${0.4 + b * 0.1}s ease-in-out infinite alternate` }} />)}
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="flex-1 overflow-hidden">
                          <p className="text-[10px] uppercase tracking-widest font-bold" style={{ color: dominantColor }}>{isPlaying ? '▶ Now Playing' : '⏸ Paused'}</p>
                          <h3 className="text-white font-bold text-sm truncate mt-0.5">{currentSong.title}</h3>
                          <p className="text-white/50 text-xs truncate mt-0.5">{currentSong.artist}</p>
                        </div>
                        <button onClick={(e) => { e.stopPropagation(); togglePlay(); }} className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center flex-shrink-0 shadow-md active:scale-90 transition-all">
                          {isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="ml-0.5" />}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Quick Access Grid */}
                  <div className="px-4 mt-4">
                    <div className="grid grid-cols-2 gap-2 mb-6">
                      {[
                        { label: 'Liked Songs', icon: <Heart size={18} fill="white" className="text-white" />, gradient: 'from-[#4b22c7] to-[#a680ff]', action: () => setActiveTab('Favorites'), count: `${favorites.length} songs` },
                        { label: 'Recently Played', icon: <History size={18} className="text-white" />, gradient: 'from-[#c7225a] to-[#ff6b6b]', action: () => setActiveTab('History'), count: `${listenHistory.length} songs` },
                        { label: 'Playlists', icon: <List size={18} className="text-white" />, gradient: 'from-[#226ac7] to-[#6bb8ff]', action: () => setActiveTab('Playlists'), count: `${playlists.length} playlists` },
                        { label: 'Search Music', icon: <Search size={18} className="text-white" />, gradient: 'from-[#22b5c7] to-[#6bffeb]', action: () => setActiveTab('Search'), count: 'Find anything' },
                      ].map((item, i) => (
                        <div key={i} onClick={item.action} className="flex items-center bg-[#1e1e1e] rounded-xl overflow-hidden cursor-pointer active:scale-95 transition-all h-14 shadow-md border border-white/5">
                          <div className={`w-14 h-14 bg-gradient-to-br ${item.gradient} shrink-0 flex items-center justify-center`}>
                            {item.icon}
                          </div>
                          <div className="px-2.5 flex-1 overflow-hidden">
                            <p className="text-white text-[11px] font-bold truncate">{item.label}</p>
                            <p className="text-white/40 text-[9px] mt-0.5">{item.count}</p>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* 🎬 Music Directors */}
                    <div className="mb-6">
                      <div className="flex items-center justify-between mb-3">
                        <h2 className="text-base font-bold text-white">🎬 Music Directors</h2>
                        <span className="text-[10px] text-white/30 font-semibold">Tamil Only</span>
                      </div>
                      <div className="flex overflow-x-auto gap-3 no-scrollbar pb-2">
                        {MUSIC_DIRECTORS.map((director) => (
                          <button
                            key={director.id}
                            onClick={() => fetchDirectorSongs(director)}
                            className="flex flex-col items-center gap-2 shrink-0 active:scale-95 transition-all"
                          >
                            <div className={`w-[72px] h-[72px] rounded-2xl bg-gradient-to-br ${director.color} flex items-center justify-center text-2xl shadow-lg border border-white/10`}>
                              {director.emoji}
                            </div>
                            <span className="text-white text-[10px] font-bold text-center leading-tight w-[72px]">{director.name}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* 🕰️ Era Collections */}
                    <div className="mb-6">
                      <div className="flex items-center justify-between mb-3">
                        <h2 className="text-base font-bold text-white">🕰️ Time Travel</h2>
                        <span className="text-[10px] text-[#8cd92b] font-semibold uppercase tracking-wider">Evergreen</span>
                      </div>
                      <div className="flex overflow-x-auto gap-3 no-scrollbar pb-2">
                        {ERA_COLLECTIONS.map((era) => (
                          <div
                            key={era.id}
                            onClick={() => fetchDirectorSongs(era)}
                            className="flex-shrink-0 w-[140px] h-[72px] rounded-2xl relative overflow-hidden cursor-pointer active:scale-95 transition-all shadow-lg"
                          >
                            <div className={`absolute inset-0 bg-gradient-to-r ${era.color} opacity-80`} />
                            <div className="absolute inset-0 bg-black/20" />
                            <div className="absolute inset-0 flex items-center justify-between px-4">
                              <div>
                                <h3 className="text-white font-black text-sm italic">{era.name}</h3>
                                <p className="text-white/80 text-[10px] font-bold">{era.subtitle}</p>
                              </div>
                              <span className="text-2xl drop-shadow-md">{era.emoji}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Jump Back In */}
                    {(searchHistory.length > 0 || listenHistory.length > 0) && (
                      <div className="mb-6">
                        <div className="flex items-center justify-between mb-3">
                          <h2 className="text-base font-bold text-white">Jump Back In</h2>
                          <button onClick={() => setActiveTab('History')} className="text-[10px] text-[#8cd92b] font-bold uppercase tracking-wider">See all</button>
                        </div>
                        <div className="flex overflow-x-auto gap-3 no-scrollbar pb-2">
                          {(listenHistory.length > 0 ? listenHistory : searchHistory).slice(0, 8).map((song, i) => (
                            <div key={`jump-${i}`} onClick={() => playSong(song)} className="flex flex-col w-[110px] shrink-0 cursor-pointer group active:scale-95 transition-all">
                              <div className="relative w-[110px] h-[110px] mb-2 rounded-2xl overflow-hidden shadow-lg">
                                <img src={song.thumbnail} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                                {currentSong?.id === song.id && (
                                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center" style={{ background: `${dominantColor}66` }}>
                                    {isPlaying ? <Pause size={24} fill="white" className="text-white drop-shadow" /> : <Play size={24} fill="white" className="text-white drop-shadow ml-1" />}
                                  </div>
                                )}
                                <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
                              </div>
                              <span className="text-white text-[11px] font-semibold truncate leading-tight">{song.title}</span>
                              <span className="text-white/40 text-[10px] truncate mt-0.5">{song.artist}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Trending Now */}
                    {trendingSongs.length > 0 && (
                      <div className="mb-6">
                        <div className="flex items-center justify-between mb-3">
                          <h2 className="text-base font-bold text-white">🔥 Trending Now</h2>
                          <span className="text-[10px] text-white/30 font-semibold">Tamil Hits</span>
                        </div>
                        <div className="flex overflow-x-auto gap-3 no-scrollbar pb-2">
                          {trendingSongs.slice(0, 10).map((song, i) => (
                            <div key={`trend-${i}`} onClick={() => playSong(song)} className="flex flex-col w-[130px] shrink-0 cursor-pointer group active:scale-95 transition-all">
                              <div className="relative w-[130px] h-[130px] mb-2 rounded-2xl overflow-hidden shadow-lg">
                                <img src={song.thumbnail} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                                <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-sm text-white text-[10px] font-black px-2 py-0.5 rounded-full">#{i + 1}</div>
                                <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
                              </div>
                              <span className="text-white text-[11px] font-semibold truncate leading-tight">{song.title}</span>
                              <span className="text-white/40 text-[10px] truncate mt-0.5">{song.artist}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Your Playlists */}
                    {playlists.length > 0 && (
                      <div className="mb-6">
                        <div className="flex items-center justify-between mb-3">
                          <h2 className="text-base font-bold text-white">Your Playlists</h2>
                          <button onClick={() => setActiveTab('Playlists')} className="text-[10px] text-[#8cd92b] font-bold uppercase tracking-wider">See all</button>
                        </div>
                        <div className="flex overflow-x-auto gap-3 no-scrollbar pb-2">
                          {playlists.map((pl, i) => (
                            <div key={pl.id} onClick={() => { setCurrentViewPlaylist(pl); setActiveTab('PlaylistDetails'); }} className="flex flex-col w-[110px] shrink-0 cursor-pointer active:scale-95 transition-all">
                              <div className="w-[110px] h-[110px] mb-2 rounded-2xl overflow-hidden shadow-lg bg-[#2a2a2a] flex items-center justify-center relative">
                                {pl.songs.length > 0 ? (
                                  <div className="grid grid-cols-2 w-full h-full">
                                    {pl.songs.slice(0, 4).map((s, si) => <img key={si} src={s.thumbnail} alt="" className="w-full h-full object-cover" />)}
                                  </div>
                                ) : (
                                  <div className={`w-full h-full bg-gradient-to-br ${['from-purple-600 to-blue-500', 'from-green-600 to-teal-500', 'from-orange-600 to-pink-500', 'from-red-600 to-yellow-500'][i % 4]} flex items-center justify-center`}>
                                    <List size={32} className="text-white/80" />
                                  </div>
                                )}
                              </div>
                              <span className="text-white text-[11px] font-semibold truncate">{pl.name}</span>
                              <span className="text-white/40 text-[10px] mt-0.5">{pl.songs.length} songs</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Suggestions for you (fallback songs) */}
                    <div className="mb-24">
                      <h2 className="text-base font-bold text-white mb-3">Suggested for You</h2>
                      <div className="space-y-1">
                        {fallbackSongs.slice(0, 10).map((song, i) => (
                          <div key={`sugg-${song.id}`} onClick={() => playSong(song)} className="flex items-center gap-3 p-2 rounded-xl cursor-pointer transition-all active:scale-[0.98] active:bg-white/5 group">
                            <div className="relative shrink-0">
                              <img src={song.thumbnail} alt="" className="w-12 h-12 object-cover rounded-xl shadow-sm" />
                              {currentSong?.id === song.id && isPlaying && (
                                <div className="absolute inset-0 bg-black/50 rounded-xl flex items-center justify-center">
                                  <div className="flex gap-0.5 items-end h-4">
                                    {[0, 1, 2].map(b => <div key={b} className="w-[3px] rounded-full animate-bounce" style={{ height: `${6 + b * 3}px`, backgroundColor: dominantColor, animationDelay: `${b * 0.1}s` }} />)}
                                  </div>
                                </div>
                              )}
                            </div>
                            <div className="flex-1 overflow-hidden">
                              <h4 className="text-white text-[13px] font-semibold truncate">{song.title}</h4>
                              <p className="text-white/40 text-[11px] truncate mt-0.5">{song.artist}</p>
                            </div>
                            <button onClick={(e) => { e.stopPropagation(); toggleFavorite(e, song); }} className="p-2 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity active:opacity-100">
                              <Heart size={16} fill={favoriteIds.has(song.id) ? dominantColor : 'none'} stroke={favoriteIds.has(song.id) ? dominantColor : 'currentColor'} className="text-white/40" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* FAVORITES VIEW */}
            {activeTab === 'Favorites' && (
              <div className="overflow-x-hidden min-h-screen bg-[#121212] animate-fade-in animate-slide-up-premium">
                <div className="px-5 pt-12 pb-6 flex flex-col justify-end" style={{ background: `linear-gradient(to bottom, ${dominantColor}dd 0%, #121212 100%)` }}>
                  <div onClick={() => setActiveTab('Home')} className="mb-6 bg-black/20 w-8 h-8 rounded-full flex items-center justify-center cursor-pointer hover:bg-black/40">
                    <ArrowLeft size={20} className="text-white" />
                  </div>
                  <h1 className="text-3xl font-bold text-white tracking-widest leading-tight">Liked Songs</h1>
                  <p className="text-sm text-[#d1c4e9] mt-2 font-medium">{favorites.length} songs</p>
                </div>
                <div className="px-4 pb-24 space-y-1">
                  {favorites.length > 0 ? favorites.map((song, idx) => (
                    <DesktopSongRow key={song.id} song={song} onSelect={() => playSong(song)} isFavorite={true} onToggleFavorite={(e) => toggleFavorite(e, song)} />
                  )) : <p className="text-center py-20 text-gray-500">No liked songs yet.</p>}
                </div>
              </div>
            )}

            {/* LISTEN HISTORY VIEW */}
            {activeTab === 'History' && (
              <div className="overflow-x-hidden min-h-screen bg-[#121212] animate-fade-in animate-slide-up-premium">
                <div className="px-5 pt-12 pb-6" style={{ background: `linear-gradient(to bottom, ${dominantColor}55 0%, #121212 100%)` }}>
                  <button onClick={() => setActiveTab('Home')} className="mb-4 w-9 h-9 bg-black/20 rounded-full flex items-center justify-center hover:bg-black/30 transition-all">
                    <ArrowLeft size={18} className="text-white" />
                  </button>
                  <h1 className="text-3xl font-bold text-white">Recently Played</h1>
                  <p className="text-sm text-white/50 mt-1 font-medium">{listenHistory.length} songs</p>
                </div>
                <div className="px-4 pb-24 space-y-1">
                  {listenHistory.length === 0 ? (
                    <div className="flex flex-col items-center justify-center pt-20 text-center opacity-40">
                      <History size={48} className="mb-4 text-gray-500" />
                      <p className="text-white font-bold">No history yet</p>
                      <p className="text-gray-500 text-sm mt-1">Play a song to see it here</p>
                    </div>
                  ) : (
                    listenHistory.map((song, idx) => (
                      <div key={`${song.id}-${idx}`} onClick={() => playSong(song)} className="flex items-center gap-3 p-2 hover:bg-white/5 rounded-xl cursor-pointer transition-all active:scale-[0.98]">
                        <div className="relative shrink-0">
                          <img src={song.thumbnail} alt="" className="w-12 h-12 object-cover rounded-xl shadow-sm" />
                          {currentSong?.id === song.id && isPlaying && (
                            <div className="absolute inset-0 bg-black/50 rounded-xl flex items-center justify-center">
                              <div className="flex gap-0.5 items-end h-4">
                                {[0, 1, 2].map(b => <div key={b} className="w-[3px] rounded-full animate-bounce" style={{ height: `${6 + b * 4}px`, backgroundColor: dominantColor, animationDelay: `${b * 0.1}s` }} />)}
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="flex-1 overflow-hidden">
                          <h4 className="font-semibold text-white text-[14px] truncate">{song.title}</h4>
                          <p className="text-[12px] text-[#a0a0a0] truncate mt-0.5">{song.artist}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <p className="text-[10px] text-gray-600">
                            {song.playedAt ? new Date(song.playedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                          </p>
                          <button onClick={(e) => { e.stopPropagation(); toggleFavorite(e, song); }} className="p-1.5">
                            <Heart size={14} fill={favoriteIds.has(song.id) ? dominantColor : 'none'} stroke={favoriteIds.has(song.id) ? dominantColor : '#6b7280'} />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* DIRECTOR SONGS VIEW */}
            {activeTab === 'DirectorSongs' && selectedDirector && (
              <div className="overflow-x-hidden min-h-screen bg-[#121212] animate-fade-in animate-slide-up-premium">
                {/* Hero Header */}
                <div className={`relative px-5 pt-12 pb-8 overflow-hidden`} style={{ background: `linear-gradient(160deg, ${dominantColor}55 0%, #121212 100%)` }}>
                  <div className={`absolute inset-0 bg-gradient-to-br ${selectedDirector.color} opacity-20`} />
                  <button onClick={() => setActiveTab('Home')} className="relative z-10 mb-5 w-9 h-9 bg-black/20 rounded-full flex items-center justify-center hover:bg-black/40 transition-all">
                    <ArrowLeft size={18} className="text-white" />
                  </button>
                  <div className="relative z-10 flex items-center gap-4">
                    <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${selectedDirector.color} flex items-center justify-center text-3xl shadow-2xl`}>
                      {selectedDirector.emoji}
                    </div>
                    <div>
                      <p className="text-white/50 text-[10px] uppercase tracking-widest font-bold mb-1">✨ {selectedDirector.subtitle || 'Collection'}</p>
                      <h1 className="text-2xl font-black text-white">{selectedDirector.name}</h1>
                      <p className="text-white/40 text-xs mt-0.5">{directorSongs.length > 0 ? `${directorSongs.length} songs` : 'Loading...'}</p>
                    </div>
                  </div>
                </div>

                {/* Song List */}
                <div className="px-4 pb-24 space-y-1 mt-2">
                  {directorLoading ? (
                    [...Array(8)].map((_, i) => (
                      <div key={i} className="flex items-center gap-3 p-2 animate-pulse">
                        <div className="w-12 h-12 rounded-xl bg-white/10 shrink-0" />
                        <div className="flex-1">
                          <div className="h-3 bg-white/10 rounded-full w-3/4 mb-2" />
                          <div className="h-2.5 bg-white/10 rounded-full w-1/2" />
                        </div>
                      </div>
                    ))
                  ) : directorSongs.length === 0 ? (
                    <div className="text-center py-20 opacity-40">
                      <p className="text-white font-bold text-lg">{selectedDirector.emoji}</p>
                      <p className="text-white/60 text-sm mt-2">No songs found</p>
                    </div>
                  ) : (
                    directorSongs.map((song, idx) => (
                      <div key={`dir-${song.id}-${idx}`} onClick={() => playSong(song)} className="flex items-center gap-3 p-2 rounded-xl cursor-pointer transition-all active:scale-[0.98] active:bg-white/5 group">
                        <div className="relative shrink-0">
                          <img src={song.thumbnail} alt="" className="w-12 h-12 object-cover rounded-xl shadow-sm" />
                          {currentSong?.id === song.id && isPlaying && (
                            <div className="absolute inset-0 bg-black/50 rounded-xl flex items-center justify-center">
                              <div className="flex gap-0.5 items-end h-4">
                                {[0, 1, 2].map(b => <div key={b} className="w-[3px] rounded-full animate-bounce" style={{ height: `${6 + b * 3}px`, backgroundColor: dominantColor, animationDelay: `${b * 0.1}s` }} />)}
                              </div>
                            </div>
                          )}
                          <div className="absolute top-1 left-1 bg-black/60 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full">
                            {idx + 1}
                          </div>
                        </div>
                        <div className="flex-1 overflow-hidden">
                          <h4 className="text-white text-[13px] font-semibold truncate">{song.title}</h4>
                          <p className="text-white/40 text-[11px] truncate mt-0.5">{song.artist}</p>
                        </div>
                        <button onClick={(e) => { e.stopPropagation(); toggleFavorite(e, song); }} className="p-2 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity active:opacity-100">
                          <Heart size={16} fill={favoriteIds.has(song.id) ? dominantColor : 'none'} stroke={favoriteIds.has(song.id) ? dominantColor : '#6b7280'} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* SEARCH VIEW */}
            {activeTab === 'Search' && (
              <div className="p-4 pt-10 flex flex-col h-full bg-[#121212] animate-fade-in animate-slide-up-premium">
                <h1 className="text-2xl font-bold text-white mb-6">Search</h1>
                <form onSubmit={searchYoutube} className="mb-6 shrink-0">
                  <div className="relative">
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Artists, songs, or podcasts"
                      className="w-full bg-white text-black px-4 py-[12px] pl-10 pr-12 rounded-sm outline-none font-bold text-[14px]"
                    />
                    <Search className="absolute left-3 top-3.5 text-[#121212]" size={18} />
                    {searchQuery && (
                      <button type="button" onClick={() => setSearchQuery('')} className="absolute right-3 top-3.5 text-gray-400 p-0.5">
                        <X size={18} />
                      </button>
                    )}
                  </div>
                </form>

                <div className="flex-1 overflow-y-auto no-scrollbar pb-24 overscroll-contain">
                  {songs.length === 0 && searchHistory.length > 0 && (
                    <div className="mb-8 mt-2 px-1 animate-fade-in">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-bold text-white/80 lowercase tracking-wider">Recent Searches</h3>
                        <button
                          onClick={() => { setSearchHistory([]); localStorage.removeItem('musicHistory'); }}
                          className="text-[10px] uppercase font-bold text-[#8cd92b] hover:opacity-70 transition-opacity"
                        >
                          Clear All
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {searchHistory.slice(0, 6).map((item, i) => (
                          <div
                            key={i}
                            onClick={() => { setSearchQuery(item.title || item); searchYoutube(null, item.title || item); }}
                            className="bg-[#2a2a2a] px-4 py-2 rounded-full text-sm text-white border border-[#3e3e3e]/50 flex items-center gap-2 hover:bg-[#3e3e3e] transition-colors active:scale-95"
                          >
                            <Clock size={12} className="text-gray-500" />
                            <span className="truncate max-w-[120px]">{item.title || item}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {loading ? (
                    <div className="space-y-2 mt-4 px-1">
                      {[...Array(6)].map((_, i) => <SkeletonRow key={i} />)}
                    </div>
                  ) : (
                    <>
                      <h3 className="text-sm font-bold text-white/60 mb-4 px-1 lowercase tracking-wider">
                        {songs.length > 0 ? "Top Results" : "Suggestions for you"}
                      </h3>
                      <div className="space-y-1">
                        {(songs.length > 0 ? songs : displaySongs).map((song) => (
                          <div key={song.id} onClick={() => playSong(song)} className="flex items-center gap-3 p-2 hover:bg-[#ffffff0a] rounded-md cursor-pointer transition-all active:scale-[0.98] active:opacity-80">
                            <img src={song.thumbnail} alt="" className="w-12 h-12 object-cover shrink-0 rounded-md shadow-sm" />
                            <div className="flex-1 overflow-hidden">
                              <h4 className="font-semibold text-white text-[14px] truncate">{song.title}</h4>
                              <p className="text-[12px] text-[#a0a0a0] truncate mt-0.5">{song.artist}</p>
                            </div>
                            <MoreHorizontal size={18} className="text-gray-500" />
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* PLAYLISTS VIEW */}
            {activeTab === 'Playlists' && (
              <div className="p-6 pt-10">
                <h1 className="text-2xl font-bold text-white mb-8">Your Playlists</h1>
                <div className="space-y-3 pb-6">
                  {playlists.map((pl) => (
                    <div
                      key={pl.id}
                      onClick={() => {
                        setCurrentViewPlaylist(pl);
                        setActiveTab('PlaylistDetails');
                      }}
                      className="flex items-center gap-4 bg-[#1a1c2a] p-4 rounded-2xl cursor-pointer border border-[#262837]"
                    >
                      <div className="w-12 h-12 bg-[#262837] rounded-xl flex items-center justify-center text-[#8cd92b]">
                        <List size={24} />
                      </div>
                      <div className="flex-1">
                        <h4 className="font-semibold text-white text-sm">{pl.name}</h4>
                        <p className="text-xs text-gray-500">{pl.songs.length} songs</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* PLAYLIST DETAILS VIEW */}
            {activeTab === 'PlaylistDetails' && currentViewPlaylist && (
              <div className="p-6 pt-10 h-full">
                <div className="flex items-center gap-4 mb-8">
                  <button onClick={() => setActiveTab('Playlists')} className="w-10 h-10 flex items-center justify-center bg-[#1a1c2a] rounded-full text-white">
                    <ArrowLeft size={18} />
                  </button>
                  <h2 className="text-xl font-bold text-white">{currentViewPlaylist.name}</h2>
                </div>
                <div className="space-y-3 pb-10">
                  {currentViewPlaylist.songs.map((song, idx) => (
                    <div key={idx} onClick={() => playSong(song)} className="flex items-center gap-3 bg-[#1a1c2a] p-3 rounded-2xl cursor-pointer border border-[#262837]">
                      <img src={song.thumbnail} alt="" className="w-12 h-12 rounded-xl object-cover" />
                      <div className="flex-1 overflow-hidden">
                        <h4 className="font-semibold text-white text-sm truncate">{song.title}</h4>
                        <p className="text-xs text-gray-400 truncate">{song.artist}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* NOW PLAYING VIEW */}
        {activeTab === 'Music' && (
          <div
            className="flex flex-col flex-1 bg-[#121212] relative h-full"
            onTouchStart={(e) => { swipeTouchStartX.current = e.touches[0].clientX; swipeTouchStartY.current = e.touches[0].clientY; }}
            onTouchEnd={(e) => {
              if (swipeTouchStartX.current === null) return;
              const dx = e.changedTouches[0].clientX - swipeTouchStartX.current;
              const dy = e.changedTouches[0].clientY - swipeTouchStartY.current;
              if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 60) {
                if (dx < 0) { playNext(); showToast('Next song ⏭', 'info'); }
                else { playPrev(); showToast('Previous song ⏮', 'info'); }
              }
              swipeTouchStartX.current = null;
              swipeTouchStartY.current = null;
            }}
          >
            {/* Gradient Background tied to Album Art */}
            <div
              className="absolute inset-0 z-0 opacity-50 blur-[100px] scale-150 pointer-events-none transition-all duration-1000"
              style={{ background: `radial-gradient(circle at center, ${dominantColor}cc 0%, #121212 100%)` }}
            ></div>
            <div className="absolute inset-0 bg-black/40 z-0 pointer-events-none"></div>

            <div className="flex items-center justify-between p-5 pt-10 z-10 relative">
              <button onClick={() => setActiveTab('Home')} className="p-2 -ml-2 text-white/70 hover:text-white transition-all active:scale-75">
                <ArrowLeft size={24} />
              </button>
              <div className="text-center flex flex-col text-white font-semibold flex-1">
                <span className="text-[10px] uppercase tracking-widest text-[#a0a0a0]">Now Playing</span>
                <span className="text-xs truncate max-w-[200px] mx-auto">{currentSong?.title || 'Unknown Title'}</span>
              </div>
              <button className="p-2 -mr-2 text-white/70 hover:text-white transition-colors">
                <MoreHorizontal size={24} />
              </button>
            </div>

            {currentSong ? (
              <div className="flex-1 flex flex-col items-center px-6 relative z-10 w-full overflow-y-auto no-scrollbar pb-24">
                {/* Album Art Square Banner with Equalizer Overlay */}
                <div className={`mt-2 mb-2 w-[min(310px,75vw)] aspect-square relative mx-auto rounded-3xl overflow-hidden shadow-[0_30px_60px_rgba(0,0,0,0.7)] bg-[#1a1c2a] shrink-0 border border-[#ffffff0a] transition-all duration-1000 ${isPlaying ? 'animate-slow-pulse scale-[1.02]' : 'scale-100'}`}>
                  <img
                    src={currentSong.thumbnail}
                    alt="Cover"
                    className="w-full h-full object-cover block absolute inset-0 z-0"
                    onError={(e) => { e.target.src = '/logo.jpg'; }}
                  />

                  {/* Equalizer Overlay - REAL-TIME REACTIVE */}
                  <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex items-end justify-center gap-[3px] px-8 pb-4 z-10 pointer-events-none">
                    {Array.from({ length: 24 }).map((_, i) => {
                      // Map audio frequency data to bars
                      const dataLen = audioData.length || 1;
                      const value = audioData[i % dataLen] || 0;
                      const height = (value / 255) * 100;
                      return (
                        <div key={i} className="flex-1 max-w-[4px] rounded-full transition-all duration-150"
                          style={{
                            height: `${Math.max(12, height)}%`,
                            backgroundColor: dominantColor,
                            boxShadow: `0 0 10px ${dominantColor}66`
                          }}>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Song Info */}
                <div className="w-full max-w-[340px] mt-12 mb-6 flex justify-between items-center gap-2">
                  <div className="flex-1 overflow-hidden">
                    <h2 className="text-[22px] font-bold text-white truncate leading-tight">{currentSong.title}</h2>
                    <p className="text-[16px] text-[#a0a0a0] font-medium mt-1 truncate">{currentSong.artist || 'Unknown Artist'}</p>
                  </div>
                  <div className="shrink-0 p-2">
                    <AnimatedHeart size={24} isFavorite={favoriteIds.has(currentSong.id)} onClick={(e) => toggleFavorite(e, currentSong)} />
                  </div>
                </div>

                {/* Progress Bar (Line) */}
                <div className="w-full max-w-[340px] relative mt-2 group px-2">
                  <input
                    type="range" min={0} max={duration || 1} value={progress} onChange={handleSeek}
                    className="absolute top-0 inset-x-2 h-4 -mt-1.5 opacity-0 z-10 cursor-pointer"
                  />
                  <div className="w-full h-[6px] bg-white/10 rounded-full overflow-hidden relative mb-2">
                    <div className={`h-full rounded-full absolute top-0 left-0 transition-all duration-300 pointer-events-none ${isPlaying ? 'progress-glow' : 'bg-white/60'}`} style={{ width: `${(progress / (duration || 1)) * 100}%`, backgroundColor: isPlaying ? dominantColor : undefined, boxShadow: isPlaying ? `0 0 15px ${dominantColor}` : undefined }}></div>
                  </div>
                  <div className="flex justify-between text-[11px] text-[#a0a0a0] font-bold tracking-widest">
                    <span>{formatTime(progress)}</span>
                    <span>{formatTime(duration)}</span>
                  </div>
                </div>

                {/* Controls */}
                <div className="flex items-center justify-between w-full max-w-[340px] mt-4 mb-8">
                  <button className="text-[#1ed760] hover:text-white transition-all active:scale-75 p-2"><Shuffle size={20} /></button>
                  <button onClick={playPrev} className="text-white hover:text-white transition-all active:scale-75 p-2"><SkipBack size={32} fill="currentColor" /></button>

                  <button
                    onClick={togglePlay}
                    className="w-[68px] h-[68px] flex items-center justify-center bg-white rounded-full text-black hover:scale-105 active:scale-90 transition-all shadow-md"
                  >
                    {isPlaying ? <Pause size={30} fill="currentColor" /> : <Play size={30} fill="currentColor" className="ml-1" />}
                  </button>

                  <button onClick={playNext} className="text-white hover:text-white transition-all active:scale-75 p-2"><SkipForward size={32} fill="currentColor" /></button>
                  <button className="text-[#a0a0a0] hover:text-white transition-all active:scale-75 p-2"><Repeat size={20} /></button>
                </div>

                {/* Bottom Tool Bar */}
                <div className="flex items-center justify-between w-full max-w-[340px] px-2 mb-8 relative">
                  <button onClick={() => setShowSleepModal(true)} className={`transition-all active:scale-75 flex flex-col items-center gap-1 ${sleepMinutesLeft > 0 ? 'text-[#1ed760]' : 'text-[#a0a0a0] hover:text-white'}`}>
                    <Clock size={20} className={sleepMinutesLeft > 0 ? 'animate-pulse' : ''} />
                    {sleepMinutesLeft > 0 && <span className="text-[8px] font-bold">{sleepMinutesLeft}m</span>}
                  </button>

                  <button onClick={() => setIsLyricsVisible(true)} className="text-[#a0a0a0] hover:text-white transition-all active:scale-75 flex flex-col items-center gap-1">
                    <Mic2 size={20} />
                    <span className="text-[8px] font-bold uppercase tracking-tighter">Lyrics</span>
                  </button>

                  {/* Speed Picker */}
                  <div className="relative">
                    <button
                      onClick={() => setShowSpeedMenu(s => !s)}
                      className={`flex flex-col items-center gap-1 transition-all active:scale-75 ${playbackSpeed !== 1 ? 'text-[#8cd92b]' : 'text-[#a0a0a0] hover:text-white'}`}
                    >
                      <Gauge size={20} />
                      <span className="text-[8px] font-bold">{playbackSpeed}x</span>
                    </button>
                    {showSpeedMenu && (
                      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 bg-[#1a1c2a] border border-[#262837] rounded-2xl shadow-2xl p-2 z-50 flex flex-col gap-1 min-w-[80px]">
                        {[0.5, 0.75, 1, 1.25, 1.5, 2].map(s => (
                          <button key={s} onClick={() => { setPlaybackSpeed(s); setShowSpeedMenu(false); if (backgroundAudio) backgroundAudio.playbackRate = s; showToast(`Speed: ${s}x 🎚️`, 'info'); }}
                            className={`text-sm font-bold px-3 py-1.5 rounded-xl transition-all ${playbackSpeed === s ? 'bg-[#8cd92b] text-black' : 'text-white hover:bg-[#262837]'}`}
                          >{s}x</button>
                        ))}
                      </div>
                    )}
                  </div>

                  <button onClick={() => shareSong(currentSong)} className="text-[#a0a0a0] hover:text-white transition-all active:scale-75 flex flex-col items-center gap-1">
                    <Share2 size={20} />
                    <span className="text-[8px] font-bold uppercase tracking-tighter">Share</span>
                  </button>

                  <button className="text-[#a0a0a0] hover:text-white transition-all active:scale-75 flex flex-col items-center gap-1">
                    <List size={20} />
                    <span className="text-[8px] font-bold uppercase tracking-tighter">Queue</span>
                  </button>
                </div>

                {/* Mobile Up Next Mini preview */}
                {queue.length > 0 && (
                  <div className="w-full max-w-[340px] mt-2 mb-8 text-left">
                    <div className="flex items-center justify-between text-[14px] font-bold text-white mb-4">
                      <span className="bg-[#1a1a1a] px-4 py-1.5 rounded-full shadow-sm border border-[#262837] flex items-center gap-2">Up Next <List size={14} className="text-white" /></span>
                      {isFetchingQueue && <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>}
                    </div>

                    <div className="space-y-4 relative z-10 pb-4">
                      {queue.map(song => (
                        <div
                          key={song.id}
                          onClick={() => playSong(song, true)}
                          className="flex items-center gap-3 p-1 rounded-md cursor-pointer transition-all hover:bg-[#ffffff0a]"
                        >
                          <div className="w-12 h-12 min-w-[48px] rounded-[6px] overflow-hidden bg-[#2a2a2a] shrink-0 shadow-sm border border-[#3e3e3e]/30">
                            <img src={song.thumbnail} alt={song.title} className="w-full h-full object-cover" />
                          </div>
                          <div className="flex-1 overflow-hidden">
                            <h4 className="font-semibold text-white text-[14px] truncate">{song.title}</h4>
                            <p className="text-[12px] text-[#a0a0a0] truncate mt-0.5">{song.artist || 'Unknown Artist'}</p>
                          </div>
                          <button
                            onClick={(e) => { e.stopPropagation(); setQueue(prev => prev.filter(q => q.id !== song.id)); }}
                            className="p-2 text-gray-500 hover:text-red-400 transition-colors"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center px-8 z-10">
                <div className="w-32 h-32 bg-[#2a2a2a] rounded-full flex items-center justify-center mb-6">
                  <Music size={40} className="text-[#a0a0a0]" />
                </div>
                <h3 className="text-lg font-bold text-white">No Track Selected</h3>
              </div>
            )}
          </div>
        )}

        {/* LYRICS OVERLAY */}
        {isLyricsVisible && currentSong && (
          <div className="absolute inset-0 z-[60] bg-[#121212] animate-slide-up-premium flex flex-col">
            <div
              className="absolute inset-0 z-0 opacity-40 blur-[120px] scale-150"
              style={{ background: `radial-gradient(circle at 30% 30%, ${dominantColor}ff 0%, #121212 100%)` }}
            ></div>

            <div className="flex items-center justify-between p-6 z-10">
              <button onClick={() => setIsLyricsVisible(false)} className="p-2 bg-white/10 rounded-full text-white backdrop-blur-md">
                <ChevronDown size={24} />
              </button>
              <div className="text-center">
                <p className="text-[10px] uppercase tracking-widest text-[#a0a0a0] font-bold">Lyrics</p>
                <p className="text-xs text-white font-bold truncate max-w-[200px]">{currentSong.title}</p>
              </div>
              <div className="w-10"></div>
            </div>

            <div className="flex-1 overflow-y-auto px-8 py-10 z-10 no-scrollbar text-left flex flex-col gap-8">
              <h2 className="text-3xl md:text-4xl font-black text-white/90 leading-tight">
                Music is what feelings sound like.
              </h2>
              <div className="space-y-6 opacity-60">
                <p className="text-2xl font-bold">{currentSong.title}</p>
                <p className="text-xl font-semibold">By {currentSong.artist}</p>
                <p className="text-lg italic">Instrumental or lyrics currently being fetched...</p>
              </div>

              <div className="mt-auto pt-10 border-t border-white/5 space-y-2 opacity-40">
                <p className="text-sm">Enjoy the rhythm,</p>
                <p className="text-sm">Feel the soul of ISAI.</p>
              </div>
            </div>
          </div>
        )}

        {/* PLAYLIST MODAL */}
        {showPlaylistModal.isOpen && (
          <div className="absolute inset-0 z-50 bg-[#121422]/90 backdrop-blur-sm flex flex-col justify-end transition-all">
            <div className="bg-[#1a1c2a] rounded-t-3xl p-6 border-t border-[#262837] animate-slide-up shadow-[0_-20px_40px_rgba(0,0,0,0.5)] max-h-[80vh] flex flex-col">
              <div className="flex items-center justify-between mb-6 shrink-0">
                <h3 className="text-white font-bold text-lg">Add to Playlist</h3>
                <button onClick={() => setShowPlaylistModal({ isOpen: false, songInfo: null })} className="p-2 bg-[#262837] rounded-full text-gray-400 hover:text-white transition-colors">
                  <X size={16} />
                </button>
              </div>
              <div className="flex items-center gap-3 mb-6 bg-[#121422] p-3 rounded-2xl border border-[#262837]/50 shrink-0">
                <img src={showPlaylistModal.songInfo?.thumbnail} alt="" className="w-12 h-12 rounded-xl object-cover" />
                <div className="flex-1 overflow-hidden pr-2">
                  <h4 className="text-white text-sm font-semibold truncate">{showPlaylistModal.songInfo?.title}</h4>
                  <p className="text-xs text-gray-500 truncate mt-0.5">{showPlaylistModal.songInfo?.artist}</p>
                </div>
              </div>
              <div className="space-y-2 overflow-y-auto no-scrollbar flex-1 pb-4">
                {playlists.filter(pl => !pl.isAuto).map(pl => (
                  <div key={pl.id} onClick={() => addToPlaylist(pl.id, showPlaylistModal.songInfo)} className="flex items-center justify-between p-3 bg-[#262837]/50 hover:bg-[#262837] rounded-xl cursor-pointer transition-colors border border-transparent hover:border-[#8cd92b]/50">
                    <div className="flex items-center gap-3">
                      <FolderPlus size={20} className="text-[#8cd92b]" />
                      <span className="text-white text-sm font-medium">{pl.name}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* SLEEP TIMER MODAL */}
        {showSleepModal && (
          <div className="absolute inset-0 z-50 bg-[#121422]/90 backdrop-blur-sm flex flex-col justify-end transition-all">
            <div className="bg-[#1a1c2a] rounded-t-3xl p-6 border-t border-[#262837] animate-slide-up shadow-[0_-20px_40px_rgba(0,0,0,0.5)]">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-white font-bold text-lg flex items-center gap-2"><Clock size={20} className="text-[#8cd92b]" /> Sleep Timer</h3>
                <button onClick={() => setShowSleepModal(false)} className="p-2 bg-[#262837] rounded-full text-gray-400 hover:text-white transition-colors">
                  <X size={16} />
                </button>
              </div>
              <div className="space-y-3 pb-6 border-b border-[#262837] mb-6">
                {[15, 30, 45, 60].map(mins => (
                  <button key={mins} onClick={() => { setSleepTimer(mins); setShowSleepModal(false); }} className="w-full flex items-center justify-between p-4 bg-[#262837]/50 hover:bg-[#262837] rounded-2xl text-white font-medium transition-colors border border-transparent hover:border-[#8cd92b]/50">
                    <span>{mins} Minutes</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* MOBILE MINI PLAYER */}
        {currentSong && activeTab !== 'Music' && (
          <div
            onClick={() => setActiveTab('Music')}
            className="absolute bottom-24 left-4 right-4 bg-[#1a1c2a]/70 backdrop-blur-xl rounded-2xl p-2.5 flex items-center gap-3 border border-white/10 shadow-[0_15px_35px_rgba(0,0,0,0.5)] z-40 cursor-pointer animate-slide-up"
          >
            <div className="relative shrink-0 transition-transform active:scale-95">
              <img src={currentSong.thumbnail} alt="" className={`w-11 h-11 rounded-lg object-cover ${isPlaying ? 'animate-slow-pulse' : ''} border border-white/10`} />
              {isPlaying && (
                <div
                  className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center border-2 border-[#121422] shadow-[0_0_8px_rgba(0,0,0,0.5)]"
                  style={{ backgroundColor: dominantColor }}
                >
                  <div className="w-1.5 h-1.5 bg-[#121422] rounded-full animate-ping"></div>
                </div>
              )}
            </div>

            <div className="flex-1 overflow-hidden">
              <h4 className="text-white text-[13px] font-bold truncate leading-tight">{currentSong.title}</h4>
              <p className="text-[10px] text-white/50 truncate mt-0.5">{currentSong.artist}</p>
            </div>

            <div className="flex items-center gap-1 shrink-0 px-1">
              <button
                onClick={(e) => { e.stopPropagation(); playPrev(); }}
                className="p-1.5 text-white/70 hover:text-white transition-all active:scale-75"
              >
                <SkipBack size={16} fill="currentColor" />
              </button>

              <button
                onClick={(e) => { e.stopPropagation(); togglePlay(); }}
                className="w-10 h-10 flex items-center justify-center bg-white rounded-full text-black shadow-lg hover:scale-105 active:scale-90 transition-all"
                style={{ boxShadow: isPlaying ? `0 0 15px ${dominantColor}66` : undefined }}
              >
                {isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="ml-0.5" />}
              </button>

              <button
                onClick={(e) => { e.stopPropagation(); playNext(); }}
                className="p-1.5 text-white/70 hover:text-white transition-all active:scale-75"
              >
                <SkipForward size={16} fill="currentColor" />
              </button>
            </div>
          </div>
        )}

        {/* Bottom Navigation */}
        <div className="absolute bottom-0 w-full h-20 bg-[#121422]/95 backdrop-blur-xl border-t border-[#262837]/50 flex items-center justify-around px-2 pb-2 rounded-none z-10 shadow-[0_-10px_30px_rgba(0,0,0,0.3)]">
          <button onClick={() => setActiveTab('Home')} className={`flex flex-col items-center justify-center gap-1.5 transition-all w-16 h-12 rounded-xl active:scale-90 active:opacity-70 ${activeTab === 'Home' ? 'text-[#8cd92b]' : 'text-gray-500'}`}>
            <Home size={20} />
            {activeTab === 'Home' && <span className="w-1 h-1 rounded-full bg-[#8cd92b] animate-pulse"></span>}
          </button>

          <button onClick={() => setActiveTab('Search')} className={`flex flex-col items-center justify-center gap-1.5 transition-all w-16 h-12 rounded-xl active:scale-90 active:opacity-70 ${activeTab === 'Search' ? 'text-[#8cd92b]' : 'text-gray-500'}`}>
            <Search size={20} />
            {activeTab === 'Search' && <span className="w-1 h-1 rounded-full bg-[#8cd92b] animate-pulse"></span>}
          </button>

          <button onClick={() => setActiveTab('Favorites')} className={`flex flex-col items-center justify-center gap-1.5 transition-all w-16 h-12 rounded-xl active:scale-90 active:opacity-70 ${activeTab === 'Favorites' ? 'text-[#8cd92b]' : 'text-gray-500'}`}>
            <Heart size={20} fill={activeTab === 'Favorites' ? 'currentColor' : 'none'} />
            {activeTab === 'Favorites' && <span className="w-1 h-1 rounded-full bg-[#8cd92b] animate-pulse"></span>}
          </button>

          <button onClick={() => setActiveTab('Music')} className={`flex flex-col items-center justify-center gap-1.5 transition-all w-16 h-12 rounded-xl active:scale-90 active:opacity-70 ${activeTab === 'Music' ? 'text-[#8cd92b]' : 'text-gray-500'}`}>
            <Headphones size={20} />
            {activeTab === 'Music' && <span className="w-1 h-1 rounded-full bg-[#8cd92b] animate-pulse"></span>}
          </button>
        </div>

      </div >

      {/* App Container - Desktop Layout */}
      <div className="hidden md:flex w-full max-w-[1200px] h-[850px] max-h-[90vh] bg-[#121422] rounded-[36px] shadow-[0_20px_50px_rgba(0,0,0,0.5)] relative overflow-hidden text-[#a0a3b1]">
        {/* Left Sidebar */}
        <div className="w-64 bg-[#1a1c2a] flex flex-col pt-10 pb-8 px-8 border-r border-[#262837] shrink-0 z-10 transition-colors">
          <h1 className="text-2xl font-bold mb-10 text-white flex items-center gap-4 px-1">
            <img src="/logo.png" alt="Isai" className="h-12 w-12 object-cover rounded-2xl shadow-xl transition-all" style={{ boxShadow: `0 10px 30px ${dominantColor}33` }} />
            <div className="flex flex-col">
              <span className="text-white tracking-tighter text-3xl font-black italic -mb-1">ISAI</span>
            </div>
          </h1>
          <nav className="flex-1 space-y-5 overflow-y-auto no-scrollbar">
            <div className="flex items-center gap-4 font-semibold cursor-pointer border-l-2 pl-2 -ml-2.5 transition-all" style={{ color: dominantColor, borderColor: dominantColor }}>
              <Music size={18} /> <span className="text-sm">Playlist</span>
            </div>
            <div className="flex items-center gap-4 hover:text-white font-medium cursor-pointer transition-colors pl-2">
              <Heart size={18} /> <span className="text-sm">Favorites</span>
            </div>
          </nav>
          <div className="mt-auto space-y-5">
            <div className="flex items-center gap-4 hover:text-white font-medium cursor-pointer transition-colors pl-2">
              <Settings size={18} /> <span className="text-sm">Settings</span>
            </div>
          </div>
        </div>

        {/* Middle Column (Main Content) */}
        <div className="flex-1 flex flex-col p-8 overflow-hidden bg-[#121422]">
          <form onSubmit={searchYoutube} className="mb-8 z-20 shrink-0">
            <div className="relative max-w-2xl flex gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-6 top-4 text-gray-500" size={18} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search..."
                  className="w-full bg-[#1a1c2a] px-14 py-3.5 rounded-full outline-none focus:ring-1 focus:ring-[#8cd92b] text-white"
                />
              </div>
            </div>
          </form>

          <div className="flex-1 overflow-y-auto no-scrollbar pb-10 flex flex-col pt-2">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-white tracking-wide">
                {shouldShowQueue ? "Up Next" : (songs.length > 0 ? "Search Results" : "Suggested For You")}
              </h3>
            </div>
            <div className="space-y-1">
              {(songs.length > 0 ? songs : displaySongs).map((song, idx) => (
                <DesktopSongRow
                  key={song.id}
                  song={song}
                  onSelect={() => playSong(song)}
                  isFavorite={favoriteIds.has(song.id)}
                  onToggleFavorite={(e) => toggleFavorite(e, song)}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Right Sidebar (Now Playing) */}
        <div className="w-80 bg-[#1a1c2a] flex flex-col pt-8 pb-8 px-6 border-l border-[#262837] shrink-0 z-10 shadow-[-10px_0_30px_rgba(0,0,0,0.1)]">
          {currentSong ? (
            <div className="flex-1 flex flex-col w-full h-full overflow-hidden justify-center items-center py-6">
              <h3 className="text-xl font-bold text-white mb-8">Now Playing</h3>
              <div className="w-full h-28 rounded-full overflow-hidden shadow-2xl mb-8 bg-[#121422]">
                <img src={currentSong.thumbnail} alt="" className="w-full h-full object-cover rounded-full" />
              </div>
              <div className="w-full mb-4">
                <h4 className="font-bold text-white text-base truncate">{currentSong.title}</h4>
                <p className="text-xs text-gray-400 truncate mt-1">{currentSong.artist}</p>
              </div>
              <div className="w-full mb-10">
                <div className="h-1 bg-[#262837] rounded-full overflow-hidden relative">
                  <div className="h-full bg-[#8cd92b] absolute top-0 left-0" style={{ width: `${(progress / (duration || 1)) * 100}%` }}></div>
                </div>
              </div>
              <div className="flex items-center justify-between w-full mt-2">
                <button onClick={playPrev} className="text-white hover:text-[#8cd92b]"><SkipBack size={24} fill="currentColor" /></button>
                <button onClick={togglePlay} className="w-16 h-16 bg-[#8cd92b] rounded-full text-[#121422] flex items-center justify-center">
                  {isPlaying ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" className="ml-1" />}
                </button>
                <button onClick={playNext} className="text-white hover:text-[#8cd92b]"><SkipForward size={24} fill="currentColor" /></button>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center opacity-30">
              <Music size={32} className="mb-4" />
              <p>Play a song</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
