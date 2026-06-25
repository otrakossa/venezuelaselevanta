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
  state: string | null;
  municipality: string | null;
  parish: string | null;
  lat: number;
  lng: number;
  reporter_name: string | null;
  photo_url: string | null;
  media_urls: string[] | null;
  media_thumbs: string[] | null;
  affected_count: number | null;
  verified: boolean;
  verified_by: string | null;
  verified_at: string | null;
  confirm_count: number;
  dispute_count: number;
  hidden?: boolean;
  hidden_reason?: string | null;
  hidden_at?: string | null;
  created_at: string;
  updated_at: string;
}

export type VoteKind = "confirm" | "dispute";

export interface ReportVote {
  id: string;
  report_id: string;
  device_id: string;
  vote: VoteKind;
  created_at: string;
  updated_at: string;
}

export interface ReportComment {
  id: string;
  report_id: string;
  author_name: string | null;
  content: string;
  created_at: string;
}

export interface MissingPerson {
  id: string;
  name: string;
  age: number | null;
  description: string | null;
  last_seen_location: string | null;
  state: string | null;
  municipality: string | null;
  parish: string | null;
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
