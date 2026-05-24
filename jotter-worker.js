// Jotter Search Worker — deploy to Cloudflare Workers (free tier)
// This acts as a proxy server that queries TW book databases

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  const url = new URL(request.url)
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json; charset=utf-8',
  }

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: cors })
  }

  const q   = url.searchParams.get('q') || ''
  const isbn = url.searchParams.get('isbn') || ''
  const mode = url.searchParams.get('mode') || 'search' // 'search' or 'isbn'

  if (!q && !isbn) {
    return new Response(JSON.stringify({ error: 'missing q or isbn' }), { headers: cors })
  }

  const enc = encodeURIComponent(isbn || q)
  const results = []
  const seen = new Set()

  function add(book) {
    if (!book.title || book.title === 'Unknown') return
    const key = book.title.replace(/\s/g, '').toLowerCase().slice(0, 12)
    if (seen.has(key)) return
    seen.add(key)
    results.push(book)
  }

  function mkGB(info, isbnOverride) {
    const ids = info.industryIdentifiers || []
    return {
      title:  info.title || 'Unknown',
      author: (info.authors || []).join(', ') || '',
      year:   info.publishedDate?.slice(0, 4) || '',
      pages:  info.pageCount || 0,
      thumb:  (info.imageLinks?.thumbnail || info.imageLinks?.smallThumbnail || '')
                .replace('http://', 'https://').replace('zoom=1', 'zoom=3'),
      isbn:   isbnOverride || ids.find(x => x.type === 'ISBN_13')?.identifier
              || ids.find(x => x.type === 'ISBN_10')?.identifier || '',
      source: 'Google Books'
    }
  }

  const fetches = []

  if (mode === 'isbn') {
    // ── ISBN mode: try every TW source ────────────────────────
    // 1. 博客來
    fetches.push(
      fetch(`https://search.books.com.tw/search/query/key/${enc}/cat/BKA/`, {
        headers: { 'User-Agent': 'Mozilla/5.0', 'Accept-Language': 'zh-TW' }
      }).then(r => r.text()).then(html => {
        const m = html.match(/<h4[^>]*>\s*<a[^>]*href="([^"]*\/products\/([^"?]+))[^"]*"[^>]*>([^<]+)</)
        if (!m) return
        const title = m[3].trim()
        const authorM = html.match(/作者[：:]\s*<[^>]*>([^<]+)/)
        const thumbM  = html.match(/data-original="(https?:\/\/[^"]*books\.com\.tw[^"]*\.jpg)"/)
        add({ title, author: authorM?.[1]?.trim() || '', thumb: thumbM?.[1] || '',
              isbn, year: '', pages: 0, source: '博客來' })
      }).catch(() => {})
    )

    // 2. NCL 國家圖書館
    fetches.push(
      fetch(`https://apin.ncl.edu.tw/opac/servlet/Query?format=json&q=${enc}&field=isbn&count=3`)
        .then(r => r.json()).then(d => {
          const recs = d?.result || d?.records ||
            (Array.isArray(d) ? d : null) ||
            Object.values(d || {}).find(v => Array.isArray(v)) || []
          ;(Array.isArray(recs) ? recs : []).forEach(rec => {
            const title = rec.title || rec.TI || ''
            if (title) add({ title, author: rec.author || rec.AU || '',
              year: rec.year || rec.PY || '', pages: parseInt(rec.pages || 0) || 0,
              thumb: '', isbn, source: 'NCL Taiwan' })
          })
        }).catch(() => {})
    )

    // 3. Taaze 讀冊
    fetches.push(
      fetch(`https://www.taaze.tw/api/searchResult.json?type=1&keyword=${enc}`)
        .then(r => r.json()).then(d => {
          const list = d?.data?.result?.list || d?.data || d?.list || d?.result || []
          ;(Array.isArray(list) ? list : []).slice(0, 3).forEach(item => {
            const title = item.title || item.name || ''
            if (!title) return
            add({ title,
              author: (Array.isArray(item.author) ? item.author.join(', ') : item.author) || '',
              year: item.publishYear || item.year || '',
              pages: item.pages || 0,
              thumb: item.cover || item.coverUrl || '',
              isbn: item.isbn || isbn, source: 'Taaze' })
          })
        }).catch(() => {})
    )

    // 4. Google Books TW
    fetches.push(
      fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${enc}&country=TW&maxResults=1`)
        .then(r => r.json()).then(d => {
          if (d.items?.length) add(mkGB(d.items[0].volumeInfo, isbn))
        }).catch(() => {})
    )

    // 5. Google Books global
    fetches.push(
      fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${enc}&maxResults=1`)
        .then(r => r.json()).then(d => {
          if (d.items?.length) add(mkGB(d.items[0].volumeInfo, isbn))
        }).catch(() => {})
    )

    // 6. Open Library
    fetches.push(
      fetch(`https://openlibrary.org/api/books?bibkeys=ISBN:${enc}&format=json&jscmd=data`)
        .then(r => r.json()).then(d => {
          const entry = d[`ISBN:${isbn}`]
          if (entry) add({
            title: entry.title || '', author: (entry.authors || []).map(a => a.name).join(', '),
            year: entry.publish_date?.match(/\d{4}/)?.[0] || '',
            pages: entry.number_of_pages || 0,
            thumb: entry.cover?.large || entry.cover?.medium || '',
            isbn, source: 'Open Library'
          })
        }).catch(() => {})
    )

  } else {
    // ── Search mode ────────────────────────────────────────────
    // 1. 博客來 search
    fetches.push(
      fetch(`https://search.books.com.tw/search/query/key/${enc}/cat/BKA/`, {
        headers: { 'User-Agent': 'Mozilla/5.0', 'Accept-Language': 'zh-TW' }
      }).then(r => r.text()).then(html => {
        const items = [...html.matchAll(/<h4[^>]*>\s*<a[^>]*href="[^"]*\/products\/[^"]*"[^>]*>([^<]+)<\/a>/g)]
        const authors = [...html.matchAll(/作者[：:].*?<a[^>]*>([^<]+)<\/a>/g)]
        const thumbs = [...html.matchAll(/data-original="(https?:\/\/[^"]*books\.com\.tw[^"]*\.jpg)"/g)]
        items.slice(0, 6).forEach((m, i) => {
          const title = m[1].trim()
          if (title) add({ title, author: authors[i]?.[1]?.trim() || '',
            thumb: thumbs[i]?.[1] || '', isbn: '', year: '', pages: 0, source: '博客來' })
        })
      }).catch(() => {})
    )

    // 2. NCL title search
    fetches.push(
      fetch(`https://apin.ncl.edu.tw/opac/servlet/Query?format=json&q=${enc}&field=title&count=5`)
        .then(r => r.json()).then(d => {
          const recs = d?.result || (Array.isArray(d) ? d : [])
          ;(Array.isArray(recs) ? recs : []).forEach(rec => {
            const title = rec.title || rec.TI || ''
            if (title) add({ title, author: rec.author || rec.AU || '',
              year: rec.year || '', pages: 0, thumb: '', isbn: rec.isbn || '', source: 'NCL Taiwan' })
          })
        }).catch(() => {})
    )

    // 3. Taaze search
    fetches.push(
      fetch(`https://www.taaze.tw/api/searchResult.json?type=1&keyword=${enc}`)
        .then(r => r.json()).then(d => {
          const list = d?.data?.result?.list || d?.data || d?.list || []
          ;(Array.isArray(list) ? list : []).slice(0, 5).forEach(item => {
            const title = item.title || item.name || ''
            if (title) add({ title,
              author: (Array.isArray(item.author) ? item.author.join(', ') : item.author) || '',
              year: item.publishYear || '', pages: item.pages || 0,
              thumb: item.cover || item.coverUrl || '',
              isbn: item.isbn || '', source: 'Taaze' })
          })
        }).catch(() => {})
    )

    // 4. Google Books TW
    fetches.push(
      fetch(`https://www.googleapis.com/books/v1/volumes?q=${enc}&country=TW&maxResults=8`)
        .then(r => r.json()).then(d => { (d.items || []).forEach(item => add(mkGB(item.volumeInfo))) })
        .catch(() => {})
    )

    // 5. Google Books global
    fetches.push(
      fetch(`https://www.googleapis.com/books/v1/volumes?q=${enc}&maxResults=8`)
        .then(r => r.json()).then(d => { (d.items || []).forEach(item => add(mkGB(item.volumeInfo))) })
        .catch(() => {})
    )

    // 6. Open Library
    fetches.push(
      fetch(`https://openlibrary.org/search.json?q=${enc}&fields=title,author_name,cover_i,first_publish_year,isbn&limit=6`)
        .then(r => r.json()).then(d => {
          (d.docs || []).forEach(doc => {
            add({ title: doc.title || '', author: (doc.author_name || []).join(', '),
              year: doc.first_publish_year ? String(doc.first_publish_year) : '',
              pages: 0,
              thumb: doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg` : '',
              isbn: (doc.isbn || [])[0] || '', source: 'Open Library' })
          })
        }).catch(() => {})
    )
  }

  await Promise.allSettled(fetches)

  return new Response(JSON.stringify({ results }), { headers: cors })
}
