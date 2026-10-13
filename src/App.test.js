import { render, screen } from '@testing-library/react';
import App from './App';

beforeAll(() => {
  window.matchMedia = () => ({
    matches: false,
    addEventListener: () => {},
    removeEventListener: () => {},
  });
});

test('renders the search box', () => {
  render(<App />);
  expect(screen.getByPlaceholderText(/album\/single name/i)).toBeInTheDocument();
});
