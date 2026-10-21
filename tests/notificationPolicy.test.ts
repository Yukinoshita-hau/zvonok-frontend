import { describe, it, expect } from 'vitest';
import { defaultNotificationPolicy, normalizeNotificationPolicy, notificationPresentation } from '../src/utils/notificationPolicy';
import deviceReducer, { deviceActions } from '../src/store/slices/device.slice';

describe('E6 notification presentation policy', () => {
  const device = { notificationPolicy: defaultNotificationPolicy, notificationSoundsEnabled: true, desktopNotificationsEnabled: true };
  it('keeps sound and toast categories independent; OS sound is handled by the application', () => {
    expect(notificationPresentation({...device, notificationPolicy: {...defaultNotificationPolicy, messages:false}}, 'message')).toMatchObject({toast:false,sound:true});
    expect(notificationPresentation({...device, notificationPolicy: {...defaultNotificationPolicy, messageSound:false}}, 'message')).toMatchObject({toast:true,sound:false});
    expect(notificationPresentation({...device, notificationSoundsEnabled:false}, 'call').sound).toBe(false);
  });
  it('silences DND, with account scoped message exceptions and explicit call bypass', () => {
    const notificationPolicy = {...defaultNotificationPolicy, dnd:true, exceptions:[{accountId:1,roomId:7}]};
    expect(notificationPresentation({...device,notificationPolicy}, 'message',7,1)).toMatchObject({toast:true,sound:true});
    expect(notificationPresentation({...device,notificationPolicy}, 'message',7,2)).toMatchObject({toast:false,sound:false});
    expect(notificationPresentation({...device,notificationPolicy}, 'call',7,1)).toMatchObject({toast:false,sound:false});
    expect(notificationPresentation({...device,notificationPolicy:{...notificationPolicy,allowCallsDuringDnd:true}}, 'call')).toMatchObject({toast:true,sound:true});
    expect(notificationPresentation({...device,notificationPolicy,notificationSoundsEnabled:false}, 'message',7,1).sound).toBe(false);
  });
  it('controls the OS sound for existing friend and group notifications', () => {
    expect(notificationPresentation(device, 'friend_request').sound).toBe(true);
    expect(notificationPresentation({...device, notificationPolicy: {...defaultNotificationPolicy, eventSound:false}}, 'room').sound).toBe(false);
    expect(notificationPresentation({...device, notificationPolicy: {...defaultNotificationPolicy, dnd:true}}, 'room')).toMatchObject({toast:false,sound:false});
  });
  it('honours focus and message privacy without mutating delivery state', () => {
    const notificationPolicy = {...defaultNotificationPolicy, onlyUnfocused:true, preview:false};
    expect(notificationPresentation({...device,notificationPolicy}, 'message',1,1,true)).toMatchObject({toast:false,preview:false});
    expect(notificationPresentation({...device,notificationPolicy}, 'message',1,1,false).toast).toBe(true);
  });
  it('rejects malformed preferences and cross-account exception identities', () => {
    expect(normalizeNotificationPolicy({dnd:'true', exceptions:[null,{accountId:-1,roomId:2},{accountId:1,roomId:'2'}]})).toEqual(defaultNotificationPolicy);
    expect(normalizeNotificationPolicy(null)).toEqual(defaultNotificationPolicy);
    const original = deviceReducer(undefined,{type:'init'});
    expect(deviceReducer(original,deviceActions.setNotificationPolicy({dnd:true})).notificationPolicy.dnd).toBe(true);
    expect(original.notificationPolicy.dnd).toBe(false);
  });
});
