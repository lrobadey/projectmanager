This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Last.fm integration (Music space)

The Music dashboard can pull album metadata from Last.fm: search-as-you-type
autofill (artist, genre, cover art) and a "Import from Last.fm" button that
seeds the Listened shelf from a profile's most-played albums (with scrobble
counts and last-listened dates for sorting).

This uses only public, read-only Last.fm methods, so a single API key is enough
— no user login/OAuth. Set it as a server env var:

```bash
# .env.local (and in your hosting provider's env settings)
LASTFM_API_KEY=your_key_here
```

Get a free key from https://www.last.fm/api/account/create (a Non-Commercial
account is fine). When the key is absent, the Music space still works fully —
the search box just behaves as a plain text input and the import button is
hidden.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
