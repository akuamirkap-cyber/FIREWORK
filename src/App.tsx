import ErrorBoundary from "./components/ErrorBoundary";
import GameCanvas from "./components/GameCanvas";
import Hud from "./components/Hud";
import LevelSheet from "./components/LevelSheet";
import Shop from "./components/Shop";

export default function App() {
  return (
    <div className="fixed inset-0 flex select-none flex-col overflow-hidden bg-[#070a26] md:flex-row">
      <div className="relative min-h-0 min-w-0 flex-1 overflow-hidden">
        <ErrorBoundary label="game">
          <GameCanvas />
        </ErrorBoundary>
        <ErrorBoundary label="HUD">
          <Hud />
        </ErrorBoundary>
      </div>
      <ErrorBoundary label="toko">
        <Shop />
      </ErrorBoundary>
      <ErrorBoundary label="level up">
        <LevelSheet />
      </ErrorBoundary>
    </div>
  );
}
