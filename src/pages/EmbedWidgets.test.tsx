import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import EmbedWidgets from './EmbedWidgets';
vi.mock('@/components/AppLayout',()=>({AppLayout:({children}:{children:ReactNode})=><main>{children}</main>}));
afterEach(()=>{cleanup();vi.restoreAllMocks();});
const open=()=>render(<MemoryRouter><EmbedWidgets/></MemoryRouter>);
it('opens and selects executable code when clipboard permission is denied',async()=>{
  Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:vi.fn().mockRejectedValue(new Error('Denied'))}});
  open();fireEvent.click(screen.getByRole('button',{name:'Kopiuj kod HTML'}));
  await screen.findByText(/Schowek jest niedostępny/);
  const code=screen.getByLabelText('Kod HTML widżetu') as HTMLTextAreaElement;
  expect(code.closest('details')).toHaveAttribute('open');expect(code).toHaveFocus();expect(code.selectionStart).toBe(0);expect(code.selectionEnd).toBe(code.value.length);expect(code.value).toContain('customElements.define');
});
it('blocks exporting conflicting schedule dates and restores export after correction',async()=>{
  open();fireEvent.click(screen.getByRole('button',{name:'Wolne miejsca'}));
  fireEvent.change(screen.getByLabelText('Źródło wartości'),{target:{value:'steps'}});
  fireEvent.click(screen.getByRole('button',{name:'Dodaj termin zmiany'}));
  const first=screen.getByLabelText('Data etapu 1') as HTMLInputElement;
  fireEvent.change(screen.getByLabelText('Data etapu 2'),{target:{value:first.value}});
  expect(screen.getByRole('alert')).toHaveTextContent('różne daty');expect(screen.getByRole('button',{name:'Kopiuj kod HTML'})).toBeDisabled();
  fireEvent.click(screen.getByRole('button',{name:'Usuń etap 2'}));
  await waitFor(()=>expect(screen.getByRole('button',{name:'Kopiuj kod HTML'})).toBeEnabled());
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});
