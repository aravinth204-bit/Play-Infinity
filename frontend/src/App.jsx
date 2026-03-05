import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
// Build ID: 2026-03-03-2225 (Vercel Fix)
import ReactPlayer from 'react-player';
import { Home, Music, Search, User, Play, Pause, SkipBack, SkipForward, Heart, MoreHorizontal, ArrowLeft, Shuffle, Repeat, Upload, List, Headphones, Book, Download, Clock, Settings, LogOut, Bell, ChevronRight, ChevronUp, Plus, X, FolderPlus, Mic2 } from 'lucide-react';
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

// Global audio element for background play
const backgroundAudio = typeof window !== 'undefined' ? new Audio() : null;
if (backgroundAudio) {
  backgroundAudio.id = "play-infinity-core-audio";
  backgroundAudio.style.display = 'none';
  backgroundAudio.setAttribute('playsinline', 'true');
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
      className="flex items-center gap-4 hover:bg-[#1a1c2a] p-3 rounded-2xl cursor-pointer transition-all border border-transparent hover:border-[#262837]"
    >
      {index != null && (
        <span className="text-gray-500 font-bold text-sm w-6 text-center opacity-70">{String(index + 1).padStart(2, '0')}</span>
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
  const sleepTimerRef = useRef(null);

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
    setFavorites(prev => {
      const exists = prev.some(s => s.id === song.id);
      if (exists) return prev.filter(s => s.id !== song.id);
      return [song, ...prev].slice(0, 100);
    });
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
  };

  const addToPlaylist = (playlistId, song) => {
    setPlaylists(prev => prev.map(p => {
      if (p.id === playlistId) {
        if (p.songs.some(s => s.id === song.id)) return p;
        return { ...p, songs: [song, ...p.songs] };
      }
      return p;
    }));
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
        const cached = sessionStorage.getItem('trendingSongs');
        if (cached) {
          setTrendingSongs(JSON.parse(cached));
          return;
        }
        const apiEndpoint = `https://play-infinity.vercel.app/api/search`;
        // Search for Tamil audio songs
        const res = await fetch(`${apiEndpoint}?q=${encodeURIComponent('tamil hit songs audio')}`);
        const data = await res.json();
        let songsList = Array.isArray(data) ? data : (data.videos || []);

        // Stricter filtering for trending (also block short duration like less than 60s if possible, or heavily rely on titles)
        songsList = songsList.filter(s => {
          const title = s.title.toLowerCase();
          return !title.includes('jukebox') && !title.includes('collections') && !title.includes('mashup') && !title.includes('nonstop') && !title.includes('full album') && !title.includes('short') && !title.includes('whatsapp status');
        });

        const shuffled = songsList.sort(() => 0.5 - Math.random()).slice(0, 20);
        setTrendingSongs(shuffled);
        sessionStorage.setItem('trendingSongs', JSON.stringify(shuffled));
      } catch (err) {
        console.error("Fetch trending error:", err);
        // Show error for debugging in development/APK
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

      // Strict filter for single songs only, ban shorts/reels/news words
      results = results.filter(s => {
        const t = s.title.toLowerCase();
        return !t.includes('jukebox') && !t.includes('mashup') && !t.includes('collection') && !t.includes('nonstop') && !t.includes('full album') && !t.includes('#short') && !t.includes('status') && !t.includes('news') && !t.includes('teaser') && !t.includes('trailer') && !t.includes('karaoke');
      });

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
    setCurrentSong(song);
    setIsPlaying(true);
    setActiveTab('Music');
    setUseIframeFallback(false);

    sessionPlayedIds.current.add(song.id);
    addPlayedTitleTokens(song.title);

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
        album: 'Play Infinity',
        artwork: [
          { src: currentSong.thumbnail, sizes: '96x96', type: 'image/jpeg' },
          { src: currentSong.thumbnail, sizes: '128x128', type: 'image/jpeg' },
          { src: currentSong.thumbnail, sizes: '256x256', type: 'image/jpeg' },
          { src: currentSong.thumbnail, sizes: '512x512', type: 'image/jpeg' },
        ]
      });

      try {
        navigator.mediaSession.setActionHandler('play', () => {
          setIsPlaying(true);
          silentAudioRef.current?.play().catch(() => { });
        });
        navigator.mediaSession.setActionHandler('pause', () => {
          setIsPlaying(false);
          silentAudioRef.current?.pause();
        });
        navigator.mediaSession.setActionHandler('previoustrack', () => {
          if (playPrevRef.current) playPrevRef.current();
        });
        navigator.mediaSession.setActionHandler('nexttrack', () => {
          if (playNextRef.current) playNextRef.current();
        });
        navigator.mediaSession.setActionHandler('seekto', (details) => {
          if (playerRef.current) {
            playerRef.current.seekTo(details.seekTime, "seconds");
          }
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
    if (silentAudioRef.current) {
      if (isPlaying) {
        silentAudioRef.current.play().catch(() => { });
      } else {
        silentAudioRef.current.pause();
      }
    }
    if ('mediaSession' in navigator) {
      navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
    }
  }, [isPlaying]);

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
  }, []);

  useEffect(() => {
    if (!backgroundAudio) return;
    if (isPlaying && !useIframeFallback) {
      backgroundAudio.play().catch(e => console.error("Play failed", e));
    } else {
      backgroundAudio.pause();
    }
  }, [isPlaying, useIframeFallback]);

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



        {/* Mobile Main Content Area */}
        {activeTab !== 'Music' && (
          <div className="flex-1 overflow-y-auto no-scrollbar pb-20">
            {/* HOME VIEW */}
            {activeTab === 'Home' && (
              <div className="p-4 pt-10 overflow-x-hidden" style={{ background: 'linear-gradient(to bottom, #1e1e1e 0%, #121212 250px)' }}>
                {/* Top Header */}
                <div className="flex items-center gap-3 mb-6 relative z-10">
                  <div onClick={() => setActiveTab('Search')} className="w-8 h-8 rounded-full bg-[#f8a4bc] text-black flex items-center justify-center font-bold text-sm shrink-0 shadow-md">
                    A
                  </div>
                  <div className="flex gap-2 overflow-x-auto no-scrollbar py-1">
                    <button className="px-4 py-1.5 bg-[#1ed760] text-black rounded-full text-sm font-semibold shrink-0">All</button>
                    <button className="px-4 py-1.5 bg-[#2a2a2a] text-white rounded-full text-sm font-medium shrink-0 hover:bg-[#3e3e3e]">Music</button>
                    <button className="px-4 py-1.5 bg-[#2a2a2a] text-white rounded-full text-sm font-medium shrink-0 hover:bg-[#3e3e3e]">Podcasts</button>
                  </div>
                </div>

                {/* Grid Section */}
                <div className="grid grid-cols-2 gap-2 mb-8 relative z-10">
                  <div onClick={() => setActiveTab('Favorites')} className="flex items-center bg-[#2a2a2a]/80 backdrop-blur-sm rounded-md overflow-hidden cursor-pointer hover:bg-[#3e3e3e]/80 transition-colors h-14 shadow-sm">
                    <div className="w-14 h-14 bg-gradient-to-br from-[#4b22c7] to-[#8d8dec] shrink-0 flex items-center justify-center">
                      <Heart size={20} fill="white" className="text-white relative top-0.5" />
                    </div>
                    <p className="px-2.5 text-xs font-bold text-white line-clamp-2 leading-tight">Liked Songs</p>
                  </div>
                  {fallbackSongs.slice(1, 8).map((song, i) => (
                    <div key={i} onClick={() => playSong(song)} className="flex items-center bg-[#2a2a2a]/80 backdrop-blur-sm rounded-md overflow-hidden cursor-pointer hover:bg-[#3e3e3e]/80 transition-colors h-14 shadow-sm">
                      <img src={song.thumbnail} alt="" className="w-14 h-14 object-cover shrink-0" />
                      <p className="px-2.5 text-[11px] font-bold text-white line-clamp-2 leading-tight">{song.title}</p>
                    </div>
                  ))}
                </div>

                {/* Jump back in */}
                <h2 className="text-xl font-bold text-white mb-4 pl-1">Jump back in</h2>
                <div className="flex overflow-x-auto gap-4 no-scrollbar pb-8 mb-2 pl-1">
                  {(searchHistory.length > 0 ? searchHistory : fallbackSongs.slice(8, 14)).map((song, i) => (
                    <div key={`jump-${i}`} onClick={() => playSong(song)} className="flex flex-col w-[120px] shrink-0 cursor-pointer group">
                      <div className="relative w-[120px] h-[120px] mb-3">
                        <img src={song.thumbnail} alt="" className="w-full h-full object-cover rounded-md shadow-[0_8px_24px_rgba(0,0,0,0.5)] bg-[#262837]" />
                        <div className="absolute top-2 left-2 text-[#8cd92b]">
                          <img src="/logo.jpg" className="w-5 h-5 rounded-full object-cover" alt="icon" />
                        </div>
                      </div>
                      <span className="text-white text-[12px] font-semibold truncate">{song.title}</span>
                      <span className="text-[#a0a0a0] text-[11px] line-clamp-2 mt-1 leading-snug">{song.artist}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* FAVORITES VIEW */}
            {activeTab === 'Favorites' && (
              <div className="overflow-x-hidden min-h-screen bg-[#121212]">
                <div className="px-5 pt-12 pb-6 flex flex-col justify-end" style={{ background: 'linear-gradient(to bottom, #4f338d 0%, #2b1d4c 100%)' }}>
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

            {/* SEARCH VIEW */}
            {activeTab === 'Search' && (
              <div className="p-4 pt-10 flex flex-col h-full bg-[#121212]">
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

                <div className="flex-1 overflow-y-auto no-scrollbar pb-24">
                  {loading ? (
                    <div className="flex items-center justify-center py-20">
                      <div className="w-8 h-8 border-2 border-[#8cd92b] border-t-transparent rounded-full animate-spin"></div>
                    </div>
                  ) : (
                    <>
                      <h3 className="text-sm font-bold text-white/60 mb-4 px-1 lowercase tracking-wider">
                        {songs.length > 0 ? "Top Results" : "Suggestions for you"}
                      </h3>
                      <div className="space-y-1">
                        {(songs.length > 0 ? songs : displaySongs).map((song) => (
                          <div key={song.id} onClick={() => playSong(song)} className="flex items-center gap-3 p-2 hover:bg-[#ffffff0a] rounded-md cursor-pointer transition-colors">
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
          <div className="flex flex-col flex-1 bg-[#121212] relative h-full">
            {/* Gradient Background tied to Album Art */}
            <div
              className="absolute inset-0 z-0 opacity-40 blur-[80px] scale-125 pointer-events-none"
              style={{ backgroundImage: currentSong ? `url(${currentSong.thumbnail})` : 'none', backgroundSize: 'cover', backgroundPosition: 'center' }}
            ></div>
            <div className="absolute inset-0 bg-[#121212]/60 z-0 pointer-events-none"></div>

            {/* Header */}
            <div className="flex items-center justify-between p-5 pt-10 z-10 relative">
              <button onClick={() => setActiveTab('Home')} className="p-2 -ml-2 text-white/70 hover:text-white transition-colors">
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
                <div className={`mt-6 mb-2 w-[min(310px,75vw)] aspect-square relative mx-auto rounded-3xl overflow-hidden shadow-[0_30px_60px_rgba(0,0,0,0.7)] bg-[#1a1c2a] shrink-0 border border-[#ffffff0a] transition-all duration-1000 ${isPlaying ? 'animate-slow-pulse scale-[1.02]' : 'scale-100'}`}>
                  <img
                    src={currentSong.thumbnail}
                    alt="Cover"
                    className="w-full h-full object-cover block absolute inset-0 z-0"
                    onError={(e) => { e.target.src = '/logo.jpg'; }}
                  />

                  {/* Equalizer Overlay - Small and Subtle */}
                  <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/90 via-black/40 to-transparent flex items-end justify-center gap-1 px-10 pb-4 z-10 pointer-events-none">
                    {[...Array(20)].map((_, i) => {
                      const durationAnim = 0.4 + (i % 3) * 0.2;
                      const delayAnim = (i % 4) * 0.1;
                      return (
                        <div key={i} className={`flex-1 max-w-[4px] rounded-full bg-[#8cd92b] transition-all duration-500 ${isPlaying ? 'opacity-100' : 'opacity-30'}`}
                          style={{
                            height: isPlaying ? '40%' : '15%',
                            animation: isPlaying ? `eq ${durationAnim}s ease-in-out infinite ${delayAnim}s alternate` : 'none'
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
                    <div className={`h-full rounded-full absolute top-0 left-0 transition-all duration-300 pointer-events-none ${isPlaying ? 'progress-glow' : 'bg-white/60'}`} style={{ width: `${(progress / (duration || 1)) * 100}%` }}></div>
                  </div>
                  <div className="flex justify-between text-[11px] text-[#a0a0a0] font-bold tracking-widest">
                    <span>{formatTime(progress)}</span>
                    <span>{formatTime(duration)}</span>
                  </div>
                </div>

                {/* Controls */}
                <div className="flex items-center justify-between w-full max-w-[340px] mt-4 mb-8">
                  <button className="text-[#1ed760] hover:text-white transition-colors p-2"><Shuffle size={20} /></button>
                  <button onClick={playPrev} className="text-white hover:text-white transition-colors p-2"><SkipBack size={32} fill="currentColor" /></button>

                  <button
                    onClick={togglePlay}
                    className="w-[68px] h-[68px] flex items-center justify-center bg-white rounded-full text-black hover:scale-105 transition-all shadow-md"
                  >
                    {isPlaying ? <Pause size={30} fill="currentColor" /> : <Play size={30} fill="currentColor" className="ml-1" />}
                  </button>

                  <button onClick={playNext} className="text-white hover:text-white transition-colors p-2"><SkipForward size={32} fill="currentColor" /></button>
                  <button className="text-[#a0a0a0] hover:text-white transition-colors p-2"><Repeat size={20} /></button>
                </div>

                {/* Bottom Tool Bar */}
                <div className="flex items-center justify-between w-full max-w-[340px] px-2 mb-8">
                  <button onClick={() => setShowSleepModal(true)} className={`transition-colors ${sleepMinutesLeft > 0 ? 'text-[#1ed760]' : 'text-[#a0a0a0] hover:text-white'}`}>
                    <Clock size={20} />
                  </button>
                  <div className="flex gap-4">
                    <button className="text-[#a0a0a0] hover:text-white transition-colors"><Upload size={20} /></button>
                    <button className="text-[#a0a0a0] hover:text-white transition-colors"><List size={20} /></button>
                  </div>
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
            <div className="relative shrink-0">
              <img src={currentSong.thumbnail} alt="" className={`w-11 h-11 rounded-lg object-cover ${isPlaying ? 'animate-slow-pulse' : ''} border border-white/10`} />
              {isPlaying && (
                <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-[#8cd92b] rounded-full flex items-center justify-center border-2 border-[#121422]">
                  <div className="w-1.5 h-1.5 bg-[#121422] rounded-full animate-ping"></div>
                </div>
              )}
            </div>

            <div className="flex-1 overflow-hidden">
              <h4 className="text-white text-[13px] font-bold truncate leading-tight">{currentSong.title}</h4>
              <p className="text-[10px] text-white/50 truncate mt-0.5">{currentSong.artist}</p>
            </div>

            <div className="flex items-center gap-2 shrink-0 px-1">
              <button
                onClick={(e) => { e.stopPropagation(); playPrev(); }}
                className="p-2 text-white/70 hover:text-white transition-colors"
              >
                <SkipBack size={18} fill="currentColor" />
              </button>

              <button
                onClick={(e) => { e.stopPropagation(); togglePlay(); }}
                className="w-10 h-10 flex items-center justify-center bg-white rounded-full text-black shadow-lg shadow-white/10 hover:scale-105 active:scale-95 transition-all"
              >
                {isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="ml-0.5" />}
              </button>

              <button
                onClick={(e) => { e.stopPropagation(); playNext(); }}
                className="p-2 text-white/70 hover:text-white transition-colors"
              >
                <SkipForward size={18} fill="currentColor" />
              </button>
            </div>
          </div>
        )}

        {/* Bottom Navigation */}
        <div className="absolute bottom-0 w-full h-20 bg-[#121422]/95 backdrop-blur-xl border-t border-[#262837]/50 flex items-center justify-around px-2 pb-2 rounded-none z-10 shadow-[0_-10px_30px_rgba(0,0,0,0.3)]">
          <button onClick={() => setActiveTab('Home')} className={`flex flex-col items-center justify-center gap-1.5 transition-colors w-16 h-12 rounded-xl ${activeTab === 'Home' ? 'text-[#8cd92b]' : 'text-gray-500'}`}>
            <Home size={20} />
            {activeTab === 'Home' && <span className="w-1 h-1 rounded-full bg-[#8cd92b]"></span>}
          </button>

          <button onClick={() => setActiveTab('Search')} className={`flex flex-col items-center justify-center gap-1.5 transition-colors w-16 h-12 rounded-xl ${activeTab === 'Search' ? 'text-[#8cd92b]' : 'text-gray-500'}`}>
            <Search size={20} />
            {activeTab === 'Search' && <span className="w-1 h-1 rounded-full bg-[#8cd92b]"></span>}
          </button>

          <button onClick={() => setActiveTab('Favorites')} className={`flex flex-col items-center justify-center gap-1.5 transition-colors w-16 h-12 rounded-xl ${activeTab === 'Favorites' ? 'text-[#8cd92b]' : 'text-gray-500'}`}>
            <Heart size={20} fill={activeTab === 'Favorites' ? 'currentColor' : 'none'} />
            {activeTab === 'Favorites' && <span className="w-1 h-1 rounded-full bg-[#8cd92b]"></span>}
          </button>

          <button onClick={() => setActiveTab('Music')} className={`flex flex-col items-center justify-center gap-1.5 transition-colors w-16 h-12 rounded-xl ${activeTab === 'Music' ? 'text-[#8cd92b]' : 'text-gray-500'}`}>
            <Headphones size={20} />
            {activeTab === 'Music' && <span className="w-1 h-1 rounded-full bg-[#8cd92b]"></span>}
          </button>
        </div>

      </div >

      {/* App Container - Desktop Layout */}
      <div className="hidden md:flex w-full max-w-[1200px] h-[850px] max-h-[90vh] bg-[#121422] rounded-[36px] shadow-[0_20px_50px_rgba(0,0,0,0.5)] relative overflow-hidden text-[#a0a3b1]">
        {/* Left Sidebar */}
        <div className="w-64 bg-[#1a1c2a] flex flex-col pt-10 pb-8 px-8 border-r border-[#262837] shrink-0 z-10">
          <h1 className="text-2xl font-bold mb-10 text-white flex items-center gap-3">
            <img src="/logo.jpg" alt="Play Infinity" className="h-10 w-10 object-cover rounded-full" />
            <span className="text-[#8cd92b] tracking-wider text-xl">Play Infinity v2.2</span>
          </h1>
          <nav className="flex-1 space-y-5 overflow-y-auto no-scrollbar">
            <div className="flex items-center gap-4 text-white font-semibold cursor-pointer border-l-2 border-[#8cd92b] pl-2 -ml-2.5">
              <Music size={18} className="text-[#8cd92b]" /> <span className="text-sm">Playlist</span>
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
