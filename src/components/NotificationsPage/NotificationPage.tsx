import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { Bell, CheckCheck, UserRound, Info, Check, AlertTriangle } from 'lucide-react';
import { useDispatch, useSelector } from 'react-redux';
import type { RootState } from '../../store/store';
import type { Notification } from '../../store/interfaces/notification.interface';
import { notificationAction } from '../../store/slices/notification.slice';
import { UserMiniProfileModal } from '../UserMiniProfileModal/UserMiniProfileModal';
import { notificationRoute, notificationTime } from './notificationPresentation';
import styles from './NotificationPage.module.css';

const labels = {info:'Информация',success:'Успешно',warning:'Предупреждение',error:'Ошибка'};
const icons = {info:Info,success:Check,warning:AlertTriangle,error:AlertTriangle};
export function NotificationsPage() {
  const navigate=useNavigate(), dispatch=useDispatch();
  const notifications=useSelector((s:RootState)=>s.notification.notifications);
  const users=useSelector((s:RootState)=>s.users.byId);
  const friends=useSelector((s:RootState)=>s.friend);
  const ws=useSelector((s:RootState)=>s.websocket.status);
  const [filter,setFilter]=useState<'all'|'unread'>('all');
  const [profileId,setProfileId]=useState<number|null>(null);
  const unread=notifications.filter(n=>!n.read).length;
  const visible=filter==='unread'?notifications.filter(n=>!n.read):notifications;
  const open=(n:Notification)=>{
    dispatch(notificationAction.markAsRead({id:n.id}));
    if(n.target.type==='FRIEND_PROFILE'){
      const username=n.target.username;
      const id=Object.values(users).find(u=>u.username===username)?.id
        ?? friends.friends.find(f=>f.friendUsername===username)?.friendId
        ?? friends.incomingRequests.find(r=>r.senderUsername===username)?.senderId;
      if(id){setProfileId(id);return;}
    }
    const route=notificationRoute(n.target);if(route)navigate(route);
  };
  return <div className={styles['notification-page']}>
    <header className={styles.header}><Bell size={20}/><h2>Уведомления</h2><span>{unread} непрочитанных</span><button disabled={!unread} onClick={()=>dispatch(notificationAction.markAllIsRead())}><CheckCheck size={16}/>Прочитать все</button></header>
    <div className={styles.filters} aria-label="Фильтр уведомлений"><button aria-pressed={filter==='all'} onClick={()=>setFilter('all')}>Все</button><button aria-pressed={filter==='unread'} onClick={()=>setFilter('unread')}>Непрочитанные {unread>0&&('· '+unread)}</button></div>
    {ws!=='connected'&&<p role="status" className={styles.connection}>{ws==='connecting'?'Подключаемся к уведомлениям…':'Нет связи с сервером. Новые уведомления появятся после восстановления соединения.'}</p>}
    <div className={styles.list}>
      {!visible.length?<div className={styles.empty}><Bell size={32}/><h3>{filter==='unread'?'Всё прочитано':'Пока тихо'}</h3><p>{filter==='unread'?'Новых уведомлений нет.':'Новые заявки в друзья и ответы появятся здесь.'}</p><small>Здесь хранятся уведомления текущей сессии.</small></div>:visible.map(n=>{
        const Icon=n.target.type==='FRIEND_PROFILE'?UserRound:icons[n.type];
        return <article key={n.id} className={styles.item} data-unread={!n.read}>
          <button className={styles.open} onClick={()=>open(n)} aria-label={(n.read?'Прочитано: ':'Не прочитано: ')+n.title}>
            <span className={styles.icon}><Icon size={20}/></span><span className={styles.body}><span className={styles.meta}>{labels[n.type]} · {n.read?'Прочитано':'Новое'}</span><strong>{n.title}</strong><span className={styles.message}>{n.message}</span></span><time dateTime={n.createdAt} title={n.createdAt}>{notificationTime(n.createdAt)}</time>
          </button>
          {!n.read&&<button className={styles.read} aria-label={'Прочитать: '+n.title} title="Отметить прочитанным" onClick={()=>dispatch(notificationAction.markAsRead({id:n.id}))}><Check size={17}/></button>}
        </article>;
      })}
    </div>
    <UserMiniProfileModal userId={profileId} isOpen={profileId!==null} onClose={()=>setProfileId(null)}/>
  </div>;
}
