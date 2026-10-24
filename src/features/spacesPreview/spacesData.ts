export const friends = [
  { name: 'Аня Морозова', initials: 'АМ', color: 'rose', activity: 'В Cinema Space' },
  { name: 'Марк Ким', initials: 'МК', color: 'blue', activity: 'Смотрит «Дюну»' },
  { name: 'Даша Соколова', initials: 'ДС', color: 'mint', activity: 'В дизайн-сессии' },
  { name: 'Илья Волков', initials: 'ИВ', color: 'amber', activity: 'Общается с друзьями' },
  { name: 'Соня Белова', initials: 'СБ', color: 'violet', activity: 'В Cinema Space' },
  { name: 'Никита Орлов', initials: 'НО', color: 'blue', activity: 'В дизайн-сессии' },
];

export type Space = { id: string; name: string; context: string; kind: 'cinema' | 'design' | 'music' | 'personal'; owner: string; date: string; activity: string; active: boolean; hub: boolean };
export const recentSpaces: Space[] = [
  { id: 'cinema', name: 'Киновечер: Дюна', context: 'Hub «Киноклуб»', kind: 'cinema', owner: 'Аня Морозова', date: '22 окт.', activity: 'Сейчас', active: true, hub: true },
  { id: 'design', name: 'Дизайн-сессия', context: 'Hub «Делаем вместе»', kind: 'design', owner: 'Даша Соколова', date: '22 окт.', activity: '12 минут назад', active: true, hub: true },
  { id: 'music', name: 'Музыка и разговоры', context: 'Личный Space · без Hub', kind: 'music', owner: 'Илья Волков', date: '21 окт.', activity: 'Вчера', active: false, hub: false },
  { id: 'ideas', name: 'Место для идей', context: 'Ваш личный Space · без Hub', kind: 'personal', owner: 'Вы', date: '20 окт.', activity: '2 дня назад', active: false, hub: false },
];

export function filterSpaces(spaces: Space[], query: string, filter: string) {
  const search = query.trim().toLocaleLowerCase('ru');
  return spaces.filter(s => `${s.name} ${s.context} ${s.owner}`.toLocaleLowerCase('ru').includes(search) && (filter === 'all' || (filter === 'personal' ? !s.hub : s.hub)));
}
