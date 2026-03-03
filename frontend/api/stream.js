const ytdl = require('@distube/ytdl-core');

module.exports = async (req, res) => {
    const { videoId } = req.query;

    if (!videoId) {
        return res.status(400).json({ error: 'Missing videoId' });
    }

    try {
        const info = await ytdl.getInfo(videoId);
        // Choose the best audio format
        const format = ytdl.chooseFormat(info.formats, { quality: 'highestaudio' });

        if (format && format.url) {
            // Tell browser/audio element that this route handles partial bytes
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Cache-Control', 'no-cache');

            // Temporarily redirect to the actual Google server raw audio file
            res.redirect(302, format.url);
        } else {
            res.status(404).json({ error: 'Audio stream not found' });
        }
    } catch (error) {
        console.error('YTDL Stream Error:', error.message);
        res.status(500).json({ error: 'Failed to fetch audio stream' });
    }
};
