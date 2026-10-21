import { useEffect, useRef } from 'react';
import type { VideoHTMLAttributes } from 'react';
import { VideoPlayer as Player, Video, NeutralVideoSkin } from '@videojs/react/video';
import '@videojs/react/video/neutral-skin.css';
import { playbackShortcut } from './playback';
import styles from './VideoPlayer.module.css';

export interface VideoPlayerProps extends VideoHTMLAttributes<HTMLVideoElement> {
  onElement: (element: HTMLMediaElement | null) => void;
  audio?: boolean;
}

// This adapter accepts only browser media inputs/events; access and room policy live outside it.
export default function VideoPlayer({ onElement, audio, ...props }: VideoPlayerProps) {
  const ref = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  useEffect(() => {
    const element = audio ? audioRef.current : ref.current;
    // Strict Mode replays effects on the same DOM node after cleanup released its source.
    if (element && props.src) element.src = props.src;
    onElement(element);
    return () => {
      onElement(null);
      if (element) {
        if (document.pictureInPictureElement === element) void document.exitPictureInPicture().catch(() => {});
        if (document.fullscreenElement?.contains(element)) void document.exitFullscreen().catch(() => {});
        element.pause(); element.removeAttribute('src'); element.load();
      }
    };
  }, [audio, onElement, props.src]);
  if (audio) return <audio {...props} ref={audioRef} controls preload="metadata" onKeyDown={event => {
    if (!event.altKey && !event.ctrlKey && !event.metaKey && playbackShortcut(event.currentTarget, event.key)) {
      event.preventDefault(); event.stopPropagation();
    }
  }} />;
  return <Player><NeutralVideoSkin className={styles.player}><Video {...props} ref={ref} playsInline preload="metadata" /></NeutralVideoSkin></Player>;
}
