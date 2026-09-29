import { useEffect } from 'react';
import { IconAuto, IconChart, IconFlame, IconMoon, IconStar, IconSun } from './components/Icons';
import { href, useRoute } from './lib/router';
import { useTheme } from './lib/theme';
import { EndsMode, GelMode, NumbersMode, PcrMode } from './modes/QuizModes';
import { Home } from './modes/Home';
import { MappingMode } from './modes/MappingMode';
import { StatsScreen } from './modes/StatsScreen';
import { TrueFalseMode } from './modes/TrueFalseMode';
import { ProgressProvider, useProgress } from './state/ProgressContext';

export function App() {
  return (
    <ProgressProvider>
      <Shell />
    </ProgressProvider>
  );
}

function Shell() {
  const route = useRoute();
  const [theme, cycleTheme] = useTheme();
  const { progress } = useProgress();

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [route.path]);

  let page;
  switch (route.path) {
    case '/map':
      page = <MappingMode />;
      break;
    case '/ends':
      page = <EndsMode />;
      break;
    case '/pcr':
      page = <PcrMode />;
      break;
    case '/gel':
      page = <GelMode />;
      break;
    case '/numbers':
      page = <NumbersMode />;
      break;
    case '/tf':
      page = <TrueFalseMode />;
      break;
    case '/stats':
      page = <StatsScreen />;
      break;
    default:
      page = <Home />;
  }

  const themeLabel = theme === 'system' ? 'Theme: follows system' : theme === 'light' ? 'Theme: light' : 'Theme: dark';

  return (
    <>
      <header className="app-header">
        <a href={href('/')} className="brand" aria-label="Digest Lab home">
          <svg width="26" height="26" viewBox="0 0 32 32" aria-hidden="true">
            <rect width="32" height="32" rx="7" fill="var(--gel-bottom)" />
            <rect x="7" y="12" width="7" height="2.2" rx="1.1" fill="var(--band)" />
            <rect x="18" y="15" width="7" height="2.2" rx="1.1" fill="var(--band)" />
            <rect x="7" y="21" width="7" height="2" rx="1" fill="var(--band)" opacity=".7" />
            <rect x="18" y="25" width="7" height="1.8" rx=".9" fill="var(--band)" opacity=".55" />
          </svg>
          <span>Digest Lab</span>
        </a>
        <nav className="header-stats" aria-label="Your progress">
          <a href={href('/stats')} className="stat-pill" title="Points">
            <IconStar size={15} />
            <span className="stat-num">{progress.points}</span>
            <span className="sr-only">points</span>
          </a>
          <a href={href('/stats')} className="stat-pill" title="Current streak of correct answers">
            <IconFlame size={15} />
            <span className="stat-num">{progress.streak}</span>
            <span className="sr-only">in a row</span>
          </a>
          <a href={href('/stats')} className="icon-btn" aria-label="Stats and weak spots">
            <IconChart size={18} />
          </a>
          <button type="button" className="icon-btn" onClick={cycleTheme} aria-label={themeLabel} title={themeLabel}>
            {theme === 'system' ? <IconAuto size={18} /> : theme === 'light' ? <IconSun size={18} /> : <IconMoon size={18} />}
          </button>
        </nav>
      </header>
      <main className="app-main">{page}</main>
      <footer className="app-footer">
        <span>Digest Lab · Enginyeria Genètica, Universitat de Barcelona · after T.A. Brown, <em>Gene Cloning and DNA Analysis</em></span>
      </footer>
    </>
  );
}
