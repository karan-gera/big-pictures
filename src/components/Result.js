import React, { useState } from "react";
import "./Result.css";

const Result = ({ album, useJPG }) => {
  const [imageLoaded, setImageLoaded] = useState(false);

  const getHighResImageUrl = (url) => {
    if (!url) return url;
    
    // Handle iTunes URLs (mzstatic.com)
    if (url.includes("mzstatic.com")) {
      // iTunes URLs have pattern: .../100x100bb.jpg
      // Replace size with maximum resolution
      return url.replace(/\d+x\d+bb\.(jpg|png)/, `${100000}x${100000}bb.${useJPG ? "jpg" : "png"}`);
    }
    
    // Handle Last.fm URLs (lastfm.freetls.fastly.net)
    if (url.includes("lastfm.freetls.fastly.net")) {
      // Last.fm URLs have pattern: .../300x300/filename.png
      // Try to get larger size (Last.fm supports up to 500x500)
      // If already at max or larger, return as-is
      if (url.includes("/500x500/") || url.includes("/800x800/")) {
        return url;
      }
      return url.replace(/\/\d+x\d+\//, "/500x500/");
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
    // For Last.fm results, prefer imageUrl over originalImageUrl if originalImageUrl is Cover Art Archive
    // This is because Cover Art Archive URLs may not exist even if the MBID is present
    let urlToUse = album.originalImageUrl || album.imageUrl;
    
    // If this is a Last.fm result (ID starts with "lastfm-") and originalImageUrl is Cover Art Archive,
    // but imageUrl is a Last.fm URL, prefer the Last.fm URL
    if (album.id && String(album.id).startsWith("lastfm-")) {
      if (album.originalImageUrl && album.originalImageUrl.includes("coverartarchive.org")) {
        // Cover Art Archive URL might not exist, prefer Last.fm URL if available
        if (album.imageUrl && album.imageUrl.includes("lastfm.freetls.fastly.net")) {
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

  const handleImageLoad = () => {
    setImageLoaded(true);
  };

  return (
    <div
      className="album-card"
      onClick={handleClick}
      role="button"
      tabIndex={0}
    >
      <div className="image-container">
        {!imageLoaded && <div className="loading-spinner" />}
        <img
          src={album.imageUrl}
          alt={`${album.title} cover`}
          className="album-image"
          onLoad={handleImageLoad}
          style={{ opacity: imageLoaded ? 1 : 0 }}
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
