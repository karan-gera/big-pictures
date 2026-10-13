// Make a role="button" element respond to the keyboard like a native button:
// Enter activates on press (once, ignoring key repeat), Space activates on
// release, and only if the press started on the same element and focus never
// left it in between.
export const buttonKeyHandlers = (handler) => ({
  onKeyDown: (event) => {
    if (event.nativeEvent.isComposing) return;
    if (event.key === "Enter") {
      // Also tells the global type-anywhere handler in App.js to leave it alone
      event.preventDefault();
      if (!event.repeat) handler();
    } else if (event.key === " ") {
      // Stops Space from scrolling the page, including on key repeat
      event.preventDefault();
      // A repeat means the key went down somewhere else first
      if (!event.repeat) event.currentTarget.dataset.spacePressed = "true";
    }
  },
  onKeyUp: (event) => {
    if (event.key !== " ") return;
    const pressedHere = event.currentTarget.dataset.spacePressed === "true";
    delete event.currentTarget.dataset.spacePressed;
    if (pressedHere) handler();
  },
  onBlur: (event) => {
    // Space released after focus moved away shouldn't count later
    delete event.currentTarget.dataset.spacePressed;
  },
});
