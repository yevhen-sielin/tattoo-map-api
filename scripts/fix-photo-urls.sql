-- Replace S3 direct URLs with CloudFront URLs for all artists
UPDATE "Artist" 
SET photos = ARRAY(
  SELECT regexp_replace(
    unnest(photos), 
    'https://tatmap-uploads-dev\.s3\.eu-north-1\.amazonaws\.com', 
    'https://d3g4il54x1qtex.cloudfront.net', 
    'g'
  )
) 
WHERE photos::text LIKE '%tatmap-uploads-dev.s3.eu-north-1.amazonaws.com%';
