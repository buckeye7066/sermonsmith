import { ThemePreference } from '../config/theme-preference';
function AppShell() {
  const [theme, setTheme] = useState(ThemePreference.mode);
  return (
    <div className="AppShell">
      {/* ... */}
      <button onClick={() => setTheme((prevMode) => (prevMode === "light" ? "dark" : "light"))}> {
        {theme === "light" ? "Sun" : "Moon"}
      </button>
    </div>
  );
}