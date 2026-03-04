import ytSearch from "yt-search";

export default async function handler(req, res) {
    try {
        const query = req.query.q;
        if (!query) {
            return res.status(400).json({ error: "Query is required" });
        }

        // Append auto/music to get better song results
        const r = await ytSearch(query + " official track audio");

        const videos = r.videos
            .filter(v => {
                const title = v.title.toLowerCase();
                const excludeKeywords = ['news', 'interview', 'collection', 'jukebox', 'mashup', 'podcast', 'episode'];
                const hasExcludedKeyword = excludeKeywords.some(keyword => title.includes(keyword));
                const isReasonableLength = v.seconds < 600; // Exclude videos longer than 10 minutes
                return !hasExcludedKeyword && isReasonableLength;
            })
            .slice(0, 50).map(v => ({
                id: v.videoId,
                title: v.title,
                artist: v.author.name,
                duration: v.timestamp,
                durationSeconds: v.seconds,
                thumbnail: v.thumbnail,
                url: v.url
            }));

        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Access-Control-Allow-Headers", "Content-Type");
        return res.status(200).json(videos);
    } catch (err) {
        res.setHeader("Access-Control-Allow-Origin", "*");
        return res.status(500).json({ error: err.message });
    }
}
