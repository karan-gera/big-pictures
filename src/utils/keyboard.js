// Make a role="button" element respond to Enter and Space like a real button
export const onActivateKey = (handler) => (event) => {
  if (event.key === "Enter" || event.key === " ") {
    // Stops Space from scrolling, and tells the global type-anywhere handler
    // in App.js to leave this key alone
    event.preventDefault();
    handler();
  }
};
