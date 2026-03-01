# Modern Music Player Web App 🎵

Welcome to the Modern Music Player project! This application is designed with a premium, sleek aesthetic and uses YouTube to power real-time song searches and playback. 

## Features
- **YouTube Powered**: Search any song from YouTube and get instant audio playback right in the browser.
- **Micro-Animations**: Uses dynamic scaling and tailwind styles to create a fluid navigation experience.
- **Glassmorphism UI**: Beautiful light-pink background with softly saturated controls reflecting modern design trends.
- **Serverless functions**: Powered by Netlify functions to securely scrape YouTube metadata without spinning up an extra VPS.

## Running Locally

To run the project locally on your machine, just go into the frontend directory, install dependencies and start the dev server:

```sh
cd frontend
npm install
npm run dev
```

Visit the displayed `localhost` URL in your browser to start searching and listening!

## Deployment to Netlify

You can deploy this entire application (frontend + backend functions) simultaneously to **Netlify** using these steps:

1. Push your `frontend` folder code to a **GitHub Repository** (either private or public).
2. Go to [Netlify.com](https://www.netlify.com/) and Log In or Sign Up.
3. Click on **Add new site** > **Import from an existing project**.
4. Connect your GitHub account and select your repository.
5. Provide the following Build settings (these should be automatically detected from the `netlify.toml` file):
   - **Base directory**: `frontend`
   - **Build command**: `npm run build`
   - **Publish directory**: `frontend/dist`
   - **Functions directory**: `frontend/netlify/functions`
6. Click **Deploy Site**.
7. Wait a few moments for the build to complete. Netlify will generate a live URL for you!

That's it! Once deployed, you can access your music player on any phone, tablet, or desktop.
