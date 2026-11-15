export function canViewRecommendations(room) {
  return room?.status === "active";
}

export function canSubmitRecommendation(room) {
  return canViewRecommendations(room) && room.isParticipant === true;
}

export function canRemoveRecommendation(user, room, recommendation) {
  return canViewRecommendations(room)
    && Boolean(user)
    && (
      user.id === recommendation.author.id
      || user.id === room.owner.id
    );
}
