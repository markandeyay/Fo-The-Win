export const START_RATING = 1200;

export function expectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

export function kFactor(gamesPlayed: number): number {
  return gamesPlayed < 30 ? 32 : 16;
}

export interface RatedPlayer {
  id: string;
  rating: number;
  gamesPlayed: number;
  placement: number;
}

export interface RatingDelta {
  id: string;
  delta: number;
  newRating: number;
}

export function computeRatingDeltas(players: RatedPlayer[]): RatingDelta[] {
  const deltas = new Map<string, number>();
  for (const player of players) {
    deltas.set(player.id, 0);
  }

  for (let i = 0; i < players.length; i++) {
    for (let j = i + 1; j < players.length; j++) {
      const a = players[i];
      const b = players[j];
      let actualA = 0;
      if (a.placement < b.placement) actualA = 1;
      else if (a.placement === b.placement) actualA = 0.5;

      const expectedA = expectedScore(a.rating, b.rating);
      const k = Math.round((kFactor(a.gamesPlayed) + kFactor(b.gamesPlayed)) / 2);
      const deltaA = Math.round(k * (actualA - expectedA));

      deltas.set(a.id, (deltas.get(a.id) ?? 0) + deltaA);
      deltas.set(b.id, (deltas.get(b.id) ?? 0) - deltaA);
    }
  }

  return players.map((p) => ({
    id: p.id,
    delta: deltas.get(p.id) ?? 0,
    newRating: p.rating + (deltas.get(p.id) ?? 0),
  }));
}
