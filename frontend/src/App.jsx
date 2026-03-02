import React, { useState, useRef, useEffect } from 'react';
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

export default function App() {
  const [activeTab, setActiveTab] = useState('Home');
  const [currentSong, setCurrentSong] = useState(null);
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
        const apiEndpoint = import.meta.env.DEV ? `/api/search` : `/.netlify/functions/search`;
        const res = await fetch(`${apiEndpoint}?q=tamil+latest+trending+hit+songs+video`);
        const data = await res.json();
        const shuffled = data.sort(() => 0.5 - Math.random()).slice(0, 20);
        setTrendingSongs(shuffled);
        sessionStorage.setItem('trendingSongs', JSON.stringify(shuffled));
      } catch (err) {
        console.error("Fetch trending error:", err);
      }
    };
    fetchTrending();
  }, []);

  const searchYoutube = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setLoading(true);
    try {
      // Fetch from our local dev proxy or netlify function
      const apiEndpoint = import.meta.env.DEV ? `/api/search` : `/.netlify/functions/search`;
      const res = await fetch(`${apiEndpoint}?q=${encodeURIComponent(searchQuery)}`);
      const data = await res.json();
      setSongs(data);
    } catch (err) {
      console.error(err);
      alert("Failed to search. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  const fetchQueue = async (song) => {
    setIsFetchingQueue(true);
    try {
      const apiEndpoint = import.meta.env.DEV ? `/api/search` : `/.netlify/functions/search`;

      const titleLower = song.title.toLowerCase();
      const searchLower = searchQuery.toLowerCase();

      // Vibe keyword detection
      const kuthuKeywords = ["kuthu", "dance", "mass", "folk", "fast", "dappankuthu", "seena thana", "appadi podu", "kalyana vayasu", "vaathi coming", "aaluma doluma", "verithanam", "machi open the bottle", "nakku mukka", "sodakku", "rowdy baby", "kutti story"];
      const melodyKeywords = ["love", "kadhal", "melody", "romantic", "bgm", "po nee po", "munbe vaa", "hosanna", "nenjukkul", "vaseegara", "minnale", "ilayaraja", "ar rahman", "thamarai", "kurumugil"];
      const sadKeywords = ["sad", "sogam", "pain", "broken", "kanneer", "feeling", "lonely"];

      let moodQuery = "";

      if (kuthuKeywords.some(w => searchLower.includes(w) || titleLower.includes(w))) {
        moodQuery = "tamil mass kuthu dance hit video songs";
      } else if (melodyKeywords.some(w => searchLower.includes(w) || titleLower.includes(w))) {
        moodQuery = "tamil melody love romantic hit video songs";
      } else if (sadKeywords.some(w => searchLower.includes(w) || titleLower.includes(w))) {
        moodQuery = "tamil sad feelings hit video songs";
      } else {
        let artist = song.artist?.replace(/ - Topic|VEVO/gi, '').split(',')[0].trim();
        if (artist && artist.toLowerCase() !== 'various artists' && artist.length > 2) {
          moodQuery = `${artist} super hit tamil video songs`;
        } else {
          const fallbacks = [
            "tamil mass kuthu dance hit video songs",
            "tamil melody love romantic hit video songs",
            "tamil trending latest hit video songs"
          ];
          moodQuery = fallbacks[Math.floor(Math.random() * fallbacks.length)];
        }
      }

      const res = await fetch(`${apiEndpoint}?q=${encodeURIComponent(moodQuery)}`);
      const data = await res.json();

      const getSignificantWords = (str) => {
        return str.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(' ')
          .filter(w => w.length > 3 && !['lyric', 'video', 'audio', 'song', 'songs', 'tamil', 'official', 'full', 'theme', 'topic'].includes(w));
      };

      const currentWords = getSignificantWords(song.title);

      const filteredQueue = data.filter(s => {
        if (s.id === song.id) return false;
        if (s.durationSeconds && s.durationSeconds > 420) return false;

        const lowerTitle = s.title.toLowerCase();

        const badWords = ["jukebox", "mashup", "news", "interview", "podcast", "vlog", "speech", "review", "reaction", "trailer", "teaser", "promo", "audio launch", "press", "telugu", "hindi", "malayalam", "kannada", "whatsapp status"];
        for (let word of badWords) {
          if (lowerTitle.includes(word)) return false;
        }

        const sWords = getSignificantWords(s.title);
        let matchCount = 0;
        for (let w of currentWords) {
          if (sWords.includes(w)) matchCount++;
        }

        // Prevent showing different versions (audio, lyric video) of the same song
        if (matchCount >= 2) return false;
        if (currentWords.length === 1 && matchCount === 1) return false;

        return true;
      });

      let newQueue = filteredQueue.length >= 10 ? filteredQueue : data.filter(s => s.id !== song.id && s.durationSeconds < 420).sort(() => 0.5 - Math.random()).slice(0, 30);

      setQueue(prevQueue => {
        const existingIds = new Set(prevQueue.map(s => s.id));
        existingIds.add(song.id);
        if (currentSong) existingIds.add(currentSong.id);

        sessionPlayedIds.current.forEach(id => existingIds.add(id));

        const filteredNew = newQueue.filter(s => !existingIds.has(s.id));
        return [...prevQueue, ...filteredNew].slice(0, 50);
      });
    } catch (err) {
      console.error(err);
    } finally {
      setIsFetchingQueue(false);
    }
  };

  const playSong = (song, fromQueue = false) => {
    setCurrentSong(song);
    setIsPlaying(true);
    setActiveTab('Music');
    sessionPlayedIds.current.add(song.id);

    setSearchHistory(prev => {
      const filtered = prev.filter(s => s.id !== song.id);
      return [song, ...filtered].slice(0, 20); // Keep last 20 songs
    });

    if (!fromQueue) {
      setQueue([]);
      fetchQueue(song);
    } else {
      setQueue(prev => prev.filter(s => s.id !== song.id));
      if (queue.length <= 15) {
        fetchQueue(song);
      }
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
      // Don't fall back to search results if queue is still loading
      return;
    } else if (songs.length > 0) {
      const idx = songs.findIndex(s => s.id === currentSong?.id);
      if (idx !== -1 && idx < songs.length - 1) {
        playSong(songs[idx + 1]);
      } else {
        playSong(songs[0]); // loop back
      }
    }
  };

  const playPrev = () => {
    if (songs.length === 0 && queue.length === 0) return;
    const idx = songs.findIndex(s => s.id === currentSong?.id);
    if (idx > 0) {
      playSong(songs[idx - 1]);
    } else if (songs.length > 0) {
      playSong(songs[0]);
    }
  };

  // Mobile Background Playback & MediaSession API Workaround
  const silentAudioRef = useRef(null);
  const playNextRef = useRef(playNext);
  const playPrevRef = useRef(playPrev);

  useEffect(() => {
    playNextRef.current = playNext;
    playPrevRef.current = playPrev;
  }, [playNext, playPrev]);

  useEffect(() => {
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

      navigator.mediaSession.setActionHandler('play', () => {
        setIsPlaying(true);
        silentAudioRef.current?.play();
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

      try {
        navigator.mediaSession.setActionHandler('seekbackward', () => {
          if (playerRef.current) {
            playerRef.current.seekTo(Math.max(playerRef.current.getCurrentTime() - 10, 0), "seconds");
          }
        });
        navigator.mediaSession.setActionHandler('seekforward', () => {
          if (playerRef.current) {
            playerRef.current.seekTo(playerRef.current.getCurrentTime() + 10, "seconds");
          }
        });
      } catch (error) {
        console.log("Seek actions not supported in this browser version.");
      }
    }
  }, [currentSong]);

  useEffect(() => {
    if (isPlaying && silentAudioRef.current) {
      silentAudioRef.current.play().catch(e => console.log('Silent audio play error:', e));
    } else if (!isPlaying && silentAudioRef.current) {
      silentAudioRef.current.pause();
    }
  }, [isPlaying]);

  const displaySongs = songs.length > 0
    ? songs
    : [...searchHistory, ...trendingSongs.filter(t => !searchHistory.some(h => h.id === t.id))].slice(0, 30);

  return (
    <div className="flex items-center justify-center bg-gray-900 overflow-hidden font-['Outfit']" style={{ height: '100vh' }}>

      {/* Invisible HTML5 Audio to keep browser session alive for iOS/Android Background playing */}
      <audio ref={silentAudioRef} loop src="data:audio/mp3;base64,//OwgAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAAFAAAH8AACBwYICQoLDA0ODxAREhMUFRYXGBkZGhscHR4fICEiIyQlJicpKSorLC0uLzAxMjM0NTY3ODk5Ojs8PT4/QEFCQ0RFRkdISUpLTE1OT1BRUlNUVVZXWFlbW1xdXl9gYWJjZGVmZ2hpamtc" />

      {/* Invisible YouTube Player */}
      {currentSong && (
        <div className="absolute top-[-9999px] left-[-9999px] w-[50px] h-[50px] opacity-0 pointer-events-none overflow-hidden">
          <ReactPlayer
            ref={playerRef}
            url={currentSong.url}
            playing={isPlaying}
            onProgress={handleProgress}
            onDuration={handleDuration}
            onEnded={playNext}
            volume={1}
            width="50px"
            height="50px"
            config={{
              youtube: {
                playerVars: {
                  autoplay: 1,
                  playsinline: 1, // Essential for iOS background
                  origin: window.location.origin
                }
              }
            }}
          />
        </div>
      )}

      {/* App Container - Mobile Layout (Dark Theme) */}
      <div className="w-[375px] h-[812px] bg-[#121422] rounded-[40px] shadow-[0_20px_50px_rgba(0,0,0,0.5)] relative overflow-hidden flex flex-col transform scale-95 md:hidden text-[#a0a3b1]">



        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto no-scrollbar pb-24">

          {/* HOME VIEW */}
          {activeTab === 'Home' && (
            <div className="p-6 pt-10">
              <div className="flex items-center justify-between mb-8 cursor-pointer">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-[#262837] rounded-full flex items-center justify-center text-gray-400">
                    <User size={24} />
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Welcome</p>
                    <h3 className="text-white font-bold">Login to Sync</h3>
                  </div>
                </div>
                <ChevronRight size={20} className="text-gray-500" />
              </div>

              <div className="flex gap-4 mb-8">
                <div onClick={() => setActiveTab('Playlists')} className="flex-1 bg-gradient-to-br from-[#1a1c2a] to-[#262837] p-4 rounded-2xl cursor-pointer shadow-md border border-[#262837]/50">
                  <List className="text-[#8cd92b] mb-2" size={24} />
                  <h3 className="text-white font-bold text-sm">Playlists</h3>
                  <p className="text-xs text-gray-500">{playlists.length} lists</p>
                </div>
                <div onClick={() => setActiveTab('Favorites')} className="flex-1 bg-gradient-to-br from-[#1a1c2a] to-[#262837] p-4 rounded-2xl cursor-pointer shadow-md border border-[#262837]/50">
                  <Heart className="text-[#8cd92b] mb-2" size={24} />
                  <h3 className="text-white font-bold text-sm">Favorites</h3>
                  <p className="text-xs text-gray-500">{favorites.length} songs</p>
                </div>
              </div>

              <div className="flex items-center justify-between mb-4 mt-2">
                <h3 className="text-xs uppercase tracking-wider font-bold text-gray-500 text-left">Recently Played</h3>
              </div>

              <div className="space-y-3 pb-6">
                {searchHistory.length > 0 ? searchHistory.slice(0, 5).map((song, idx) => (
                  <div
                    key={`hist-${song.id}-${idx}`}
                    onClick={() => playSong(song)}
                    className="flex items-center gap-3 bg-[#1a1c2a] hover:bg-[#262837] p-3 rounded-2xl cursor-pointer transition-all border border-transparent shadow-sm"
                  >
                    <img src={song.thumbnail} alt={song.title} className="w-14 h-14 rounded-[14px] object-cover shadow-sm" />
                    <div className="flex-1 overflow-hidden pr-2">
                      <h4 className="font-semibold text-white text-sm truncate">{song.title}</h4>
                      <p className="text-[11px] text-gray-500 truncate mt-0.5">{song.artist}</p>
                    </div>
                    <div className="w-8 h-8 rounded-full flex items-center justify-center transition-colors">
                      <AnimatedHeart size={16} isFavorite={favorites.some(s => s.id === song.id)} onClick={(e) => toggleFavorite(e, song)} />
                    </div>
                    <div onClick={(e) => { e.stopPropagation(); setShowPlaylistModal({ isOpen: true, songInfo: song }); }} className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-white transition-colors cursor-pointer shrink-0">
                      <MoreHorizontal size={18} />
                    </div>
                  </div>
                )) : (
                  <p className="text-xs text-gray-500 text-center py-6 bg-[#1a1c2a] rounded-2xl">No recent history.</p>
                )}
              </div>
            </div>
          )}

          {/* FAVORITES VIEW */}
          {activeTab === 'Favorites' && (
            <div className="p-6 pt-10">
              <h1 className="text-2xl font-bold text-white mb-2">Your<br /><span className="text-[#8cd92b]">Favorites <Heart className="inline mb-1" size={18} fill="currentColor" /></span></h1>
              <p className="text-xs text-gray-500 mb-8">{favorites.length} saved songs</p>

              <div className="space-y-3 pb-6">
                {favorites.length > 0 ? favorites.map((song, idx) => (
                  <div
                    key={`fav-${song.id}-${idx}`}
                    onClick={() => playSong(song)}
                    className="flex items-center gap-3 bg-[#1a1c2a] hover:bg-[#262837] p-3 rounded-2xl cursor-pointer transition-all border border-transparent shadow-sm"
                  >
                    <img src={song.thumbnail} alt={song.title} className="w-14 h-14 rounded-[14px] object-cover shadow-sm" />
                    <div className="flex-1 overflow-hidden pr-2">
                      <h4 className="font-semibold text-white text-sm truncate">{song.title}</h4>
                      <p className="text-[11px] text-gray-500 truncate mt-0.5">{song.artist}</p>
                    </div>
                    <div className="w-8 h-8 rounded-full flex items-center justify-center transition-colors">
                      <AnimatedHeart size={16} isFavorite={true} onClick={(e) => toggleFavorite(e, song)} />
                    </div>
                    <div onClick={(e) => { e.stopPropagation(); setShowPlaylistModal({ isOpen: true, songInfo: song }); }} className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-white transition-colors cursor-pointer shrink-0">
                      <MoreHorizontal size={18} />
                    </div>
                  </div>
                )) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-center opacity-40 py-20">
                    <Heart size={32} className="text-[#8cd92b] mb-4" />
                    <p className="text-sm">No favorites yet.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* PLAYLISTS VIEW */}
          {activeTab === 'Playlists' && (
            <div className="p-6 pt-10">
              <h1 className="text-2xl font-bold text-white mb-2">Your<br /><span className="text-[#8cd92b]">Playlists <List className="inline mb-1" size={18} /></span></h1>
              <p className="text-xs text-gray-500 mb-8">{playlists.length} collections</p>

              {/* Add New Playlist */}
              <div className="flex items-center gap-3 mb-6 bg-[#1a1c2a] p-3 rounded-2xl border border-[#262837]/50">
                <div className="w-12 h-12 bg-[#262837] rounded-xl flex items-center justify-center text-white shrink-0">
                  <Plus size={20} />
                </div>
                <div className="flex-1 relative">
                  <input
                    type="text"
                    value={newPlaylistName}
                    onChange={(e) => setNewPlaylistName(e.target.value)}
                    placeholder="New Playlist Name"
                    className="w-full bg-transparent text-sm text-white font-medium outline-none placeholder-gray-500 pr-10"
                    onKeyDown={(e) => e.key === 'Enter' && createPlaylist()}
                  />
                </div>
                {newPlaylistName.trim() && (
                  <button onClick={createPlaylist} className="px-3 py-1.5 bg-[#8cd92b] text-[#121422] rounded-lg text-xs font-bold">Add</button>
                )}
              </div>

              <div className="space-y-3 pb-6">
                {playlists.map((pl) => (
                  <div
                    key={pl.id}
                    onClick={() => {
                      setCurrentViewPlaylist(pl);
                      setActiveTab('PlaylistDetails');
                    }}
                    className="flex items-center gap-4 bg-[#1a1c2a] hover:bg-[#262837] p-4 rounded-2xl cursor-pointer transition-all border border-transparent shadow-sm"
                  >
                    <div className="w-14 h-14 bg-[#262837] rounded-xl flex items-center justify-center text-[#8cd92b] shrink-0">
                      {pl.isAuto ? <Music size={24} /> : <FolderPlus size={24} />}
                    </div>
                    <div className="flex-1 overflow-hidden pr-2">
                      <h4 className="font-semibold text-white text-sm truncate">{pl.name}</h4>
                      <p className="text-[11px] text-gray-500 truncate mt-0.5">{pl.isAuto ? 'Auto-generated' : 'Custom'} • {pl.songs.length} songs</p>
                    </div>
                    <ChevronRight size={16} className="text-gray-500" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* PLAYLIST DETAILS VIEW */}
          {activeTab === 'PlaylistDetails' && currentViewPlaylist && (
            <div className="flex flex-col h-full min-h-[500px]">
              <div className="p-6 pt-10 pb-4 flex items-center gap-4 border-b border-[#262837]/50">
                <button onClick={() => setActiveTab('Playlists')} className="w-8 h-8 flex items-center justify-center bg-[#1a1c2a] hover:bg-[#262837] rounded-full text-white transition-colors">
                  <ArrowLeft size={16} />
                </button>
                <div className="flex-1 overflow-hidden">
                  <h2 className="text-lg font-bold text-white truncate">{currentViewPlaylist.name}</h2>
                  <p className="text-xs text-[#8cd92b]">{currentViewPlaylist.songs.length} songs</p>
                </div>
                {currentViewPlaylist.songs.length > 0 && (
                  <button onClick={() => {
                    setQueue(currentViewPlaylist.songs);
                    playSong(currentViewPlaylist.songs[0], true);
                  }} className="w-10 h-10 flex items-center justify-center bg-[#8cd92b] text-[#121422] rounded-full pl-0.5 shadow-md">
                    <Play size={18} fill="currentColor" />
                  </button>
                )}
              </div>

              <div className="flex-1 overflow-y-auto p-6 pt-2 pb-10 space-y-3">
                {currentViewPlaylist.songs.length > 0 ? currentViewPlaylist.songs.map((song, idx) => (
                  <div
                    key={`${currentViewPlaylist.id}-${song.id}-${idx}`}
                    onClick={() => playSong(song)}
                    className="flex items-center gap-3 bg-[#1a1c2a] hover:bg-[#262837] p-3 rounded-2xl cursor-pointer transition-all border border-transparent shadow-sm"
                  >
                    <img src={song.thumbnail} alt={song.title} className="w-14 h-14 rounded-[14px] object-cover shadow-sm" />
                    <div className="flex-1 overflow-hidden pr-2">
                      <h4 className="font-semibold text-white text-sm truncate">{song.title}</h4>
                      <p className="text-[11px] text-gray-500 truncate mt-0.5">{song.artist}</p>
                    </div>
                    <div className="w-8 h-8 rounded-full flex items-center justify-center transition-colors">
                      <AnimatedHeart size={16} isFavorite={favorites.some(s => s.id === song.id)} onClick={(e) => toggleFavorite(e, song)} />
                    </div>
                    <div onClick={(e) => { e.stopPropagation(); setShowPlaylistModal({ isOpen: true, songInfo: song }); }} className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-white transition-colors cursor-pointer shrink-0">
                      <MoreHorizontal size={18} />
                    </div>
                  </div>
                )) : (
                  <div className="flex flex-col items-center justify-center opacity-40 py-20">
                    <List size={32} className="text-gray-500 mb-4" />
                    <p className="text-sm">Playlist is empty</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* SEARCH VIEW */}
          {activeTab === 'Search' && (
            <div className="p-6 pt-10">
              <p className="text-xs text-gray-400 uppercase tracking-widest pl-1 mb-1 font-semibold flex items-center gap-2"><span className="w-2 h-[2px] bg-[#8cd92b]"></span> Discover</p>
              <h1 className="text-2xl font-bold text-white mb-8 flex items-center gap-3">
                <img src="/logo.jpg" alt="Play Infinity" className="h-10 w-10 object-cover rounded-full" />
                <span>Play<br /><span className="text-[#8cd92b]">Infinity</span></span>
              </h1>

              <form onSubmit={searchYoutube} className="mb-8">
                <div className="relative">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search Song..."
                    className="w-full bg-[#1a1c2a] px-5 py-4 pl-12 rounded-2xl outline-none focus:ring-1 focus:ring-[#8cd92b] shadow-sm text-white font-medium transition-all text-sm"
                  />
                  <Search className="absolute left-4 top-4 text-gray-500" size={18} />
                </div>
                <button type="submit" disabled={loading} className="w-full mt-3 bg-[#8cd92b] text-[#121422] font-bold py-3.5 rounded-2xl transition-all shadow-md flex justify-center items-center">
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-[#121422] border-t-transparent rounded-full animate-spin"></div>
                  ) : "Search"}
                </button>
              </form>

              <div className="flex items-center justify-between mb-4 mt-2">
                <h3 className="text-xs uppercase tracking-wider font-bold text-gray-500 text-left">
                  {songs.length > 0 ? "Searched List" : (searchHistory.length > 0 ? "Recent & Suggested" : "Suggested For You")}
                </h3>
                <span className="text-[10px] text-[#8cd92b]">See more</span>
              </div>

              <div className="space-y-3 pb-6">
                {displaySongs.map((song, idx) => (
                  <div
                    key={song.id}
                    onClick={() => playSong(song)}
                    className="flex items-center gap-3 bg-[#1a1c2a] hover:bg-[#262837] p-3 rounded-2xl cursor-pointer transition-all border border-transparent"
                  >
                    <img src={song.thumbnail} alt={song.title} className="w-14 h-14 rounded-[14px] object-cover shadow-sm" />
                    <div className="flex-1 overflow-hidden pr-2">
                      <h4 className="font-semibold text-white text-sm truncate">{song.title}</h4>
                      <p className="text-[11px] text-gray-500 truncate mt-0.5">{song.artist}</p>
                    </div>
                    <div className="w-8 h-8 rounded-full flex items-center justify-center transition-colors">
                      <AnimatedHeart size={16} isFavorite={favorites.some(s => s.id === song.id)} onClick={(e) => toggleFavorite(e, song)} />
                    </div>
                    <div onClick={(e) => { e.stopPropagation(); setShowPlaylistModal({ isOpen: true, songInfo: song }); }} className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-white transition-colors cursor-pointer shrink-0">
                      <MoreHorizontal size={18} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* NOW PLAYING VIEW */}
          {activeTab === 'Music' && (
            <div className="flex flex-col min-h-full">
              {/* Header */}
              <div className="flex items-center justify-between p-6 pt-10">
                <button onClick={() => setActiveTab('Search')} className="p-2 bg-[#1a1c2a] rounded-full hover:bg-[#262837] text-white transition-colors">
                  <ArrowLeft size={16} />
                </button>
                <div className="text-center text-[10px] tracking-[0.2em] uppercase text-white font-semibold">
                  NOW PLAYING
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setShowSleepModal(true)} className={`p-2 rounded-full transition-colors ${sleepMinutesLeft > 0 ? 'bg-[#8cd92b]/20 text-[#8cd92b]' : 'bg-[#1a1c2a] hover:bg-[#262837] text-gray-400'}`}>
                    <Clock size={16} />
                  </button>
                  <button className="p-2 bg-[#1a1c2a] rounded-full hover:bg-[#262837] text-gray-400 transition-colors">
                    <MoreHorizontal size={16} />
                  </button>
                </div>
              </div>

              {currentSong ? (
                <div className="flex-1 flex flex-col items-center px-8 relative pb-10">

                  {/* Album Art Square Banner */}
                  <div className={`mt-2 w-full aspect-square rounded-[40px] rounded-tl-[10px] rounded-br-[10px] overflow-hidden shadow-[0_20px_40px_rgba(0,0,0,0.5)] transition-transform duration-500 ${isPlaying ? 'scale-100' : 'scale-95'}`}>
                    <img
                      src={currentSong.thumbnail}
                      alt="Cover"
                      className="w-full h-full object-cover scale-105"
                    />
                  </div>

                  {/* Song Info */}
                  <div className="w-full mt-10 mb-8 flex justify-between items-end gap-2">
                    <div className="flex-1 overflow-hidden">
                      <h2 className="text-xl font-bold text-white truncate leading-tight">{currentSong.title}</h2>
                      <p className="text-[13px] text-gray-400 font-medium mt-1 truncate">{currentSong.artist || 'Unknown Artist'}</p>
                    </div>
                    <AnimatedHeart size={20} className="shrink-0 mb-1" isFavorite={favorites.some(s => s.id === currentSong.id)} onClick={(e) => toggleFavorite(e, currentSong)} />
                  </div>

                  {/* Visual Equalizer */}
                  <div className="w-full h-10 mb-4 flex items-end justify-center gap-[3px] overflow-hidden opacity-80">
                    {[...Array(40)].map((_, i) => {
                      const durationAnim = 0.5 + (i % 4) * 0.2;
                      const delayAnim = (i % 5) * 0.15 + (i % 3) * 0.1;
                      return (
                        <div key={i} className="flex-1 max-w-[4px] rounded-t-sm bg-gradient-to-t from-[#8cd92b]/40 to-[#8cd92b] transition-all"
                          style={{
                            height: isPlaying ? '100%' : '15%',
                            animation: isPlaying ? `eq ${durationAnim}s ease-in-out infinite ${delayAnim}s alternate` : 'none'
                          }}>
                        </div>
                      )
                    })}
                  </div>

                  {/* Progress Bar (Line) */}
                  <div className="w-full mb-8 relative">
                    <input
                      type="range" min={0} max={duration || 1} value={progress} onChange={handleSeek}
                      className="absolute top-0 w-full h-4 -mt-1.5 opacity-0 z-10 cursor-pointer"
                    />
                    <div className="w-full h-1 bg-[#262837] rounded-full overflow-hidden relative mb-2">
                      <div className="h-full bg-[#8cd92b] rounded-full absolute top-0 left-0 transition-all duration-300 pointer-events-none" style={{ width: `${(progress / (duration || 1)) * 100}%` }}></div>
                    </div>
                    <div className="flex justify-between text-[10px] text-gray-500 font-medium px-1">
                      <span>{formatTime(progress)}</span>
                      <span>{formatTime(duration)}</span>
                    </div>
                  </div>

                  {/* Controls */}
                  <div className="flex items-center justify-between w-full px-2">
                    <button className="text-gray-500 hover:text-white transition-colors"><Shuffle size={18} /></button>
                    <button onClick={playPrev} className="text-white hover:text-[#8cd92b] transition-colors"><SkipBack size={20} fill="currentColor" /></button>

                    <button
                      onClick={togglePlay}
                      className="w-16 h-16 flex items-center justify-center bg-[#8cd92b] rounded-full shadow-[0_10px_25px_rgba(247,148,29,0.3)] text-[#121422] hover:scale-105 transition-all"
                    >
                      {isPlaying ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" className="ml-1" />}
                    </button>

                    <button onClick={playNext} className="text-white hover:text-[#8cd92b] transition-colors"><SkipForward size={20} fill="currentColor" /></button>
                    <button className="text-gray-500 hover:text-white transition-colors"><Repeat size={18} /></button>
                  </div>

                  {/* Mobile Up Next Mini preview */}
                  <div className="mt-8 w-full flex-1 flex flex-col min-h-[50px]">
                    <div className="flex items-center justify-between text-[11px] tracking-wider uppercase text-gray-500 font-bold mb-3 z-10 relative shrink-0">
                      <span className="flex items-center gap-1.5"><List size={14} className="text-[#8cd92b]" /> Up Next</span>
                      {isFetchingQueue && <div className="w-3 h-3 border-2 border-[#8cd92b] border-t-transparent rounded-full animate-spin"></div>}
                    </div>

                    <div className="space-y-3 pb-8 relative z-10 overflow-y-auto no-scrollbar flex-1 max-h-[140px] scroll-smooth" style={{ WebkitOverflowScrolling: 'touch' }}>
                      {queue.map(song => (
                        <div
                          key={song.id}
                          onClick={() => playSong(song, true)}
                          className="flex items-center gap-3 bg-[#1a1c2a] hover:bg-[#262837] p-2 rounded-xl cursor-pointer transition-all border border-transparent shrink-0"
                        >
                          <img src={song.thumbnail} alt={song.title} className="w-10 h-10 rounded-lg object-cover min-w-[40px]" />
                          <div className="flex-1 overflow-hidden">
                            <h4 className="font-semibold text-white text-[11px] truncate">{song.title}</h4>
                            <p className="text-[9px] text-gray-500 truncate mt-0.5">{song.artist}</p>
                          </div>
                        </div>
                      ))}
                      {queue.length === 0 && !isFetchingQueue && (
                        <p className="text-xs text-center text-gray-600 mt-2">End of queue</p>
                      )}
                    </div>
                  </div>

                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center px-8 opacity-40">
                  <div className="w-32 h-32 bg-[#1a1c2a] rounded-full flex items-center justify-center mb-6">
                    <Music size={40} className="text-gray-500" />
                  </div>
                  <h3 className="text-lg font-bold text-white">No Track Selected</h3>
                </div>
              )}
            </div>
          )}
        </div>

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
                    {pl.songs.some(s => s.id === showPlaylistModal.songInfo?.id) && (
                      <span className="text-xs text-[#8cd92b] font-medium tracking-wide">Added</span>
                    )}
                  </div>
                ))}
                {playlists.filter(pl => !pl.isAuto).length === 0 && (
                  <div className="text-center py-8 opacity-50">
                    <List size={32} className="text-gray-500 mx-auto mb-3" />
                    <p className="text-xs text-gray-400">No custom playlists created yet.<br />Create one from the Playlists tab!</p>
                  </div>
                )}
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
                  <button
                    key={mins}
                    onClick={() => { setSleepTimer(mins); setShowSleepModal(false); }}
                    className="w-full flex items-center justify-between p-4 bg-[#262837]/50 hover:bg-[#262837] rounded-2xl text-white font-medium transition-colors border border-transparent hover:border-[#8cd92b]/50"
                  >
                    <span>{mins} Minutes</span>
                    {sleepTimer === mins && <span className="text-xs text-[#8cd92b]">Active</span>}
                  </button>
                ))}
                <button
                  onClick={() => { setSleepTimer(null); setShowSleepModal(false); }}
                  className="w-full flex items-center justify-center p-4 bg-[#262837]/50 hover:bg-red-500/20 hover:text-red-400 rounded-2xl text-gray-400 font-medium transition-colors mt-2"
                >
                  Off
                </button>
              </div>
              {sleepMinutesLeft > 0 && (
                <p className="text-center text-sm text-gray-400 mb-4">Music will stop in <span className="text-[#8cd92b] font-bold">{sleepMinutesLeft}</span> mins</p>
              )}
            </div>
          </div>
        )}

        {/* MOBILE MINI PLAYER */}
        {currentSong && activeTab !== 'Music' && (
          <div
            onClick={() => setActiveTab('Music')}
            className="absolute bottom-24 left-4 right-4 bg-[#1a1c2a] rounded-2xl p-2.5 flex items-center gap-3 border border-[#262837] shadow-[0_10px_30px_rgba(0,0,0,0.4)] z-40 cursor-pointer animate-slide-up"
          >
            <img src={currentSong.thumbnail} alt="" className={`w-10 h-10 rounded-full object-cover ${isPlaying ? 'animate-[spin_8s_linear_infinite]' : ''} border border-[#262837]`} />
            <div className="flex-1 overflow-hidden">
              <h4 className="text-white text-sm font-semibold truncate">{currentSong.title}</h4>
              <p className="text-[10px] text-[#8cd92b] truncate">{currentSong.artist}</p>
            </div>
            <div className="flex items-center gap-1 shrink-0 px-1">
              <button onClick={(e) => { e.stopPropagation(); toggleFavorite(e, currentSong); }} className="p-2 text-gray-400 hover:text-white">
                <Heart size={16} fill={favorites.some(s => s.id === currentSong.id) ? '#8cd92b' : 'none'} className={favorites.some(s => s.id === currentSong.id) ? 'text-[#8cd92b]' : ''} />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); togglePlay(); }}
                className="w-10 h-10 flex items-center justify-center bg-[#8cd92b] rounded-full text-[#121422] shadow-sm ml-1"
              >
                {isPlaying ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" className="ml-0.5" />}
              </button>
            </div>
            <div className="absolute bottom-0 left-3 right-3 h-0.5 bg-[#262837] rounded-full overflow-hidden">
              <div className="h-full bg-[#8cd92b] transition-all" style={{ width: `${(progress / (duration || 1)) * 100}%` }}></div>
            </div>
          </div>
        )}

        {/* Bottom Navigation */}
        <div className="absolute bottom-0 w-full h-20 bg-[#121422]/95 backdrop-blur-xl border-t border-[#262837]/50 flex items-center justify-around px-2 pb-2 rounded-b-[40px] z-10 shadow-[0_-10px_30px_rgba(0,0,0,0.3)]">
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

      </div>

      {/* App Container - Desktop Layout (Dark Theme 3-Column) */}
      <div className="hidden md:flex w-full max-w-[1200px] h-[850px] max-h-[90vh] bg-[#121422] rounded-[36px] shadow-[0_20px_50px_rgba(0,0,0,0.5)] relative overflow-hidden text-[#a0a3b1]">

        {/* Left Sidebar */}
        <div className="w-64 bg-[#1a1c2a] flex flex-col pt-10 pb-8 px-8 border-r border-[#262837] shrink-0 z-10">
          <h1 className="text-2xl font-bold mb-10 text-white flex items-center gap-3">
            <img src="/logo.jpg" alt="Play Infinity" className="h-10 w-10 object-cover rounded-full" />
            <span className="text-[#8cd92b] tracking-wider text-xl">Play Infinity</span>
          </h1>

          <nav className="flex-1 space-y-5 overflow-y-auto no-scrollbar">
            <div className="flex items-center gap-4 text-white font-semibold cursor-pointer border-l-2 border-[#8cd92b] pl-2 -ml-2.5">
              <Music size={18} className="text-[#8cd92b]" /> <span className="text-sm">Playlist</span>
            </div>
            <div className="flex items-center gap-4 hover:text-white font-medium cursor-pointer transition-colors pl-2">
              <Heart size={18} /> <span className="text-sm">Favorites</span>
            </div>
            <div className="flex items-center gap-4 hover:text-white font-medium cursor-pointer transition-colors pl-2">
              <List size={18} /> <span className="text-sm">Albums</span>
            </div>
            <div className="flex items-center gap-4 hover:text-white font-medium cursor-pointer transition-colors pl-2">
              <User size={18} /> <span className="text-sm">Artists</span>
            </div>
            <div className="flex items-center gap-4 hover:text-white font-medium cursor-pointer transition-colors pl-2">
              <Headphones size={18} /> <span className="text-sm">Podcasts</span>
            </div>
            <div className="flex items-center gap-4 hover:text-white font-medium cursor-pointer transition-colors pl-2">
              <Book size={18} /> <span className="text-sm">Books</span>
            </div>
            <div className="flex items-center gap-4 hover:text-white font-medium cursor-pointer transition-colors pl-2 mt-8">
              <Download size={18} /> <span className="text-sm">Downloaded</span>
            </div>
            <div className="flex items-center gap-4 hover:text-white font-medium cursor-pointer transition-colors pl-2">
              <Clock size={18} /> <span className="text-sm">Recent</span>
            </div>
          </nav>

          <div className="mt-auto space-y-5">
            <div className="flex items-center gap-4 hover:text-white font-medium cursor-pointer transition-colors pl-2">
              <Settings size={18} /> <span className="text-sm">Settings</span>
            </div>
            <div className="flex items-center gap-4 text-[#8cd92b] font-medium cursor-pointer transition-colors pl-2">
              <LogOut size={18} /> <span className="text-sm">Log out</span>
            </div>
          </div>
        </div>

        {/* Middle Column (Main Content) */}
        <div className="flex-1 flex flex-col p-8 overflow-hidden bg-[#121422]">
          {/* Header & Search */}
          <form onSubmit={(e) => { searchYoutube(e); setCurrentSong(null); }} className="mb-8 z-20 shrink-0">
            <div className="relative max-w-2xl flex gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-6 top-4 text-gray-500" size={18} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search..."
                  className="w-full bg-[#1a1c2a] px-14 py-3.5 rounded-full outline-none focus:ring-1 focus:ring-[#8cd92b] shadow-sm text-white font-medium transition-all text-sm"
                />
              </div>
              <button type="submit" disabled={loading} className="w-12 h-12 bg-[#1a1c2a] hover:bg-[#262837] text-white rounded-full transition-all shadow-md flex justify-center items-center">
                {loading ? <div className="w-5 h-5 border-2 border-[#8cd92b] border-t-transparent rounded-full animate-spin"></div> : <Search size={18} className="text-[#8cd92b]" />}
              </button>
            </div>
          </form>

          {/* Trending / Results / Up Next section */}
          <div className="flex-1 overflow-y-auto w-full max-w-4xl no-scrollbar pb-10 flex flex-col pt-2">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-white tracking-wide">
                {currentSong ? "Up Next" : (searchQuery && songs.length > 0 ? "Search Results" : (searchHistory.length > 0 ? "Recent Plays & Suggestions" : "Suggested For You"))}
              </h3>
              {(currentSong ? queue.length > 0 : displaySongs.length > 0) && <span className="text-xs text-[#8cd92b] cursor-pointer font-semibold hover:underline">See all</span>}
            </div>

            {currentSong ? (
              <div className="space-y-1">
                {isFetchingQueue && queue.length === 0 && (
                  <div className="flex items-center justify-center py-10">
                    <div className="w-8 h-8 border-2 border-[#8cd92b] border-t-transparent rounded-full animate-spin"></div>
                  </div>
                )}
                {queue.map((song, idx) => (
                  <div
                    key={song.id}
                    onClick={() => playSong(song, true)}
                    className="flex items-center gap-4 hover:bg-[#1a1c2a] p-3 rounded-2xl cursor-pointer transition-all border border-transparent hover:border-[#262837]"
                  >
                    <span className="text-gray-500 font-bold text-sm w-6 text-center opacity-70">{String(idx + 1).padStart(2, '0')}</span>
                    <img src={song.thumbnail} alt={song.title} className="w-12 h-12 rounded-xl object-cover shadow-sm" />
                    <div className="flex-1 overflow-hidden pr-4">
                      <h4 className="font-semibold text-white text-sm truncate">{song.title}</h4>
                      <p className="text-xs text-gray-400 truncate mt-1">{song.artist}</p>
                    </div>
                    <div className="text-xs text-gray-500 w-12 text-right mr-4">{formatTime(song.durationSeconds)}</div>
                    <AnimatedHeart size={16} isFavorite={favorites.some(s => s.id === song.id)} onClick={(e) => toggleFavorite(e, song)} />
                    <div className="text-gray-500 hover:text-white transition-colors ml-4 mr-2"><MoreHorizontal size={16} /></div>
                  </div>
                ))}
              </div>
            ) : displaySongs.length > 0 ? (
              <div className="space-y-1">
                {displaySongs.map((song, idx) => (
                  <div
                    key={song.id}
                    onClick={() => playSong(song)}
                    className="flex items-center gap-4 hover:bg-[#1a1c2a] p-3 rounded-2xl cursor-pointer transition-all border border-transparent hover:border-[#262837]"
                  >
                    <img src={song.thumbnail} alt={song.title} className="w-12 h-12 rounded-xl object-cover shadow-sm" />
                    <div className="flex-1 overflow-hidden pr-4">
                      <h4 className="font-semibold text-white text-sm truncate">{song.title}</h4>
                      <p className="text-xs text-gray-400 truncate mt-1">{song.artist}</p>
                    </div>
                    <div className="text-xs text-gray-500 w-12 text-right mr-4">{formatTime(song.durationSeconds)}</div>
                    <AnimatedHeart size={16} isFavorite={favorites.some(s => s.id === song.id)} onClick={(e) => toggleFavorite(e, song)} />
                    <div className="text-gray-500 hover:text-white transition-colors ml-4 mr-2"><MoreHorizontal size={16} /></div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center opacity-40 mb-20">
                <Music size={40} className="text-[#8cd92b] mb-4" />
                <h3 className="text-xl text-white font-medium">No results to display</h3>
                <p className="text-sm mt-2">Search for a track to get started.</p>
              </div>
            )}
          </div>
        </div>

        {/* Right Sidebar (Now Playing) */}
        <div className="w-80 bg-[#1a1c2a] flex flex-col pt-8 pb-8 px-6 border-l border-[#262837] shrink-0 z-10 shadow-[-10px_0_30px_rgba(0,0,0,0.1)]">

          {currentSong ? (
            <div className="flex-1 flex flex-col w-full h-full overflow-hidden justify-center items-center py-6">
              <div className="w-full text-left flex justify-between items-center mb-8">
                <h3 className="text-xl font-bold text-white">Now Playing</h3>
                <div className="flex gap-2">
                  <button onClick={() => setShowSleepModal(true)} className={`p-1.5 rounded-full transition-colors ${sleepMinutesLeft > 0 ? 'bg-[#8cd92b]/20 text-[#8cd92b]' : 'hover:bg-[#262837] text-gray-500 hover:text-white'}`}>
                    <Clock size={16} />
                  </button>
                </div>
              </div>

              {/* Song Cover aspect ratio adjusted to banner/rectangle based on reference */}
              <div className="w-full h-28 rounded-full overflow-hidden shadow-2xl mb-8 flex items-center justify-center bg-[#121422]">
                <img src={currentSong.thumbnail} alt="Cover" className="w-full h-full object-cover rounded-full" />
              </div>

              {/* Title & Heart */}
              <div className="flex items-start justify-between gap-2 mb-4">
                <div className="overflow-hidden flex-1">
                  <h4 className="font-bold text-white text-base truncate pr-2">{currentSong.title}</h4>
                  <p className="text-xs text-gray-400 truncate mt-1">{currentSong.artist || 'Unknown Artist'}</p>
                </div>
                <AnimatedHeart size={20} className="shrink-0 mt-1" isFavorite={favorites.some(s => s.id === currentSong.id)} onClick={(e) => toggleFavorite(e, currentSong)} />
              </div>

              {/* Visual Equalizer */}
              <div className="w-full h-12 mb-4 flex items-end justify-center gap-[3px] overflow-hidden opacity-80 mt-4">
                {[...Array(40)].map((_, i) => {
                  const durationAnim = 0.5 + (i % 4) * 0.2;
                  const delayAnim = (i % 5) * 0.15 + (i % 3) * 0.1;
                  return (
                    <div key={i} className="flex-1 max-w-[4px] rounded-t-sm bg-gradient-to-t from-[#8cd92b]/40 to-[#8cd92b] transition-all"
                      style={{
                        height: isPlaying ? '100%' : '15%',
                        animation: isPlaying ? `eq ${durationAnim}s ease-in-out infinite ${delayAnim}s alternate` : 'none'
                      }}>
                    </div>
                  )
                })}
              </div>

              {/* Progress Bar (Line) */}
              <div className="w-full mb-10 relative group">
                <input
                  type="range" min={0} max={duration || 1} value={progress} onChange={handleSeek}
                  className="absolute top-0 w-full h-4 -mt-1.5 opacity-0 z-10 cursor-pointer"
                />
                <div className="w-full h-1 bg-[#262837] rounded-full overflow-hidden relative mb-2">
                  <div className="h-full bg-[#8cd92b] rounded-full absolute top-0 left-0 transition-all duration-300 pointer-events-none" style={{ width: `${(progress / (duration || 1)) * 100}%` }}></div>
                </div>
                <div className="flex justify-between text-xs text-gray-500 font-medium">
                  <span>{formatTime(progress)}</span>
                  <span>{formatTime(duration)}</span>
                </div>
              </div>

              {/* Controls */}
              <div className="flex items-center justify-between px-2 w-full mt-2">
                <Shuffle size={20} className="text-gray-500 cursor-pointer hover:text-white" />
                <button onClick={playPrev} className="text-white hover:text-[#8cd92b] transition-colors"><SkipBack size={24} fill="currentColor" /></button>
                <button onClick={togglePlay} className="w-16 h-16 flex items-center justify-center bg-[#8cd92b] rounded-full shadow-[0_5px_20px_rgba(140,217,43,0.3)] text-[#121422] hover:scale-105 transition-all">
                  {isPlaying ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" className="ml-1" />}
                </button>
                <button onClick={playNext} className="text-white hover:text-[#8cd92b] transition-colors"><SkipForward size={24} fill="currentColor" /></button>
                <Repeat size={20} className="text-gray-500 cursor-pointer hover:text-white" />
              </div>

            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center opacity-30">
              <div className="w-24 h-24 rounded-full border-2 border-dashed border-gray-500 flex items-center justify-center mb-4">
                <Music size={32} className="text-gray-500" />
              </div>
              <p className="text-sm text-gray-400">Play a song</p>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
