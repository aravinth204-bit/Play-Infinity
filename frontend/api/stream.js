const ytdl = require('@distube/ytdl-core');
const play = require('play-dl');

module.exports = async (req, res) => {
    const { videoId } = req.query;

    if (!videoId) {
        return res.status(400).json({ error: 'Missing videoId' });
    }

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'no-cache');

    try {
        // Try ytdl-core first
        try {
            const info = await ytdl.getInfo(videoId);
            const format = ytdl.chooseFormat(info.formats, { quality: 'highestaudio' });
            if (format && format.url) {
                return res.redirect(302, format.url);
            }
        } catch (ytdlError) {
            console.warn('YTDL Core failed, trying play-dl:', ytdlError.message);
        }

        // Fallback to play-dl
        const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
        const info = await play.video_info(videoUrl);
        const stream = await play.stream_from_info(info);

        if (stream && stream.url) {
            return res.redirect(302, stream.url);
        } else {
            res.status(404).json({ error: 'Audio stream not found' });
        }
    } catch (error) {
        console.error('Streaming API Error:', error.message);
        res.status(500).json({ error: 'Failed to fetch audio stream: ' + error.message });
    }
};
