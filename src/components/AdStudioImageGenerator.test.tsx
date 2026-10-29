import { act,cleanup,fireEvent,render,screen,waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach,beforeEach,expect,it,vi } from 'vitest';
import { AdStudioImageGenerator } from './AdStudioImageGenerator';
import { vpsFetch } from '@/lib/vpsApi';
vi.mock('@/lib/vpsApi',()=>({vpsFetch:vi.fn()}));
const {credits,model,session}=vi.hoisted(()=>({credits:{isAdmin:false,balance:100,loading:false,refetch:vi.fn()},model:{id:'image-model',label:'Testowy model',cost:25,supportsReferenceImages:true},session:{user:{id:'user'}}}));
vi.mock('@/hooks/useCredits',()=>({useCredits:()=>credits}));
vi.mock('@/hooks/useAuth',()=>({useAuth:()=>session}));
vi.mock('@/hooks/useAiModels',()=>({useAiModels:()=>({aiModels:[model],selectedModel:model.id,selectedModelOption:model,setSelectedModel:vi.fn(),loading:false})}));
vi.mock('@/lib/authSession',()=>({getStoredAuthSession:()=>session}));
vi.mock('@/lib/localDesignExport',()=>({readLocalDesignImage:vi.fn(async()=>({dataUrl:'data:image/png;base64,AA=='})),saveLocalBlob:vi.fn()}));
const ad={title:'Reklama',hookPl:'Sprawdź ofertę',prompt:'Create ONE finished advertising image. Original approved copy.',needsImage:false,imageNote:'',styleId:'impact'};
const busy=vi.fn();
function open(needsImage=false){render(<MemoryRouter><AdStudioImageGenerator ad={{...ad,needsImage}} index={0} disabled={false} onBusyChange={busy}/></MemoryRouter>);fireEvent.click(screen.getByRole('button',{name:'Wygeneruj grafikę tutaj'}));}
beforeEach(()=>{credits.balance=100;credits.isAdmin=false;session.user.id='user';model.supportsReferenceImages=true;vi.mocked(vpsFetch).mockImplementation(async path=>path.includes('reference-upload')?{path:'graphics/user/references/ref.png'} as never:{imageUrl:'https://images.test/ad.png'} as never);});
afterEach(()=>{cleanup();vi.clearAllMocks();});
it('generates one priced image with the chosen composition and format, without losing approved copy',async()=>{
 open();fireEvent.change(screen.getByLabelText('Kompozycja grafiki 1'),{target:{value:'closeup'}});fireEvent.change(screen.getByLabelText('Format grafiki 1'),{target:{value:'1080x1350'}});
 fireEvent.click(screen.getByRole('button',{name:'Generuj 1 grafikę · 25 kredytów'}));await screen.findByRole('img',{name:'Gotowa reklama 1, wariant 1'});
 const call=vi.mocked(vpsFetch).mock.calls[0];expect(call[0]).toBe('/ai/generate-image');expect(call[2]).toEqual({retryAuthOnly:true});const body=JSON.parse(call[1]!.body as string);expect(body).toMatchObject({model:'image-model',expectedCreditCost:25,count:1,dimensions:'1080x1350',referenceImagePaths:[]});expect(body.prompt).toContain(ad.prompt);expect(body.prompt).toContain('tighter close-up');expect(credits.refetch).toHaveBeenCalled();expect(busy.mock.calls.map(item=>item[0])).toEqual([true,false]);
});
it('blocks reference concepts until a separate own photo is explicitly selected and uploaded',async()=>{
 open(true);expect(screen.getByRole('button',{name:'Generuj 1 grafikę · 25 kredytów'})).toBeDisabled();
 fireEvent.change(screen.getByLabelText('Zdjęcie referencyjne 1'),{target:{files:[new File(['own photo'],'own.png',{type:'image/png'})]}});
 fireEvent.click(screen.getByRole('button',{name:'Generuj 1 grafikę · 25 kredytów'}));await screen.findByRole('img');
 expect(vi.mocked(vpsFetch).mock.calls[0][0]).toBe('/gallery/reference-upload');const body=JSON.parse(vi.mocked(vpsFetch).mock.calls[1][1]!.body as string);expect(body.referenceImagePaths).toEqual(['graphics/user/references/ref.png']);
});
it('prevents duplicate paid requests and ignores a late result after account change',async()=>{
 let resolve!:(value:{imageUrl:string})=>void;vi.mocked(vpsFetch).mockImplementation(()=>new Promise(done=>{resolve=done;}));open();const button=screen.getByRole('button',{name:'Generuj 1 grafikę · 25 kredytów'});fireEvent.click(button);fireEvent.click(button);expect(vpsFetch).toHaveBeenCalledTimes(1);session.user.id='other';await act(async()=>resolve({imageUrl:'https://images.test/private.png'}));expect(screen.queryByRole('img')).not.toBeInTheDocument();
});
it('retains previous results on provider error and does not spend on insufficient balance',async()=>{
 open();fireEvent.click(screen.getByRole('button',{name:'Generuj 1 grafikę · 25 kredytów'}));await screen.findByRole('img');vi.mocked(vpsFetch).mockRejectedValueOnce(new Error('Błąd dostawcy'));fireEvent.click(screen.getByRole('button',{name:'Generuj 1 grafikę · 25 kredytów'}));expect(await screen.findByRole('alert')).toHaveTextContent('Błąd dostawcy');expect(screen.getByRole('img')).toBeInTheDocument();cleanup();credits.balance=0;open();await waitFor(()=>expect(screen.getByRole('button',{name:'Generuj 1 grafikę · 25 kredytów'})).toBeDisabled());
});
