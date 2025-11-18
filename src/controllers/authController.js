import { sql, hashPassword, comparePassword } from '../config/db.js';
import rateLimit from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import { sendWelcomeEmail } from "../emails/emailHandlers.js";

// Fonction pour générer un token JWT
const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: "15d" });
};

// 🔒 Limiteur de tentatives de connexion (anti-brute force)
export const loginLimiter = rateLimit({
  windowMs: 1 * 30 * 1000, // 1 minute
  max: 3, // Limite à 3 tentatives
  message: { message: 'Trop de tentatives de connexion. Réessayez dans 30 secondes.' }
});

// 🧩 Inscription d’un nouvel utilisateur
export const register = async (req, res) => {
  try {
    const { email, username, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ message: "Le nom d'utilisateur, l'adresse e-mail et le mot de passe sont requis." });
    }

    if (email && !/\S+@\S+\.\S+/.test(email)) {
      return res.status(400).json({ message: "Format d'adresse e-mail invalide." });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: "Le mot de passe doit contenir au moins 6 caractères." });
    }

    if (username.length < 3) {
      return res.status(400).json({ message: "Le nom d'utilisateur doit contenir au moins 3 caractères." });
    }

    // Vérifier si l'utilisateur existe déjà
    const existingUser = await sql`
      SELECT * FROM users WHERE LOWER(email) = LOWER(${email}) OR LOWER(username) = LOWER(${username})
    `;

    if (existingUser.length > 0) {
      if (existingUser[0].email === email) {
        return res.status(400).json({ message: "Cette adresse e-mail est déjà utilisée." });
      }
      if (existingUser[0].username === username) {
        return res.status(400).json({ message: "Ce nom d'utilisateur est déjà pris." });
      }
    }

    // Générer un avatar automatique et hacher le mot de passe
    const profileImage = `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`;
    const hashedPassword = await hashPassword(password);

    // Créer un nouvel utilisateur
    const newUser = await sql`
      INSERT INTO users (username, email, password, profile_image) 
      VALUES (${username}, ${email}, ${hashedPassword}, ${profileImage})
      RETURNING id, username, email, profile_image, created_at
    `;

    if (newUser) {

    const token = generateToken(newUser[0].id);

    res.status(201).json({
      message: "Utilisateur créé avec succès.",
      token,
      user: {
        id: newUser[0].id,
        username: newUser[0].username,
        email: newUser[0].email,
        profileImage: newUser[0].profile_image,
        createdAt: newUser[0].created_at,
      },
    });

      try {
        await sendWelcomeEmail(newUser[0].email, newUser[0].username);
      } catch (error) {
        console.error("Failed to send welcome email:", error);
      }

    } else {
      res.status(400).json({ message: "Invalid user data" });
    }

  } catch (error) {
    console.error("Erreur dans la route d’inscription :", error);
    res.status(500).json({ message: "Erreur interne du serveur." });
  }
};

// 🔑 Connexion utilisateur
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password)
      return res.status(400).json({ message: "Tous les champs sont requis." });

    // Vérifier si l'utilisateur existe
    const users = await sql`
      SELECT * FROM users WHERE email = ${email}
    `;

    if (users.length === 0)
      return res.status(400).json({ message: "Identifiants invalides." });

    const user = users[0];

    // Vérifier le mot de passe
    const isPasswordCorrect = await comparePassword(password, user.password);
    if (!isPasswordCorrect)
      return res.status(400).json({ message: "Identifiants invalides." });

    const token = generateToken(user.id);

    res.status(200).json({
      message: "Connexion réussie.",
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        profileImage: user.profile_image,
        createdAt: user.created_at,
      },
    });
  } catch (error) {
    console.error("Erreur dans la route de connexion :", error);
    res.status(500).json({ message: "Erreur interne du serveur." });
  }
};
