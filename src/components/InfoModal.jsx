import React, { useCallback, useEffect, useRef, useState } from "react";
import "./InfoModal.css";

const InfoModal = ({ isOpen, onClose }) => {
  const [isClosing, setIsClosing] = useState(false);
  const closeButtonRef = useRef(null);

  const handleClose = useCallback(() => {
    if (isClosing) return;
    setIsClosing(true);
    // Match the CSS animation duration, then reset for the next open
    setTimeout(() => {
      setIsClosing(false);
      onClose();
    }, 200);
  }, [isClosing, onClose]);

  // Move focus into the modal so keyboard and screen reader users land in it,
  // and back to where it was on close. The cleanup runs after the page behind
  // the modal stops being inert; focusing it any earlier silently fails.
  useEffect(() => {
    if (!isOpen) return;
    const previouslyFocused = document.activeElement;
    closeButtonRef.current?.focus();
    return () => previouslyFocused?.focus?.();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape") handleClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, handleClose]);

  if (!isOpen) return null;

  return (
    <div
      className={`modal-overlay ${isClosing ? "closing" : ""}`}
      onClick={handleClose}
    >
      <div
        className="modal-content"
        role="dialog"
        aria-modal="true"
        aria-labelledby="info-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          ref={closeButtonRef}
          className="modal-close"
          onClick={handleClose}
          aria-label="Close"
        >
          ×
        </button>
        <h2 id="info-modal-title">bigpictures</h2>
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
