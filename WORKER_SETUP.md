# Jotter Worker Setup (5 minutes, free)

This gives Jotter a backend server that can query 博客來, NCL Taiwan, Taaze,
and all other TW book databases — exactly like 讀痕 does.

## Step 1 — Create Cloudflare account (free)
Go to https://dash.cloudflare.com and sign up. No credit card needed.

## Step 2 — Deploy the Worker

1. In Cloudflare dashboard → click **Workers & Pages**
2. Click **Create** → **Create Worker**
3. Name it: `jotter-search`
4. Click **Deploy** (deploys the default worker)
5. Click **Edit code**
6. Delete all the default code
7. Copy the entire contents of `jotter-worker.js` and paste it
8. Click **Deploy**

Your worker URL will be:
`https://jotter-search.YOUR-ACCOUNT.workers.dev`

## Step 3 — Update index.html

Open `index.html`, find this line near the top of the JS:

```
const WORKER_URL = 'https://jotter-search.YOUR-SUBDOMAIN.workers.dev';
```

Replace `YOUR-SUBDOMAIN` with your actual Cloudflare subdomain.
For example: `https://jotter-search.hilary.workers.dev`

## Step 4 — Upload to GitHub

Upload both the updated `index.html` to your GitHub repo.

## That's it

Now ISBN 9786267752111 and all other Taiwan 978-626 books will be found
by searching 博客來, NCL Taiwan, and Taaze directly from the server.
