import { useTheme } from "../context/ThemeContext";

export default function ThemeToggle() {
  const { darkMode, setDarkMode } = useTheme();

  return (
<button
  onClick={() => setDarkMode(!darkMode)}
  className="rounded-lg bg-white px-3 py-2 text-black shadow"
>
  {darkMode ? "☀️" : "🌙"}
</button>
  );
}