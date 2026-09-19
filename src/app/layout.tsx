import type { Metadata, Viewport } from "next";
import "@fontsource-variable/nunito";
import "@fontsource-variable/fredoka";
import "./globals.css";
export const metadata:Metadata={title:{default:"Gabie World",template:"%s · Gabie World"},description:"Planeje, acompanhe e monte seu PC sem perder nenhuma peça pelo caminho.",applicationName:"Gabie World",manifest:"/manifest.webmanifest",icons:{icon:"/favicon.svg",apple:"/icons/icon-192.svg"}};
export const viewport:Viewport={themeColor:"#FFF9FB",width:"device-width",initialScale:1,viewportFit:"cover"};
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){return <html lang="pt-BR" suppressHydrationWarning><body>{children}</body></html>}
