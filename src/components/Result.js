import React, { useState } from "react";
import "./Result.css";

const Result = ({ album }) => {
  const [imageLoaded, setImageLoaded] = useState(false);

  const getHighResImageUrl = (url) => {
    // Extract the base URL up to .jpg
    const baseUrl = url.match(/(.*?\.jpg)/)[0];
    return `${baseUrl}/100000x100000bb.jpg`;
  };

  const handleClick = () => {
    const highResUrl = getHighResImageUrl(album.originalImageUrl);
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
      <div className="album-title">{album.title}</div>
      <div className="album-artist">{album.artist}</div>
      <div className="album-year">{album.year}</div>
    </div>
  );
};

export default Result;
