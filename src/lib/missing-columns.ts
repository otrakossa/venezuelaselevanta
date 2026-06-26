// Columns granted to anon for public.missing_persons.
// Contact fields (contact_name, contact_phone, contact_email) are intentionally
// excluded — only authenticated users can read them via select("*").
export const MISSING_PUBLIC_COLUMNS =
  "id,name,age,description,last_seen_location,state,municipality,parish,last_seen_lat,last_seen_lng,photo_url,status,report_date,found_date,source_id,source_label,source_url,matched_patient_id,created_at,updated_at";
