import redirects from './legacy-game-redirects.json';

export function onRequest({ request, next }) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/$/, '');
  if (!Object.hasOwn(redirects, path)) return next();

  const target = new URL(redirects[path], url.origin);
  target.search = url.search;
  return Response.redirect(target.href, 301);
}
