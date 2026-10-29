import { useState } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { CarouselNavigationEditor } from './CarouselNavigationEditor';
import type { CarouselNavigation } from '@/lib/carouselNavigation';
let value: CarouselNavigation | undefined;
function Example() { const [nav,setNav]=useState<CarouselNavigation>(); return <CarouselNavigationEditor value={nav} onChange={next=>{value=next;setNav(next);}}/>; }
afterEach(cleanup);
it('combines edits to numbering, arrow style, caption and visibility and can reset them',()=>{
  render(<Example/>);
  fireEvent.change(screen.getByLabelText('Wygląd numeracji'),{target:{value:'dots'}});
  fireEvent.change(screen.getByLabelText('Rodzaj strzałki'),{target:{value:'circle'}});
  fireEvent.change(screen.getByLabelText('Podpis przy strzałce'),{target:{value:'Przesuń po więcej'}});
  fireEvent.click(screen.getByLabelText('Ukryj numerację na pierwszym slajdzie'));
  expect(value).toMatchObject({numberStyle:'dots',arrowStyle:'circle',caption:'Przesuń po więcej',numberHideFirst:true});
  fireEvent.click(screen.getByRole('button',{name:'Dół środek'})); expect(value).toMatchObject({numberX:50,numberY:95});
  fireEvent.click(screen.getByRole('button',{name:'Przywróć domyślną nawigację'})); expect(value).toBeUndefined();
});
