import { ButtonItem, staticClasses, DialogButton, Focusable, Navigation, Tabs } from '@decky/ui';
import { definePlugin, routerHook } from '@decky/api';
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { FaMusic } from 'react-icons/fa';
import { SiYoutubemusic } from 'react-icons/si';
import { BsGearFill } from 'react-icons/bs';

import { PlayerProvider, usePlayer } from './context/PlayerContext';
import { PlayerView } from './components/PlayerView';
import { QueueView } from './components/QueueView';
import { LibraryView } from './components/LibraryView';
import { SettingsPage } from './components/SettingsPage';
import { themeCss } from './theme';
import { clearLyricsCache } from './services/lyrics';
import { SearchPage } from './components/SearchPage';
import { initAudio, destroyAudio } from './services/audioManager';
import { initNotifications } from './services/notifications';

const SETTINGS_ROUTE = '/youtube-music-settings';
const SEARCH_ROUTE = '/youtube-music-search';
const THEME_STYLE_ID = 'ytm-theme-styles';
const TABS_CSS = `
  #ytm-tabs-container > * { height:100%; display:flex; flex-direction:column; min-height:0; }
  #ytm-tabs-container [class*="TabHeaderRowWrapper"] { flex-shrink:0 !important; min-height:32px !important; padding-left:0 !important; padding-right:0 !important; }
  #ytm-tabs-container [class*="TabContentsScroll"] { flex:1 !important; min-height:0 !important; overflow-y:auto !important; padding-left:0 !important; padding-right:0 !important; }
  #ytm-tabs-container [class*="Glyphs"] { transform:scale(.65) !important; transform-origin:center center !important; }
`;

const installThemeStyles = () => {
  let style = document.getElementById(THEME_STYLE_ID) as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement('style');
    style.id = THEME_STYLE_ID;
    document.head.appendChild(style);
  }
  style.textContent = `${themeCss}\n${TABS_CSS}`;
};

const removeThemeStyles = () => document.getElementById(THEME_STYLE_ID)?.remove();

const PaddedButtonItem = (props: React.ComponentProps<typeof ButtonItem>) => {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const first = ref.current?.firstElementChild as HTMLElement | null;
    if (first) {
      first.style.paddingLeft = '16px';
      first.style.paddingRight = '16px';
    }
  }, []);
  return <div ref={ref}><ButtonItem {...props} /></div>;
};

// Keep Decky's Tabs interaction (including L1/R1) while constraining only our
// own panel. The ancestor Quick Access layout is left untouched.
const TabsContainer = memo(() => {
  const [activeTab, setActiveTab] = useState('player');
  const tabItems = useMemo(() => [
    { id:'player', title:'Player', content:<PlayerView /> },
    { id:'queue', title:'Queue', content:<QueueView /> },
    { id:'library', title:'Library', content:<LibraryView onSwitchToPlayer={() => setActiveTab('player')} /> },
  ], []);
  return <div id="ytm-tabs-container" className="ytm-ui" style={{
    width:'100%',
    maxWidth:'100%',
    minWidth:0,
    // Quick Access gets a different height when Steam is mirrored or attached
    // to an external display. Keep the tabs inside that viewport instead of
    // clipping them at the old fixed 390px height.
    height:'min(620px, calc(100vh - 96px))',
    minHeight:'320px',
    maxHeight:'calc(100vh - 96px)',
    overflow:'hidden',
    boxSizing:'border-box',
  }}>
    <Tabs activeTab={activeTab} onShowTab={(tab: string) => setActiveTab(tab)} tabs={tabItems} />
  </div>;
});
TabsContainer.displayName = 'TabsContainer';

const Content = () => <PlayerProvider><PluginContentWrapper /></PlayerProvider>;

const PluginContentWrapper = () => {
  const { authenticated } = usePlayer();

  // If not authenticated, prompt user to go to settings
  if (!authenticated) {
    return (
      <div>
        <div style={{ textAlign: 'center', padding: '24px 32px 12px', color: 'var(--gpSystemLighterGrey)' }}>
          <div style={{ marginBottom: '8px' }}><FaMusic size={32} /></div>
          <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>Not Authenticated</div>
          <div style={{ fontSize: '12px', lineHeight: '1.4' }}>
            Set up your YouTube Music credentials in <strong>Settings</strong> to get started.
          </div>
        </div>
        <PaddedButtonItem onClick={() => {
          Navigation.CloseSideMenus();
          Navigation.Navigate(SETTINGS_ROUTE);
        }}>
          Open Settings
        </PaddedButtonItem>
        <div style={{ height: '16px' }} />
      </div>
    );
  }

  return <TabsContainer />;
};

const onSettingsClick = () => {
  Navigation.CloseSideMenus();
  Navigation.Navigate(SETTINGS_ROUTE);
};

export default definePlugin(() => {
  installThemeStyles();
  const stopNotifications = initNotifications();
  initAudio();
  routerHook.addRoute(SETTINGS_ROUTE, () => <SettingsPage />);
  routerHook.addRoute(SEARCH_ROUTE, () => <SearchPage />);

  return {
    name: 'YouTube Music',
    titleView: (
      <Focusable
        style={{
          display: 'flex',
          padding: '0',
          width: '100%',
          boxShadow: 'none',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
        className={staticClasses.Title}
      >
        <div>YouTube Music</div>
        <DialogButton
          style={{ height: '28px', width: '40px', minWidth: 0, padding: '10px 12px' }}
          onClick={onSettingsClick}
          onOKActionDescription="Settings"
        >
          <BsGearFill style={{ marginTop: '-4px', display: 'block' }} />
        </DialogButton>
      </Focusable>
    ),
    content: <Content />,
    icon: <SiYoutubemusic />,
    onDismount() {
      stopNotifications();
      destroyAudio();
      clearLyricsCache();
      removeThemeStyles();
      routerHook.removeRoute(SETTINGS_ROUTE);
      routerHook.removeRoute(SEARCH_ROUTE);
    },
  };
});
