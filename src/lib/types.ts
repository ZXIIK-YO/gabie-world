export const categories=["CPU","GPU","Placa-mãe","RAM","SSD","HD","Fonte","Gabinete","Cooler","Fans","Monitor","Teclado","Mouse","Headset","Acessório","Personalizado"] as const;
export const statuses=["Pesquisando","Quero","Escolhida","Comprada","A caminho","Recebida","Instalada","Descartada"] as const;
export type Item={id:string;category:string;name:string;status:string;priority:string;planned:number;paid:number;owned:boolean;favorite:boolean;targetPrice?:number};
export type Build={id:string;name:string;description:string;budget:number;items:Item[];createdAt:string};export type Notice={id:string;title:string;body:string;read:boolean;createdAt:string};export type State={builds:Build[];activeBuildId:string;notices:Notice[]};
// Deliberately empty: a fake build looks like the user's own data and there is no
// honest way to tell "example" apart from "mine" once it is sitting in the list.
export const initialState:State={activeBuildId:"",notices:[],builds:[]};
