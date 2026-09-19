import type { Metadata, Viewport } from "next";
import "@fontsource-variable/nunito";
import "@fontsource-variable/fredoka";
import "./globals.css";
export const metadata:Metadata={title:{default:"Gabie World",template:"%s · Gabie World"},description:"Planeje, acompanhe e monte seu PC sem perder nenhuma peça pelo caminho.",applicationName:"Gabie World",manifest:"/manifest.webmanifest",icons:{icon:"/favicon.svg",apple:"/icons/icon-192.svg"}};
export const viewport:Viewport={themeColor:"#FFF9FB",width:"device-width",initialScale:1,viewportFit:"cover"};
// Runs before first paint so a saved dark theme doesn't flash white on load.
const themeBoot=`(function(){try{var p=localStorage.getItem("gw-theme");var d=p==="dark"||(p!=="light"&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.dataset.theme=d?"dark":"light"}catch(e){document.documentElement.dataset.theme="light"}})()`;
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){return <html lang="pt-BR" suppressHydrationWarning><head><script dangerouslySetInnerHTML={{__html:themeBoot}}/></head><body>{children}</body></html>}
