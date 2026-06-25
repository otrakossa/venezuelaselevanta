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
    name: "Tu nombre aquí",
    role: "Fundador / Desarrollo",
    initials: "VL",
    links: [{ label: "Web", url: "https://venezuelaselevanta.info" }],
  },
];

export const collaborators: Person[] = [
  { name: "Voluntarios verificadores", role: "Verificación de reportes", initials: "VV" },
  { name: "Comunidad Telegram", role: "Reportes en terreno", initials: "TG" },
];

export const organizations: Organization[] = [
  {
    name: "Tu organización aliada",
    description: "¿Quieres aparecer aquí? Escríbenos.",
    url: "mailto:contacto@venezuelaselevanta.info",
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
    name: "Lovable Cloud",
    description: "Backend, base de datos y autenticación",
    url: "https://lovable.dev/",
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
