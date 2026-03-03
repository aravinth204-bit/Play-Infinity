import ytSearch from "yt-search";

export default async function handler(req, res) {
    try {
        const query = req.query.q;
        if (!query) {
            return res.status(400).json({ error: "Query is required" });
        }

        // Append auto/music to get better song results
        const r = await ytSearch(query + " song audio");
        const videos = r.videos.slice(0, 50).map(v => ({
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
