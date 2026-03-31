import AppNavigator from "./src/navigation/AppNavigator";
import { ThemeProvider } from "./src/context/ThemeContext";
import { LanguageProvider } from "./src/context/LanguageProvider"; // Ah, I called it LanguageContext.js but let's check export

export default function App() {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <AppNavigator />
      </LanguageProvider>
    </ThemeProvider>
  );
}
