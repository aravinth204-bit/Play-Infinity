const fs = require('fs');

const appPath = 'c:\\Users\\Dell\\Desktop\\New Project\\My Music App\\frontend\\src\\App.jsx';
let content = fs.readFileSync(appPath, 'utf8');

// The mobile app container starts with:
// <div className="w-[375px] h-[812px] bg-gradient-to-b from-[#ffcfd7] to-[#fcfcfc] rounded-[40px] shadow-2xl relative overflow-hidden flex flex-col transform scale-95 md:scale-100">
// We need to add `md:hidden` to this class list.

content = content.replace(
    `className="w-[375px] h-[812px] bg-gradient-to-b from-[#ffcfd7] to-[#fcfcfc] rounded-[40px] shadow-2xl relative overflow-hidden flex flex-col transform scale-95 md:scale-100"`,
    `className="w-[375px] h-[812px] bg-gradient-to-b from-[#ffcfd7] to-[#fcfcfc] rounded-[40px] shadow-2xl relative overflow-hidden flex flex-col transform scale-95 md:hidden"`
);

// We need to insert the desktop layout right before the final `</div>` (the closing of the bg-gray-900 wrapper).
// The end of the file looks like:
//         </div>
// 
//       </div>
//     </div>
//   );
// }

const desktopCode = `
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
            <div className={\`w-72 h-72 rounded-[40px] overflow-hidden shadow-[0_20px_40px_rgba(255,158,177,0.3)] transition-transform duration-500 mb-8 \${isPlaying ? 'scale-100' : 'scale-95'}\`}>
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
`;

// Insert the desktop code right before the closing div and closing bracket
content = content.replace("      </div>\n    </div>\n  );\n}", desktopCode + "\n    </div>\n  );\n}");

fs.writeFileSync(appPath, content);
console.log('Done patching App.jsx for Desktop responsive view');
