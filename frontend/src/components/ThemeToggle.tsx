import { useTheme } from "../context/ThemeContext";

export default function ThemeToggle() {
  const { darkMode, setDarkMode } = useTheme();

  return (
<button
  onClick={() => setDarkMode(!darkMode)}
  className="rounded-lg bg-[#E9E7FE] dark:bg-[#FFFFFF] px-3 py-2 text-black dark:text-white shadow"
>
  {darkMode ? "☀️" : "🌙"}
</button>
  );
}