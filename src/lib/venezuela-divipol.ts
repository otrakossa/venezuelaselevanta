// División Político-Territorial de Venezuela
// Estados + municipios (lista completa). Las parroquias se ingresan como texto libre
// porque son ~1.150 entradas; el usuario las escribe a mano (campo opcional).

export const ESTADOS: string[] = [
  "Distrito Capital",
  "Amazonas",
  "Anzoátegui",
  "Apure",
  "Aragua",
  "Barinas",
  "Bolívar",
  "Carabobo",
  "Cojedes",
  "Delta Amacuro",
  "Falcón",
  "Guárico",
  "Lara",
  "La Guaira",
  "Mérida",
  "Miranda",
  "Monagas",
  "Nueva Esparta",
  "Portuguesa",
  "Sucre",
  "Táchira",
  "Trujillo",
  "Yaracuy",
  "Zulia",
  "Dependencias Federales",
];

export const MUNICIPIOS: Record<string, string[]> = {
  "Distrito Capital": ["Libertador"],
  "Amazonas": ["Alto Orinoco", "Atabapo", "Atures", "Autana", "Manapiare", "Maroa", "Río Negro"],
  "Anzoátegui": [
    "Anaco", "Aragua", "Bolívar", "Bruzual", "Cajigal", "Carvajal", "Diego Bautista Urbaneja",
    "Freites", "Guanipa", "Guanta", "Independencia", "Libertad", "McGregor", "Miranda",
    "Monagas", "Peñalver", "Píritu", "San Juan de Capistrano", "Santa Ana", "Simón Rodríguez",
    "Sotillo",
  ],
  "Apure": ["Achaguas", "Biruaca", "Muñoz", "Páez", "Pedro Camejo", "Rómulo Gallegos", "San Fernando"],
  "Aragua": [
    "Bolívar", "Camatagua", "Francisco Linares Alcántara", "Girardot", "José Ángel Lamas",
    "José Félix Ribas", "José Rafael Revenga", "Libertador", "Mario Briceño Iragorry",
    "Ocumare de la Costa de Oro", "San Casimiro", "San Sebastián", "Santiago Mariño",
    "Santos Michelena", "Sucre", "Tovar", "Urdaneta", "Zamora",
  ],
  "Barinas": [
    "Alberto Arvelo Torrealba", "Andrés Eloy Blanco", "Antonio José de Sucre", "Arismendi",
    "Barinas", "Bolívar", "Cruz Paredes", "Ezequiel Zamora", "Obispos", "Pedraza",
    "Rojas", "Sosa",
  ],
  "Bolívar": [
    "Caroní", "Cedeño", "El Callao", "Gran Sabana", "Heres", "Padre Pedro Chien", "Piar",
    "Raúl Leoni", "Roscio", "Sifontes", "Sucre",
  ],
  "Carabobo": [
    "Bejuma", "Carlos Arvelo", "Diego Ibarra", "Guacara", "Juan José Mora", "Libertador",
    "Los Guayos", "Miranda", "Montalbán", "Naguanagua", "Puerto Cabello", "San Diego",
    "San Joaquín", "Valencia",
  ],
  "Cojedes": [
    "Anzoátegui", "Ezequiel Zamora", "Falcón", "Girardot", "Lima Blanco", "Pao de San Juan Bautista",
    "Ricaurte", "Rómulo Gallegos", "San Carlos", "Tinaco",
  ],
  "Delta Amacuro": ["Antonio Díaz", "Casacoima", "Pedernales", "Tucupita"],
  "Falcón": [
    "Acosta", "Bolívar", "Buchivacoa", "Cacique Manaure", "Carirubana", "Colina", "Dabajuro",
    "Democracia", "Falcón", "Federación", "Jacura", "Los Taques", "Mauroa", "Miranda",
    "Monseñor Iturriza", "Palmasola", "Petit", "Píritu", "San Francisco", "Silva", "Sucre",
    "Tocópero", "Unión", "Urumaco", "Zamora",
  ],
  "Guárico": [
    "Camaguán", "Chaguaramas", "El Socorro", "Francisco de Miranda", "José Félix Ribas",
    "José Tadeo Monagas", "Juan Germán Roscio", "Julián Mellado", "Las Mercedes", "Leonardo Infante",
    "Ortiz", "Pedro Zaraza", "San Gerónimo de Guayabal", "San José de Guaribe", "Santa María de Ipire",
  ],
  "Lara": ["Andrés Eloy Blanco", "Crespo", "Iribarren", "Jiménez", "Morán", "Palavecino", "Simón Planas", "Torres", "Urdaneta"],
  "La Guaira": ["Vargas"],
  "Mérida": [
    "Alberto Adriani", "Andrés Bello", "Antonio Pinto Salinas", "Aricagua", "Arzobispo Chacón",
    "Campo Elías", "Caracciolo Parra Olmedo", "Cardenal Quintero", "Guaraque", "Julio César Salas",
    "Justo Briceño", "Libertador", "Miranda", "Obispo Ramos de Lora", "Padre Noguera", "Pueblo Llano",
    "Rangel", "Rivas Dávila", "Santos Marquina", "Sucre", "Tovar", "Tulio Febres Cordero",
    "Zea",
  ],
  "Miranda": [
    "Acevedo", "Andrés Bello", "Baruta", "Brión", "Buroz", "Carrizal", "Chacao", "Cristóbal Rojas",
    "El Hatillo", "Guaicaipuro", "Independencia", "Lander", "Los Salias", "Páez", "Paz Castillo",
    "Pedro Gual", "Plaza", "Simón Bolívar", "Sucre", "Urdaneta", "Zamora",
  ],
  "Monagas": [
    "Acosta", "Aguasay", "Bolívar", "Caripe", "Cedeño", "Ezequiel Zamora", "Libertador",
    "Maturín", "Piar", "Punceres", "Santa Bárbara", "Sotillo", "Uracoa",
  ],
  "Nueva Esparta": [
    "Antolín del Campo", "Arismendi", "Díaz", "García", "Gómez", "Maneiro", "Marcano",
    "Mariño", "Península de Macanao", "Tubores", "Villalba",
  ],
  "Portuguesa": [
    "Agua Blanca", "Araure", "Esteller", "Guanare", "Guanarito", "Monseñor José Vicente de Unda",
    "Ospino", "Páez", "Papelón", "San Genaro de Boconoíto", "San Rafael de Onoto",
    "Santa Rosalía", "Sucre", "Turén",
  ],
  "Sucre": [
    "Andrés Eloy Blanco", "Andrés Mata", "Arismendi", "Benítez", "Bermúdez", "Bolívar",
    "Cajigal", "Cruz Salmerón Acosta", "Libertador", "Mariño", "Mejía", "Montes", "Ribero",
    "Sucre", "Valdez",
  ],
  "Táchira": [
    "Andrés Bello", "Antonio Rómulo Costa", "Ayacucho", "Bolívar", "Cárdenas", "Córdoba",
    "Fernández Feo", "Francisco de Miranda", "García de Hevia", "Guásimos", "Independencia",
    "Jáuregui", "José María Vargas", "Junín", "Libertad", "Libertador", "Lobatera", "Michelena",
    "Panamericano", "Pedro María Ureña", "Rafael Urdaneta", "Samuel Darío Maldonado",
    "San Cristóbal", "San Judas Tadeo", "Seboruco", "Simón Rodríguez", "Sucre", "Torbes",
    "Uribante",
  ],
  "Trujillo": [
    "Andrés Bello", "Boconó", "Bolívar", "Candelaria", "Carache", "Carvajal", "Escuque",
    "José Felipe Márquez Cañizalez", "Juan Vicente Campo Elías", "La Ceiba", "Miranda", "Monte Carmelo",
    "Motatán", "Pampán", "Pampanito", "Rafael Rangel", "San Rafael de Carvajal", "Sucre",
    "Trujillo", "Urdaneta", "Valera",
  ],
  "Yaracuy": [
    "Arístides Bastidas", "Bolívar", "Bruzual", "Cocorote", "Independencia", "José Antonio Páez",
    "La Trinidad", "Manuel Monge", "Nirgua", "Peña", "San Felipe", "Sucre", "Urachiche",
    "Veroes",
  ],
  "Zulia": [
    "Almirante Padilla", "Baralt", "Cabimas", "Catatumbo", "Colón", "Francisco Javier Pulgar",
    "Guajira", "Jesús Enrique Lossada", "Jesús María Semprún", "La Cañada de Urdaneta",
    "Lagunillas", "Machiques de Perijá", "Mara", "Maracaibo", "Miranda", "Páez", "Rosario de Perijá",
    "San Francisco", "Santa Rita", "Simón Bolívar", "Sucre", "Valmore Rodríguez",
  ],
  "Dependencias Federales": ["Dependencias Federales"],
};

// Best-effort: dado un address (Nominatim, etc.) intenta detectar el estado.
export function detectStateFromAddress(address: string | null | undefined): string | null {
  if (!address) return null;
  const norm = address.toLowerCase();
  for (const est of ESTADOS) {
    if (norm.includes(est.toLowerCase())) return est;
  }
  // Aliases
  if (/\bcaracas\b/.test(norm)) return "Distrito Capital";
  if (/\bvargas\b/.test(norm)) return "La Guaira";
  return null;
}
