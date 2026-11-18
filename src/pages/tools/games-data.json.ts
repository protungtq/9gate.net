import games from '../../data/games.json';

export function GET() {
  return Response.json(games);
}
