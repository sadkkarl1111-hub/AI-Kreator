import { useState } from 'react';
import { afterEach, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { CarouselWorkspaceSidebar, type CarouselPanel } from './CarouselWorkspaceSidebar';
const ids: CarouselPanel[] = ['templates', 'conversion', 'text', 'elements', 'media', 'generator', 'brand', 'background', 'style', 'navigation', 'export'];
function Example({ disabled = false }: { disabled?: boolean }) {
  const [active, setActive] = useState<CarouselPanel>('templates');
  const panels = Object.fromEntries(ids.map(id => [id, <input key={id} aria-label={`Input ${id}`} defaultValue={id}/>])) as Record<CarouselPanel, React.ReactNode>;
  return <CarouselWorkspaceSidebar active={active} onChange={setActive} panels={panels} disabled={disabled}/>;
}
afterEach(cleanup);
it('shows one section at a time and retains edits when switching sections', () => {
  render(<Example/>); expect(screen.getAllByRole('tabpanel')).toHaveLength(1);
  expect(screen.queryByRole('textbox', { name: 'Input text' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('tab', { name: 'Tekst' }));
  fireEvent.change(screen.getByRole('textbox', { name: 'Input text' }), { target: { value: 'Zapisany tekst' } });
  fireEvent.click(screen.getByRole('tab', { name: 'Marka' })); fireEvent.click(screen.getByRole('tab', { name: 'Tekst' }));
  expect(screen.getByRole('textbox', { name: 'Input text' })).toHaveValue('Zapisany tekst');
  expect(screen.getAllByRole('tabpanel')).toHaveLength(1);
});
it('supports both arrow directions and Home/End for the side navigation', () => {
  render(<Example/>);
  fireEvent.keyDown(screen.getByRole('tab', { name: 'Szablony' }), { key: 'ArrowDown' });
  expect(screen.getByRole('tab', { name: 'Okładki i CTA' })).toHaveFocus();
  fireEvent.keyDown(screen.getByRole('tab', { name: 'Okładki i CTA' }), { key: 'ArrowDown' });
  expect(screen.getByRole('tab', { name: 'Tekst' })).toHaveAttribute('aria-selected', 'true');
  expect(screen.getByRole('tab', { name: 'Tekst' })).toHaveFocus();
  fireEvent.keyDown(screen.getByRole('tab', { name: 'Tekst' }), { key: 'End' }); expect(screen.getByRole('tab', { name: 'Pobieranie' })).toHaveAttribute('aria-selected', 'true');
  fireEvent.keyDown(screen.getByRole('tab', { name: 'Pobieranie' }), { key: 'ArrowRight' }); expect(screen.getByRole('tab', { name: 'Szablony' })).toHaveAttribute('aria-selected', 'true');
});
it('disables document edits while keeping export cancellation accessible', () => {
  render(<Example disabled/>); expect(screen.getByRole('textbox', { name: 'Input templates' })).toBeDisabled();
  fireEvent.click(screen.getByRole('tab', { name: 'Pobieranie' })); expect(screen.getByRole('textbox', { name: 'Input export' })).toBeEnabled();
});
