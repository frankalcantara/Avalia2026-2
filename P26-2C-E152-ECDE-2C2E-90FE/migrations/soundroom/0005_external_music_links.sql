ALTER TABLE music_recommendations
ADD COLUMN provider TEXT
CHECK (provider IS NULL OR provider IN ('youtube', 'spotify', 'soundcloud'));

ALTER TABLE music_recommendations
ADD COLUMN external_url TEXT
CHECK (external_url IS NULL OR length(external_url) BETWEEN 1 AND 2048);

UPDATE music_recommendations
SET provider = (
      SELECT metadata.provider
      FROM music_recommendation_metadata AS metadata
      WHERE metadata.recommendation_id = music_recommendations.id
    ),
    external_url = (
      SELECT metadata.external_url
      FROM music_recommendation_metadata AS metadata
      WHERE metadata.recommendation_id = music_recommendations.id
    )
WHERE EXISTS (
  SELECT 1 FROM music_recommendation_metadata AS metadata
  WHERE metadata.recommendation_id = music_recommendations.id
);
