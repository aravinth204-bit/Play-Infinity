import play from 'play-dl';
import ytStream from 'yt-stream';
import ytdl from '@distube/ytdl-core';

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
        } catch (err) {}

        // 2. Try ytdl-core (Distube version is more active)
        try {
            const info = await ytdl.getInfo(videoId);
            const format = ytdl.chooseFormat(info.formats, { quality: 'highestaudio', filter: 'audioonly' });
            if (format?.url) {
                return res.redirect(302, format.url);
            }
        } catch (err) {}

        // 3. Try yt-stream
        try {
            const stream = await ytStream.getStream(videoId, {
                quality: 'high',
                type: 'audio',
                highWaterMark: 1048576 * 32
            });
            if (stream?.url) {
                return res.redirect(302, stream.url);
            }
        } catch (err) {}

        // 4. Try Piped API Fallback (Extensive list)
        const pipedInstances = [
            'https://pipedapi.kavin.rocks',
            'https://api.piped.victr.me',
            'https://pipedapi.metafates.me',
            'https://pipedapi.drgns.space',
            'https://api-piped.mha.fi',
            'https://piped-api.lunar.icu',
            'https://pipedapi.rivo.cc',
            'https://pipedapi.adminforge.de'
        ];

        for (const instance of pipedInstances) {
            try {
                const response = await fetch(`${instance}/streams/${videoId}`, { signal: AbortSignal.timeout(3000) });
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

        // 5. Try Invidious Fallback
        const invidiousInstances = [
            'https://invidious.snopyta.org',
            'https://yewtu.be',
            'https://invidious.kavin.rocks',
            'https://invidious.sethforprivacy.com'
        ];

        for (const instance of invidiousInstances) {
            try {
                const response = await fetch(`${instance}/api/v1/videos/${videoId}`, { signal: AbortSignal.timeout(3000) });
                if (response.ok) {
                    const data = await response.json();
                    const adaptiveFormats = data.adaptiveFormats || [];
                    const bestAudio = adaptiveFormats
                        .filter(f => f.type.includes('audio/mp4'))
                        .sort((a, b) => (parseInt(b.bitrate) || 0) - (parseInt(a.bitrate) || 0))[0];
                    
                    if (bestAudio?.url) {
                        return res.redirect(302, bestAudio.url);
                    }
                }
            } catch (err) {
                continue;
            }
        }

        res.status(404).send('Audio not found in any source');

    } catch (error) {
        console.error('Final Stream Error:', error.message);
        res.status(500).send('Stream fetch failed');
    }
}
