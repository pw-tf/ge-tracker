import { useEffect } from 'react';
import { HashRouter, Outlet, Route, Routes, useLocation } from 'react-router';
import { DesktopHeader } from './components/Shell';
import { useIsMobile } from './hooks/useNow';
import { AlchsPage } from './pages/Alchs';
import { FlipsPage } from './pages/Flips';
import { ItemRoute } from './pages/ItemDetail';
import { MoversPage } from './pages/Movers';
import { SetsDecantPage } from './pages/SetsDecant';
import { WatchlistPage } from './pages/Watchlist';
import { MarketProvider } from './state/market';
import { useSettings } from './state/settings';

const TITLES: Record<string, string> = {
  '/': 'Margin flips',
  '/alchs': 'High alchemy',
  '/sets': 'Sets & decanting',
  '/movers': 'Movers',
  '/watchlist': 'Watchlist',
};

function Layout() {
  const mobile = useIsMobile();
  const { theme } = useSettings();
  const { pathname } = useLocation();

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#13161b' : '#ffffff');
  }, [theme]);

  useEffect(() => {
    const t = TITLES[pathname];
    if (t) document.title = `${t} · GE Profit Tracker`;
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <div className="app">
      {!mobile && <DesktopHeader />}
      <Outlet />
    </div>
  );
}

export function App() {
  return (
    <MarketProvider>
      <HashRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<FlipsPage />} />
            <Route path="alchs" element={<AlchsPage />} />
            <Route path="sets" element={<SetsDecantPage />} />
            <Route path="movers" element={<MoversPage />} />
            <Route path="watchlist" element={<WatchlistPage />} />
            <Route path="item/:id" element={<ItemRoute />} />
            <Route path="*" element={<FlipsPage />} />
          </Route>
        </Routes>
      </HashRouter>
    </MarketProvider>
  );
}
