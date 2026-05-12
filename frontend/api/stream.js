import play from 'play-dl';
import ytStream from 'yt-stream';

export default async function handler(req, res) {
    const { videoId } = req.query;

    if (!videoId) {
        return res.status(400).json({ error: 'Missing videoId' });
    }

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Cache-Control', 'no-cache');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        // 1. Try play-dl
        try {
            const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
            const info = await play.video_info(videoUrl);
            const format = info.format.filter(f => f.mime_type?.includes('audio/mp4')).sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))[0] || info.format.find(f => f.mime_type?.includes('audio'));
            
            if (format?.url) {
                return res.redirect(302, format.url);
            }
        } catch (err) {
            console.warn('play-dl failed');
        }

        // 2. Try yt-stream (already in package.json)
        try {
            const stream = await ytStream.getStream(videoId, {
                quality: 'high',
                type: 'audio',
                highWaterMark: 1048576 * 32
            });
            if (stream?.url) {
                return res.redirect(302, stream.url);
            }
        } catch (err) {
            console.warn('yt-stream failed');
        }

        // 3. Try Piped API Fallback
        const pipedInstances = [
            'https://pipedapi.kavin.rocks',
            'https://api.piped.victr.me',
            'https://piped-api.lunar.icu',
            'https://pipedapi.metafates.me',
            'https://api-piped.mha.fi',
            'https://pipedapi.drgns.space'
        ];

        for (const instance of pipedInstances) {
            try {
                const response = await fetch(`${instance}/streams/${videoId}`);
                if (response.ok) {
                    const data = await response.json();
                    const audioStreams = data.audioStreams || [];
                    const bestAudio = audioStreams
                        .filter(s => s.mimeType.includes('audio/mp4'))
                        .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))[0] || audioStreams[0];
                    
                    if (bestAudio?.url) {
                        return res.redirect(302, bestAudio.url);
                    }
                }
            } catch (err) {
                continue;
            }
        }

        res.status(404).json({ error: 'All stream sources failed' });

    } catch (error) {
        console.error('Final Stream Error:', error.message);
        res.status(500).json({ error: 'Stream fetch failed' });
    }
}
