-- Permit active room participants to vote on their own recommendations.
-- Keep participation, room-state, and recommendation-state validation in the database.

DROP TRIGGER IF EXISTS music_votes_validate_insert;
CREATE TRIGGER music_votes_validate_insert
BEFORE INSERT ON music_votes
WHEN NOT EXISTS (
    SELECT 1
    FROM music_recommendations AS recommendation
    JOIN rooms AS room ON room.id = recommendation.room_id
    JOIN room_participations AS participation
      ON participation.room_id = room.id
     AND participation.user_id = NEW.user_id
     AND participation.left_at IS NULL
    WHERE recommendation.id = NEW.recommendation_id
      AND recommendation.deleted_at IS NULL
      AND room.is_public = 1
      AND room.archived_at IS NULL
)
BEGIN
    SELECT RAISE(ABORT, 'Active participation is required to vote');
END;

DROP TRIGGER IF EXISTS music_votes_validate_update;
CREATE TRIGGER music_votes_validate_update
BEFORE UPDATE OF recommendation_id, user_id, value ON music_votes
WHEN NOT EXISTS (
    SELECT 1
    FROM music_recommendations AS recommendation
    JOIN rooms AS room ON room.id = recommendation.room_id
    JOIN room_participations AS participation
      ON participation.room_id = room.id
     AND participation.user_id = NEW.user_id
     AND participation.left_at IS NULL
    WHERE recommendation.id = NEW.recommendation_id
      AND recommendation.deleted_at IS NULL
      AND room.is_public = 1
      AND room.archived_at IS NULL
)
BEGIN
    SELECT RAISE(ABORT, 'Active participation is required to vote');
END;
