import React, { useState, useRef, useEffect } from 'react';
import ReactPlayer from 'react-player';
import { Home, Music, Search, User, Play, Pause, SkipBack, SkipForward, Heart, MoreHorizontal, ArrowLeft, Shuffle, Repeat, Upload, List, Headphones, Book, Download, Clock, Settings, LogOut, Bell, ChevronRight, ChevronUp } from 'lucide-react';
import { formatTime } from './utils';

export default function App() {
  const [activeTab, setActiveTab] = useState('Search');
  const [currentSong, setCurrentSong] = useState(null);
  const [songs, setSongs] = useState([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [queue, setQueue] = useState([]);
  const [isFetchingQueue, setIsFetchingQueue] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const playerRef = useRef(null);

  useEffect(() => {
    const timer = setTimeout(() => setShowSplash(false), 2000);
    return () => clearTimeout(timer);
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

      let searchContext = searchQuery.replace(/song|audio|video|lyrics|tamil/gi, '').trim();
      if (searchContext.length < 3) {
        searchContext = song.artist?.replace(/ - Topic|VEVO/gi, '').trim() || "trending";
      }

      // Default query uses the search context to get related songs (e.g. "Anirudh tamil hits", "May maasam tamil hits")
      let moodQuery = `${searchContext} tamil hits video`;

      if (searchLower.includes("kuthu") || titleLower.includes("kuthu") || titleLower.includes("dance") || titleLower.includes("mass")) {
        moodQuery = "tamil mass kuthu dance video songs";
      } else if (searchLower.includes("love") || titleLower.includes("love") || titleLower.includes("kadhal") || titleLower.includes("melody")) {
        moodQuery = "tamil melody love romantic video songs";
      } else if (searchLower.includes("sad") || titleLower.includes("sad") || titleLower.includes("sogam") || titleLower.includes("pain")) {
        moodQuery = "tamil sad feelings video songs";
      }

      const res = await fetch(`${apiEndpoint}?q=${encodeURIComponent(moodQuery)}`);
      const data = await res.json();

      const currentTitleCleaned = song.title.split('-')[0].split('|')[0].split('(')[0].toLowerCase().replace(/[^a-z0-9 ]/g, "").trim();

      const filteredQueue = data.filter(s => {
        if (s.id === song.id) return false;
        if (s.durationSeconds && s.durationSeconds > 420) return false; // Over 7 mins is disqualified

        const lowerTitle = s.title.toLowerCase();

        const badWords = ["jukebox", "mashup", "news", "interview", "podcast", "vlog", "speech", "review", "reaction", "trailer", "teaser", "promo", "audio launch", "press", "telugu", "hindi", "malayalam", "kannada", "whatsapp status"];
        for (let word of badWords) {
          if (lowerTitle.includes(word)) return false;
        }

        // Prevent showing different versions (audio, lyric video) of the EXACT same song being played
        if (currentTitleCleaned.length > 5 && lowerTitle.includes(currentTitleCleaned)) return false;

        return true;
      });

      // Maintain order rather than full random, to keep Google's relevance ranking, but slice top 30
      // If filters removed too many, fallback to basic non-long videos to guarantee we have 20+ songs
      let newQueue = filteredQueue.length >= 20 ? filteredQueue : data.filter(s => s.id !== song.id && s.durationSeconds < 420).slice(0, 30);

      setQueue(prevQueue => {
        const existingIds = new Set(prevQueue.map(s => s.id));
        existingIds.add(song.id);
        if (currentSong) existingIds.add(currentSong.id);
        const filteredNew = newQueue.filter(s => !existingIds.has(s.id));
        return [...prevQueue, ...filteredNew].slice(0, 40); // Keep max 40 songs
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

    if (!fromQueue) {
      setQueue([]);
      fetchQueue(song);
    } else {
      setQueue(prev => prev.filter(s => s.id !== song.id));
      if (queue.length <= 10) {
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

  useEffect(() => {
    if ('mediaSession' in navigator && currentSong) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: currentSong.title,
        artist: currentSong.artist || 'Unknown Artist',
        album: 'My Music App',
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
      navigator.mediaSession.setActionHandler('previoustrack', playPrev);
      navigator.mediaSession.setActionHandler('nexttrack', playNext);
    }
  }, [currentSong]);

  useEffect(() => {
    if (isPlaying && silentAudioRef.current) {
      silentAudioRef.current.play().catch(e => console.log('Silent audio play error:', e));
    } else if (!isPlaying && silentAudioRef.current) {
      silentAudioRef.current.pause();
    }
  }, [isPlaying]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-900 overflow-hidden font-['Outfit']">

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

        {/* Splash Screen */}
        <div className={`absolute inset-0 bg-[#0c0e18] z-50 flex flex-col items-center justify-center p-8 transition-opacity duration-1000 ${showSplash ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
          <div className="w-48 h-48 rounded-[60px] rounded-tl-xl rounded-br-xl overflow-hidden shadow-[0_0_50px_rgba(247,148,29,0.15)] mb-10 relative">
            <div className="absolute inset-0 bg-gradient-to-t from-[#121422] via-transparent to-transparent z-10"></div>
            <img src="https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=80" alt="Enjoy Music" className="w-full h-full object-cover origin-center scale-110" />
          </div>

          <h1 className="text-3xl font-bold text-white mb-4 text-center leading-snug">Listen and Enjoy<br />Your Music</h1>
          <p className="text-[13px] text-gray-500 text-center max-w-[260px] mb-12">Welcome to MUSIC WORLD. Listen to our music and feel the joy of the songs we provide.</p>

          <div className="w-14 h-14 bg-[#1a1c2a] rounded-full flex items-center justify-center relative">
            <div className="absolute inset-0 rounded-full border-2 border-[#f7941d]/30 animate-pulse"></div>
            <div className="w-10 h-10 bg-[linear-gradient(135deg,#f7941d,#ffb966)] rounded-full flex items-center justify-center text-[#121422]">
              <ChevronRight size={20} className="ml-0.5" />
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto no-scrollbar pb-24">

          {/* SEARCH VIEW */}
          {activeTab === 'Search' && (
            <div className="p-6 pt-10">
              <p className="text-xs text-gray-400 uppercase tracking-widest pl-1 mb-1 font-semibold flex items-center gap-2"><span className="w-2 h-[2px] bg-[#f7941d]"></span> Hi, Guest User</p>
              <h1 className="text-2xl font-bold text-white mb-8">Listen To Your<br /><span className="text-[#f7941d]">Music Today <Music className="inline mb-1" size={18} /></span></h1>

              <form onSubmit={searchYoutube} className="mb-8">
                <div className="relative">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search Song..."
                    className="w-full bg-[#1a1c2a] px-5 py-4 pl-12 rounded-2xl outline-none focus:ring-1 focus:ring-[#f7941d] shadow-sm text-white font-medium transition-all text-sm"
                  />
                  <Search className="absolute left-4 top-4 text-gray-500" size={18} />
                </div>
                <button type="submit" disabled={loading} className="w-full mt-3 bg-[#f7941d] text-[#121422] font-bold py-3.5 rounded-2xl transition-all shadow-md flex justify-center items-center">
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-[#121422] border-t-transparent rounded-full animate-spin"></div>
                  ) : "Search"}
                </button>
              </form>

              <div className="flex items-center justify-between mb-4 mt-2">
                <h3 className="text-xs uppercase tracking-wider font-bold text-gray-500 text-left">Searched List</h3>
                <span className="text-[10px] text-[#f7941d]">See more</span>
              </div>

              <div className="space-y-3 pb-6">
                {songs.map((song, idx) => (
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
                    <div className="w-8 h-8 rounded-full bg-[#121422] flex items-center justify-center text-gray-400">
                      <Play size={12} fill="currentColor" className="ml-0.5" />
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
                <button className="p-2 bg-[#1a1c2a] rounded-full hover:bg-[#262837] text-gray-400 transition-colors">
                  <MoreHorizontal size={16} />
                </button>
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
                    <Heart size={20} className="text-[#f7941d] shrink-0 mb-1" fill="currentColor" />
                  </div>

                  {/* Progress Bar / Waveform */}
                  <div className="w-full mb-8 relative">
                    <input
                      type="range" min={0} max={duration || 1} value={progress} onChange={handleSeek}
                      className="absolute top-0 w-full h-8 opacity-0 z-10 cursor-pointer"
                    />
                    <div className="w-full h-8 flex items-center justify-between gap-[2px] overflow-hidden opacity-80">
                      {[...Array(30)].map((_, i) => {
                        const h = Math.max(10, Math.sin(i * 0.4) * 100);
                        const isPlayed = (i / 30) < (progress / (duration || 1));
                        return <div key={i} className={`flex-1 rounded-full ${isPlayed ? 'bg-[#f7941d]' : 'bg-[#262837]'}`} style={{ height: `${h}%` }}></div>;
                      })}
                    </div>
                    <div className="flex justify-between text-[10px] text-gray-500 font-medium mt-3 px-1">
                      <span>{formatTime(progress)}</span>
                      <span>{formatTime(duration)}</span>
                    </div>
                  </div>

                  {/* Controls */}
                  <div className="flex items-center justify-between w-full px-2">
                    <button className="text-gray-500 hover:text-white transition-colors"><Shuffle size={18} /></button>
                    <button onClick={playPrev} className="text-white hover:text-[#f7941d] transition-colors"><SkipBack size={20} fill="currentColor" /></button>

                    <button
                      onClick={togglePlay}
                      className="w-16 h-16 flex items-center justify-center bg-[#f7941d] rounded-full shadow-[0_10px_25px_rgba(247,148,29,0.3)] text-[#121422] hover:scale-105 transition-all"
                    >
                      {isPlaying ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" className="ml-1" />}
                    </button>

                    <button onClick={playNext} className="text-white hover:text-[#f7941d] transition-colors"><SkipForward size={20} fill="currentColor" /></button>
                    <button className="text-gray-500 hover:text-white transition-colors"><Repeat size={18} /></button>
                  </div>

                  {/* Mobile Up Next Mini preview */}
                  <div className="mt-8 w-full flex-1 flex flex-col min-h-[50px]">
                    <div className="flex items-center justify-between text-[11px] tracking-wider uppercase text-gray-500 font-bold mb-3 z-10 relative shrink-0">
                      <span className="flex items-center gap-1.5"><List size={14} className="text-[#f7941d]" /> Up Next</span>
                      {isFetchingQueue && <div className="w-3 h-3 border-2 border-[#f7941d] border-t-transparent rounded-full animate-spin"></div>}
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

        {/* Bottom Navigation */}
        <div className="absolute bottom-0 w-full h-20 bg-[#121422]/90 backdrop-blur-xl border-t border-[#262837]/50 flex items-center justify-around px-2 pb-2 rounded-b-[40px] z-10">
          <button onClick={() => setActiveTab('Search')} className={`flex flex-col items-center justify-center gap-1.5 transition-colors w-16 h-12 rounded-xl ${activeTab === 'Search' ? 'text-[#f7941d]' : 'text-gray-500'}`}>
            <Home size={20} />
            {activeTab === 'Search' && <span className="w-1 h-1 rounded-full bg-[#f7941d]"></span>}
          </button>

          <button onClick={() => setActiveTab('Music')} className={`flex flex-col items-center justify-center gap-1.5 transition-colors w-16 h-12 rounded-xl ${activeTab === 'Music' ? 'text-[#f7941d]' : 'text-gray-500'}`}>
            <Headphones size={20} />
            {activeTab === 'Music' && <span className="w-1 h-1 rounded-full bg-[#f7941d]"></span>}
          </button>

          <button className="flex flex-col items-center justify-center gap-1.5 transition-colors w-16 h-12 rounded-xl text-gray-500">
            <Heart size={20} />
          </button>

          <button className="flex flex-col items-center justify-center gap-1.5 transition-colors w-16 h-12 rounded-xl text-gray-500">
            <Settings size={20} />
          </button>
        </div>

      </div>

      {/* App Container - Desktop Layout (Dark Theme 3-Column) */}
      <div className="hidden md:flex w-full max-w-[1200px] h-[850px] max-h-[90vh] bg-[#121422] rounded-[36px] shadow-[0_20px_50px_rgba(0,0,0,0.5)] relative overflow-hidden text-[#a0a3b1]">

        {/* Left Sidebar */}
        <div className="w-64 bg-[#1a1c2a] flex flex-col pt-10 pb-8 px-8 border-r border-[#262837] shrink-0 z-10">
          <h1 className="text-2xl font-bold mb-10 text-white flex items-center gap-2">
            <span className="text-[#f7941d] tracking-wider">Music House</span>
          </h1>

          <nav className="flex-1 space-y-5 overflow-y-auto no-scrollbar">
            <div className="flex items-center gap-4 text-white font-semibold cursor-pointer border-l-2 border-[#f7941d] pl-2 -ml-2.5">
              <Music size={18} className="text-[#f7941d]" /> <span className="text-sm">Playlist</span>
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
            <div className="flex items-center gap-4 text-[#f7941d] font-medium cursor-pointer transition-colors pl-2">
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
                  className="w-full bg-[#1a1c2a] px-14 py-3.5 rounded-full outline-none focus:ring-1 focus:ring-[#f7941d] shadow-sm text-white font-medium transition-all text-sm"
                />
              </div>
              <button type="submit" disabled={loading} className="w-12 h-12 bg-[#1a1c2a] hover:bg-[#262837] text-white rounded-full transition-all shadow-md flex justify-center items-center">
                {loading ? <div className="w-5 h-5 border-2 border-[#f7941d] border-t-transparent rounded-full animate-spin"></div> : <Search size={18} className="text-[#f7941d]" />}
              </button>
            </div>
          </form>

          {/* Trending / Results / Up Next section */}
          <div className="flex-1 overflow-y-auto w-full max-w-4xl no-scrollbar pb-10 flex flex-col pt-2">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-white tracking-wide">
                {currentSong ? "Up Next" : (searchQuery ? "Search Results" : "Music for You")}
              </h3>
              {(currentSong ? queue.length > 0 : songs.length > 0) && <span className="text-xs text-[#f7941d] cursor-pointer font-semibold hover:underline">See all</span>}
            </div>

            {currentSong ? (
              <div className="space-y-1">
                {isFetchingQueue && queue.length === 0 && (
                  <div className="flex items-center justify-center py-10">
                    <div className="w-8 h-8 border-2 border-[#f7941d] border-t-transparent rounded-full animate-spin"></div>
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
                    <div className="text-gray-500 hover:text-[#f7941d] transition-colors"><Heart size={16} /></div>
                    <div className="text-gray-500 hover:text-white transition-colors ml-4 mr-2"><MoreHorizontal size={16} /></div>
                  </div>
                ))}
              </div>
            ) : songs.length > 0 ? (
              <div className="space-y-1">
                {songs.map((song, idx) => (
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
                    <div className="text-gray-500 hover:text-[#f7941d] transition-colors"><Heart size={16} /></div>
                    <div className="text-gray-500 hover:text-white transition-colors ml-4 mr-2"><MoreHorizontal size={16} /></div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center opacity-40 mb-20">
                <Music size={40} className="text-[#f7941d] mb-4" />
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
              <div className="w-full text-left">
                <h3 className="text-xl font-bold text-white mb-8">Now Playing</h3>
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
                <Heart size={18} className="text-[#f7941d] shrink-0 mt-1 cursor-pointer" fill="currentColor" />
              </div>

              {/* Fake Audio Wave / Progress */}
              <div className="w-full mb-10 relative group mt-4">
                <input
                  type="range" min={0} max={duration || 1} value={progress} onChange={handleSeek}
                  className="absolute top-0 w-full h-10 opacity-0 z-10 cursor-pointer"
                />

                {/* Visual Fake Waveform pattern for aesthetics */}
                <div className="w-full h-10 flex items-center justify-between gap-[2px] overflow-hidden">
                  {[...Array(30)].map((_, i) => {
                    const h = Math.max(20, Math.sin(i * 0.5) * 100);
                    const isPlayed = (i / 30) < (progress / (duration || 1));
                    return <div key={i} className={`flex-1 rounded-full ${isPlayed ? 'bg-[#f7941d]' : 'bg-[#262837]'}`} style={{ height: `${h}%` }}></div>;
                  })}
                </div>
                <div className="flex justify-between text-xs text-gray-500 font-medium mt-3">
                  <span>{formatTime(progress)}</span>
                  <span>{formatTime(duration)}</span>
                </div>
              </div>

              {/* Controls */}
              <div className="flex items-center justify-between px-2 w-full mt-2">
                <Shuffle size={20} className="text-gray-500 cursor-pointer hover:text-white" />
                <button onClick={playPrev} className="text-white hover:text-[#f7941d] transition-colors"><SkipBack size={24} fill="currentColor" /></button>
                <button onClick={togglePlay} className="w-16 h-16 flex items-center justify-center bg-[#f7941d] rounded-full shadow-[0_5px_20px_rgba(247,148,29,0.3)] text-[#121422] hover:scale-105 transition-all">
                  {isPlaying ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" className="ml-1" />}
                </button>
                <button onClick={playNext} className="text-white hover:text-[#f7941d] transition-colors"><SkipForward size={24} fill="currentColor" /></button>
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
