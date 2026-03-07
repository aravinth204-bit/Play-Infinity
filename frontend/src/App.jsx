import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
// Build ID: 2026-03-05-MEGAUPDATE
import ReactPlayer from 'react-player';
import { Home, Music, Search, User, Play, Pause, SkipBack, SkipForward, Heart, MoreHorizontal, ArrowLeft, Shuffle, Repeat, Upload, List, Headphones, Book, Download, Clock, Settings, LogOut, Bell, ChevronRight, ChevronUp, ChevronDown, Plus, X, FolderPlus, Mic2, Share2, Wifi, WifiOff, History, Gauge, CheckCircle2, Camera, Instagram, Flame, Award, BarChart2 } from 'lucide-react';
import { formatTime } from './utils';
import { toPng } from 'html-to-image';

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
  // Stack of songs played — for the ⏮ Previous button to navigate back
  const playHistoryStack = useRef([]);
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

  // PREMIUM INTERACTIVE FEATURES (Insta Story, Swipe, Profile, Visualizer)
  const [visualizerMode, setVisualizerMode] = useState(0); // 0=Equalizer, 1=Halo Only, 2=Off
  const [showShareCard, setShowShareCard] = useState(false);
  const shareCardRef = useRef(null);
  const [discoverQueue, setDiscoverQueue] = useState([]);
  const [discoverIndex, setDiscoverIndex] = useState(0);

  useEffect(() => {
    // Keep populating the discover queue so it never empties out
    if (discoverQueue.length - discoverIndex < 5) {
      const candidates = [...trendingSongs, ...songs, ...fallbackSongs]
        .filter(s => !discoverQueue.some(dq => dq.id === s.id))
        .sort(() => 0.5 - Math.random())
        .slice(0, 15);
      if (candidates.length > 0) {
        setDiscoverQueue(prev => [...prev, ...candidates]);
      }
    }
  }, [trendingSongs, songs, fallbackSongs, discoverQueue, discoverIndex]);

  // FEATURE: Real Listening Time
  const [totalListeningSeconds, setTotalListeningSeconds] = useState(() => {
    try {
      const stored = localStorage.getItem('totalListeningSeconds');
      if (stored) return parseInt(stored, 10);
      const existingHistory = JSON.parse(localStorage.getItem('listenHistory') || '[]');
      return existingHistory.length * 240; // Approx baseline
    } catch { return 0; }
  });

  useEffect(() => {
    let interval;
    if (isPlaying && currentSong) {
      interval = setInterval(() => {
        setTotalListeningSeconds(prev => {
          const next = prev + 1;
          if (next % 10 === 0) localStorage.setItem('totalListeningSeconds', next.toString());
          return next;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isPlaying, currentSong]);

  const handleDownloadShareCard = async () => {
    if (!shareCardRef.current) return;
    try {
      const dataUrl = await toPng(shareCardRef.current, { quality: 1.0, pixelRatio: 3, skipFonts: false });
      const link = document.createElement('a');
      link.download = `ISAI_Story_${currentSong?.title?.slice(0, 15) || 'Track'}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error(err);
    }
  };

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
    const BLOCKED_WORDS = [
      'jukebox', 'mashup', 'collection', 'nonstop', 'full album', 'short',
      'reels', 'reel', 'status', 'teaser', 'trailer', 'karaoke',
      'whatsapp', 'ringtone', '8d', 'podcast', 'reaction',
      'cover', 'promo', 'making of', 'behind the scenes', 'top 10', 'top 50',
      'best of', 'all songs', 'hit list', 'audio jukebox', 'songs list'
    ];

    // Specifically block News and Entertainment gossip channels / keywords
    const BLOCKED_CHANNELS_AND_NEWS = [
      'news', 'glitz', 'galatta', 'behindwoods', 'polimer', 'thanthi', 'puthiya thalaimurai',
      'sun tv', 'vijay tv', 'zee tamil', 'kalaignar', 'captain tv', 'jebam', 'seithigal',
      'cinema vikatan', 'indiaglitz', 'valai pechu', 'rednool', 'touring talkies',
      'press meet', 'interview', 'speech', 'audio launch', 'public review'
    ];

    return songs.filter(s => {
      const title = (s.title || '').toLowerCase();
      const artist = (s.artist || s.channelTitle || '').toLowerCase();
      const combinedTxt = title + ' ' + artist;

      if (BLOCKED_WORDS.some(kw => title.includes(kw))) return false;
      if (BLOCKED_CHANNELS_AND_NEWS.some(kw => combinedTxt.includes(kw))) return false;
      return true;
    });
  };


  // ──────────────────────────────────────────────────────
  // FEATURE: Music Director Collections
  // ──────────────────────────────────────────────────────
  const MUSIC_DIRECTORS = [
    {
      id: 'anirudh', name: 'Anirudh', color: 'from-[#f97316] to-[#ef4444]', emoji: '🎸', subtitle: 'Music Director',
      query: 'Anirudh Ravichander tamil hit songs -jukebox -mashup -nonstop -shorts -reels -status',
      queries: [
        'Anirudh Ravichander Vijay songs tamil audio',
        'Anirudh 96 Remo Kaaki Sattai songs tamil',
        'Anirudh Rajinikanth Petta Darbar songs',
        'Anirudh Master Beast Jailer songs tamil',
      ]
    },
    {
      id: 'arrahman', name: 'A.R. Rahman', color: 'from-[#6366f1] to-[#8b5cf6]', emoji: '🎹', subtitle: 'Music Director',
      query: 'AR Rahman tamil hit songs -jukebox -mashup -nonstop -shorts -reels -status',
      queries: [
        'AR Rahman Roja Bombay tamil songs audio',
        'AR Rahman Mani Ratnam tamil songs',
        'AR Rahman Kadhalan Gentleman Muthu songs',
        'AR Rahman Enthiran Maryan tamil songs',
      ]
    },
    {
      id: 'harris', name: 'Harris Jayaraj', color: 'from-[#0ea5e9] to-[#6366f1]', emoji: '🎻', subtitle: 'Music Director',
      query: 'Harris Jayaraj tamil hit songs -jukebox -mashup -nonstop -shorts -reels -status',
      queries: [
        'Harris Jayaraj Ghajini Kaakha Kaakha songs',
        'Harris Jayaraj Vinnaithaandi Varuvaaya songs',
        'Harris Jayaraj Anniyan Unnale Unnale songs',
        'Harris Jayaraj tamil melody songs audio',
      ]
    },
    {
      id: 'yuvan', name: 'Yuvan Shankar Raja', color: 'from-[#10b981] to-[#0ea5e9]', emoji: '🎵', subtitle: 'Music Director',
      query: 'Yuvan Shankar Raja tamil hit songs -jukebox -mashup -nonstop -shorts -reels -status',
      queries: [
        'Yuvan Shankar Raja Mankatha Billa songs',
        'Yuvan Shankar Raja 7G Rainbow Colony songs',
        'Yuvan Madrasapattinam Ayan tamil songs',
        'Yuvan Thanga Magan Iruvar songs tamil',
      ]
    },
    {
      id: 'deva', name: 'Deva', color: 'from-[#ec4899] to-[#f97316]', emoji: '🥁', subtitle: 'Music Director',
      query: 'Deva tamil hit songs -jukebox -mashup -nonstop -shorts -reels -status',
      queries: [
        'Deva Rajinikanth Murasoli Muthal Mariyathai songs',
        'Deva Vijay Kushi Thirumalai songs tamil',
        'Deva Vikram tamil songs audio',
        'Deva classic tamil hit songs',
      ]
    },
    {
      id: 'ilayaraja', name: 'Ilaiyaraaja', color: 'from-[#f59e0b] to-[#ec4899]', emoji: '🎼', subtitle: 'Music Director',
      query: 'Ilaiyaraaja evergreen tamil hit songs -jukebox -mashup -nonstop -shorts -reels -status',
      queries: [
        'Ilaiyaraaja Moondram Pirai Ninaithale Innikkum songs',
        'Ilaiyaraaja Nayagan Punnagai Mannan songs',
        'Ilaiyaraaja Agni Natchathiram Thalapathi songs',
        'Ilaiyaraaja classic 80s tamil melody songs',
      ]
    },
    {
      id: 'gv', name: 'G.V. Prakash', color: 'from-[#14b8a6] to-[#22c55e]', emoji: '🎤', subtitle: 'Music Director',
      query: 'GV Prakash Kumar tamil hit songs -jukebox -mashup -nonstop -shorts -reels -status',
      queries: [
        'GV Prakash Aadukalam Mynaa songs tamil',
        'GV Prakash Inaindha Kaigal Irudhi Suttru songs',
        'GV Prakash Puriyaatha Puthir Darling songs',
        'GV Prakash 8 Thottakal Saahasam songs',
      ]
    },
    {
      id: 'sid', name: 'Sid Sriram', color: 'from-[#a855f7] to-[#ec4899]', emoji: '🎧', subtitle: 'Top Singer',
      query: 'Sid Sriram tamil hit songs -jukebox -mashup -nonstop -shorts -reels -status',
      queries: [
        'Sid Sriram Kannaana Kanney tamil songs',
        'Sid Sriram Nenjame Nenjame Vendhu Thanindhathu Kaadu songs',
        'Sid Sriram Dear Comrade Adithya Varma songs',
        'Sid Sriram tamil melody songs audio',
      ]
    },
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
      color: 'from-[#ff007f] to-[#ff7f00]',
      emoji: '🔥',
      subtitle: 'Current Hits',
      query: 'Anirudh tamil hit songs 2024 trending audio',
      queries: [
        'Anirudh 2024 tamil hit songs audio',
        'Yuvan GV Prakash 2024 tamil songs audio',
        'Ajith Vijay Dhanush 2024 tamil songs audio',
        'Sid Sriram Anirudh 2025 tamil songs audio',
      ]
    },
    {
      id: '2k_kids',
      name: '2K Kids',
      color: 'from-[#00f2fe] to-[#4facfe]',
      emoji: '🎧',
      subtitle: 'After 2015',
      query: 'Anirudh Mersal Bigil tamil songs audio',
      queries: [
        'Mersal Bigil tamil songs Anirudh audio',
        'Master Vikram Beast tamil songs audio',
        'Jailer Darbar Petta Rajinikanth songs',
        'Dhanush Sivakarthikeyan 2016 2017 2018 tamil songs',
      ]
    },
    {
      id: '90s_hits',
      name: '90s Hits',
      color: 'from-[#f6d365] to-[#fda085]',
      emoji: '📼',
      subtitle: '1990 – 2015',
      query: 'AR Rahman 90s tamil songs Roja Bombay audio',
      queries: [
        'AR Rahman Roja Bombay Kadhal Desam songs',
        'AR Rahman Mani Ratnam Ilaiyaraaja 2000s tamil songs',
        'Harris Jayaraj Yuvan 2000s tamil hit songs audio',
        'Shankar tamil songs Enthiran Sivaji audio',
      ]
    },
    {
      id: '80s_classics',
      name: '80s Classics',
      color: 'from-[#d4fc79] to-[#96e6a1]',
      emoji: '📻',
      subtitle: 'Before 1990',
      query: 'Ilaiyaraaja classic 80s tamil songs audio',
      queries: [
        'Ilaiyaraaja Ninaithale Innikkum Moondram Pirai songs',
        'Ilaiyaraaja Nayagan Punnagai Mannan songs tamil',
        'Ilaiyaraaja Agni Natchathiram Thalapathi songs',
        'Ilaiyaraaja SPB 80s classic tamil melody songs',
      ]
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
      const cacheKey = `director_v3_${director.id}`; // bump version to invalidate old bad cache
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        setDirectorSongs(JSON.parse(cached));
        setDirectorLoading(false);
        return;
      }
      const apiEndpoint = 'https://play-infinity.vercel.app/api/search';
      // Use multi-query parallel fetch if queries array exists, else fall back to single query
      const queryList = director.queries || [director.query];
      const results = await Promise.allSettled(
        queryList.map(q => {
          // Force strictly Tamil audio, block other languages and junk formats
          const strictQuery = `${q} tamil audio song -telugu -hindi -malayalam -kannada -status -shorts -reels -jukebox -mashup -nonstop`;
          return fetch(`${apiEndpoint}?q=${encodeURIComponent(strictQuery)}`)
            .then(r => r.json())
            .then(d => Array.isArray(d) ? d : (d.videos || []))
            .catch(() => [])
        })
      );

      // Flatten all results and shuffle heavily to mix different movies up
      let rawPool = results.flatMap(r => r.status === 'fulfilled' ? r.value : []);
      rawPool = rawPool.sort(() => 0.5 - Math.random());

      // Apply strict Tamil + quality filter first
      rawPool = applyBaseFilter(applyTamilFilter(rawPool));

      // Deduplicate by ID, normalized title, and similarity (prevent same song)
      const seenIds = new Set();
      const seenTitleKeys = new Set();
      const addedTitles = [];
      const combined = [];

      for (const s of rawPool) {
        if (!s || !s.id) continue;
        if (s.durationSeconds && s.durationSeconds < 90) continue;
        if (s.durationSeconds && s.durationSeconds > 480) continue;

        if (seenIds.has(s.id)) continue;

        const tk = normalizeTitleKey(s.title || '');
        if (tk && seenTitleKeys.has(tk)) continue;

        // Skip if it is essentially the same song as one we already added
        if (addedTitles.some(t => isLikelySameSong(s.title, t))) continue;

        seenIds.add(s.id);
        if (tk) seenTitleKeys.add(tk);
        addedTitles.push(s.title || '');
        combined.push(s);

        if (combined.length >= 25) break;
      }

      sessionStorage.setItem(cacheKey, JSON.stringify(combined));
      setDirectorSongs(combined);
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

    // Exact token overlap
    let overlapCount = 0;
    for (const w of aWords) {
      if (bWords.has(w)) overlapCount++;
    }

    // Fuzzy prefix/substring matching — catches spelling variants like
    // "mallapuru" vs "mallapur", "thiruchitrambalam" vs "thiruchitrambala"
    let fuzzyOverlap = 0;
    for (const w of aWords) {
      for (const v of bWords) {
        if (w === v) continue; // already counted above
        const longer = w.length > v.length ? w : v;
        const shorter = w.length > v.length ? v : w;
        // One starts with the other AND shorter is at least 4 chars long
        if (shorter.length >= 4 && longer.startsWith(shorter)) {
          fuzzyOverlap++;
          break;
        }
      }
    }

    const totalOverlap = overlapCount + fuzzyOverlap;
    const similarity = tokenSimilarity(aWords, bWords);

    // Match if: >=2 overlapping words (incl. fuzzy), or high similarity,
    // or: 1 fuzzy match + both titles clearly share same lead word
    return (
      (totalOverlap >= 2 && (overlapCount + fuzzyOverlap) / Math.min(aWords.size, bWords.size) >= 0.4) ||
      similarity >= 0.65 ||
      (fuzzyOverlap >= 1 && overlapCount >= 1)
    );
  };

  const addPlayedTitleTokens = (title = '') => {
    const tokens = titleTokenSet(title);
    if (tokens.size === 0) return;

    const alreadyExists = playedTitleTokenSetsRef.current.some(existing => tokenSimilarity(existing, tokens) >= 0.8);
    if (alreadyExists) return;

    playedTitleTokenSetsRef.current = [tokens, ...playedTitleTokenSetsRef.current].slice(0, 80);
  };

  // ── PREMIUM: High-Res Album Art Helper ─────────────────────────────────────
  const getHighResImage = (url) => {
    if (!url) return '';
    // YouTube thumbnails: replace hqdefault or mqdefault with maxresdefault for 4K/HD
    return url.replace(/(hqdefault|mqdefault|sddefault)\.jpg/i, 'maxresdefault.jpg');
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

  // ── CLEAN TITLE: Strip YouTube junk from song titles ─────────────────────
  const cleanTitle = (raw = '') => {
    return raw
      .replace(/\s*[|\-–—•·]\s*(official|lyric|lyrics|video|audio|song|songs|hd|hq|4k|8k|full|feat\.?|ft\.?|starring|music video|video song|audio song|tamil song|tamil|whatsapp status|status|remaster|remastered|\d{4})[^|\-–—•·]*/gi, '')
      .replace(/\s*\([^)]{0,40}(official|lyric|audio|hd|remaster|\d{4})[^)]*\)/gi, '')
      .replace(/\s*\[[^\]]{0,40}(official|lyric|audio|hd|remaster|\d{4})[^\]]*\]/gi, '')
      .replace(/\s{2,}/g, ' ')
      .trim();
  };

  // ── QUICK GENRE SEARCH ────────────────────────────────────────────────────
  const GENRE_CHIPS = [
    { label: '💃 Kuthu', query: 'tamil kuthu mass dance songs' },
    { label: '❤️ Love', query: 'tamil love melody romantic songs' },
    { label: '😢 Sad', query: 'tamil sad feeling songs' },
    { label: '🔥 Trending', query: 'Anirudh 2024 2025 tamil trending songs' },
    { label: '🎸 Anirudh', query: 'Anirudh Ravichander tamil hit songs' },
    { label: '🎹 Rahman', query: 'AR Rahman evergreen tamil songs' },
    { label: '🎻 Harris', query: 'Harris Jayaraj tamil melody songs' },
    { label: '🎵 Yuvan', query: 'Yuvan Shankar Raja tamil hit songs' },
    { label: '📻 Classic', query: 'Ilaiyaraaja classic 80s 90s tamil songs' },
    { label: '🎤 Sid', query: 'Sid Sriram tamil songs' },
  ];

  const searchYoutube = async (e, overrideQuery) => {
    if (e && e.preventDefault) e.preventDefault();
    const q = overrideQuery || searchQuery;
    if (!q.trim()) return;
    setLoading(true);
    try {
      const apiEndpoint = `https://play-infinity.vercel.app/api/search`;
      const res = await fetch(`${apiEndpoint}?q=${encodeURIComponent(q + ' tamil song')}`);
      const data = await res.json();
      let results = Array.isArray(data) ? data : (data.videos || []);
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
      const apiEndpoint = `https://play-infinity.vercel.app/api/search`;
      const currentSongTitle = (song.title || '').toLowerCase();
      const searchLower = searchQuery.toLowerCase();
      const combinedText = `${currentSongTitle} ${searchLower}`;

      // ── MOOD / VIBE DETECTION ───────────────────────────────────────────
      const kuthuWords = ['kuthu', 'dance', 'mass', 'folk', 'fast', 'dappankuthu', 'vaathi', 'verithanam', 'rowdy', 'aaluma', 'nakku', 'seena', 'appadi', 'boss', 'billa', 'villain', 'thala', 'thalapathy', 'rajini', 'rajinikanth', 'beast mode', 'goat'];
      const loveWords = ['love', 'kadhal', 'romance', 'romantic', 'nee', 'yen', 'un', 'vaseegara', 'hosanna', 'munbe', 'minnale', 'kanave', 'kannam', 'kaadhal', 'priya', 'penne', 'love song', 'melody love', 'mannipaaya', 'yennai'];
      const sadWords = ['sad', 'sogam', 'pain', 'broken', 'lonely', 'kanneer', 'feeling', 'missing', 'thirumbi', 'ninaivugal', 'oru naal', 'life', 'vaazhkai', 'irukkindren', 'illaiyae'];
      const newWords = ['2024', '2025', '2023', 'new', 'latest', 'trending', 'recent', 'anirudh', 'gv prakash', 'sid sriram', 'beast', 'jailer', 'leo', 'amaran', 'vidaamuyarchi', 'goat'];
      const oldWords = ['80s', '90s', 'classic', 'evergreen', 'ilayaraja', 'ilaiyaraaja', 'spb', 'janaki', 'swarnalatha', 'old', 'golden', 'roja', 'bombay', 'mani ratnam', 'rajkumar', 'sivaji'];
      const devotionalWords = ['devotional', 'bhakti', 'murugan', 'amman', 'vinayagar', 'ayyappan', 'suprabhatam', 'kovil', 'god', 'prayer'];

      const matches = (words) => words.some(w => combinedText.includes(w));

      // Extract artist name (clean up YouTube artifacts)
      const rawArtist = (song.artist || '').replace(/ - topic|vevo|official|music/gi, '').split(',')[0].trim();
      const artist = rawArtist.length > 2 && rawArtist.toLowerCase() !== 'various artists' ? rawArtist : '';

      // ── BUILD QUERY LIST BASED ON DETECTED MOOD ─────────────────────────
      let queryList = [];

      if (matches(devotionalWords)) {
        queryList = [
          'tamil devotional songs Murugan Amman audio',
          'SPB tamil devotional songs audio',
          'tamil god songs Ayyappan Vinayagar audio',
          'Veeramanidaasan devotional tamil songs',
        ];
      } else if (matches(sadWords)) {
        queryList = [
          'tamil sad melody songs audio',
          'tamil feeling songs broken heart audio',
          'Harris Jayaraj sad melody tamil songs',
          'Yuvan Shankar Raja sad songs tamil audio',
          'AR Rahman emotional tamil songs audio',
        ];
      } else if (matches(loveWords)) {
        queryList = [
          'tamil love melody romantic songs audio',
          'Sid Sriram tamil love songs audio',
          'AR Rahman romantic tamil songs audio',
          'Harris Jayaraj love melody tamil songs',
          'tamil kadhal melody songs Yuvan audio',
        ];
      } else if (matches(kuthuWords)) {
        queryList = [
          'tamil mass kuthu dance songs audio',
          'Anirudh mass beat tamil songs audio',
          'tamil folk kuthu songs audio',
          'Devi Sri Prasad kuthu tamil songs audio',
          'tamil party songs mass audio',
        ];
      } else if (matches(oldWords)) {
        queryList = [
          'Ilaiyaraaja evergreen 80s 90s tamil songs audio',
          'SPB Janaki classic tamil melody songs',
          'AR Rahman 90s Mani Ratnam tamil songs audio',
          'Swarnalatha classic tamil songs audio',
          'Deva classic Tamil hit songs audio',
        ];
      } else if (matches(newWords)) {
        queryList = [
          'Anirudh 2024 2025 tamil songs audio',
          'Sid Sriram GV Prakash new tamil songs',
          'Yuvan Anirudh latest tamil hit songs audio',
          'Vijay Ajith 2024 tamil movie songs audio',
          'new tamil songs 2025 trending audio',
        ];
      } else {
        // Context-based: use artist + song title words
        const titleWords = currentSongTitle.replace(/[^a-z0-9 ]/g, ' ').split(' ').filter(w => w.length > 3 && !['song', 'songs', 'audio', 'video', 'tamil', 'official', 'full', 'lyrics'].includes(w)).slice(0, 2).join(' ');
        queryList = [
          artist ? `${artist} tamil songs audio` : 'tamil hit songs audio',
          titleWords ? `${titleWords} tamil songs audio` : 'tamil melody songs audio',
          'Anirudh Yuvan tamil hit songs audio',
          'AR Rahman Harris Jayaraj tamil songs audio',
          'tamil love melody mass songs audio',
        ];
      }

      // ── PARALLEL FETCH ALL QUERIES ───────────────────────────────────────
      const fetchResults = await Promise.allSettled(
        queryList.map(q =>
          fetch(`${apiEndpoint}?q=${encodeURIComponent(q)}`)
            .then(r => r.json())
            .then(d => Array.isArray(d) ? d : (d.videos || []))
            .catch(() => [])
        )
      );

      // Flatten
      let rawPool = fetchResults.flatMap(r => r.status === 'fulfilled' ? r.value : []);

      // ── FILTER & DEDUPLICATE ─────────────────────────────────────────────
      // Apply Tamil + base quality filter first
      rawPool = applyBaseFilter(applyTamilFilter(rawPool));

      // Deduplicate by ID + normalized title (full key, not just 30 chars)
      const seenIds = new Set([song.id]);
      if (currentSong) seenIds.add(currentSong.id);
      sessionPlayedIds.current.forEach(id => seenIds.add(id));

      // Use full normalized title key to prevent same-song variants slipping through
      const seenTitleKeys = new Set();
      seenTitleKeys.add(normalizeTitleKey(song.title || ''));
      if (currentSong) seenTitleKeys.add(normalizeTitleKey(currentSong.title || ''));

      const deduped = [];
      for (const s of rawPool) {
        if (!s || !s.id) continue;
        if (seenIds.has(s.id)) continue;
        // Duration guard: skip very short (<90s) or very long (>7min) tracks
        if (s.durationSeconds && s.durationSeconds < 90) continue;
        if (s.durationSeconds && s.durationSeconds > 480) continue;
        // Full normalized title key dedup
        const titleKey = normalizeTitleKey(s.title || '');
        if (titleKey && seenTitleKeys.has(titleKey)) continue;
        // Skip if title too similar to the song being played OR to current song
        if (isLikelySameSong(s.title, song.title)) continue;
        if (currentSong && isLikelySameSong(s.title, currentSong.title)) continue;
        seenIds.add(s.id);
        if (titleKey) seenTitleKeys.add(titleKey);
        deduped.push(s);
      }

      // Shuffle for variety, cap at 40
      const finalQueue = deduped.sort(() => 0.5 - Math.random()).slice(0, 40);

      // ── MERGE INTO EXISTING QUEUE (no repeats, check title similarity too) ──
      setQueue(prevQueue => {
        const prevIds = new Set(prevQueue.map(s => s.id));
        prevIds.add(song.id);
        if (currentSong) prevIds.add(currentSong.id);
        sessionPlayedIds.current.forEach(id => prevIds.add(id));
        // Also collect normalized titles of existing queue to prevent title dupes
        const prevTitleKeys = new Set(prevQueue.map(s => normalizeTitleKey(s.title || '')).filter(Boolean));
        if (currentSong) prevTitleKeys.add(normalizeTitleKey(currentSong.title || ''));
        prevTitleKeys.add(normalizeTitleKey(song.title || ''));
        const newEntries = finalQueue.filter(s => {
          if (prevIds.has(s.id)) return false;
          const tk = normalizeTitleKey(s.title || '');
          if (tk && prevTitleKeys.has(tk)) return false;
          // Final similarity check against current + played song
          if (isLikelySameSong(s.title, song.title)) return false;
          if (currentSong && isLikelySameSong(s.title, currentSong.title)) return false;
          return true;
        });
        return [...prevQueue, ...newEntries].slice(0, 60);
      });

    } catch (err) {
      console.error('fetchQueue error:', err);
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

    // Push current song to history stack BEFORE switching (so ⏮ can go back)
    if (currentSong && (!playHistoryStack.current.length || playHistoryStack.current[playHistoryStack.current.length - 1]?.id !== currentSong.id)) {
      playHistoryStack.current.push(currentSong);
      // Keep stack size reasonable
      if (playHistoryStack.current.length > 50) playHistoryStack.current.shift();
    }

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
    // Pop from the play history stack to go back to the previous song
    if (playHistoryStack.current.length > 0) {
      // Peek first — skip any duplicate of current song at top of stack
      while (
        playHistoryStack.current.length > 0 &&
        playHistoryStack.current[playHistoryStack.current.length - 1]?.id === currentSong?.id
      ) {
        playHistoryStack.current.pop();
      }
      if (playHistoryStack.current.length > 0) {
        const prev = playHistoryStack.current.pop();
        // Push current song to front of queue so ▶ Next can come back
        setQueue(q => [currentSong, ...q.filter(s => s.id !== currentSong?.id)].slice(0, 60));
        playSong(prev, true); // fromQueue=true so it doesn't clear the queue
        return;
      }
    }
    // Fallback: use search results / trending songs
    const pool = [...songs, ...trendingSongs];
    const idx = pool.findIndex(s => s.id === currentSong?.id);
    if (idx > 0) playSong(pool[idx - 1]);
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
          <div
            className="flex-1 overflow-y-auto no-scrollbar overscroll-contain scroll-smooth"
            style={{ paddingBottom: currentSong ? 'calc(9.5rem + env(safe-area-inset-bottom))' : 'calc(5.5rem + env(safe-area-inset-bottom))' }}
          >
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
                        <button onClick={() => setActiveTab('Profile')} className="w-10 h-10 bg-white/10 backdrop-blur-sm text-white rounded-full flex items-center justify-center hover:bg-white/20 transition-all active:scale-90 border border-white/10">
                          <User size={18} />
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
                              <span className="text-white text-[11px] font-semibold truncate leading-tight">{cleanTitle(song.title)}</span>
                              <span className="text-white/40 text-[10px] truncate mt-0.5">{song.artist?.replace(/ - Topic| VEVO/gi, '')}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Suggested For You — based on listen history mood */}
                    {listenHistory.length >= 3 && trendingSongs.length > 0 && (() => {
                      // Pick mood from most recent song listened
                      const recentTitle = (listenHistory[0]?.title || '').toLowerCase();
                      const isLove = /love|kadhal|romantic|melody|vaseegara|nenjukkul|hosanna|un perai/.test(recentTitle);
                      const isKuthu = /kuthu|mass|dance|rowdy|vaathi|verithanam|appadi/.test(recentTitle);
                      const suggestedLabel = isLove ? '❤️ More Love Songs' : isKuthu ? '🔥 More Kuthu Bangers' : '🎵 Suggested For You';
                      // Filter trending that don't overlap with listenHistory
                      const playedIds = new Set(listenHistory.map(s => s.id));
                      const suggested = trendingSongs.filter(s => !playedIds.has(s.id)).slice(0, 10);
                      if (suggested.length < 3) return null;
                      return (
                        <div className="mb-6">
                          <div className="flex items-center justify-between mb-3">
                            <h2 className="text-base font-bold text-white">{suggestedLabel}</h2>
                            <span className="text-[10px] text-white/30 font-semibold">Tamil Only</span>
                          </div>
                          <div className="flex overflow-x-auto gap-3 no-scrollbar pb-2">
                            {suggested.map((song, i) => (
                              <div key={`sug-${i}`} onClick={() => playSong(song)} className="flex flex-col w-[130px] shrink-0 cursor-pointer group active:scale-95 transition-all">
                                <div className="relative w-[130px] h-[130px] mb-2 rounded-2xl overflow-hidden shadow-lg">
                                  <img src={song.thumbnail} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                                  {currentSong?.id === song.id && isPlaying && (
                                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                                      <div className="flex gap-[2px] items-end h-5">
                                        {[0, 1, 2].map(b => <div key={b} className="w-1 rounded-full animate-bounce" style={{ height: `${8 + b * 4}px`, backgroundColor: dominantColor, animationDelay: `${b * 0.1}s` }} />)}
                                      </div>
                                    </div>
                                  )}
                                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
                                </div>
                                <span className="text-white text-[11px] font-semibold truncate leading-tight">{cleanTitle(song.title)}</span>
                                <span className="text-white/40 text-[10px] truncate mt-0.5">{song.artist?.replace(/ - Topic| VEVO/gi, '')}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })()}


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
                            <button onClick={(e) => { e.stopPropagation(); toggleFavorite(e, song); }} className="p-2 shrink-0 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity active:opacity-100">
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
                  <div onClick={() => setActiveTab('Home')} className="mb-6 bg-black/20 w-11 h-11 rounded-full flex items-center justify-center cursor-pointer hover:bg-black/40 active:scale-95 transition-all">
                    <ArrowLeft size={20} className="text-white" />
                  </div>
                  <h1 className="text-3xl font-bold text-white tracking-widest leading-tight">Liked Songs</h1>
                  <p className="text-sm text-[#d1c4e9] mt-2 font-medium">{favorites.length} songs</p>
                </div>
                <div className="px-4 pb-24 space-y-1">
                  {favorites.length > 0 ? favorites.map((song, idx) => (
                    <DesktopSongRow key={song.id} song={song} onSelect={() => playSong(song)} isFavorite={true} onToggleFavorite={(e) => toggleFavorite(e, song)} />
                  )) : (
                    <div className="flex flex-col items-center justify-center pt-16 pb-8 text-center px-6">
                      <div className="relative mb-6">
                        <div className="w-28 h-28 rounded-full flex items-center justify-center" style={{ background: `${dominantColor}22`, border: `2px solid ${dominantColor}44` }}>
                          <Heart size={44} className="text-[#a080ff]" />
                        </div>
                        <div className="absolute -top-1 -right-1 text-2xl animate-bounce">🎵</div>
                        <div className="absolute -bottom-1 -left-2 text-xl animate-bounce" style={{ animationDelay: '0.2s' }}>🎶</div>
                      </div>
                      <h3 className="text-white font-bold text-lg mb-2">No liked songs yet</h3>
                      <p className="text-white/40 text-sm leading-relaxed mb-6">Tap the ♥ heart on any song while it's playing to save it here</p>
                      <button
                        onClick={() => setActiveTab('Search')}
                        className="px-6 py-3 rounded-full font-bold text-sm text-black"
                        style={{ background: dominantColor }}
                      >
                        🔍 Discover Songs
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* LISTEN HISTORY VIEW */}
            {activeTab === 'History' && (
              <div className="overflow-x-hidden min-h-screen bg-[#121212] animate-fade-in animate-slide-up-premium">
                <div className="px-5 pt-12 pb-6" style={{ background: `linear-gradient(to bottom, ${dominantColor}55 0%, #121212 100%)` }}>
                  <button onClick={() => setActiveTab('Home')} className="mb-4 w-11 h-11 bg-black/20 rounded-full flex items-center justify-center hover:bg-black/30 active:scale-95 transition-all">
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
                  <button onClick={() => setActiveTab('Home')} className="relative z-10 mb-5 w-11 h-11 bg-black/20 rounded-full flex items-center justify-center hover:bg-black/40 active:scale-95 transition-all">
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
                        <button onClick={(e) => { e.stopPropagation(); toggleFavorite(e, song); }} className="p-2 shrink-0 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity active:opacity-100">
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
                <h1 className="text-2xl font-bold text-white mb-4">Search</h1>
                <form onSubmit={searchYoutube} className="mb-4 shrink-0">
                  <div className="relative">
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Songs, artists, moods..."
                      className="w-full bg-white text-black px-4 py-[12px] pl-10 pr-12 rounded-xl outline-none font-semibold text-base shadow-lg"
                    />
                    <Search className="absolute left-3 top-3.5 text-[#121212]" size={18} />
                    {searchQuery && (
                      <button type="button" onClick={() => { setSearchQuery(''); setSongs([]); }} className="absolute right-3 top-3.5 text-gray-400 p-0.5">
                        <X size={18} />
                      </button>
                    )}
                  </div>
                </form>

                {/* Quick Genre Chips */}
                {songs.length === 0 && !loading && (
                  <div className="mb-4 shrink-0">
                    <p className="text-xs text-white/40 font-bold uppercase tracking-wider mb-2">Browse by mood</p>
                    <div className="flex overflow-x-auto gap-2 no-scrollbar pb-1">
                      {GENRE_CHIPS.map((chip) => (
                        <button
                          key={chip.label}
                          onClick={() => { setSearchQuery(chip.label); searchYoutube(null, chip.query); }}
                          className="shrink-0 px-4 py-2 rounded-full text-sm font-bold bg-[#1a1c2a] text-white border border-[#3e3e3e]/60 hover:border-[#8cd92b]/60 hover:text-[#8cd92b] active:scale-95 transition-all whitespace-nowrap"
                        >
                          {chip.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex-1 overflow-y-auto no-scrollbar pb-24 overscroll-contain">
                  {songs.length === 0 && searchHistory.length > 0 && (
                    <div className="mb-6 mt-2 px-1 animate-fade-in">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-xs font-bold text-white/50 uppercase tracking-wider">Recent</h3>
                        <button
                          onClick={() => { setSearchHistory([]); localStorage.removeItem('musicHistory'); }}
                          className="text-[10px] uppercase font-bold text-[#8cd92b] hover:opacity-70 transition-opacity"
                        >
                          Clear All
                        </button>
                      </div>
                      <div className="space-y-1">
                        {searchHistory.slice(0, 5).map((item, i) => (
                          <div
                            key={i}
                            onClick={() => { setSearchQuery(item.title || item); searchYoutube(null, item.title || item); }}
                            className="flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 cursor-pointer transition-all active:scale-[0.98]"
                          >
                            <div className="w-9 h-9 bg-[#2a2a2a] rounded-lg flex items-center justify-center shrink-0">
                              <Clock size={14} className="text-gray-500" />
                            </div>
                            <span className="text-white text-sm font-medium truncate">{typeof item === 'string' ? item : item.title}</span>
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
                      {(songs.length > 0 || displaySongs.length > 0) && (
                        <h3 className="text-xs font-bold text-white/40 mb-3 px-1 uppercase tracking-wider">
                          {songs.length > 0 ? `${songs.length} results` : 'Suggestions for you'}
                        </h3>
                      )}
                      <div className="space-y-1">
                        {(songs.length > 0 ? songs : displaySongs).map((song) => (
                          <div key={song.id} onClick={() => playSong(song)} className="flex items-center gap-3 p-2 hover:bg-[#ffffff0a] rounded-xl cursor-pointer transition-all active:scale-[0.98] active:opacity-80">
                            <div className="relative shrink-0">
                              <img src={song.thumbnail} alt="" className="w-12 h-12 object-cover rounded-xl shadow-sm" />
                              {currentSong?.id === song.id && isPlaying && (
                                <div className="absolute inset-0 bg-black/50 rounded-xl flex items-center justify-center">
                                  <div className="flex gap-[2px] items-end h-4">
                                    {[0, 1, 2].map(b => <div key={b} className="w-[3px] rounded-full animate-bounce" style={{ height: `${7 + b * 3}px`, backgroundColor: dominantColor, animationDelay: `${b * 0.1}s` }} />)}
                                  </div>
                                </div>
                              )}
                            </div>
                            <div className="flex-1 overflow-hidden">
                              <h4 className="font-semibold text-white text-[13px] truncate leading-snug">{cleanTitle(song.title)}</h4>
                              <div className="flex items-center gap-2 mt-0.5">
                                <p className="text-[11px] text-[#a0a0a0] truncate">{song.artist?.replace(/ - Topic| VEVO/gi, '')}</p>
                                {song.durationSeconds > 0 && (
                                  <span className="text-[10px] text-white/25 shrink-0 font-mono">{Math.floor(song.durationSeconds / 60)}:{String(song.durationSeconds % 60).padStart(2, '0')}</span>
                                )}
                              </div>
                            </div>
                            <MoreHorizontal size={16} className="text-gray-600 shrink-0" />
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

            {/* DISCOVER (TINDER STYLE SWIPE) VIEW */}
            {activeTab === 'Discover' && (
              <div className="flex flex-col h-full bg-[#121212] overflow-hidden">
                <div className="p-6 pt-12 shrink-0 text-center">
                  <h1 className="text-2xl font-black text-white flex items-center gap-2 justify-center"><Flame className="text-[#ff4500]" /> Discover</h1>
                  <p className="text-white/50 text-xs mt-1 font-bold">Swipe Right to Like, Left to Skip</p>
                </div>

                <div className="flex-1 relative flex items-center justify-center -mt-10 px-6 max-h-[600px]">
                  {discoverQueue.length > 0 && discoverIndex < discoverQueue.length ? (
                    <div className="relative w-full max-w-[340px] aspect-[3/4] rounded-[40px] shadow-[0_30px_60px_rgba(0,0,0,0.8)] overflow-hidden bg-[#1a1a1a] border border-white/10 animate-fade-in mx-auto">
                      <img src={getHighResImage(discoverQueue[discoverIndex].thumbnail)} alt="" className="absolute inset-0 w-full h-full object-cover opacity-90" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-transparent" />

                      {/* Floating Play Button */}
                      <button
                        onClick={() => playSong(discoverQueue[discoverIndex])}
                        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 bg-white/20 backdrop-blur-xl rounded-full text-white flex items-center justify-center active:scale-90 transition-all shadow-2xl"
                      >
                        <Play size={36} fill="white" className="ml-2" />
                      </button>

                      <div className="absolute bottom-0 inset-x-0 p-8">
                        <h2 className="text-white text-2xl font-black leading-tight mb-2 drop-shadow-lg">{discoverQueue[discoverIndex].title}</h2>
                        <p className="text-white/70 font-semibold mb-6 drop-shadow-lg">{discoverQueue[discoverIndex].artist}</p>

                        <div className="flex items-center justify-between">
                          <button
                            onClick={() => {
                              showToast('Skipped ⏭', 'info');
                              setDiscoverIndex(prev => prev + 1);
                            }}
                            className="w-16 h-16 rounded-full bg-white/10 backdrop-blur-lg flex items-center justify-center text-red-500 hover:bg-white/20 active:scale-90 transition-all"
                          >
                            <X size={28} strokeWidth={3} />
                          </button>

                          <button
                            onClick={(e) => {
                              toggleFavorite(e, discoverQueue[discoverIndex]);
                              showToast('Liked! Added to Favorites ❤️', 'info');
                              setDiscoverIndex(prev => prev + 1);
                            }}
                            className="w-16 h-16 rounded-full bg-[#8cd92b]/20 backdrop-blur-lg flex items-center justify-center text-[#8cd92b] hover:bg-[#8cd92b]/30 active:scale-90 transition-all shadow-[0_0_20px_rgba(140,217,43,0.3)]"
                          >
                            <Heart size={28} fill="currentColor" strokeWidth={0} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center text-white/50 font-bold">
                      <p className="text-4xl mb-4">🎵</p>
                      <p>You've swiped them all!</p>
                      <button onClick={() => setDiscoverIndex(0)} className="mt-4 px-6 py-2 bg-white/10 rounded-full text-white text-sm">Restart Discovery</button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* PROFILE (LISTENING STATS) VIEW */}
            {activeTab === 'Profile' && (
              <div className="p-6 pt-12 h-full bg-[#121212] overflow-y-auto no-scrollbar">
                <div className="text-center mb-10">
                  <div className="w-24 h-24 rounded-full bg-gradient-to-br from-[#8cd92b] to-[#22c7b5] mx-auto p-1 mb-4 shadow-[0_0_30px_rgba(140,217,43,0.3)]">
                    <img src="/logo.png" className="w-full h-full rounded-full border-4 border-[#121212] object-cover" alt="User" />
                  </div>
                  <h2 className="text-2xl font-black text-white">Music Lover</h2>
                  <p className="text-white/50 text-sm font-bold mt-1">ISAI Premium User</p>
                </div>

                <h3 className="text-lg font-black text-white mb-4">Your Listening Stats 📊</h3>
                <div className="grid grid-cols-2 gap-4 mb-8">
                  <div className="bg-[#1a1c2a] p-5 rounded-3xl border border-white/5">
                    <Headphones size={24} className="text-[#8cd92b] mb-3" />
                    <p className="text-white text-3xl font-black">{listenHistory.length}</p>
                    <p className="text-white/40 text-[11px] font-bold uppercase tracking-wider mt-1">Total Streams</p>
                  </div>
                  <div className="bg-[#1a1c2a] p-5 rounded-3xl border border-white/5">
                    <Clock size={24} className="text-[#22c7b5] mb-3" />
                    <p className="text-white text-3xl font-black">
                      {Math.floor(totalListeningSeconds / 3600)}h {Math.floor((totalListeningSeconds % 3600) / 60)}m
                    </p>
                    <p className="text-white/40 text-[11px] font-bold uppercase tracking-wider mt-1">Time Listened</p>
                  </div>
                </div>

                <h3 className="text-lg font-black text-white mb-4">Badges & Achievements 🏆</h3>
                <div className="space-y-3 mb-10">
                  <div className="flex items-center gap-4 bg-[#1a1c2a] p-4 rounded-2xl border border-[#ff4500]/30 shadow-[0_5px_20px_rgba(255,69,0,0.1)]">
                    <div className="w-12 h-12 rounded-xl bg-[#ff4500]/20 flex items-center justify-center text-2xl">🔥</div>
                    <div>
                      <h4 className="text-white font-bold">Trending Setter</h4>
                      <p className="text-white/50 text-xs mt-0.5">Listened to 10+ Top Chart songs.</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 bg-[#1a1c2a] p-4 rounded-2xl border border-white/5">
                    <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center text-2xl opacity-50">🎸</div>
                    <div>
                      <h4 className="text-white font-bold opacity-50">Anirudh Fanatic (Locked)</h4>
                      <p className="text-white/50 text-xs mt-0.5">Stream Anirudh 50 times to unlock.</p>
                    </div>
                  </div>
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
              // PREMIUM: Swipe down to minimize
              if (dy > Math.abs(dx) && dy > 80) {
                setActiveTab('Home');
              }
              // Swipe left/right for Next/Prev
              else if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 60) {
                if (dx < 0) { playNext(); showToast('Next song ⏭', 'info'); }
                else { playPrev(); showToast('Previous song ⏮', 'info'); }
              }
              swipeTouchStartX.current = null;
              swipeTouchStartY.current = null;
            }}
          >
            {/* PREMIUM BACKGROUND: Immersive Blurred Background (Apple Music Style) */}
            {currentSong && (
              <>
                <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
                  <img src={getHighResImage(currentSong.thumbnail)} alt="bg" className="w-full h-full object-cover scale-[1.5] blur-[80px] opacity-60 transition-all duration-1000" />
                </div>
                {/* Dynamic Gradient Overlay */}
                <div
                  className="absolute inset-0 z-0 opacity-80 pointer-events-none mix-blend-multiply transition-all duration-1000"
                  style={{ background: `linear-gradient(to bottom, transparent 0%, #121212 90%)` }}
                ></div>
                <div className="absolute inset-0 z-0 bg-black/30 pointer-events-none"></div>
              </>
            )}
            <div className="flex items-center justify-between p-5 pt-10 z-10 relative">
              <button onClick={() => setActiveTab('Home')} className="p-2 -ml-2 text-white/70 hover:text-white transition-all active:scale-75">
                <ArrowLeft size={24} />
              </button>
              <div className="text-center flex flex-col text-white font-semibold flex-1">
                <span className="text-[10px] uppercase tracking-widest text-[#a0a0a0]">Now Playing</span>
                <span className="text-xs truncate max-w-[200px] mx-auto">{currentSong?.title || 'Unknown Title'}</span>
              </div>
              <button onClick={() => setShowShareCard(true)} className="p-2 -mr-2 text-white/70 hover:text-white transition-colors">
                <Instagram size={24} />
              </button>
            </div>

            {currentSong ? (
              <div className="flex-1 flex flex-col items-center px-6 relative z-10 w-full overflow-y-auto no-scrollbar pb-24">
                {/* PREMIUM: Audio Visualizer / Glowing Halo around Image */}
                <div
                  onDoubleClick={() => {
                    setVisualizerMode(prev => (prev + 1) % 3);
                    showToast(['Visualizer: Equalizer 🎚', 'Visualizer: Halo Pulse 🟢', 'Visualizer: Minimal ⚪'][visualizerMode === 2 ? 0 : visualizerMode + 1]);
                  }}
                  className={`mt-2 mb-2 w-[min(310px,75vw)] aspect-square relative mx-auto rounded-3xl overflow-hidden bg-[#1a1c2a] shrink-0 border border-[#ffffff1a] transition-all duration-300 ${isPlaying ? 'scale-[1.02]' : 'scale-100'}`}
                  style={{
                    // Dynamic Glowing Halo based on audio bass (audioData[2] is roughly lower frequencies)
                    boxShadow: visualizerMode !== 2 && isPlaying && audioData.length > 0
                      ? `0 20px 60px -10px ${dominantColor}${Math.floor((audioData[2] / 255) * 99).toString(16).padStart(2, '0')}, 0 0 ${Math.floor((audioData[2] / 255) * 60)}px ${dominantColor}50`
                      : `0 30px 60px rgba(0,0,0,0.7)`
                  }}
                >
                  <img
                    src={getHighResImage(currentSong.thumbnail)}
                    alt="Cover"
                    className="w-full h-full object-cover block absolute inset-0 z-0 select-none pointer-events-none"
                    onError={(e) => { e.target.src = currentSong.thumbnail || '/logo.png'; }}
                  />

                  {/* Equalizer Overlay - REAL-TIME REACTIVE */}
                  {visualizerMode === 0 && (
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
                  )}
                </div>

                <p className="text-[10px] text-white/30 font-bold uppercase tracking-widest mt-1 mb-6">Double tap art to change theme</p>

                {/* Song Info */}
                <div className="w-full max-w-[340px] mt-12 mb-6 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <h2 className="text-[22px] font-bold text-white truncate leading-tight">{cleanTitle(currentSong.title)}</h2>
                    <p className="text-[16px] text-[#a0a0a0] font-medium mt-1 truncate">{currentSong.artist?.replace(/ - Topic| VEVO/gi, '') || 'Unknown Artist'}</p>
                  </div>
                  <div className="shrink-0 p-2">
                    <AnimatedHeart size={24} isFavorite={favoriteIds.has(currentSong.id)} onClick={(e) => toggleFavorite(e, currentSong)} />
                  </div>
                </div>

                {/* Progress Bar (Line) — thicker with scrub thumb */}
                <div className="w-full max-w-[340px] relative mt-2 group px-2">
                  <input
                    type="range" min={0} max={duration || 1} value={progress} onChange={handleSeek}
                    className="absolute inset-x-2 top-0 h-8 -mt-2 opacity-0 z-20 cursor-pointer w-[calc(100%-16px)]"
                  />
                  <div className="w-full h-[5px] bg-white/10 rounded-full relative mb-1 mt-3">
                    {/* Filled track */}
                    <div
                      className="h-full rounded-full absolute top-0 left-0 transition-all duration-200 pointer-events-none"
                      style={{
                        width: `${(progress / (duration || 1)) * 100}%`,
                        backgroundColor: dominantColor,
                        boxShadow: `0 0 8px ${dominantColor}88`
                      }}
                    />
                    {/* Thumb dot */}
                    <div
                      className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full shadow-xl border-2 border-black pointer-events-none transition-all duration-200"
                      style={{
                        left: `calc(${(progress / (duration || 1)) * 100}% - 8px)`,
                        backgroundColor: dominantColor,
                        boxShadow: `0 0 12px ${dominantColor}`
                      }}
                    />
                  </div>
                  <div className="flex justify-between text-[11px] text-[#a0a0a0] font-bold tracking-widest mt-3">
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

                    <div className="space-y-3 relative z-10 pb-4">
                      {queue.map((song, qi) => (
                        <div
                          key={song.id}
                          onClick={() => playSong(song, true)}
                          className="flex items-center gap-3 p-1.5 rounded-xl cursor-pointer transition-all hover:bg-white/5 active:scale-[0.98]"
                        >
                          <div className="relative w-11 h-11 min-w-[44px] rounded-xl overflow-hidden bg-[#2a2a2a] shrink-0 shadow-sm">
                            <img src={song.thumbnail} alt={song.title} className="w-full h-full object-cover" />
                            <div className="absolute top-0.5 left-0.5 bg-black/70 text-white text-[8px] font-black px-1.5 py-0.5 rounded-full leading-tight">{qi + 1}</div>
                          </div>
                          <div className="flex-1 overflow-hidden">
                            <h4 className="font-semibold text-white text-[13px] truncate leading-snug">{cleanTitle(song.title)}</h4>
                            <div className="flex items-center gap-2 mt-0.5">
                              <p className="text-[11px] text-[#a0a0a0] truncate">{song.artist?.replace(/ - Topic| VEVO/gi, '') || 'Unknown'}</p>
                              {song.durationSeconds > 0 && (
                                <span className="text-[10px] text-white/25 shrink-0 font-mono">{Math.floor(song.durationSeconds / 60)}:{String(song.durationSeconds % 60).padStart(2, '0')}</span>
                              )}
                            </div>
                          </div>
                          <button
                            onClick={(e) => { e.stopPropagation(); setQueue(prev => prev.filter(q => q.id !== song.id)); }}
                            className="p-2 text-gray-600 hover:text-red-400 transition-colors shrink-0"
                          >
                            <X size={13} />
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

        {/* PREMIUM MOBILE MINI PLAYER (Floating Control with sleek Glassmorphism) */}
        {currentSong && activeTab !== 'Music' && (
          <div
            onClick={() => setActiveTab('Music')}
            className="absolute left-3 right-3 bg-black/50 backdrop-blur-2xl rounded-[20px] p-2 flex items-center gap-3 border border-white/10 shadow-[0_20px_40px_rgba(0,0,0,0.6)] z-40 cursor-pointer animate-slide-up overflow-hidden group"
            style={{ bottom: 'calc(5.5rem + env(safe-area-inset-bottom))' }}
          >
            {/* Mini Progress Bar Line at bottom */}
            <div className="absolute bottom-0 left-0 h-[2px] bg-white/20 w-full">
              <div
                className="h-full bg-[#8cd92b] transition-all duration-200"
                style={{ width: `${(progress / (duration || 1)) * 100}%`, boxShadow: '0 0 10px #8cd92b' }}
              />
            </div>

            <div className="relative w-12 h-12 shrink-0 transition-transform active:scale-95">
              <img src={currentSong.thumbnail} alt="" className={`w-full h-full rounded-[14px] object-cover shadow-md ${isPlaying ? 'animate-slow-pulse' : ''}`} />
            </div>

            <div className="flex-1 overflow-hidden py-1">
              <h4 className="text-white text-[13px] font-bold truncate leading-tight drop-shadow-md">{cleanTitle(currentSong.title)}</h4>
              <p className="text-[10px] text-white/50 truncate mt-0.5 drop-shadow-sm">{currentSong.artist?.replace(/ - Topic| VEVO/gi, '')}</p>
            </div>

            <div className="flex items-center gap-2 shrink-0 pr-2">
              <button onClick={(e) => { e.stopPropagation(); togglePlay(); }} className="w-10 h-10 flex items-center justify-center bg-white rounded-full text-black hover:scale-105 active:scale-90 transition-all shadow-lg" >
                {isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="ml-0.5" />}
              </button>
              <button onClick={(e) => { e.stopPropagation(); playNext(); }} className="w-8 h-8 flex items-center justify-center text-white/80 hover:text-white transition-all active:scale-75">
                <SkipForward size={20} fill="currentColor" />
              </button>
            </div>
          </div>
        )}

        {/* SHARE CARD / INSTA STORY GENERATOR MODAL */}
        {showShareCard && currentSong && (
          <div className="absolute inset-0 z-[100] bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-6 animate-fade-in">
            <button onClick={() => setShowShareCard(false)} className="absolute top-12 right-6 p-3 bg-white/10 rounded-full text-white active:scale-90 transition-all">
              <X size={24} />
            </button>
            <h2 className="text-white text-xl font-bold mb-6">Share to Story</h2>

            {/* The Actual Rendered Card */}
            <div
              ref={shareCardRef}
              className="w-full max-w-[320px] aspect-[9/16] rounded-[32px] relative overflow-hidden shadow-2xl bg-[#121212] flex flex-col border border-white/20"
            >
              <img src={getHighResImage(currentSong.thumbnail)} alt="bg" className="absolute inset-0 w-full h-full object-cover opacity-60 blur-2xl scale-[1.5]" />
              <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/60 to-[#121212]" />

              <div className="relative z-10 flex-1 flex flex-col items-center justify-center p-8 text-center mt-10">
                <img src={getHighResImage(currentSong.thumbnail)} alt="cover" className="w-[200px] h-[200px] rounded-2xl shadow-2xl mb-8 object-cover border border-white/10" />
                <h3 className="text-white font-black text-2xl leading-tight mb-2 drop-shadow-md">{currentSong.title}</h3>
                <p className="text-white/70 font-bold text-sm mb-4">{currentSong.artist}</p>
                <div className="w-full h-1 bg-white/20 rounded-full mt-4 overflow-hidden">
                  <div className="w-1/2 h-full bg-[#8cd92b]"></div>
                </div>
              </div>

              <div className="relative z-10 shrink-0 p-8 pt-0 flex flex-col items-center">
                <div className="flex items-center gap-2 mb-2">
                  <img src="/logo.png" alt="logo" className="w-8 h-8 rounded-lg" />
                  <span className="text-white font-black text-xl italic tracking-tighter">ISAI</span>
                </div>
                <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest">Listen exclusively on Play Infinity</p>
              </div>
            </div>

            <button
              onClick={handleDownloadShareCard}
              className="mt-8 bg-gradient-to-r from-purple-500 to-[#8cd92b] text-black font-black text-lg py-4 px-10 rounded-full flex items-center gap-3 shadow-[0_10px_30px_rgba(140,217,43,0.3)] active:scale-95 transition-all"
            >
              <Camera size={24} /> Save to Gallery
            </button>
            <p className="text-white/50 text-[11px] font-bold mt-4">Downloads image so you can upload to WhatsApp/Insta</p>
          </div>
        )}

        {/* Bottom Navigation */}
        <div className="absolute bottom-0 w-full h-[calc(5rem+env(safe-area-inset-bottom))] bg-[#121422]/95 backdrop-blur-xl border-t border-[#262837]/50 flex items-center justify-around px-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] rounded-none z-10 shadow-[0_-10px_30px_rgba(0,0,0,0.3)]">
          <button onClick={() => setActiveTab('Home')} className={`flex flex-col items-center justify-center gap-1.5 transition-all w-16 h-12 rounded-xl active:scale-90 active:opacity-70 ${activeTab === 'Home' ? 'text-[#8cd92b]' : 'text-gray-500'}`}>
            <Home size={20} />
            {activeTab === 'Home' && <span className="w-1 h-1 rounded-full bg-[#8cd92b] animate-pulse"></span>}
          </button>

          <button onClick={() => setActiveTab('Discover')} className={`flex flex-col items-center justify-center gap-1.5 transition-all w-16 h-12 rounded-xl active:scale-90 active:opacity-70 ${activeTab === 'Discover' ? 'text-[#ff4500]' : 'text-gray-500'}`}>
            <Flame size={20} />
            {activeTab === 'Discover' && <span className="w-1 h-1 rounded-full bg-[#ff4500] animate-pulse"></span>}
          </button>

          <button onClick={() => setActiveTab('Search')} className={`flex flex-col items-center justify-center gap-1.5 transition-all w-16 h-12 rounded-xl active:scale-90 active:opacity-70 ${activeTab === 'Search' ? 'text-[#8cd92b]' : 'text-gray-500'}`}>
            <Search size={20} />
            {activeTab === 'Search' && <span className="w-1 h-1 rounded-full bg-[#8cd92b] animate-pulse"></span>}
          </button>

          <button onClick={() => setActiveTab('Profile')} className={`flex flex-col items-center justify-center gap-1.5 transition-all w-16 h-12 rounded-xl active:scale-90 active:opacity-70 ${activeTab === 'Profile' ? 'text-[#22c7b5]' : 'text-gray-500'}`}>
            <User size={20} />
            {activeTab === 'Profile' && <span className="w-1 h-1 rounded-full bg-[#22c7b5] animate-pulse"></span>}
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
