export interface Report {
  id: string;
  title: string;
  description: string | null;
  category: string;
  urgency: "critico" | "alto" | "medio" | "bajo";
  status: "activo" | "en_atencion" | "resuelto";
  location_text: string | null;
  lat: number;
  lng: number;
  reporter_name: string | null;
  photo_url: string | null;
  affected_count: number | null;
  verified: boolean;
  created_at: string;
  updated_at: string;
}

export interface MissingPerson {
  id: string;
  name: string;
  age: number | null;
  physical_description: string | null;
  last_seen_location: string | null;
  lat: number | null;
  lng: number | null;
  photo_url: string | null;
  contact_info: string | null;
  status: "desaparecido" | "encontrado";
  created_at: string;
  updated_at: string;
}
