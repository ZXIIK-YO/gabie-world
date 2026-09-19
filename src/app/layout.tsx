import type { Metadata, Viewport } from "next";
import "@fontsource-variable/nunito";
import "@fontsource-variable/fredoka";
import "./globals.css";
export const metadata:Metadata={title:{default:"Gabie World",template:"%s · Gabie World"},description:"Planeje, acompanhe e monte seu PC sem perder nenhuma peça pelo caminho.",applicationName:"Gabie World",manifest:"/manifest.webmanifest",icons:{icon:"/favicon.svg",apple:"/icons/icon-192.svg"}};
export const viewport:Viewport={themeColor:"#FFF9FB",width:"device-width",initialScale:1,viewportFit:"cover"};
// globals.css already honours prefers-color-scheme, so this only has to replay an
// explicit choice — before first paint, otherwise it flashes the system theme first.
// React logs a dev-only warning about script tags in components; the tag is SSR'd
// into the HTML and runs on document load, which is exactly what we need here.
const themeBoot=`(function(){try{var p=localStorage.getItem("gw-theme");if(p==="dark"||p==="light")document.documentElement.dataset.theme=p}catch(e){}})()`;
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){return <html lang="pt-BR" suppressHydrationWarning><head><script dangerouslySetInnerHTML={{__html:themeBoot}}/></head><body>{children}</body></html>}
