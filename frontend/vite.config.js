import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import ytSearch from 'yt-search'
import { URL } from 'url'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'api-proxy',
      configureServer(server) {
        server.middlewares.use('/api/search', async (req, res) => {
          const url = new URL(req.url, 'http://localhost');
          const q = url.searchParams.get('q');
          if (!q) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: 'Missing query' }));
            return;
          }
          try {
            res.setHeader('Access-Control-Allow-Origin', '*');
            const r = await ytSearch(q + ' music audio');
            const videos = r.videos.slice(0, 50).map(v => ({
              id: v.videoId,
              title: v.title,
              artist: v.author.name,
              duration: v.timestamp,
              durationSeconds: v.seconds,
              thumbnail: v.image || v.thumbnail,
              url: v.url
            }));
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(videos));
          } catch (e) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: e.message }));
          }
        });

        server.middlewares.use('/api/stream', async (req, res) => {
          const url = new URL(req.url, 'http://localhost');
          const videoId = url.searchParams.get('videoId');
          if (!videoId) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: 'Missing videoId' }));
            return;
          }

          try {
            const ytdl = await import('@distube/ytdl-core');
            const info = await ytdl.default.getInfo(videoId);
            const format = ytdl.default.chooseFormat(info.formats, { quality: 'highestaudio' });

            if (format && format.url) {
              res.setHeader('Access-Control-Allow-Origin', '*');
              res.statusCode = 302;
              res.setHeader('Location', format.url);
              res.end();
            } else {
              res.statusCode = 404;
              res.end(JSON.stringify({ error: 'No audio format found' }));
            }
          } catch (error) {
            console.error('YTDL Stream Fetch Error:', error.message);
            res.statusCode = 500;
            res.end(JSON.stringify({ error: 'Failed to fetch audio stream' }));
          }
        });
      }
    }
  ],
})
