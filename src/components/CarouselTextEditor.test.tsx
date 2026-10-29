import { useState } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { CarouselTextEditor } from './CarouselTextEditor';
import { type TextMark } from '@/lib/carouselRichText';
let updated: TextMark[] = [];
function Example() {
  const [marks, setMarks] = useState<TextMark[]>([{ start: 0, end: 5, color: '#ff0000' }]);
  return <CarouselTextEditor id="text" label="Nagłówek" value="Ważne słowo" maximum={100} marks={marks} onChange={(_value, next) => { updated = next; setMarks(next); }}/>;
}
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
function selectWord() {
  const input = screen.getByRole('textbox', { name: 'Nagłówek' }) as HTMLTextAreaElement;
  act(() => { input.focus(); input.setSelectionRange(0,5); }); fireEvent.select(input); return input;
}
it('enlarges the selected word repeatedly and keeps the existing color and selection', () => {
  render(<Example/>); const input = selectWord();
  fireEvent.click(screen.getByRole('button', { name: 'Nagłówek: powiększ zaznaczone słowa' }));
  fireEvent.click(screen.getByRole('button', { name: 'Nagłówek: powiększ zaznaczone słowa' }));
  expect(updated).toEqual([{ start: 0, end: 5, color: '#ff0000', size: 120 }]); expect(input.selectionStart).toBe(0); expect(input.selectionEnd).toBe(5);
});
it('sets individual underline/background effects and clears only the marker', () => {
  render(<Example/>); selectWord();
  fireEvent.change(screen.getByLabelText('Rodzaj podkreślenia'), { target: { value: 'wavy' } });
  fireEvent.click(screen.getByRole('button', { name: 'Tło markera' }));
  fireEvent.change(screen.getByLabelText('Nagłówek: zaokrąglenie tła słów'), { target: { value: 20 } });
  expect(updated[0]).toMatchObject({ underline: true, underlineStyle: 'wavy', highlightRadius: 20, highlight: '#fde047' });
  fireEvent.click(screen.getByRole('button', { name: 'Usuń tylko tło słów' }));
  expect(updated[0]).toMatchObject({ color: '#ff0000', underline: true, underlineStyle: 'wavy' }); expect(updated[0].highlight).toBeUndefined();
});
