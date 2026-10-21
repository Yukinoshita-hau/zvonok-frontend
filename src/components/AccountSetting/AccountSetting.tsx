import { useDispatch, useSelector } from 'react-redux';
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './AccountSetting.module.css';
import type { AppDispatch, RootState } from '../../store/store';
import { getMyUser, logoutUser, updateUser, uploadAvatar } from '../../store/slices/user.slice';
import { AVATAR_READBACK_FAILED } from '../../api/profileResponse';
import { UserProfileCard } from '../UserProfileCard/UserProfileCard';
import { StringToColor } from '../../utils/stringHelpers';
import { resolveMediaUrl } from '../../utils/mediaUrl';
import { validateAvatar, validateProfile } from './profileValidation';

export function AccountSetting({onFormStateChange, compact = false}: {onFormStateChange?: (state:{dirty:boolean;busy:boolean})=>void; compact?: boolean}) {
  const id = useId();
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const user = useSelector((s:RootState)=>s.user.myUser);
  const callStatus = useSelector((s:RootState)=>s.call.status);
  const [displayName,setDisplayName] = useState(user?.displayName ?? '');
  const [aboutMe,setAboutMe] = useState(user?.aboutMe ?? '');
  const [file,setFile] = useState<File|null>(null);
  const [preview,setPreview] = useState<string|null>(null);
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  const [saved,setSaved] = useState(false);
  const [baseline,setBaseline] = useState(user);
  const [refreshRequired,setRefreshRequired] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const pending = useRef(false);
  const dirty = displayName!==(baseline?.displayName ?? '') || aboutMe!==(baseline?.aboutMe ?? '') || !!file;
  // shortcut: detects observed updates only; use conditional writes when the API provides version tokens.
  const externalChange = dirty && (baseline?.displayName !== user?.displayName || baseline?.aboutMe !== user?.aboutMe);
  const validation = validateProfile(displayName,aboutMe);
  const nameError = validateProfile(displayName, '');
  const aboutError = aboutMe.length > 1000 ? 'Не более 1000 символов.' : null;
  useEffect(()=>{
    if (user?.id !== baseline?.id || (!dirty && !busy && user !== baseline)) {setBaseline(user);setDisplayName(user?.displayName ?? '');setAboutMe(user?.aboutMe ?? '');setSaved(false);if(user?.id !== baseline?.id){setFile(null);setError('');setRefreshRequired(false);}}
  },[user,dirty,busy]);
  useEffect(()=>{
    if (!dirty && !busy) return;
    const guard = (event: BeforeUnloadEvent) => {event.preventDefault();event.returnValue='';};
    window.addEventListener('beforeunload',guard);
    return ()=>window.removeEventListener('beforeunload',guard);
  },[dirty,busy]);
  useLayoutEffect(()=>{onFormStateChange?.({dirty,busy});},[dirty,busy,onFormStateChange]);
  useEffect(()=>{
    if (!file) {setPreview(null);return;}
    const url = URL.createObjectURL(file); setPreview(url);
    return ()=>URL.revokeObjectURL(url);
  },[file]);
  const reset = () => {setBaseline(user);setDisplayName(user?.displayName ?? '');setAboutMe(user?.aboutMe ?? '');setFile(null);setError('');setSaved(false);if(input.current) input.current.value='';};
  const save = async () => {
    if (pending.current || validation || !dirty || refreshRequired) return;
    pending.current=true;setBusy(true);setError('');setSaved(false);
    let avatarSaved = false;
    try {
      if (externalChange) {setError('Профиль изменён в другом месте. Сбросьте черновик и повторите изменения.');return;}
      let confirmed = user;
      if (file) {
        const uploaded = await dispatch(uploadAvatar(file)).unwrap();
        confirmed=uploaded;avatarSaved=true;
        setFile(null); if(input.current) input.current.value='';
      }
      const textChanged = displayName !== (baseline?.displayName ?? '') || aboutMe !== (baseline?.aboutMe ?? '');
      const updated = textChanged ? await dispatch(updateUser({displayName:displayName !== baseline?.displayName ? displayName.trim() : null,aboutMe:aboutMe !== (baseline?.aboutMe ?? '') ? aboutMe : null,avatarUrl:null})).unwrap() : confirmed;
      setBaseline(updated);setDisplayName(updated?.displayName ?? '');setAboutMe(updated?.aboutMe ?? '');setSaved(true);
    } catch(e) {
      if (e === AVATAR_READBACK_FAILED) {setFile(null);setRefreshRequired(true);if(input.current) input.current.value='';}
      setError((avatarSaved?'Аватар сохранён. Текст профиля не сохранён. ':'')+(typeof e==='string'?e:'Не удалось сохранить профиль. Попробуйте ещё раз.'));
    }
    finally {pending.current=false;setBusy(false);}
  };
  const logout = async (allDevices:boolean) => {
    if (pending.current || !window.confirm((dirty?'Несохранённые изменения профиля будут потеряны. ':'')+(callStatus==='in_call'||callStatus==='connecting'?'Выход завершит участие в звонке. ':'')+'Выйти '+(allDevices?'на всех устройствах?':'из аккаунта?'))) return;
    pending.current=true;setBusy(true);setError('');
    try {await dispatch(logoutUser({allDevices})).unwrap();navigate('/auth/login');}
    catch(e) {setError(typeof e==='string'?e:'Не удалось выйти из аккаунта.');}
    finally {pending.current=false;setBusy(false);}
  };
  const avatar = preview || resolveMediaUrl(user?.avatarUrl);
  return <div className={styles.container}>
    <div className={styles.content}>
      <form className={styles['edit-section']} onSubmit={e=>{e.preventDefault();void save();}}>
        <p className={styles.description}>Ваш профиль виден друзьям и участникам общих чатов.</p>
        <fieldset disabled={busy} className={styles.fields}>
          <div className={styles['form-group']}><label className={styles.label} htmlFor={`${id}-username`}>Имя пользователя</label><input id={`${id}-username`} className={styles.input} readOnly value={user?.username ?? ''}/><small>Уникальное имя аккаунта</small></div>
          <div className={styles['form-group']}><label className={styles.label} htmlFor={`${id}-name`}>Отображаемое имя</label><input id={`${id}-name`} className={styles.input} value={displayName} aria-invalid={!!nameError} aria-describedby={nameError?`${id}-name-error`:undefined} onChange={e=>{setDisplayName(e.target.value);setSaved(false);}}/>{nameError&&<small id={`${id}-name-error`}>{nameError}</small>}</div>
          <div className={styles['form-group']}><label className={styles.label} htmlFor={`${id}-about`}>Обо мне</label><textarea id={`${id}-about`} rows={3} maxLength={1000} className={styles.input} value={aboutMe} aria-invalid={!!aboutError} aria-describedby={`${id}-about-help`} onChange={e=>{setAboutMe(e.target.value);setSaved(false);}}/><small id={`${id}-about-help`}>{aboutError || `${aboutMe.length} / 1000`}</small></div>
          <div className={styles['form-group']}><span className={styles.label}>Аватар</span><div className={styles['avatar-upload']}>
            <div className={styles['avatar-upload-preview']} style={{background:StringToColor(user?.username ?? '')}}>{avatar?<img src={avatar} alt="Предпросмотр аватара"/>:<span>{(displayName[0]||'?').toUpperCase()}</span>}</div>
            <div><input ref={input} aria-label="Файл аватара" type="file" accept="image/png,image/jpeg,image/gif,image/webp" hidden onChange={e=>{
              const selected=e.target.files?.[0];if(!selected)return;
              const invalid=validateAvatar(selected);if(invalid){setError(invalid);e.target.value='';return;}
              setFile(selected);setSaved(false);setError('');
            }}/><button type="button" className={styles['btn-secondary']} onClick={()=>input.current?.click()}>Выбрать изображение</button>{file&&<small className={styles['file-meta']}>{file.name}</small>}</div>
          </div></div>
        </fieldset>
        {dirty&&validation&&<p role="alert">{validation}</p>}
        {error&&<p className={styles.error} role="alert">{error}</p>}
        {refreshRequired&&<button type="button" disabled={busy} onClick={async()=>{setBusy(true);try {await dispatch(getMyUser()).unwrap();setRefreshRequired(false);setError('Профиль перечитан. Проверьте черновик перед сохранением.');}catch{setError(AVATAR_READBACK_FAILED);}finally{setBusy(false);}}}>Обновить профиль</button>}
        {externalChange&&<p role="alert">Профиль обновлён в другом месте. Черновик сохранён локально; сбросьте его перед новой отправкой.</p>}
        <div className={styles['save-bar']}><span role="status">{busy?'Сохраняем…':error?'Сохранение не подтверждено':dirty?'Есть несохранённые изменения':saved?'Изменения сохранены':'Профиль актуален'}</span><button type="button" disabled={!dirty||busy} className={styles['btn-secondary']} onClick={reset}>Сбросить</button><button type="button" disabled={!dirty||busy} className={styles['btn-secondary']} onClick={reset}>Отменить</button><button type="submit" disabled={!user||!dirty||busy||!!validation||externalChange||refreshRequired} className={styles['btn-primary']}>Сохранить</button></div>
      </form>
      <aside className={styles['preview-section']} aria-label="Предпросмотр профиля"><span className={styles.label}>Предпросмотр</span><UserProfileCard displayName={displayName} username={user?.username ?? ''} avatarUrl={avatar} avatarBg={StringToColor(user?.username ?? '')} aboutMe={aboutMe}/></aside>
    </div>
    <section className={styles.logout} data-compact={compact}><h3>Безопасность и сеансы</h3><p>Для выхода потребуется подтверждение. «Выйти везде» отзывает все refresh-сеансы аккаунта. Список сеансов и завершение отдельного устройства сервер не предоставляет.</p><div className={styles['logout-actions']}><button disabled={busy} className={styles['btn-danger']} onClick={()=>void logout(false)}>Выйти</button><button disabled={busy} className={styles['btn-danger']} onClick={()=>void logout(true)}>Выйти везде</button></div></section>
  </div>;
}
