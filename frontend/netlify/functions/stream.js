/* global require, exports */
const ytdl = require("@distube/ytdl-core");

exports.handler = async (event) => {
  const videoId = event.queryStringParameters?.videoId;

  if (!videoId) {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ error: "Missing videoId" })
    };
  }

  try {
    const info = await ytdl.getInfo(videoId);
    const format = ytdl.chooseFormat(info.formats, { quality: "highestaudio" });

    if (!format?.url) {
      return {
        statusCode: 404,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ error: "Audio stream not found" })
      };
    }

    return {
      statusCode: 302,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-cache",
        Location: format.url
      }
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ error: error.message || "Failed to fetch audio stream" })
    };
  }
};
