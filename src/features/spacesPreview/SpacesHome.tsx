import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { ArrowDown, ArrowRight, Bell, CalendarDays, Check, CircleHelp, Clock3, Film, Headphones, Link, MessageCircle, Palette, Plus, Search, Sparkles, UserPlus, Users, Video, X, Zap } from 'lucide-react';
import { filterSpaces, friends, recentSpaces } from './spacesData';
import type { Space } from './spacesData';

export function Avatar({ index = 0, small = false }: { index?: number; small?: boolean }) {
  const friend = friends[index % friends.length];
  return <span className={`sp-avatar ${friend.color} ${small ? 'small' : ''}`} title={friend.name}>{friend.initials}</span>;
}

function AvatarStack({ count = 3 }: { count?: number }) {
  return <span className="sp-avatar-stack" aria-label={`${count} участника`} >{Array.from({ length: Math.min(count, 4) }, (_, i) => <Avatar key={i} index={i} small />)}{count > 4 && <span className="sp-avatar extra">+{count - 4}</span>}</span>;
}

function SpaceIcon({ kind }: { kind: Space['kind'] }) {
  const Icon = kind === 'cinema' ? Film : kind === 'design' ? Palette : kind === 'music' ? Headphones : Sparkles;
  return <span className={`sp-space-icon ${kind}`}><Icon size={19} aria-hidden="true" /></span>;
}

function PanelHeading({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return <div className="sp-panel-heading"><h2>{children}</h2>{aside}</div>;
}

export function ActiveSpaceCard({ space, count, onOpen, onInvite }: { space: Space; count: number; onOpen: (s: Space) => void; onInvite: (s: Space) => void }) {
  return <article className={`sp-panel sp-active-card ${space.kind}`}>
    <div className="sp-active-heading"><SpaceIcon kind={space.kind}/><span className="sp-live"><i/>Сейчас</span></div>
    <h3><button className="sp-title-button" onClick={() => onOpen(space)}>{space.name}<ArrowRight size={14}/></button></h3>
    <p>{space.context}</p>
    <div className="sp-session"><span className="sp-equalizer" aria-hidden="true"><i/><i/><i/><i/></span>{space.kind === 'cinema' ? 'Смотрят фильм вместе' : 'Обсуждают новый проект'}</div>
    <div className="sp-active-footer"><AvatarStack count={count}/><span>{count} участника</span></div>
    <div className="sp-quick-actions"><button className="sp-primary" onClick={() => onOpen(space)}>Открыть Space<ArrowRight size={14}/></button><button className="sp-icon-button" aria-label={`Пригласить в ${space.name}`} onClick={() => onInvite(space)}><UserPlus size={16}/></button></div>
  </article>;
}

function PreviewDialog({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    const dialog = ref.current!;
    dialog.showModal();
    return () => { dialog.close(); previous?.focus(); };
  }, []);
  return <dialog ref={ref} className="sp-dialog" aria-labelledby="sp-dialog-title" onCancel={onClose} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
    <div className="sp-dialog-heading"><span className="sp-eyebrow">ZVONOK · ЛОКАЛЬНЫЙ ПРОТОТИП</span><button className="sp-icon-button" aria-label="Закрыть" onClick={onClose}><X size={18}/></button></div><h2 id="sp-dialog-title">{title}</h2>{children}
  </dialog>;
}

function InviteDialog({ space, empty, onClose }: { space?: Space; empty: boolean; onClose: () => void }) {
  const [spaceId, setSpaceId] = useState(space?.id ?? 'cinema');
  const [selected, setSelected] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const [sent, setSent] = useState(false);
  const available = empty ? [] : friends.filter(f => f.name.toLocaleLowerCase('ru').includes(query.toLocaleLowerCase('ru')));
  return <PreviewDialog title={sent ? 'Приглашение подготовлено' : 'Вместе интереснее'} onClose={onClose}>
    {sent ? <div className="sp-invite-success"><span className="sp-success-icon"><Check size={28}/></span><h3>{selected.length} приглашения в Space</h3><p>Локальный сценарий завершён. Друзьям ничего не отправлено.</p><button className="sp-primary" onClick={onClose}>Готово<Check size={16}/></button></div> : <>
      <p className="sp-dialog-description">Выберите Space и друзей, с которыми хотите провести время.</p>
      <label className="sp-label" htmlFor="invite-space">Пригласить в Space</label><select id="invite-space" value={spaceId} onChange={e => setSpaceId(e.target.value)}>{recentSpaces.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
      <label className="sp-search sp-invite-search"><Search size={16}/><input aria-label="Поиск друзей" value={query} onChange={e => setQuery(e.target.value)} placeholder="Найти друга по имени"/></label>
      <div className="sp-invite-list">{available.map(f => <label key={f.name} className="sp-invite-person"><Avatar index={friends.indexOf(f)}/><span><strong>{f.name}</strong><small>{f.activity}</small></span><input type="checkbox" checked={selected.includes(f.name)} onChange={e => setSelected(e.target.checked ? [...selected, f.name] : selected.filter(n => n !== f.name))}/></label>)}{!available.length && <p className="sp-no-results">{empty ? 'Пока нет друзей для приглашения.' : 'Друзья не найдены. Попробуйте другое имя.'}</p>}</div>
      <p className="sp-local-note"><CircleHelp size={14}/>Демо: приглашения не отправляются в сеть.</p><button className="sp-primary sp-full" disabled={!selected.length} onClick={() => setSent(true)}>Подготовить приглашение{selected.length > 0 && <span>· {selected.length}</span>}<ArrowRight size={16}/></button>
    </>}
  </PreviewDialog>;
}

export function RecentSpaces({ empty, query, onQuery, onOpen }: { empty: boolean; query: string; onQuery: (q: string) => void; onOpen: (s: Space) => void }) {
  const [filter, setFilter] = useState('all');
  const filtered = filterSpaces(empty ? [] : recentSpaces, query, filter);
  return <section className="sp-panel sp-recent" id="recent" aria-labelledby="recent-heading">
    <div className="sp-panel-heading"><h2 id="recent-heading">Недавние Spaces <span className="sp-count">{empty ? 0 : recentSpaces.length}</span></h2><ArrowDown size={15} className="sp-muted"/></div>
    <div className="sp-table-toolbar"><div className="sp-filters" aria-label="Фильтр Spaces">{[['all', 'Все'], ['personal', 'Личные'], ['hub', 'В Hub']].map(([value, label]) => <button key={value} aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}</button>)}</div><label className="sp-search sp-table-search"><Search size={15}/><input aria-label="Поиск недавних Spaces" placeholder="Найти Space…" value={query} onChange={e => onQuery(e.target.value)}/>{query && <button className="sp-icon-button" aria-label="Очистить поиск" onClick={() => onQuery('')}><X size={14}/></button>}</label></div>
    <table><thead><tr><th scope="col">Название</th><th scope="col">Создатель</th><th scope="col" className="sp-date">Открывали</th><th scope="col">Активность</th></tr></thead><tbody>{filtered.map(s => <tr key={s.id}><td><button className="sp-table-name" onClick={() => onOpen(s)}><SpaceIcon kind={s.kind}/><span><strong>{s.name}</strong><small>{s.context}</small></span></button></td><td><span className="sp-owner"><Avatar index={s.id === 'cinema' ? 0 : s.id === 'design' ? 2 : 3} small/>{s.owner}</span></td><td className="sp-date">{s.date}</td><td>{s.active ? <span className="sp-live"><i/>В Space</span> : <span className="sp-muted">{s.activity}</span>}</td></tr>)}</tbody></table>
    {!filtered.length && <div className="sp-table-empty"><Search size={23}/><h3>{empty ? 'Ваша история начинается здесь' : 'Таких Spaces пока нет'}</h3><p>{empty ? 'Открытые Spaces появятся в этом списке.' : 'Измените запрос или выберите другой фильтр.'}</p>{!empty && <button className="sp-text-button" onClick={() => { onQuery(''); setFilter('all'); }}>Сбросить поиск и фильтр</button>}</div>}
    <div className="sp-table-foot"><span role="status">{filtered.length} из {empty ? 0 : recentSpaces.length} Spaces</span><span>Ваши места. Ваш ритм.</span></div>
  </section>;
}

export function SpacesHome() {
  const initial = new URLSearchParams(location.search).get('state');
  const [scenario, setScenario] = useState(initial === 'empty' || initial === 'friends' ? initial : 'normal');
  const [query, setQuery] = useState('');
  const [modal, setModal] = useState<'invite' | 'create' | 'detail' | 'activity' | null>(null);
  const [chosen, setChosen] = useState<Space | undefined>();
  const [created, setCreated] = useState('');
  const [createdDone, setCreatedDone] = useState(false);
  const empty = scenario === 'empty';
  const many = scenario === 'friends';
  const search = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const keydown = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); search.current?.focus(); } };
    window.addEventListener('keydown', keydown);
    return () => window.removeEventListener('keydown', keydown);
  }, []);
  const open = (space: Space) => { setChosen(space); setModal('detail'); };
  const invite = (space?: Space) => { setChosen(space); setModal('invite'); };
  const create = () => { setCreated(''); setCreatedDone(false); setModal('create'); };
  return <div className="spaces-preview">
    <a className="sp-skip" href="#sp-main">К содержимому</a>
    <header className="sp-header"><a className="sp-brand" href="/scripts/spaces-preview/index.html" aria-label="Zvonok — Spaces Home"><span className="sp-brand-mark">z<span/></span>ZVONOK</a><label className="sp-search sp-global-search"><Search size={17}/><input ref={search} aria-label="Поиск Spaces" value={query} onChange={e => { setQuery(e.target.value); }} placeholder="Поиск Spaces…"/><kbd>Ctrl K</kbd></label><div className="sp-header-actions"><span className="sp-header-avatars"><AvatarStack count={empty ? 0 : many ? 6 : 3}/></span><button className="sp-secondary" onClick={() => invite()}><UserPlus size={15}/>Пригласить</button><span className="sp-header-divider"/><button className="sp-icon-button sp-bell" aria-label="Последняя активность" onClick={() => setModal('activity')}><Bell size={18}/>{!empty && <i/>}</button><span className="sp-self" title="Алексей · ваш профиль">АВ<span/></span></div></header>
    <main id="sp-main" tabIndex={-1} className="sp-main">
      <div className="sp-page-heading"><div><div className="sp-eyebrow">ВАШЕ ПРОСТРАНСТВО ДЛЯ ОБЩЕНИЯ</div><h1>Spaces <span>Home</span></h1><p>{empty ? 'Начните с места, в котором хочется быть.' : 'Хорошая компания уже рядом. Выбирайте, к чему присоединиться.'}</p></div><button className="sp-primary" onClick={create}><Plus size={17}/>Создать Space</button></div>
      <div className="sp-section-label"><span><i className="sp-dot"/>{empty ? 'Всё начинается с одного Space' : 'Сейчас в Zvonok'}</span><span>{empty ? 'Добро пожаловать' : `${many ? 6 : 3} друга в Spaces`}</span></div>
      <div className="sp-top-grid">
        <section className="sp-panel sp-welcome"><div className="sp-welcome-top"><span className="sp-eyebrow">МЕСТО ДЛЯ ВАШИХ ЛЮДЕЙ</span><span className="sp-spark"><Sparkles size={18}/></span></div><h2>{empty ? <>Привет!<br/>Это ваш Zvonok.</> : <>Собирайтесь.<br/>Будьте вместе.</>}</h2><div className="sp-mini-space" aria-hidden="true"><div className="sp-mini-top"><span className="sp-mini-dot"/><span>Вечер с друзьями</span><span className="sp-mini-live">LIVE</span></div><div className="sp-mini-scene"><div className="sp-orbit"/><span className="sp-mini-play"><Film size={20}/></span></div><div className="sp-mini-bottom"><AvatarStack count={3}/><span>Хорошо, когда все рядом</span></div></div><p>Фильм на вечер, общая идея или просто разговор — для каждого повода свой Space.</p><button className="sp-white" onClick={create}>Создать свой Space<ArrowRight size={15}/></button><span className="sp-welcome-note">Можно без Hub. Можно только для своих.</span></section>
        <section className="sp-active-column" aria-label="Активные Spaces">{empty ? <><div className="sp-panel sp-empty-active"><Film size={24}/><h2>Пока тихо</h2><p>Здесь появятся Spaces,<br/>в которых сейчас ваши друзья.</p></div><button className="sp-panel sp-empty-invite" onClick={() => invite()}><UserPlus size={22}/><strong>Позовите своих</strong><span>Вместе будет интереснее<ArrowRight size={15}/></span></button></> : <><ActiveSpaceCard space={recentSpaces[0]} count={many ? 6 : 3} onOpen={open} onInvite={invite}/><ActiveSpaceCard space={recentSpaces[1]} count={many ? 4 : 2} onOpen={open} onInvite={invite}/></>}</section>
        <section className="sp-panel sp-events"><PanelHeading aside={<CalendarDays size={17} className="sp-muted"/>}>Ближайшие встречи</PanelHeading><p className="sp-panel-caption">Четверг, 22 октября</p>{empty ? <div className="sp-quiet"><CalendarDays size={27}/><h3>Планов пока нет</h3><p>Отличный повод собраться<br/>спонтанно.</p></div> : <div className="sp-event-list"><button className="sp-event violet" onClick={() => open(recentSpaces[0])}><span className="sp-event-time">21:30<span>сегодня</span></span><span><strong>Большой киновечер</strong><small>Hub «Киноклуб»</small></span><Film size={15}/></button><button className="sp-event amber" onClick={() => open(recentSpaces[1])}><span className="sp-event-time">19:00<span>завтра</span></span><span><strong>Разбор идей</strong><small>Hub «Делаем вместе»</small></span><Palette size={15}/></button><button className="sp-event" onClick={() => open(recentSpaces[2])}><span className="sp-event-time">20:00<span>суббота</span></span><span><strong>Музыка и разговоры</strong><small>Личный Space</small></span><Headphones size={15}/></button></div>}<div className="sp-event-note"><Clock3 size={14}/><span>Встречи показаны как пример</span></div></section>
        <section className="sp-panel sp-friends"><PanelHeading aside={<span className="sp-count">{empty ? 0 : many ? 6 : 3}</span>}>Друзья рядом</PanelHeading><p className="sp-panel-caption">У каждого — свой повод быть вместе</p>{empty ? <div className="sp-quiet"><Users size={28}/><h3>Здесь будут ваши люди</h3><p>Пригласите друзей в свой<br/>первый Space.</p></div> : <div className="sp-friend-list">{friends.slice(0, many ? 6 : 3).map((f, i) => <button key={f.name} className="sp-friend" onClick={() => open(recentSpaces[i % 2])}><span className="sp-avatar-online"><Avatar index={i}/><i/></span><span><strong>{f.name}</strong><small>{f.activity}</small></span><ArrowRight size={14}/></button>)}</div>}{!many && <div className="sp-friends-invite"><UserPlus size={17}/><span>Хорошая компания<br/><strong>начинается с приглашения</strong></span></div>}<button className="sp-text-button" onClick={() => invite()}>Пригласить в Space<ArrowRight size={14}/></button></section>
      </div>
      <div className="sp-bottom-grid"><RecentSpaces empty={empty} query={query} onQuery={setQuery} onOpen={open}/><section className="sp-panel sp-together"><span className="sp-eyebrow">ЛУЧШЕ ВМЕСТЕ</span><h2>Один Space.<br/>Много общих моментов.</h2><p>Соберите своих людей вокруг того,<br/>что вам интересно.</p><div className="sp-together-art" aria-hidden="true"><span className="sp-orbit orbit-one"/><span className="sp-orbit orbit-two"/><span className="sp-art-avatar art-one"><Avatar index={0}/></span><span className="sp-art-avatar art-two"><Avatar index={1}/></span><span className="sp-art-avatar art-three"><Avatar index={2}/></span><div className="sp-art-center"><Zap size={29}/></div><span className="sp-art-label">ваше место быть вместе</span><span className="sp-art-star">✦</span></div><button className="sp-white" onClick={() => invite()}><UserPlus size={15}/>Пригласить друзей<ArrowRight size={15}/></button><span className="sp-welcome-note">Space — место. Hub — сообщество.</span></section></div>
    </main>
    <footer className="sp-preview-bar"><span><span className="sp-preview-dot"/>Визуальный прототип · локальные данные</span><label htmlFor="scenario">Сценарий<select id="scenario" value={scenario} onChange={e => { setScenario(e.target.value); setQuery(''); const url = new URL(location.href); url.searchParams.set('state', e.target.value); history.replaceState(null, '', url); }}><option value="normal">Обычный</option><option value="friends">Много друзей</option><option value="empty">Новый пользователь</option></select></label></footer>
    {modal === 'invite' && <InviteDialog space={chosen} empty={empty} onClose={() => setModal(null)}/>}
    {modal === 'detail' && chosen && <PreviewDialog title={chosen.name} onClose={() => setModal(null)}><div className="sp-detail"><SpaceIcon kind={chosen.kind}/><p>{chosen.context}</p><span className="sp-live"><i/>{chosen.active ? 'Друзья сейчас в Space' : 'Сейчас никого нет'}</span><p>Это предварительный просмотр карточки Space. Открытие Space не запускает голосовую или видеосессию.</p><div className="sp-local-note"><Video size={17}/>Звонками продолжает управлять существующая оболочка Zvonok. В прототипе подключение недоступно.</div><button className="sp-primary sp-full" onClick={() => setModal('invite')}><UserPlus size={16}/>Пригласить друзей</button></div></PreviewDialog>}
    {modal === 'create' && <PreviewDialog title={createdDone ? 'Ваш Space готов к просмотру' : 'Место для чего-то своего'} onClose={() => setModal(null)}>{createdDone ? <div className="sp-invite-success"><span className="sp-success-icon"><Check size={27}/></span><h3>{created}</h3><p>Локальный эскиз. Space не сохранён на сервере.</p><button className="sp-primary" onClick={() => setModal(null)}>Вернуться домой<ArrowRight size={15}/></button></div> : <form onSubmit={e => { e.preventDefault(); if (created.trim()) setCreatedDone(true); }}><p className="sp-dialog-description">Начните с названия. Space может существовать без Hub.</p><label className="sp-label" htmlFor="space-name">Название Space</label><input id="space-name" autoFocus required maxLength={60} value={created} onChange={e => setCreated(e.target.value)} placeholder="Например, Кино по пятницам"/><p className="sp-local-note"><Link size={14}/>Только локальный эскиз, без создания на сервере.</p><button className="sp-primary sp-full" disabled={!created.trim()}>Создать эскиз<Plus size={16}/></button></form>}</PreviewDialog>}
    {modal === 'activity' && <PreviewDialog title="Последняя активность" onClose={() => setModal(null)}><div className="sp-activity-list">{empty ? <p>Пока нет активности. Здесь будут ваши общие моменты.</p> : <><p><Avatar index={0}/><span><strong>Аня открыла Cinema Space</strong><small>Киновечер: Дюна · сейчас</small></span></p><p><Avatar index={2}/><span><strong>Даша пригласила вас в Space</strong><small>Дизайн-сессия · 12 минут назад</small></span></p><button className="sp-secondary sp-full" onClick={() => open(recentSpaces[1])}>Посмотреть Space<ArrowRight size={15}/></button></>}<p className="sp-local-note"><MessageCircle size={15}/>Демонстрационная история, без подключения к API.</p></div></PreviewDialog>}
  </div>;
}
