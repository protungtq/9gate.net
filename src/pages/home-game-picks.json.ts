import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import games from '../data/games.json';
import { gameArt, latestPostImageMap } from '../lib/gameArt';

export const GET: APIRoute = async () => {
  const posts = await getCollection('posts');
  const postImages = latestPostImageMap(posts.map(({ data }) => ({
    gameSlug: data.game, image: data.image, _ts: new Date(data.date || 0).getTime(),
  })));
  const picks = games.flatMap((game) => {
    const art = gameArt(game, postImages[game.slug]);
    if (!art) return [];
    return [{
      slug: game.slug, name: game.name, art,
      genre: game.genre, publisher: game.publisher,
      platforms: game.platforms, score: game.rating ?? game.provisionalRating,
      mobile: game.category === 'mobile',
    }];
  });
  return new Response(JSON.stringify(picks), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
};
