import { useState } from 'react';
import { cleanup,fireEvent,render,screen,waitFor } from '@testing-library/react';
import { afterEach,beforeEach,expect,it,vi } from 'vitest';
import { AdCompetitorResearch } from './AdCompetitorResearch';
import { vpsFetch } from '@/lib/vpsApi';
import type { AdResearchExample } from '@/lib/adStudio';
vi.mock('@/lib/vpsApi',()=>({vpsFetch:vi.fn()}));
const report={observations:[{observation:'Tekst wskazuje konkretną cechę.',evidenceIds:['12345']}],tests:[{hypothesis:'Konkret może zwiększyć liczbę zapytań.',variantA:'Poznaj ofertę',variantB:'Wybierz zapach',metric:'Koszt zapytania'}]};
function Example(){const [value,setValue]=useState<AdResearchExample[]>([]);return <AdCompetitorResearch description="Własna oferta świec" goal="messages" value={value} onChange={setValue} disabled={false}/>;}
beforeEach(()=>{vi.mocked(vpsFetch).mockImplementation(async path=>path.endsWith('/status')?{configured:false} as never:{report} as never);});
afterEach(()=>{cleanup();vi.resetAllMocks();});
function open(){render(<Example/>);fireEvent.click(screen.getByText(/Konkurencja i plan testów/));}
it('provides honest fallback when Meta is not connected and searches any topic through the public library',async()=>{
 open();await screen.findByText(/Automatyczne pobieranie reklam Meta czeka/);
 fireEvent.change(screen.getByLabelText('Branża lub firma'),{target:{value:'księgowość i faktury'}});
 expect(screen.getByRole('link',{name:'Otwórz Bibliotekę Meta'})).toHaveAttribute('href',expect.stringContaining('q=ksi%C4%99gowo%C5%9B%C4%87+i+faktury'));
 expect(screen.getByRole('button',{name:'Wyszukaj w Meta'})).toBeDisabled();
});
it('keeps competitor copy separate and sends selected examples with the user offer for a hypothesis report',async()=>{
 open();fireEvent.change(screen.getByLabelText('Nazwa źródła inspiracji'),{target:{value:'Konkurent'}});fireEvent.change(screen.getByLabelText('Tekst reklamy konkurencji'),{target:{value:'Odkryj leśne zapachy'}});fireEvent.click(screen.getByRole('button',{name:'Dodaj do inspiracji'}));
 fireEvent.click(screen.getByRole('button',{name:'Przeanalizuj inspiracje i zaproponuj testy'}));
 await screen.findByRole('region',{name:'Plan testów reklam'});expect(screen.getByText(/Koszt zapytania/)).toBeVisible();
 const call=vi.mocked(vpsFetch).mock.calls.find(([path])=>path.endsWith('/analyze'))!;
 expect(call[2]).toEqual({retryAuthOnly:true});expect(JSON.parse(call[1]!.body as string)).toMatchObject({text:'Własna oferta świec',goal:'messages',competitorExamples:[{pageName:'Konkurent',text:'Odkryj leśne zapachy',source:'manual'}]});
 fireEvent.click(screen.getByRole('button',{name:'Usuń inspirację: Konkurent'}));expect(screen.queryByRole('region',{name:'Plan testów reklam'})).not.toBeInTheDocument();
});
it('searches configured Meta and adds a selected source without fetching an arbitrary URL',async()=>{
 vi.mocked(vpsFetch).mockImplementation(async path=>path.endsWith('/status')?{configured:true} as never:{ads:[{id:'12345',pageName:'Marka',text:'Przykładowa reklama',url:'https://www.facebook.com/ads/library/?id=12345',source:'meta'}],limited:true} as never);
 open();await waitFor(()=>expect(screen.getByRole('button',{name:'Wyszukaj w Meta'})).toBeDisabled());
 fireEvent.change(screen.getByLabelText('Branża lub firma'),{target:{value:'Dowolna branża'}});
 await waitFor(()=>expect(screen.getByRole('button',{name:'Wyszukaj w Meta'})).toBeEnabled());fireEvent.click(screen.getByRole('button',{name:'Wyszukaj w Meta'}));
 fireEvent.click(await screen.findByRole('button',{name:'Dodaj inspirację'}));expect(screen.getByText('Marka · Biblioteka Meta')).toBeVisible();expect(screen.getByText(/pierwszą próbkę do 20 reklam/)).toBeVisible();
});
