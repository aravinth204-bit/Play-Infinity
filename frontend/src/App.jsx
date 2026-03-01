import React, { useState, useRef, useEffect } from 'react';
import ReactPlayer from 'react-player';
import { Home, Music, Search, User, Play, Pause, SkipBack, SkipForward, Heart, MoreHorizontal, ArrowLeft, Shuffle, Repeat, Upload } from 'lucide-react';
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
  const playerRef = useRef(null);

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
      let moodQuery = "tamil song";
      if (titleLower.includes("kuthu") || titleLower.includes("dance") || titleLower.includes("mass")) {
        moodQuery = "kuthu tamil song audio";
      } else if (titleLower.includes("love") || titleLower.includes("kadhal") || titleLower.includes("melody")) {
        moodQuery = "melody tamil love song lyric";
      } else if (titleLower.includes("sad") || titleLower.includes("sogam") || titleLower.includes("pain")) {
        moodQuery = "sad tamil song audio";
      } else {
        moodQuery = `${song.title.split(' ').slice(0, 2).join(' ')} tamil song lyrical`;
      }

      const res = await fetch(`${apiEndpoint}?q=${encodeURIComponent(moodQuery)}`);
      const data = await res.json();

      const firstWord = song.title.split(' ')[0].toLowerCase().replace(/[^a-z0-9]/g, "");
      const badWords = ["hits", "hit", "jukebox", "vol", "volume", "mashup", "collection", "non stop", "nonstop", "bgm", "compilation", "news", "reply", "interview", "speech", "review", "reaction", "trailer", "teaser", "promo", "public"];

      const filteredQueue = data.filter(s => {
        if (s.id === song.id) return false;
        if (s.durationSeconds && s.durationSeconds > 420) return false; // Over 7 mins is disqualified

        const lowerTitle = s.title.toLowerCase();
        for (let word of badWords) {
          if (lowerTitle.includes(word)) return false; // Contains jukebox / hit keywords
        }
        if (firstWord.length >= 3 && lowerTitle.includes(firstWord)) return false; // Same title check

        return true;
      });

      const shuffledQueue = filteredQueue.sort(() => 0.5 - Math.random());

      setQueue(shuffledQueue.length > 0 ? shuffledQueue : data.slice(0, 5));
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
      if (queue.length <= 2) {
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

      {/* App Container - Mobile Layout */}
      <div className="w-[375px] h-[812px] bg-gradient-to-b from-[#ffcfd7] to-[#fcfcfc] rounded-[40px] shadow-2xl relative overflow-hidden flex flex-col transform scale-95 md:hidden">

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto no-scrollbar pb-24">

          {/* SEARCH VIEW */}
          {activeTab === 'Search' && (
            <div className="p-6">
              <h1 className="text-2xl font-bold mb-6 text-gray-800 tracking-tight">Discover Music</h1>
              <form onSubmit={searchYoutube} className="mb-6">
                <div className="relative">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search any song..."
                    className="w-full bg-white/60 backdrop-blur-md px-5 py-4 rounded-2xl outline-none focus:ring-2 focus:ring-[#ff9eb1] shadow-sm text-gray-800 font-medium transition-all"
                  />
                  <Search className="absolute right-4 top-4 text-gray-400" size={20} />
                </div>
                <button type="submit" disabled={loading} className="w-full mt-3 bg-[#ff9eb1] hover:bg-[#ff8da3] text-white font-bold py-3 rounded-xl transition-all shadow-md flex justify-center items-center">
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : "Search"}
                </button>
              </form>

              <div className="space-y-4 pb-10">
                {songs.map((song, idx) => (
                  <div
                    key={song.id}
                    onClick={() => playSong(song)}
                    className="flex items-center gap-4 bg-white/40 hover:bg-white/60 p-3 rounded-2xl cursor-pointer transition-all shadow-sm"
                  >
                    <span className="text-sm text-gray-400 font-medium w-4">{String(idx + 1).padStart(2, '0')}</span>
                    <img src={song.thumbnail} alt={song.title} className="w-12 h-12 rounded-lg object-cover shadow-sm" />
                    <div className="flex-1 overflow-hidden">
                      <h4 className="font-semibold text-gray-800 text-sm truncate">{song.title}</h4>
                      <p className="text-xs text-gray-500 truncate">{song.artist}</p>
                    </div>
                    <div className="flex items-center gap-3 text-gray-400">
                      <Heart size={16} className="hover:text-pink-500 transition-colors cursor-pointer" />
                      <MoreHorizontal size={16} />
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
              <div className="flex items-center justify-between p-6">
                <button onClick={() => setActiveTab('Search')} className="p-2 hover:bg-black/5 rounded-full transition-colors">
                  <ArrowLeft size={24} className="text-gray-800" />
                </button>
                <div className="text-center text-xs tracking-widest uppercase text-gray-500 font-semibold h-[24px] flex items-center">
                  NOW PLAYING
                </div>
                <div className="w-10"></div> {/* spacer */}
              </div>

              {currentSong ? (
                <div className="flex-1 flex flex-col items-center px-8 relative pb-10">

                  {/* Album Art with pulsing effect when playing */}
                  <div className={`mt-4 w-full aspect-square rounded-[36px] overflow-hidden shadow-[0_20px_40px_rgba(255,158,177,0.3)] transition-transform duration-500 ${isPlaying ? 'scale-100' : 'scale-95'}`}>
                    <img
                      src={currentSong.thumbnail}
                      alt="Cover"
                      className="w-full h-full object-cover rounded-[36px]"
                    />
                  </div>

                  {/* Song Info */}
                  <div className="text-center mt-10 mb-8">
                    <h2 className="text-2xl font-bold text-gray-900 truncate w-[280px] leading-tight">{currentSong.title}</h2>
                    <p className="text-[#ff7895] font-medium mt-1">{currentSong.artist || 'Unknown Artist'}</p>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full mb-8">
                    <div className="flex justify-between text-xs text-gray-500 font-medium mb-3">
                      <span>{formatTime(progress)}</span>
                      <span>{formatTime(duration)}</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={duration || 1}
                      value={progress}
                      onChange={handleSeek}
                      className="w-full h-1 bg-white/50 rounded-lg appearance-none cursor-pointer outline-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-[#ff9eb1] [&::-webkit-slider-thumb]:rounded-full shadow-sm"
                    />
                  </div>

                  {/* Controls */}
                  <div className="flex items-center justify-between w-full px-2">
                    <button className="text-gray-400 hover:text-gray-600 transition-colors">
                      <Shuffle size={20} />
                    </button>
                    <button onClick={playPrev} className="text-gray-800 hover:text-gray-600 transition-colors">
                      <SkipBack size={28} fill="currentColor" />
                    </button>

                    <button
                      onClick={togglePlay}
                      className="w-20 h-20 flex items-center justify-center bg-white rounded-full shadow-[0_10px_25px_rgba(255,158,177,0.4)] text-[#ff9eb1] hover:scale-105 transition-all p-1"
                    >
                      <div className="w-full h-full bg-[#ffeaed] rounded-full flex items-center justify-center">
                        {isPlaying ? <Pause size={32} fill="currentColor" /> : <Play size={32} fill="currentColor" className="ml-1" />}
                      </div>
                    </button>

                    <button onClick={playNext} className="text-gray-800 hover:text-gray-600 transition-colors">
                      <SkipForward size={28} fill="currentColor" />
                    </button>
                    <button className="text-gray-400 hover:text-gray-600 transition-colors">
                      <Repeat size={20} />
                    </button>
                  </div>

                  {/* Up Next Mini preview */}
                  <div className="mt-8 w-full flex-1 flex flex-col min-h-[50px]">
                    <div className="flex items-center justify-between bg-white/40 p-3 rounded-2xl shadow-sm backdrop-blur-md text-sm text-gray-800 font-bold mb-3 z-10 relative shrink-0">
                      <span className="flex items-center gap-2">
                        <Upload size={16} className="rotate-90 text-[#ff9eb1]" /> Up Next
                      </span>
                      {isFetchingQueue && <div className="w-4 h-4 border-2 border-[#ff9eb1] border-t-transparent rounded-full animate-spin"></div>}
                    </div>

                    {queue.length > 0 ? (
                      <div className="space-y-3 pb-8 relative z-10 overflow-y-auto no-scrollbar flex-1 max-h-[180px]">
                        {queue.map(song => (
                          <div
                            key={song.id}
                            onClick={() => playSong(song, true)}
                            className="flex items-center gap-3 bg-white/20 hover:bg-white/40 p-2 rounded-xl cursor-pointer transition-all border border-white/20 shrink-0"
                          >
                            <img src={song.thumbnail} alt={song.title} className="w-10 h-10 rounded-lg object-cover shadow-sm min-w-[40px]" />
                            <div className="flex-1 overflow-hidden">
                              <h4 className="font-semibold text-gray-800 text-xs truncate">{song.title}</h4>
                              <p className="text-[10px] text-gray-500 truncate">{song.artist}</p>
                            </div>
                            <button className="text-[#ff9eb1] opacity-80 hover:opacity-100 mr-2"><Play size={16} fill="currentColor" /></button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      !isFetchingQueue && <p className="text-xs text-center text-gray-400 pb-8 mt-2 shrink-0">End of queue</p>
                    )}
                  </div>

                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center px-8 opacity-60">
                  <div className="w-48 h-48 bg-black/5 rounded-full flex items-center justify-center mb-6">
                    <Music size={48} className="text-gray-400" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-700">No Track Selected</h3>
                  <p className="text-gray-500 mt-2">Search and select a song from the Discover tab.</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Bottom Navigation */}
        <div className="absolute bottom-0 w-full h-20 bg-white/80 backdrop-blur-xl border-t border-white/40 flex items-center justify-around px-4 rounded-b-[40px] shadow-[0_-5px_20px_rgba(0,0,0,0.03)] z-10">
          <button
            onClick={() => setActiveTab('Search')}
            className={`flex flex-col items-center gap-1 transition-colors ${activeTab === 'Search' ? 'text-[#ff9eb1]' : 'text-gray-400'}`}
          >
            <Home size={22} className={activeTab === 'Search' ? 'opacity-100' : 'opacity-80'} />
            <span className="text-[10px] font-semibold">Discover</span>
          </button>

          <button
            onClick={() => setActiveTab('Music')}
            className={`flex flex-col items-center gap-1 transition-colors ${activeTab === 'Music' ? 'text-[#ff9eb1]' : 'text-gray-400'}`}
          >
            <Music size={22} className={activeTab === 'Music' ? 'opacity-100' : 'opacity-80'} />
            <span className="text-[10px] font-semibold">Playing</span>
          </button>

          <button className="flex flex-col items-center gap-1 text-gray-400 opacity-80 hover:opacity-100 transition-colors">
            <Search size={22} />
            <span className="text-[10px] font-semibold">Search</span>
          </button>

          <button className="flex flex-col items-center gap-1 text-gray-400 opacity-80 hover:opacity-100 transition-colors">
            <User size={22} />
            <span className="text-[10px] font-semibold">Account</span>
          </button>
        </div>


      {/* App Container - Desktop Layout */}
      <div className="hidden md:flex w-full max-w-4xl min-h-[800px] max-h-[90vh] bg-gradient-to-b from-[#ffcfd7] to-[#fcfcfc] rounded-[40px] shadow-2xl relative overflow-hidden flex-col p-10">
        <h1 className="text-4xl font-bold mb-6 text-gray-800 tracking-tight text-center mt-2">My Music</h1>
        
        <form onSubmit={(e) => { searchYoutube(e); setCurrentSong(null); }} className="mb-8 z-20 shrink-0">
          <div className="relative max-w-xl mx-auto flex gap-4">
            <div className="relative flex-1">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search any song..."
                className="w-full bg-white/60 backdrop-blur-md px-6 py-4 rounded-2xl outline-none focus:ring-2 focus:ring-[#ff9eb1] shadow-sm text-gray-800 font-medium transition-all text-lg"
              />
            </div>
            <button type="submit" disabled={loading} className="w-32 bg-[#ff9eb1] hover:bg-[#ff8da3] text-white p-4 rounded-2xl font-bold transition-all shadow-md flex justify-center items-center">
              {loading ? <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : "Search"}
            </button>
          </div>
        </form>

        {!currentSong && songs.length > 0 ? (
          <div className="flex-1 overflow-y-auto w-full max-w-2xl mx-auto space-y-4 no-scrollbar pb-10">
            <h3 className="text-xl font-bold text-gray-800 mb-6">Search Results</h3>
            {songs.map((song, idx) => (
              <div
                key={song.id}
                onClick={() => playSong(song)}
                className="flex items-center gap-6 bg-white/40 hover:bg-white/60 p-4 rounded-2xl cursor-pointer transition-all shadow-sm"
              >
                <img src={song.thumbnail} alt={song.title} className="w-16 h-16 rounded-xl object-cover shadow-sm" />
                <div className="flex-1 overflow-hidden">
                  <h4 className="font-semibold text-gray-800 text-lg truncate">{song.title}</h4>
                  <p className="text-sm text-gray-500 truncate">{song.artist}</p>
                </div>
                <div className="text-[#ff9eb1] mr-4"><Play size={24} fill="currentColor" /></div>
              </div>
            ))}
          </div>
        ) : currentSong ? (
          <div className="flex-1 flex flex-col items-center overflow-y-auto no-scrollbar pb-10">
            
            {/* Song Image */}
            <div className={`w-72 h-72 rounded-[40px] overflow-hidden shadow-[0_20px_40px_rgba(255,158,177,0.3)] transition-transform duration-500 mb-8 ${isPlaying ? 'scale-100' : 'scale-95'}`}>
               <img src={currentSong.thumbnail} alt="Cover" className="w-full h-full object-cover rounded-[40px]" />
            </div>
            
            <h2 className="text-3xl font-bold text-gray-900 truncate max-w-lg text-center leading-tight">{currentSong.title}</h2>
            <p className="text-xl text-[#ff7895] font-medium mt-2 mb-8">{currentSong.artist || 'Unknown Artist'}</p>

            {/* Progress */}
            <div className="w-full max-w-md mb-8">
               <div className="flex justify-between text-sm text-gray-500 font-medium mb-3">
                 <span>{formatTime(progress)}</span>
                 <span>{formatTime(duration)}</span>
               </div>
               <input type="range" min={0} max={duration || 1} value={progress} onChange={handleSeek} className="w-full h-1 bg-white/50 rounded-lg appearance-none cursor-pointer outline-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-[#ff9eb1] [&::-webkit-slider-thumb]:rounded-full shadow-sm" />
            </div>

            {/* Controls */}
            <div className="flex items-center justify-center gap-10 w-full max-w-md mb-12">
                <button onClick={playPrev} className="text-gray-800 hover:text-[#ff9eb1] transition-colors"><SkipBack size={36} fill="currentColor" /></button>
                <button onClick={togglePlay} className="w-24 h-24 flex items-center justify-center bg-white rounded-full shadow-[0_10px_25px_rgba(255,158,177,0.4)] text-[#ff9eb1] hover:scale-105 transition-all p-2">
                   <div className="w-full h-full bg-[#ffeaed] rounded-full flex items-center justify-center">
                     {isPlaying ? <Pause size={40} fill="currentColor" /> : <Play size={40} fill="currentColor" className="ml-2" />}
                   </div>
                </button>
                <button onClick={playNext} className="text-gray-800 hover:text-[#ff9eb1] transition-colors"><SkipForward size={36} fill="currentColor" /></button>
            </div>

            {/* Up Next Queue */}
            <div className="w-full max-w-lg flex flex-col min-h-[100px] bg-white/40 p-6 rounded-[32px] shadow-sm backdrop-blur-md">
                <div className="flex items-center justify-between text-xl text-gray-800 font-bold mb-6 shrink-0">
                    <span className="flex items-center gap-3"><Upload size={24} className="rotate-90 text-[#ff9eb1]" /> Up Next</span>
                    {isFetchingQueue && <div className="w-6 h-6 border-2 border-[#ff9eb1] border-t-transparent rounded-full animate-spin"></div>}
                </div>
                {queue.length > 0 ? (
                   <div className="space-y-4 overflow-y-auto max-h-[300px] no-scrollbar pr-2">
                      {queue.map(song => (
                         <div key={song.id} onClick={() => playSong(song, true)} className="flex items-center gap-5 bg-white/40 hover:bg-white/60 p-3 rounded-2xl cursor-pointer transition-all border border-white/20">
                            <img src={song.thumbnail} alt={song.title} className="w-16 h-16 rounded-xl object-cover shadow-sm min-w-[64px]" />
                            <div className="flex-1 overflow-hidden">
                               <h4 className="font-semibold text-gray-800 text-sm truncate">{song.title}</h4>
                               <p className="text-xs text-gray-500 mt-1 truncate">{song.artist}</p>
                            </div>
                            <button className="text-[#ff9eb1] opacity-80 hover:opacity-100 mr-4"><Play size={24} fill="currentColor" /></button>
                         </div>
                      ))}
                   </div>
                ) : (
                   !isFetchingQueue && <p className="text-base text-center text-gray-400 py-6">End of queue</p>
                )}
            </div>
         </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-8 opacity-60">
             <div className="w-32 h-32 bg-black/5 rounded-full flex items-center justify-center mb-6">
               <Music size={40} className="text-gray-400" />
             </div>
             <h3 className="text-2xl font-bold text-gray-700">Ready to Discover</h3>
             <p className="text-lg text-gray-500 mt-3">Search above to find your favorite songs.</p>
          </div>
        )}
      </div>

    </div>
  );
}
