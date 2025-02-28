let currentUser = null;

function login() {
  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;

  fetch('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  })
  .then(res => res.json())
  .then(data => {
    if (data.error) return alert(data.error);
    currentUser = data;
    document.getElementById('auth').style.display = 'none';
    document.getElementById('dashboard').style.display = 'block';
    document.getElementById('user').textContent = data.username;
    document.getElementById('credits').textContent = data.credits;
    updateDashboard();
  });
}

function showRegister() {
  const username = prompt('Enter username');
  const password = prompt('Enter password');

  fetch('/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  })
  .then(res => res.json())
  .then(data => alert(data.message || data.error));
}

function logout() {
  currentUser = null;
  document.getElementById('auth').style.display = 'block';
  document.getElementById('dashboard').style.display = 'none';
  document.getElementById('admin').style.display = 'none';
}

function requestCredits() {
  const requestedCredits = prompt('How many credits do you want?');
  fetch('/credits/request', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: currentUser.id, requestedCredits: parseInt(requestedCredits) })
  })
  .then(res => res.json())
  .then(data => alert(data.message || data.error));
}

function uploadDocument() {
  const fileInput = document.getElementById('fileInput');
  const formData = new FormData();
  formData.append('file', fileInput.files[0]);
  formData.append('userId', currentUser.id);

  fetch('/scan', {
    method: 'POST',
    body: formData
  })
  .then(res => res.json())
  .then(data => {
    if (data.error) return alert(data.error);
    fetch(`/matches/${data.docId}`)
      .then(res => res.json())
      .then(matches => {
        document.getElementById('credits').textContent = currentUser.credits - 1;
        currentUser.credits--;
        document.getElementById('matches').innerHTML = matches.map(m => 
          `<p>${m.filename} - Similarity: ${(m.similarity * 100).toFixed(2)}%</p>`
        ).join('');
      });
  });
}

function approveCredits(userId) {
  fetch('/admin/credits/update', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, adminId: currentUser.id })
  })
  .then(res => res.json())
  .then(data => {
    alert(data.message || data.error);
    updateDashboard(); // Refresh requests and analytics
  });
}

function updateDashboard() {
    if (currentUser.role === 'admin') {
      document.getElementById('admin').style.display = 'block';
      fetch(`/admin/analytics?userId=${currentUser.id}`)
        .then(res => res.json())
        .then(data => {
          document.getElementById('analytics').innerHTML = data.users.map(u => 
            `<p>${u.username}: Credits: ${u.credits}, Scans: ${u.scans}</p>`
          ).join('');
        });
      fetch('/credits/pending', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      })
        .then(res => res.json())
        .then(data => {
          console.log('Pending requests:', data); // Debug log
          document.getElementById('creditRequests').innerHTML = data.map(r => 
            `<p>User ${r.username} (ID: ${r.userId}) requests ${r.requestedCredits} credits 
             <button onclick="approveCredits(${r.userId})">Approve</button></p>`
          ).join('');
        })
        .catch(err => console.error('Fetch error:', err)); // Error log
    }
  }

// New endpoint to fetch pending requests (add this to server.js too)
app.get('/credits/pending', (req, res) => {
  db.all(`SELECT cr.userId, u.username, cr.requestedCredits 
          FROM credit_requests cr JOIN users u ON cr.userId = u.id 
          WHERE cr.status = 'pending'`, (err, requests) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    res.json(requests);
  });
});