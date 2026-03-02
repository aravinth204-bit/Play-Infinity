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
      }
    }
  ],
})
