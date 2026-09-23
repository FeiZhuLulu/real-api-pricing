import { createContext, useContext } from "react";

export type Theme = "light" | "dark";
export const ThemeContext = createContext<Theme>("light");
export const useTheme = () => useContext(ThemeContext);
