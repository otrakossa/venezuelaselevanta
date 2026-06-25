export type Person = {
  name: string;
  role: string;
  avatar?: string;
  initials?: string;
  links?: { label: string; url: string }[];
};

export type Organization = {
  name: string;
  description?: string;
  url?: string;
  logo?: string;
};

export type TechCredit = {
  name: string;
  description: string;
  url: string;
};

export const team: Person[] = [
  {
    name: "Codex",
    role: "Creador y mantenedor — Desarrollo e infraestructura",
    initials: "CX",
    links: [{ label: "codextecnologia.com", url: "https://codextecnologia.com" }],
  },
];

export const collaborators: Person[] = [
  { name: "Voluntarios verificadores", role: "Verificación de reportes", initials: "VV" },
  { name: "Comunidad Telegram", role: "Reportes en terreno", initials: "TG" },
];

export const organizations: Organization[] = [
  {
    name: "Fundación Casa del Bosque",
    description: "Organización aliada · conservación y comunidad",
    url: "https://x.com/fcbosque",
    logo: "https://www.google.com/s2/favicons?domain=x.com/fcbosque&sz=128",
  },
  {
    name: "Activistas por el Software Libre",
    description: "Promueven tecnología libre y soberana",
    url: "https://activistasxsl.org/",
    logo: "https://www.google.com/s2/favicons?domain=activistasxsl.org&sz=128",
  },
  {
    name: "Codex Tecnología",
    description: "Desarrollo, infraestructura y mantenimiento",
    url: "https://codextecnologia.com",
    logo: "https://www.google.com/s2/favicons?domain=codextecnologia.com&sz=128",
  },
];

export const tech: TechCredit[] = [
  {
    name: "OpenStreetMap",
    description: "Datos cartográficos abiertos © colaboradores de OpenStreetMap",
    url: "https://www.openstreetmap.org/copyright",
  },
  {
    name: "Leaflet",
    description: "Librería de mapas interactivos open source",
    url: "https://leafletjs.com/",
  },
  {
    name: "shadcn/ui + Tailwind CSS",
    description: "Sistema de componentes y estilos",
    url: "https://ui.shadcn.com/",
  },
  {
    name: "Telegram Bot API",
    description: "Canal de reportes vía @VenezuelaSeLevantabot",
    url: "https://core.telegram.org/bots",
  },
];

export const CONTACT_EMAIL = "contacto@venezuelaselevanta.info";
export const TELEGRAM_BOT = "https://t.me/VenezuelaSeLevantabot";
