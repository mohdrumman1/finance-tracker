const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const router = express.Router();

router.post('/register', async (req, res) => {
  const { username, password } = req.body;

  // Validate input
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  // Hash password
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);

  // Save user to database (placeholder - replace with actual DB logic)
  const user = { id: Date.now(), username, password: hashedPassword };

  // Generate JWT token
  const token = jwt.sign({ userId: user.id, username: user.username }, 'your_jwt_secret_key', { expiresIn: '1h' });

  res.json({ token, user });
});

module.exports = router;