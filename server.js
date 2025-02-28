require('dotenv').config();
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const path = require('path');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const fs = require('fs');
const { OpenAI } = require('openai');

const app = express();
const db = new sqlite3.Database('./database.sqlite');
const upload = multer({ dest: 'uploads/' });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Middleware
app.use(bodyParser.json());
app.use(express.static('public'));

// Initialize database tables
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password TEXT,
    credits INTEGER DEFAULT 20,
    role TEXT DEFAULT 'user'
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER,
    filename TEXT,
    content TEXT,
    embedding TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS credit_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER,
    requestedCredits INTEGER,
    status TEXT DEFAULT 'pending'
  )`);
});

// OpenAI Embedding Function
async function getEmbedding(text) {
  try {
    const response = await openai.embeddings.create({
      model: 'text-embedding-ada-002',
      input: text,
    });
    return response.data[0].embedding;
  } catch (error) {
    console.error('Embedding error details:', error.response ? error.response.data : error);
    throw error;
  }
}

// Cosine Similarity Function
function cosineSimilarity(vecA, vecB) {
  const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
  const normA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
  const normB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
  return dotProduct / (normA * normB);
}

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// User Registration
app.post('/auth/register', (req, res) => {
  const { username, password } = req.body;
  const hashedPassword = bcrypt.hashSync(password, 8);

  db.run(`INSERT INTO users (username, password) VALUES (?, ?)`, [username, hashedPassword], (err) => {
    if (err) return res.status(400).json({ error: 'Username taken' });
    res.json({ message: 'User registered' });
  });
});

// User Login
app.post('/auth/login', (req, res) => {
  const { username, password } = req.body;

  db.get(`SELECT * FROM users WHERE username = ?`, [username], (err, user) => {
    if (err || !user || !bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    res.json({ id: user.id, username: user.username, credits: user.credits, role: user.role });
  });
});

// Get User Profile
app.get('/user/profile', (req, res) => {
  const userId = req.query.userId;
  db.get(`SELECT username, credits FROM users WHERE id = ?`, [userId], (err, user) => {
    if (err || !user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  });
});

// Request Credits
app.post('/credits/request', (req, res) => {
  const { userId, requestedCredits } = req.body;

  db.run(`INSERT INTO credit_requests (userId, requestedCredits) VALUES (?, ?)`, [userId, requestedCredits], (err) => {
    if (err) return res.status(500).json({ error: 'Request failed' });
    res.json({ message: 'Credit request submitted' });
  });
});

// Admin Approve Credits (Updated to Use Requested Amount)
app.post('/admin/credits/update', (req, res) => {
  const { userId, adminId } = req.body; // adminId to verify admin role

  db.get(`SELECT role FROM users WHERE id = ?`, [adminId], (err, admin) => {
    if (err || !admin || admin.role !== 'admin') {
      return res.status(403).json({ error: 'Admins only' });
    }

    // Fetch the latest pending request for the user
    db.get(`SELECT requestedCredits FROM credit_requests WHERE userId = ? AND status = 'pending' ORDER BY id DESC LIMIT 1`, [userId], (err, request) => {
      if (err || !request) {
        return res.status(404).json({ error: 'No pending credit request found for this user' });
      }

      const creditsToAdd = request.requestedCredits;

      // Update user's credits
      db.run(`UPDATE users SET credits = credits + ? WHERE id = ?`, [creditsToAdd, userId], (err) => {
        if (err) return res.status(500).json({ error: 'Update failed' });

        // Mark the request as approved
        db.run(`UPDATE credit_requests SET status = 'approved' WHERE userId = ? AND status = 'pending'`, [userId], (err) => {
          if (err) return res.status(500).json({ error: 'Failed to update request status' });
          res.json({ message: `Added ${creditsToAdd} credits to user ${userId}` });
        });
      });
    });
  });
});

// Daily Credit Reset
function resetDailyCredits() {
  db.run(`UPDATE users SET credits = 20`, () => {
    console.log('Credits reset at midnight');
  });
}
setInterval(resetDailyCredits, 24 * 60 * 60 * 1000);

// Upload Document
app.post('/scan', upload.single('file'), async (req, res) => {
  const userId = req.body.userId;
  const file = req.file;

  db.get(`SELECT credits FROM users WHERE id = ?`, [userId], async (err, user) => {
    if (user.credits <= 0) return res.status(403).json({ error: 'No credits left' });

    const content = fs.readFileSync(file.path, 'utf8');
    const embedding = await getEmbedding(content);

    db.run(`UPDATE users SET credits = credits - 1 WHERE id = ?`, [userId]);
    db.run(
      `INSERT INTO documents (userId, filename, content, embedding) VALUES (?, ?, ?, ?)`,
      [userId, file.originalname, content, JSON.stringify(embedding)],
      function (err) {
        if (err) return res.status(500).json({ error: 'Upload failed' });
        res.json({ docId: this.lastID, filename: file.originalname });
      }
    );
  });
});

// Get Matching Documents
app.get('/matches/:docId', async (req, res) => {
  const docId = req.params.docId;

  try {
    db.get(`SELECT embedding FROM documents WHERE id = ?`, [docId], async (err, doc) => {
      if (err || !doc) return res.status(404).json({ error: 'Document not found' });
      const targetEmbedding = JSON.parse(doc.embedding);

      db.all(`SELECT id, filename, embedding FROM documents WHERE id != ?`, [docId], (err, docs) => {
        if (err) return res.status(500).json({ error: 'Database error' });

        const matches = docs.map(d => {
          const embedding = JSON.parse(d.embedding);
          const similarity = cosineSimilarity(targetEmbedding, embedding);
          return { id: d.id, filename: d.filename, similarity };
        })
        .filter(m => m.similarity > 0.8)
        .sort((a, b) => b.similarity - a.similarity);

        res.json(matches);
      });
    });
  } catch (error) {
    res.status(500).json({ error: 'Error processing matches' });
  }
});

// Admin Analytics
app.get('/admin/analytics', (req, res) => {
  const userId = req.query.userId;
  db.get(`SELECT role FROM users WHERE id = ?`, [userId], (err, user) => {
    if (user.role !== 'admin') return res.status(403).json({ error: 'Admins only' });

    db.all(`SELECT username, credits, (SELECT COUNT(*) FROM documents WHERE userId = users.id) as scans 
            FROM users`, (err, users) => {
      res.json({ users });
    });
  });
});

app.get('/credits/pending', (req, res) => {
    db.all(`SELECT cr.userId, u.username, cr.requestedCredits 
            FROM credit_requests cr JOIN users u ON cr.userId = u.id 
            WHERE cr.status = 'pending'`, (err, requests) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      res.json(requests);
    });
  });
  
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});