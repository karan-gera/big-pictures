import { render, screen, fireEvent, act } from '@testing-library/react';
import App from './App';
import { searchWithFallback } from './utils/albumSearch';

vi.mock('./utils/albumSearch', () => ({
  API_ORDER: ['itunes', 'lastfm', 'discogs', 'musicbrainz'],
  searchWithFallback: vi.fn(),
}));

const album = (title) => ({
  id: title,
  title,
  artist: 'artist',
  year: 2000,
  imageUrl: 'https://example.com/a.jpg',
});

beforeAll(() => {
  window.matchMedia = () => ({
    matches: false,
    addEventListener: () => {},
    removeEventListener: () => {},
  });
});

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(console, 'log').mockImplementation(() => {});
  localStorage.clear();
  searchWithFallback.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const input = () => screen.getByPlaceholderText(/album\/single name/i);
const type = (value) => fireEvent.change(input(), { target: { value } });
const settle = async (ms = 500) => {
  await act(async () => {
    vi.advanceTimersByTime(ms);
  });
};
const isLoading = () => document.querySelector('.loading') !== null;

test('renders the search box', () => {
  render(<App />);
  expect(input()).toBeInTheDocument();
});

test('clearing the input while a search is loading stops the loading state', async () => {
  searchWithFallback.mockReturnValue(new Promise(() => {}));
  render(<App />);

  type('kid a');
  await settle();
  expect(isLoading()).toBe(true);

  type('');
  await settle();
  expect(isLoading()).toBe(false);
});

test('changing the input and changing it back keeps the existing results', async () => {
  searchWithFallback.mockResolvedValue({ api: 'itunes', results: [album('Kid A')] });
  render(<App />);

  type('kid a');
  await settle();
  expect(screen.getByText('Kid A')).toBeInTheDocument();

  type('kid ab');
  await settle(200);
  type('kid a');
  await settle(1000);

  expect(screen.getByText('Kid A')).toBeInTheDocument();
  expect(document.querySelector('.album-card.fade-out')).toBeNull();
  expect(searchWithFallback).toHaveBeenCalledTimes(1);
});

test('typing right after clicking the title keeps the new input', async () => {
  searchWithFallback.mockResolvedValue({ api: 'itunes', results: [album('Kid A')] });
  render(<App />);

  type('kid a');
  await settle();

  fireEvent.click(screen.getByText('bigpictures.xyz'));
  type('ok computer');
  await settle(1000);

  expect(input().value).toBe('ok computer');
});

test('a search that finishes after a newer one started does not replace its results', async () => {
  let resolveFirst;
  searchWithFallback
    .mockReturnValueOnce(new Promise((resolve) => (resolveFirst = resolve)))
    .mockResolvedValueOnce({ api: 'itunes', results: [album('OK Computer')] });
  render(<App />);

  type('kid a');
  await settle();
  type('ok computer');
  await settle();
  expect(screen.getByText('OK Computer')).toBeInTheDocument();

  await act(async () => {
    resolveFirst({ api: 'itunes', results: [album('Kid A')] });
  });

  expect(screen.getByText('OK Computer')).toBeInTheDocument();
  expect(screen.queryByText('Kid A')).toBeNull();
});

test('pressing Enter on the title clears the search', async () => {
  render(<App />);
  type('kid a');

  fireEvent.keyDown(screen.getByText('bigpictures.xyz'), { key: 'Enter' });

  expect(input().value).toBe('');
});

test('pressing Space on a focused card does not jump to the search box', async () => {
  searchWithFallback.mockResolvedValue({ api: 'itunes', results: [album('Kid A')] });
  vi.spyOn(window, 'open').mockImplementation(() => {});
  render(<App />);
  type('kid a');
  await settle();

  const card = document.querySelector('.album-card');
  card.focus();
  fireEvent.keyDown(card, { key: ' ' });
  fireEvent.keyUp(card, { key: ' ' });

  expect(document.activeElement).toBe(card);
  expect(window.open).toHaveBeenCalled();
});

test('the info modal opens normally again after being closed', async () => {
  render(<App />);
  fireEvent.click(screen.getByLabelText('Show help'));
  fireEvent.click(screen.getByText('×'));
  await settle(250);
  expect(document.querySelector('.modal-overlay')).toBeNull();

  fireEvent.click(screen.getByLabelText('Show help'));
  expect(document.querySelector('.modal-overlay')).not.toHaveClass('closing');
});

test('clearing the input after a search finished shows neither results nor loading', async () => {
  searchWithFallback.mockResolvedValue({ api: 'itunes', results: [album('Kid A')] });
  render(<App />);
  type('kid a');
  await settle();
  expect(screen.getByText('Kid A')).toBeInTheDocument();

  type('');
  await settle();

  expect(isLoading()).toBe(false);
  expect(document.querySelector('.album-card')).toBeNull();
});
