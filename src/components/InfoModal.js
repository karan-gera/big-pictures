import React, { useState, useEffect } from "react";
import "./InfoModal.css";

const InfoModal = ({ isOpen, onClose }) => {
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setIsClosing(false);
    }
  }, [isOpen]);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(onClose, 200); // Match the CSS animation duration
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
