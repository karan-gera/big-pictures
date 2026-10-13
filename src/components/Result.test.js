import { render, screen, fireEvent } from '@testing-library/react';
import Result from './Result';

const clickResult = (album) => {
  const open = jest.spyOn(window, 'open').mockImplementation(() => {});
  render(<Result album={album} useJPG={false} />);
  fireEvent.click(screen.getByRole('button'));
  const url = open.mock.calls[0][0];
  open.mockRestore();
  return url;
};

test.each([
  'https://lastfm-img.freetls.fastly.net/i/u/300x300/abc.png',
  'https://lastfm.freetls.fastly.net/i/u/300x300/abc.png',
])('opens the original-size Last.fm image for %s', (imageUrl) => {
  const url = clickResult({
    id: 'lastfm-1',
    title: 't',
    artist: 'a',
    imageUrl,
    originalImageUrl: imageUrl,
  });

  expect(url).toBe(imageUrl.replace('/300x300/', '/'));
});

test('opens the full-resolution iTunes image', () => {
  const url = clickResult({
    id: 1,
    title: 't',
    artist: 'a',
    imageUrl: 'https://is1-ssl.mzstatic.com/image/thumb/x/600x600bb.jpg',
    originalImageUrl: 'https://is1-ssl.mzstatic.com/image/thumb/x/100x100bb.jpg',
  });

  expect(url).toBe('https://is1-ssl.mzstatic.com/image/thumb/x/10000x10000bb.png');
});

test('a faded-out card is inert and does not open anything', () => {
  const open = jest.spyOn(window, 'open').mockImplementation(() => {});
  render(
    <Result
      album={{ id: 1, title: 't', artist: 'a', imageUrl: 'u', originalImageUrl: 'u' }}
      useJPG={false}
      fadingOut
    />
  );
  const card = document.querySelector('.album-card');

  expect(card).toHaveAttribute('inert');
  fireEvent.click(card);
  expect(open).not.toHaveBeenCalled();
  open.mockRestore();
});

const renderCard = (album = {}) =>
  render(
    <Result
      album={{ id: 1, title: 't', artist: 'a', imageUrl: 'u', originalImageUrl: 'u', ...album }}
      useJPG={false}
    />
  );

test.each(['Enter', ' '])('pressing and releasing %p on a focused card opens the image once', (key) => {
  const open = jest.spyOn(window, 'open').mockImplementation(() => {});
  renderCard();
  const card = screen.getByRole('button');

  fireEvent.keyDown(card, { key });
  fireEvent.keyUp(card, { key });

  expect(open).toHaveBeenCalledTimes(1);
  expect(open).toHaveBeenCalledWith('u', '_blank');
  open.mockRestore();
});

test.each(['Enter', ' '])('holding %p down opens the image only once', (key) => {
  const open = jest.spyOn(window, 'open').mockImplementation(() => {});
  renderCard();
  const card = screen.getByRole('button');

  fireEvent.keyDown(card, { key });
  fireEvent.keyDown(card, { key, repeat: true });
  fireEvent.keyDown(card, { key, repeat: true });
  fireEvent.keyUp(card, { key });

  expect(open).toHaveBeenCalledTimes(1);
  open.mockRestore();
});

test('a Space press abandoned by moving focus away does not activate later', () => {
  const open = jest.spyOn(window, 'open').mockImplementation(() => {});
  renderCard();
  const card = screen.getByRole('button');

  // Press on the card, move focus away, release elsewhere
  fireEvent.keyDown(card, { key: ' ' });
  fireEvent.blur(card);
  // Focus comes back and a Space press that started elsewhere is released here
  fireEvent.keyUp(card, { key: ' ' });

  expect(open).not.toHaveBeenCalled();
  open.mockRestore();
});

test('a held Space repeating onto the card after focus moved does not activate it', () => {
  const open = jest.spyOn(window, 'open').mockImplementation(() => {});
  renderCard();
  const card = screen.getByRole('button');

  // The initial press happened elsewhere; only repeats reach this card
  fireEvent.keyDown(card, { key: ' ', repeat: true });
  fireEvent.keyUp(card, { key: ' ' });

  expect(open).not.toHaveBeenCalled();
  open.mockRestore();
});

test('releasing Space without pressing it on the card does nothing', () => {
  const open = jest.spyOn(window, 'open').mockImplementation(() => {});
  renderCard();

  fireEvent.keyUp(screen.getByRole('button'), { key: ' ' });

  expect(open).not.toHaveBeenCalled();
  open.mockRestore();
});

test('shows a fallback when the thumbnail fails to load', () => {
  render(
    <Result
      album={{ id: 1, title: 't', artist: 'a', imageUrl: 'broken', originalImageUrl: 'u' }}
      useJPG={false}
    />
  );

  fireEvent.error(screen.getByAltText('t cover'));

  expect(screen.getByText('No preview')).toBeInTheDocument();
  expect(document.querySelector('.loading-spinner')).toBeNull();
});

test('a card whose thumbnail failed shows the new one when its image URL changes', () => {
  const album = { id: 1, title: 't', artist: 'a', imageUrl: 'broken', originalImageUrl: 'u' };
  const { rerender } = render(<Result album={album} useJPG={false} />);
  fireEvent.error(screen.getByAltText('t cover'));
  expect(screen.getByText('No preview')).toBeInTheDocument();

  rerender(<Result album={{ ...album, imageUrl: 'working' }} useJPG={false} />);

  expect(screen.queryByText('No preview')).toBeNull();
  expect(screen.getByAltText('t cover')).toHaveAttribute('src', 'working');
});
