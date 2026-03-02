const ytSearch = require("yt-search");

exports.handler = async (event, context) => {
    try {
        const query = event.queryStringParameters.q;
        if (!query) {
            return {
                statusCode: 400,
                headers: { "Access-Control-Allow-Origin": "*" },
                body: JSON.stringify({ error: "Query is required" })
            };
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

        return {
            statusCode: 200,
            headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "Content-Type",
            },
            body: JSON.stringify(videos),
        };
    } catch (err) {
        return {
            statusCode: 500,
            headers: { "Access-Control-Allow-Origin": "*" },
            body: JSON.stringify({ error: err.message }),
        };
    }
};
