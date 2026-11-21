import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import games from '../data/games.json';

export const GET: APIRoute = async () => {
  const gameBySlug = Object.fromEntries(games.map((game) => [game.slug, game]));
  const posts = await getCollection('posts');
  const index = [
    ...games.map((game) => ({
      t: game.name,
      s: [game.genre, game.publisher].filter(Boolean).join(' · '),
      u: `/game/${game.slug}/`,
      i: game.icon || '',
    })),
    ...posts.map(({ id, data }) => ({
      t: data.title,
      s: gameBySlug[data.game]?.name || 'Bài viết',
      u: `/p/${id.replace(/\.(md|mdx)$/i, '')}/`,
      i: data.image || gameBySlug[data.game]?.icon || '',
    })),
  ];

  return new Response(JSON.stringify(index), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
};
