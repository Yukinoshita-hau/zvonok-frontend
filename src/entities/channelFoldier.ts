import type { Channel } from './channel';

export interface ChannelFolder {
  id: number;
  name: string;
  channels: Channel[];
  position: number | null;
  collapsed: boolean | null;
  isActive: boolean | null;
  createdAt: string | null;
}
