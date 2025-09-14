const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { nanoid } = require('nanoid');
const path = require('path');
const cookieParser = require('cookie-parser');
const multer = require('multer');

// Allow forcing in-memory mode via env var for environments where sqlite3 can't be built
const FORCE_IN_MEMORY = !!process.env.FORCE_IN_MEMORY;
let useSqlite = !FORCE_IN_MEMORY;
let sqlite3;
if (useSqlite) {
  try {
    sqlite3 = require('sqlite3').verbose();
  } catch (e) {
    console.warn('sqlite3 not available, falling back to in-memory storage');
    useSqlite = false;
  }
}

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(cookieParser());

// admin auth (very simple): password stored here. For production use proper auth.
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'virat123';

function requireAuth(req, res, next) {
  if (req.cookies && req.cookies.admin === '1') return next();
  return res.status(401).json({ error: 'Unauthorized' });
}

// Serve admin static files from /admin
app.use('/admin', express.static(path.join(__dirname, 'admin')));
// Serve uploaded images
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Image upload endpoint
const upload = multer({ dest: path.join(__dirname, 'uploads') });
app.post('/api/upload', requireAuth, upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  // Return public URL for uploaded image
  const url = `/uploads/${req.file.filename}`;
  res.json({ url });
});

// In-memory store (fallback)
const inMemory = {
  categories: [
    { id: 'sports', name: 'Sports', order: 1 },
    { id: 'politics', name: 'Politics', order: 2 },
    { id: 'entertainment', name: 'Entertainment', order: 3 }
  ],
  articles: [
    { id: 'a1', title: 'Virat hits winning six', description: 'A thrilling finish.', content: 'Full content of the sports article...', imageUrl: 'https://picsum.photos/600/300?random=1', author: 'Reporter A', publishedAt: '2025-09-01', categoryId: 'sports', sourceUrl: 'https://example.com/article/a1' },
    { id: 'a2', title: 'Election update', description: 'Key results in...', content: 'Full content of the politics article...', imageUrl: 'https://picsum.photos/600/300?random=2', author: 'Reporter B', publishedAt: '2025-09-02', categoryId: 'politics', sourceUrl: 'https://example.com/article/a2' },
    { id: 'a3', title: 'Movie review', description: 'New hit movie...', content: 'Full content of the entertainment article...', imageUrl: 'https://picsum.photos/600/300?random=3', author: 'Reporter C', publishedAt: '2025-09-03', categoryId: 'entertainment', sourceUrl: 'https://example.com/article/a3' }
  ],
  ads: [
    { id: 'ad1', type: 'banner', placement: 'top', imageUrl: 'https://picsum.photos/800/150?random=10', clickUrl: 'https://example.com/ad1' },
    { id: 'ad2', type: 'banner', placement: 'bottom', imageUrl: 'https://picsum.photos/800/150?random=11', clickUrl: 'https://example.com/ad2' },
    { id: 'ad3', type: 'interstitial', placement: 'interstitial', imageUrl: 'https://picsum.photos/800/1200?random=12', clickUrl: 'https://example.com/ad3' }
  ]
};

let db;
if (useSqlite) {
  const dbFile = path.join(__dirname, 'mock.db');
  db = new sqlite3.Database(dbFile);
  db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS categories (id TEXT PRIMARY KEY, name TEXT, order_num INTEGER)`);
    db.run(`CREATE TABLE IF NOT EXISTS articles (id TEXT PRIMARY KEY, title TEXT, description TEXT, content TEXT, imageUrl TEXT, author TEXT, publishedAt TEXT, categoryId TEXT, sourceUrl TEXT)`);
    db.run(`CREATE TABLE IF NOT EXISTS ads (id TEXT PRIMARY KEY, type TEXT, placement TEXT, imageUrl TEXT, clickUrl TEXT)`);

    // seed if empty
    db.get('SELECT COUNT(*) as c FROM categories', (err, row) => {
      if (!err && row.c === 0) {
        const cats = [ ['sports','Sports',1], ['politics','Politics',2], ['entertainment','Entertainment',3] ];
        const stmt = db.prepare('INSERT INTO categories (id,name,order_num) VALUES (?,?,?)');
        cats.forEach(c => stmt.run(c[0], c[1], c[2]));
        stmt.finalize();

        const stmtA = db.prepare('INSERT INTO articles (id,title,description,content,imageUrl,author,publishedAt,categoryId,sourceUrl) VALUES (?,?,?,?,?,?,?,?,?)');
        stmtA.run('a1','Virat hits winning six','A thrilling finish.','Full content of the sports article...','https://picsum.photos/600/300?random=1','Reporter A','2025-09-01','sports','https://example.com/article/a1');
        stmtA.run('a2','Election update','Key results in...','Full content of the politics article...','https://picsum.photos/600/300?random=2','Reporter B','2025-09-02','politics','https://example.com/article/a2');
        stmtA.run('a3','Movie review','New hit movie...','Full content of the entertainment article...','https://picsum.photos/600/300?random=3','Reporter C','2025-09-03','entertainment','https://example.com/article/a3');
        stmtA.finalize();

        const stmtAd = db.prepare('INSERT INTO ads (id,type,placement,imageUrl,clickUrl) VALUES (?,?,?,?,?)');
        stmtAd.run('ad1','banner','top','https://picsum.photos/800/150?random=10','https://example.com/ad1');
        stmtAd.run('ad2','banner','bottom','https://picsum.photos/800/150?random=11','https://example.com/ad2');
        stmtAd.run('ad3','interstitial','interstitial','https://picsum.photos/800/1200?random=12','https://example.com/ad3');
        stmtAd.finalize();
      }
    });
  });
}

// Root welcome route
app.get('/', (req, res) => {
  res.send(`Virat News Mock API running (${useSqlite ? 'sqlite' : 'in-memory'}). Use /api/... or /admin for UI`);
});

// === Categories ===
app.get('/api/categories', (req, res) => {
  if (useSqlite) {
    db.all('SELECT id,name,order_num as "order" FROM categories ORDER BY order_num', (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    });
  } else {
    res.json(inMemory.categories.sort((a,b)=> a.order - b.order));
  }
});

app.post('/api/categories', requireAuth, (req, res) => {
  const id = nanoid(6);
  const { name, order } = req.body;
  if (useSqlite) {
    db.run('INSERT INTO categories (id,name,order_num) VALUES (?,?,?)', [id, name, order || 0], function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id, name, order: order || 0 });
    });
  } else {
    const cat = { id, name, order: order || 0 };
    inMemory.categories.push(cat);
    res.json(cat);
  }
});

app.put('/api/categories/:id', requireAuth, (req, res) => {
  const id = req.params.id;
  const { name, order } = req.body;
  if (useSqlite) {
    db.run('UPDATE categories SET name=?, order_num=? WHERE id=?', [name, order || 0, id], function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id, name, order: order || 0 });
    });
  } else {
    const idx = inMemory.categories.findIndex(c => c.id === id);
    if (idx === -1) return res.status(404).send('Not found');
    inMemory.categories[idx] = { ...inMemory.categories[idx], name, order: order || 0 };
    res.json(inMemory.categories[idx]);
  }
});

app.delete('/api/categories/:id', requireAuth, (req, res) => {
  const id = req.params.id;
  if (useSqlite) {
    db.run('DELETE FROM categories WHERE id=?', [id], function(err) {
      if (err) return res.status(500).json({ error: err.message });
      db.run('DELETE FROM articles WHERE categoryId=?', [id]);
      res.status(204).send();
    });
  } else {
    inMemory.categories = inMemory.categories.filter(c => c.id !== id);
    inMemory.articles = inMemory.articles.filter(a => a.categoryId !== id);
    res.status(204).send();
  }
});

// === Articles ===
app.get('/api/categories/:categoryId/articles', (req, res) => {
  const catId = req.params.categoryId;
  if (useSqlite) {
    db.all('SELECT * FROM articles WHERE categoryId=?', [catId], (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    });
  } else {
    res.json(inMemory.articles.filter(a => a.categoryId === catId));
  }
});

app.get('/api/articles/:id', (req, res) => {
  const id = req.params.id;
  if (useSqlite) {
    db.get('SELECT * FROM articles WHERE id=?', [id], (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!row) return res.status(404).send('Not found');
      res.json(row);
    });
  } else {
    const a = inMemory.articles.find(x => x.id === id);
    if (!a) return res.status(404).send('Not found');
    res.json(a);
  }
});

app.post('/api/articles', requireAuth, (req, res) => {
  const id = nanoid(6);
  const { title, description, content, imageUrl, author, publishedAt, categoryId, sourceUrl } = req.body;
  if (useSqlite) {
    db.run('INSERT INTO articles (id,title,description,content,imageUrl,author,publishedAt,categoryId,sourceUrl) VALUES (?,?,?,?,?,?,?,?,?)', [id,title,description,content,imageUrl,author,publishedAt,categoryId,sourceUrl], function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id, title, description, content, imageUrl, author, publishedAt, categoryId, sourceUrl });
    });
  } else {
    const art = { id, title, description, content, imageUrl, author, publishedAt, categoryId, sourceUrl };
    inMemory.articles.push(art);
    res.json(art);
  }
});

app.put('/api/articles/:id', requireAuth, (req, res) => {
  const id = req.params.id;
  const { title, description, content, imageUrl, author, publishedAt, categoryId, sourceUrl } = req.body;
  if (useSqlite) {
    db.run('UPDATE articles SET title=?,description=?,content=?,imageUrl=?,author=?,publishedAt=?,categoryId=?,sourceUrl=? WHERE id=?', [title,description,content,imageUrl,author,publishedAt,categoryId,sourceUrl,id], function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id, title, description, content, imageUrl, author, publishedAt, categoryId, sourceUrl });
    });
  } else {
    const idx = inMemory.articles.findIndex(a => a.id === id);
    if (idx === -1) return res.status(404).send('Not found');
    inMemory.articles[idx] = { ...inMemory.articles[idx], title, description, content, imageUrl, author, publishedAt, categoryId, sourceUrl };
    res.json(inMemory.articles[idx]);
  }
});

app.delete('/api/articles/:id', requireAuth, (req, res) => {
  const id = req.params.id;
  if (useSqlite) {
    db.run('DELETE FROM articles WHERE id=?', [id], function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.status(204).send();
    });
  } else {
    inMemory.articles = inMemory.articles.filter(a => a.id !== id);
    res.status(204).send();
  }
});

// === Search ===
app.get('/api/search', (req, res) => {
  const q = (req.query.q || '').toLowerCase();
  if (useSqlite) {
    const pattern = `%${q}%`;
    db.all("SELECT * FROM articles WHERE lower(title)||' '||lower(description)||' '||lower(content) LIKE ?", [pattern], (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    });
  } else {
    const results = inMemory.articles.filter(a => (a.title + ' ' + (a.description||'') + ' ' + (a.content||'')).toLowerCase().includes(q));
    res.json(results);
  }
});

// === Ads ===
app.get('/api/ads', (req, res) => {
  if (useSqlite) {
    db.all('SELECT * FROM ads', (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    });
  } else {
    res.json(inMemory.ads);
  }
});

app.post('/api/ads', requireAuth, (req, res) => {
  const id = nanoid(6);
  const { type, placement, imageUrl, clickUrl } = req.body;
  if (useSqlite) {
    db.run('INSERT INTO ads (id,type,placement,imageUrl,clickUrl) VALUES (?,?,?,?,?)', [id,type,placement,imageUrl,clickUrl], function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id, type, placement, imageUrl, clickUrl });
    });
  } else {
    const ad = { id, type, placement, imageUrl, clickUrl };
    inMemory.ads.push(ad);
    res.json(ad);
  }
});

app.put('/api/ads/:id', requireAuth, (req, res) => {
  const id = req.params.id;
  const { type, placement, imageUrl, clickUrl } = req.body;
  if (useSqlite) {
    db.run('UPDATE ads SET type=?,placement=?,imageUrl=?,clickUrl=? WHERE id=?', [type,placement,imageUrl,clickUrl,id], function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id, type, placement, imageUrl, clickUrl });
    });
  } else {
    const idx = inMemory.ads.findIndex(a => a.id === id);
    if (idx === -1) return res.status(404).send('Not found');
    inMemory.ads[idx] = { ...inMemory.ads[idx], type, placement, imageUrl, clickUrl };
    res.json(inMemory.ads[idx]);
  }
});

app.delete('/api/ads/:id', requireAuth, (req, res) => {
  const id = req.params.id;
  if (useSqlite) {
    db.run('DELETE FROM ads WHERE id=?', [id], function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.status(204).send();
    });
  } else {
    inMemory.ads = inMemory.ads.filter(a => a.id !== id);
    res.status(204).send();
  }
});

// Admin login/logout
app.post('/admin/login', (req, res) => {
  const { password } = req.body;
  if (password === ADMIN_PASSWORD) {
    res.cookie('admin', '1', { httpOnly: true });
    return res.json({ ok: true });
  }
  res.status(403).json({ error: 'Wrong password' });
});

app.post('/admin/logout', (req, res) => {
  res.clearCookie('admin');
  res.json({ ok: true });
});

const PORT = process.env.PORT || 4000;
const server = app.listen(PORT, '0.0.0.0', () => console.log(`Mock API running on http://localhost:${PORT} (mode=${useSqlite ? 'sqlite' : 'in-memory'})`));

server.on('error', (err) => {
  console.error('Server failed to start:', err && (err.stack || err.message || err));
  process.exit(1);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err && (err.stack || err.message || err));
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason);
  process.exit(1);
});
