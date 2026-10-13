import React, { useState } from "react";
import "./InfoModal.css";

const InfoModal = ({ isOpen, onClose }) => {
  const [isClosing, setIsClosing] = useState(false);

  const handleClose = () => {
    setIsClosing(true);
    // Match the CSS animation duration, then reset for the next open
    setTimeout(() => {
      setIsClosing(false);
      onClose();
    }, 200);
  };

  if (!isOpen) return null;

  return (
    <div
      className={`modal-overlay ${isClosing ? "closing" : ""}`}
      onClick={handleClose}
    >
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={handleClose}>
          ×
        </button>
        <h2>bigpictures</h2>
        <p>
          no need to try to parse google images to find the least pixelated
          image of your favorite pink floyd record.
        </p>
        <p>
          bigpictures searches across multiple music databases to find the
          highest resolution album artwork available. simple, fast, mostly just
          works.
        </p>
        <h3>How it works</h3>
        <ul>
          <li>Type an album name (and/or artist name!)</li>
          <li>Click any result to get the highest resolution version</li>
          <li>If one source fails, it automatically tries others</li>
        </ul>
        <p className="modal-footer">
          art make the world go round. thank you for creating.
        </p>
      </div>
    </div>
  );
};

export default InfoModal;
