import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import games from '../data/games.json';
import { gameArt, latestPostImageMap } from '../lib/gameArt';

export const GET: APIRoute = async () => {
  const posts = await getCollection('posts');
  const postImages = latestPostImageMap(posts.map(({ data }) => ({
    gameSlug: data.game, image: data.image, _ts: new Date(data.date || 0).getTime(),
  })));
  const picks = games.map((game) => {
    const art = gameArt(game, postImages[game.slug]);
    return {
      slug: game.slug, name: game.name, art, icon: game.icon || '',
      genre: game.genre, publisher: game.publisher,
      platforms: game.platforms, score: game.rating ?? game.provisionalRating,
      mobile: game.category === 'mobile',
    };
  });
  return new Response(JSON.stringify(picks), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
};
