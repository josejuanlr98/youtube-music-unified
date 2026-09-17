import { call, toaster } from '@decky/api';
import { callOriginal, replacePatch, type Patch } from '@decky/ui';
import { SiYoutubemusic } from 'react-icons/si';
import { addPlaybackStartedListener, addSenderConnectedListener, addTrackChangeListener } from './audioManager';

export interface NotificationSettings {
  connections: boolean;
  tracks: boolean;
  connectionSound: boolean;
  trackSound: boolean;
}
const notificationLogo = () => <div style={{ width:48, height:48, display:'flex', alignItems:'center', justifyContent:'center', alignSelf:'center', flexShrink:0 }}>
  <SiYoutubemusic size={40} style={{ width:40, height:40, display:'block', flexShrink:0 }} />
</div>;
let settings: NotificationSettings = { connections:true, tracks:true, connectionSound:false, trackSound:false };
let ready = false;
let loading: Promise<NotificationSettings> | null = null;
export function loadNotificationSettings(): Promise<NotificationSettings> {
  if (!loading) loading = call<[], NotificationSettings>('get_notification_settings').then(value => {
    settings = value; ready = true; return { ...settings };
  }).finally(() => { loading = null; });
  return loading;
}
export async function saveNotificationSettings(value: NotificationSettings) {
  const result = await call<[NotificationSettings], NotificationSettings & { error?:string }>('set_notification_settings', value);
  if (result.error) throw new Error(result.error);
  settings = result; ready = true;
  return { ...settings };
}

// Mounted once for the plugin lifetime, independent of the Quick Access panel.
// Only actual sender events and successful playback emit notifications.
export function initNotifications() {
  let lastTrack = '';
  let alive = true;
  let soundPatch: Patch | undefined;
  const ensureSoundPatch = () => {
    if (soundPatch) return;
    const store = (window as unknown as { NotificationStore?: { PlayNotificationSound?: (...args: any[]) => unknown } }).NotificationStore;
    if (typeof store?.PlayNotificationSound !== 'function') throw new Error('Steam notification sound hook is unavailable');
    // Steam's queued-toast path selects sound by eType again, discarding the
    // playSound option Decky passed to ProcessNotification. Filter only our
    // explicitly silent toasts at the final playback method, including delayed ones.
    soundPatch = replacePatch(store, 'PlayNotificationSound', (args: any[]) => {
      const notification = args[0];
      if (notification?.decky && notification.data?.ytmNotification === true && notification.data.playSound === false) return;
      return callOriginal;
    });
  };
  const active = new Set<ReturnType<typeof toaster.toast>>();
  const timers = new Set<ReturnType<typeof setTimeout>>();
  const toast = (data: Parameters<typeof toaster.toast>[0]) => {
    if (!alive || !ready) return;
    try {
      ensureSoundPatch();
      // Keep fast skips from filling the Steam notification queue.
      if (active.size >= 2) { const oldest = active.values().next().value; oldest?.dismiss(); if (oldest) active.delete(oldest); }
      const payload = { ...data, ytmNotification:true, duration:5000, showToast:true, showNewIndicator:false };
      const item = toaster.toast(payload);
      active.add(item);
      const timer = setTimeout(() => { active.delete(item); timers.delete(timer); }, 6000);
      timers.add(timer);
    } catch (error) { console.warn('[YTM] Notification unavailable', error); }
  };
  const removers = [
    addSenderConnectedListener(name => {
      if (settings.connections) toast({ title:'YouTube Music', body:`${name || 'A device'} has connected`, logo:notificationLogo(), playSound:settings.connectionSound });
    }),
    addTrackChangeListener(track => { if (!track) lastTrack = ''; }),
    addPlaybackStartedListener(track => {
      if (!track.videoId || lastTrack === track.videoId) return;
      lastTrack = track.videoId;
      if (!settings.tracks) return;
      toast({ title:track.title || 'Now playing', body:track.artist || 'YouTube Music',
        logo:track.albumArt ? <img src={track.albumArt} alt="" style={{ width:48, height:48, objectFit:'cover', borderRadius:6 }} onError={event => { event.currentTarget.style.visibility = 'hidden'; }} /> : notificationLogo(),
        playSound:settings.trackSound });
    }),
  ];
  void loadNotificationSettings().catch(error => console.warn('[YTM] Could not load notification preferences', error));
  return () => { alive = false; ready = false; removers.forEach(remove => remove()); timers.forEach(clearTimeout); active.forEach(item => item.dismiss()); soundPatch?.unpatch(); };
}
