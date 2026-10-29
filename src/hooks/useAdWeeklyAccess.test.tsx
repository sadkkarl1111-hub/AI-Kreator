import { cleanup, renderHook, waitFor, act } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useAdWeeklyAccess } from './useAdWeeklyAccess';
import { vpsFetch } from '@/lib/vpsApi';
const auth=vi.hoisted(()=>({user:{id:'a'}}));
vi.mock('./useAuth',()=>({useAuth:()=>auth}));
vi.mock('@/lib/vpsApi',()=>({vpsFetch:vi.fn()}));
const data={campaign:{remaining:1,nextAvailableAt:null,limit:1,windowDays:7},research:{remaining:0,nextAvailableAt:'2026-11-01T12:00:00Z',limit:1,windowDays:7},lastSession:null};
afterEach(()=>{cleanup();vi.resetAllMocks();auth.user={id:'a'};});
it('loads independent quotas and fails closed when refresh fails',async()=>{
  vi.mocked(vpsFetch).mockResolvedValue(data);
  const {result}=renderHook(useAdWeeklyAccess);
  await waitFor(()=>expect(result.current.data?.campaign.remaining).toBe(1));
  expect(result.current.data?.research.remaining).toBe(0);
  vi.mocked(vpsFetch).mockRejectedValue(new Error('Brak połączenia'));
  await act(()=>result.current.refresh());expect(result.current.data).toBeUndefined();expect(result.current.error).toBe('Brak połączenia');
});
it('does not reveal saved campaigns from a previous account during an account switch',async()=>{
  vi.mocked(vpsFetch).mockResolvedValueOnce({...data,lastSession:{id:'private-a',prompts:[]}});
  const {result,rerender}=renderHook(useAdWeeklyAccess);
  await waitFor(()=>expect(result.current.data?.lastSession?.id).toBe('private-a'));
  let resolve;vi.mocked(vpsFetch).mockImplementation(()=>new Promise(r=>{resolve=r;}));
  auth.user={id:'b'};rerender();expect(result.current.data).toBeUndefined();
  await waitFor(()=>expect(vi.mocked(vpsFetch)).toHaveBeenCalledTimes(2));
  await act(async()=>{resolve(data);});expect(result.current.userId).toBe('b');expect(result.current.data?.lastSession).toBeNull();
});
