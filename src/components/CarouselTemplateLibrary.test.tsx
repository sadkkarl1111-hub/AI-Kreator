import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CarouselTemplateLibrary } from './CarouselTemplateLibrary';
vi.mock('./CarouselTemplatePreview', () => ({ CarouselTemplatePreview: () => <span data-testid="template-preview"/> }));

describe('carousel template library', () => {
  it('shows the new creator collection first and searches Polish text without requiring accents', () => {
    render(<CarouselTemplateLibrary selected="creator-red-manifest" onSelect={vi.fn()} onApply={vi.fn()}/>);
    expect(screen.getAllByRole('button', { name: /^Wybierz szablon:/ })).toHaveLength(12);
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'bledow' } });
    expect(screen.getAllByRole('button', { name: /^Wybierz szablon:/ })).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Wybierz szablon: 5 błędów na profilu' })).toBeInTheDocument();
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Wszystkie', exact: true }));
    expect(screen.getAllByRole('button', { name: /^Wybierz szablon:/ })).toHaveLength(24);
    fireEvent.click(screen.getByRole('button', { name: 'Klasyczne', exact: true }));
    expect(screen.getAllByRole('button', { name: /^Wybierz szablon:/ })).toHaveLength(12);
  });
  it('keeps selection separate from applying and lets users omit generated example photos', () => {
    const select = vi.fn(), apply = vi.fn();
    render(<CarouselTemplateLibrary selected="creator-red-manifest" onSelect={select} onApply={apply}/>);
    fireEvent.click(screen.getByRole('button', { name: 'Wybierz szablon: Webinar eksperta' }));
    expect(select).toHaveBeenCalledWith('creator-webinar'); expect(apply).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Zastosuj szablon' }));
    expect(apply).toHaveBeenCalledWith(false);
  });
});
