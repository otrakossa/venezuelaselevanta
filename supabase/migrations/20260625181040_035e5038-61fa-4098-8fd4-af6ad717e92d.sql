DELETE FROM public.reports
WHERE title ILIKE 'flood test%'
   OR title ILIKE 'test'
   OR title ILIKE '%prueba%'
   OR description ILIKE '%prueba%'
   OR reporter_name ILIKE '%prueba%';