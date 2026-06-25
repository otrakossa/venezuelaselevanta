export type Urgency = "critical" | "high" | "medium" | "low";
export type ReportStatus = "active" | "attending" | "resolved";
export type MissingStatus = "missing" | "found" | "deceased";

export interface Report {
  id: string;
  title: string;
  description: string | null;
  category: string;
  urgency: Urgency;
  status: ReportStatus;
  address: string | null;
  lat: number;
  lng: number;
  reporter_name: string | null;
  photo_url: string | null;
  media_urls: string[] | null;
  affected_count: number | null;
  verified: boolean;
  created_at: string;
  updated_at: string;
}

export interface MissingPerson {
  id: string;
  name: string;
  age: number | null;
  description: string | null;
  last_seen_location: string | null;
  last_seen_lat: number | null;
  last_seen_lng: number | null;
  photo_url: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  status: MissingStatus;
  report_date: string;
  found_date: string | null;
  created_at: string;
  updated_at: string;
}
