import React, { useState } from "react";
import { buttonKeyHandlers } from "../utils/keyboard";
import "./Result.css";

// Keyed by URL where it's used, so a new image URL always starts fresh
// instead of inheriting a previous image's loaded/failed state
const Thumbnail = ({ src, alt }) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);

  if (imageFailed) {
    // The thumbnail failed, but the full-size image may still exist
    return <div className="image-fallback">No preview</div>;
  }

  return (
    <>
      {!imageLoaded && <div className="loading-spinner" />}
      <img
        src={src}
        alt={alt}
        className="album-image"
        onLoad={() => setImageLoaded(true)}
        onError={() => setImageFailed(true)}
        style={{ opacity: imageLoaded ? 1 : 0 }}
      />
    </>
  );
};

const Result = ({ album, useJPG, fadingOut = false }) => {

  const getHighResImageUrl = (url) => {
    if (!url) return url;
    
    // Handle iTunes URLs (mzstatic.com)
    if (url.includes("mzstatic.com")) {
      // iTunes URLs have pattern: .../100x100bb.jpg
      // Request 10000x10000 to get the original upload: Apple serves the original
      // when asked for anything larger, but rejects sizes above 10000 with a 400
      return url.replace(/\d+x\d+bb\.(jpg|png)/, `10000x10000bb.${useJPG ? "jpg" : "png"}`);
    }
    
    // Handle Last.fm URLs (lastfm.freetls.fastly.net, lastfm-img.freetls.fastly.net)
    if (/lastfm(-img)?\.freetls\.fastly\.net/.test(url)) {
      // Last.fm URLs have pattern: .../i/u/300x300/filename.png
      // Dropping the size segment returns the original upload (often 1000px+)
      return url.replace(/\/i\/u\/\d+x\d+\//, "/i/u/");
    }
    
    // Handle Discogs URLs
    if (url.includes("discogs.com")) {
      // Discogs URLs already point to high-res images in originalImageUrl
      // Just return as-is
      return url;
    }
    
    // Handle MusicBrainz Cover Art Archive URLs (coverartarchive.org)
    // Only handle these if they're already in the URL - don't construct them
    if (url.includes("coverartarchive.org")) {
      // Cover Art Archive URLs have two patterns:
      // 1. .../release/{mbid}/{size}.{ext} where size is 250, 500, or 1200
      // 2. .../release/{mbid}/{imageId}.{ext} where imageId is a long number (image ID)
      // 
      // Only try to upgrade size-based URLs (250, 500, 1200)
      // Don't touch image ID URLs - they're already pointing to specific images
      const sizeBasedPattern = /\/(250|500|1200)\.(jpg|png)$/;
      if (sizeBasedPattern.test(url)) {
        // It's a size-based URL, try to get 1200
        return url.replace(/\/(250|500|1200)\.(jpg|png)$/, `/1200.${useJPG ? "jpg" : "png"}`);
      }
      // If it's an image ID URL or "front"/"back", return as-is
      return url;
    }
    
    // For any other URL, return as-is (don't try to manipulate unknown URL formats)
    return url;
  };

  const handleClick = () => {
    // Faded-out cards are stale and invisible, so they shouldn't open anything
    if (fadingOut) return;

    // For Last.fm results, prefer imageUrl over originalImageUrl if originalImageUrl is Cover Art Archive
    // This is because Cover Art Archive URLs may not exist even if the MBID is present
    let urlToUse = album.originalImageUrl || album.imageUrl;
    
    // If this is a Last.fm result (ID starts with "lastfm-") and originalImageUrl is Cover Art Archive,
    // but imageUrl is a Last.fm URL, prefer the Last.fm URL
    if (album.id && String(album.id).startsWith("lastfm-")) {
      if (album.originalImageUrl && album.originalImageUrl.includes("coverartarchive.org")) {
        // Cover Art Archive URL might not exist, prefer Last.fm URL if available
        if (album.imageUrl && /lastfm(-img)?\.freetls\.fastly\.net/.test(album.imageUrl)) {
          urlToUse = album.imageUrl;
        }
      }
    }
    
    if (!urlToUse) {
      console.warn("No image URL available for album:", album);
      return;
    }
    
    const highResUrl = getHighResImageUrl(urlToUse);
    window.open(highResUrl, "_blank");
  };

  return (
    <div
      className={`album-card ${fadingOut ? "fade-out" : ""}`}
      onClick={handleClick}
      {...buttonKeyHandlers(handleClick)}
      role="button"
      tabIndex={0}
      inert={fadingOut}
    >
      <div className="image-container">
        <Thumbnail
          key={album.imageUrl}
          src={album.imageUrl}
          alt={`${album.title} cover`}
        />
      </div>
      <div className="album-info">
        <div className="album-title">{album.title}</div>
        <div className="album-artist">{album.artist}</div>
        <div className="album-year">{album.year}</div>
      </div>
    </div>
  );
};

export default Result;
