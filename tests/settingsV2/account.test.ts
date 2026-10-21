import { describe, expect, it, vi, beforeEach } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import reducer, { updateUser, uploadAvatar, userActions } from '../../src/store/slices/user.slice';
import { userApi } from '../../src/api/userApi';
import users, { usersActions } from '../../src/store/slices/users.slice';
import { validateProfile, validateAvatar } from '../../src/components/AccountSetting/profileValidation';
import { AVATAR_READBACK_FAILED, confirmedProfile, profileRequestError } from '../../src/api/profileResponse';
vi.mock('../../src/api/userApi',()=>({userApi:{updateMyUser:vi.fn(),uploadAvatar:vi.fn(),getMyUser:vi.fn()}}));
const profile = {id:1,username:'fixture',displayName:'Fixture',aboutMe:'bio',avatarUrl:null};
const makeStore = () => {const store=configureStore({reducer:{user:reducer,users}});store.dispatch(userActions.addUser(profile as any));store.dispatch(usersActions.upsertUser({...profile,status:'ONLINE'}));return store;};
beforeEach(()=>vi.resetAllMocks());
describe('shared account contract',()=>{
  it('matches DTO limits including Unicode and empty biography',()=>{
    expect(validateProfile('Имя','')).toBeNull();
    expect(validateProfile('a'.repeat(50),'a'.repeat(1000))).toBeNull();
    for(const name of ['', '   ', 'ab', 'a'.repeat(51)]) expect(validateProfile(name,'')).toBeTruthy();
    expect(validateProfile('Alice','a'.repeat(1001))).toBeTruthy();
  });
  it('rejects unsupported, empty and oversized avatar files',()=>{
    for(const type of ['image/svg+xml','text/plain','']) expect(validateAvatar({type,size:1})).toBeTruthy();
    for(const size of [0,10*1024*1024+1]) expect(validateAvatar({type:'image/png',size})).toBeTruthy();
    for(const type of ['image/png','image/jpeg','image/gif','image/webp']) expect(validateAvatar({type,size:10*1024*1024})).toBeNull();
  });
  it('updates existing Redux only after acknowledgement and reconciles server normalization',async()=>{
    const store=makeStore();let resolve:any;
    vi.mocked(userApi.updateMyUser).mockImplementation(()=>new Promise(r=>{resolve=r;}));
    const pending=store.dispatch(updateUser({displayName:'new',aboutMe:'',avatarUrl:null}));
    expect(store.getState().user.status).toBe('loading');expect(store.getState().user.myUser?.aboutMe).toBe('bio');
    resolve({data:{...profile,displayName:'Normalized',aboutMe:''}});await pending.unwrap();
    expect(store.getState().user.myUser?.displayName).toBe('Normalized');expect(store.getState().user.myUser?.aboutMe).toBe('');
    expect(store.getState().users.byId[1].displayName).toBe('Normalized');
  });
  it('keeps confirmed profile on failure and retries',async()=>{
    const store=makeStore();vi.mocked(userApi.updateMyUser).mockRejectedValueOnce({response:{status:400}}).mockResolvedValueOnce({data:profile} as any);
    const body={displayName:'Fixture',aboutMe:'',avatarUrl:null};
    await expect(store.dispatch(updateUser(body)).unwrap()).rejects.toContain('валидации');
    expect(store.getState().user.myUser?.aboutMe).toBe('bio');await store.dispatch(updateUser(body)).unwrap();
    expect(store.getState().user.status).toBe('succeeded');
  });
  it('rejects HTTP 200 error bodies',()=>{expect(()=>confirmedProfile({message:'error'} as any)).toThrow();});
  it('rejects a response for another account',async()=>{
    const store=makeStore();vi.mocked(userApi.updateMyUser).mockResolvedValue({data:{...profile,id:2}} as any);
    await expect(store.dispatch(updateUser({displayName:'new',aboutMe:'',avatarUrl:null})).unwrap()).rejects.toBeTruthy();
    expect(store.getState().user.myUser?.id).toBe(1);
  });
  it('distinguishes authorization, validation, conflict and network failures',()=>{
    for(const [status,text] of [[401,'доступа'],[403,'доступа'],[400,'валидации'],[422,'валидации'],[409,'Конфликт']] as const) expect(profileRequestError({response:{status}})).toContain(text);
    expect(profileRequestError(new Error('offline'))).toContain('соединения');
  });
  it('requires upload plus readback and preserves avatar if later PUT fails',async()=>{
    const store=makeStore();vi.mocked(userApi.uploadAvatar).mockResolvedValue({} as any);
    vi.mocked(userApi.getMyUser).mockResolvedValue({data:{...profile,avatarUrl:'https://test/new'}} as any);
    await store.dispatch(uploadAvatar({} as File)).unwrap();
    vi.mocked(userApi.updateMyUser).mockRejectedValue(new Error('offline'));
    await expect(store.dispatch(updateUser({displayName:'new',aboutMe:'',avatarUrl:null})).unwrap()).rejects.toBeTruthy();
    expect(store.getState().user.myUser?.avatarUrl).toBe('https://test/new');
    expect(store.getState().users.byId[1].avatarUrl).toBe('https://test/new');
    expect(userApi.uploadAvatar).toHaveBeenCalledTimes(1);
  });
  it('does not publish unconfirmed upload or readback failure to Redux',async()=>{
    const store=makeStore();vi.mocked(userApi.uploadAvatar).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({} as any);
    await expect(store.dispatch(uploadAvatar({} as File)).unwrap()).rejects.toContain('соединения');
    expect(userApi.getMyUser).not.toHaveBeenCalled();vi.mocked(userApi.getMyUser).mockRejectedValue(new Error('offline'));
    await expect(store.dispatch(uploadAvatar({} as File)).unwrap()).rejects.toBe(AVATAR_READBACK_FAILED);
    expect(store.getState().user.myUser?.avatarUrl).toBeNull();
  });
});
