# bigpictures

A simple tool to grab high-res album artwork. Nothing fancy - just search and download.

## What it does

- Looks up album art from iTunes, MusicBrainz, and Discogs
- Tries to get the biggest image it can find
- Falls back to other sources if one fails
- Has dark/light modes because why not
- Saves your recent searches
- Works on phones too

## Under the hood

Built with React. Uses some basic caching to avoid hammering the APIs too much. 
Nothing groundbreaking, just trying to keep things snappy.

## APIs it uses

- iTunes 
- MusicBrainz
- Discogs

## Getting started

```bash
npm install
npm start
```

That's it! Visit localhost:3000 and you're good to go.

For production:
```bash
npm run build
npm run deploy  # pushes to GitHub Pages
```

## Cache stuff

Keeps track of your last 20 searches for an hour to save some API calls.
Stores them in your browser's localStorage - cleans itself up after.

## Made by

curroscube
