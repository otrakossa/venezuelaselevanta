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
    name: "Codex Tecnología",
    description: "Desarrollo, infraestructura y mantenimiento",
    url: "https://codextecnologia.com",
    logo: "/logo-codex.png",
  },
  {
    name: "Fundación Casa del Bosque",
    description: "Organización aliada · activismo tecnopolítico",
    url: "https://x.com/fcbosque",
    logo: "/logo-fcbosque.png",
  },
  {
    name: "CEESUR",
    description: "Centro de Estudios Estratégicos del Sur Global",
    url: "https://ceesur.org",
    logo: "/logo-ceesur.svg",
  },
  {
    name: "Mujeres Activistas XSL",
    description: "Promueven tecnología libre y soberana con perspectiva de género",
    url: "https://activistasxsl.org/",
    logo: "/logo-mujeres-xsl.png",
  },
  {
    name: "Debates del Sur Global",
    description: "Espacio de análisis y reflexión desde el Sur Global",
    url: "https://debatesdelsurglobal.org",
    logo: "/logo-debates-sur-global.png",
  },
  {
    name: "Heez Studio",
    description: "Diseño e identidad gráfica",
    url: "https://www.instagram.com/heezstudio/",
    logo: "/logo-heezstudio.svg",
  },
  {
    name: "Utopix",
    description: "Aliado en comunicación y diseño",
    url: "https://utopix.cc/",
    logo: "/logo-utopix.jpeg",
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
