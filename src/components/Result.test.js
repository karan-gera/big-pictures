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
