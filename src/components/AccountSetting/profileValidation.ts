export function validateProfile(displayName: string, aboutMe: string): string | null {
  if (displayName.trim().length < 3 || displayName.trim().length > 50) return 'Имя должно содержать от 3 до 50 символов.';
  if (aboutMe.length > 1000) return 'Описание должно содержать не более 1000 символов.';
  return null;
}

export function validateAvatar(file: Pick<File, 'type' | 'size'>): string | null {
  if (!['image/png', 'image/jpeg', 'image/gif', 'image/webp'].includes(file.type)) return 'Выберите PNG, JPEG, GIF или WebP.';
  if (file.size <= 0 || file.size > 10 * 1024 * 1024) return 'Размер изображения должен быть от 1 байта до 10 MiB.';
  return null;
}
