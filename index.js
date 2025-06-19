import express from 'express';
import bodyParser from 'body-parser';
import pg from 'pg';
import ejs from 'ejs';
import dotenv from 'dotenv';
import bcrypt from "bcrypt";
import passport from "passport";
import { Strategy } from "passport-local";
import GoogleStrategy from "passport-google-oauth2";
import session from "express-session";
import upload from './middlewares/upload.js';
import { cloudinary, storage } from './utils/cloudinary.js';
dotenv.config();

const app = express();
app.use("/uploads", express.static("uploads"));

app.use(
  session({
    secret: process.env.BLOG_WORD,
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 24 * 60 * 60 * 1000, secure: false }
  })
);
app.use(passport.initialize());
app.use(passport.session());

const db = new pg.Client({
  user: process.env.PG_USER,
  host: process.env.PG_HOST,
  database: process.env.PG_DATABASE,
  password: process.env.PG_PASSWORD,
  port: process.env.PG_PORT,
});
db.connect();

const categories = [
  { name: "EPL", slug: "epl" },
  { name: "La Liga", slug: "la-liga" },
  { name: "Bundesliga", slug: "bundesliga" },
  { name: "Serie A", slug: "serie-a" },
  { name: "Ligue A", slug: "ligue-a" },
  { name: "Eredivisie", slug: "eredivisie" },
  { name: "Primeira Liga", slug: "primeira-liga" },
  { name: "Champions League", slug: "cl" },
  { name: "Europa League", slug: "europa-league" },
  { name: "Conference League", slug: "conference-league" },
  { name: "Copa Libertadores", slug: "libertadores" },
  { name: "FIFA Club World Cup", slug: "club-world-cup" },
  { name: "MLS", slug: "mls" },
  { name: "Saudi Pro League", slug: "saudi" },
  { name: "Brasileirão", slug: "brasileirao" },
  { name: "Argentine Primera División", slug: "argentina" },
  { name: "Indian Super League", slug: "isl" },
  { name: "J1 League", slug: "j1" },
  { name: "Chinese Super League", slug: "csl" },
  { name: "International", slug: "international" }
];


const saltRounds = 10;
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));


// const storage = multer.diskStorage({
//   destination: function (req, file, cb) {
//     cb(null, "public/uploads");
//   },
//   filename: function (req, file, cb) {
//     const uniqueName = Date.now() + path.extname(file.originalname);
//     cb(null, file.fieldname + "-" + uniqueName);
//   }
// });

// const upload = multer({ storage: storage });



// Cloudinary config


// Multer Cloudinary Storage


function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) return next();
  res.redirect("/login");
}

async function incrementVisitorCount(req, res, next) {
  try {
    if (!req.session.visitorCounted) {
      await db.query(`UPDATE total_visitors SET count = count + 1 WHERE id = 1`);
      req.session.visitorCounted = true;
    }
  } catch (err) {
    console.error('Error incrementing total visitors:', err);
  }
  next();
}

app.get("/", (req, res) => {
  res.render("home.ejs", { user: req.user || null });
});

app.get("/login", (req, res) => {
  res.render("login.ejs");
});

app.get("/register", (req, res) => {
  res.render("register.ejs");
});

app.get("/logout", (req, res) => {
  req.logout(err => {
    if (err) console.error(err);
    res.redirect("/");
  });
});
app.post("/upload", upload.single("image"), (req, res) => {
  if (!req.file) return res.status(400).send("No file uploaded");
  console.log("Uploaded file info:", req.file);
  res.send("Upload successful! URL: " + req.file.path);
});

async function loadPosts(filterCategory = null) {
  const filterClause = filterCategory ? `WHERE p.category = '${filterCategory}'` : "";
  const postsResult = await db.query(`
    SELECT p.*, u.username,u.profile_photo_url, u.id AS user_id,
      (SELECT COUNT(*) FROM likes WHERE post_id = p.id) AS likescount,
      (SELECT COUNT(*) FROM bookmarks WHERE post_id = p.id) AS bookmarkcount
    FROM posts p
    JOIN users u ON p.user_id = u.id
    ${filterClause}
    ORDER BY p.created_at DESC
  `);
  const posts = postsResult.rows;
  for (let post of posts) {
    const commentRes = await db.query(`
      SELECT c.*, u.username
      FROM comments c
      JOIN users u ON c.user_id = u.id
      WHERE c.post_id = $1
      ORDER BY c.created_at ASC
    `, [post.id]);
    post.comments = commentRes.rows;
    for (let comment of post.comments) {
      const replyRes = await db.query(`
        SELECT r.*, u.username
        FROM replies r
        JOIN users u ON r.user_id = u.id
        WHERE r.comment_id = $1
        ORDER BY r.created_at ASC
      `, [comment.id]);
      comment.replies = replyRes.rows;
    }
  }
  return posts;
}
app.get("/cloudinary-test", async (req, res) => {
  try {
    const result = await cloudinary.uploader.upload("public/images/test.jpg", {
      folder: "Beyond90"
    });
    res.send(result);
  } catch (err) {
    console.log(err);
    res.send("Cloudinary upload failed " + err.message);

  }
});

app.get("/blogs", ensureAuthenticated, async (req, res) => {
  try {
    const posts = await loadPosts();
    const result = await db.query("SELECT count FROM total_visitors WHERE id = 1");


    const visitors = result.rows[0].count;
    res.render("index.ejs", { posts, user: req.user || null, categories, visitors });
  } catch (err) {
    console.error(err);
    res.render("error.ejs", { error: "Failed to load posts" });
  }
});

app.get("/footer-stats", async (req, res) => {
  try {
    const likesResult = await db.query("SELECT count FROM website_likes WHERE id = 1");
    const visitorsResult = await db.query("SELECT count FROM total_visitors WHERE id = 1");

    res.json({
      likes: likesResult.rows[0].count,
      visitors: visitorsResult.rows[0].count
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch footer stats" });
  }
});

app.post('/like-website', ensureAuthenticated, async (req, res) => {
  const userId = req.user.id;
  try {
    const liked = await db.query("SELECT * FROM website_likes_users WHERE user_id = $1", [userId]);

    if (liked.rows.length > 0) {
      // User already liked, so unlike
      await db.query("DELETE FROM website_likes_users WHERE user_id = $1", [userId]);
      await db.query("UPDATE website_likes SET count = count - 1 WHERE id = 1");
    } else {
      // Like the website
      await db.query("INSERT INTO website_likes_users (user_id) VALUES ($1)", [userId]);
      await db.query("UPDATE website_likes SET count = count + 1 WHERE id = 1");
    }

    const updated = await db.query("SELECT count FROM website_likes WHERE id = 1");
    res.json({ likes: updated.rows[0].count });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Unable to update like status" });
  }
});


app.post("/update-photo", ensureAuthenticated, upload.single("profilePhoto"), async (req, res) => {
  // const photoPath = "/uploads/" + req.file.filename;
  const photoPath = req.file.path;
  await db.query("UPDATE users SET profile_photo_url = $1 WHERE id = $2", [photoPath, req.user.id]);
  res.redirect("/user");
});

// Like a post
app.post("/posts/:id/like", ensureAuthenticated, async (req, res) => {
  const postId = req.params.id;
  const userId = req.user.id;
  try {
    const result = await db.query("SELECT * FROM likes WHERE user_id = $1 AND post_id = $2", [userId, postId]);
    if (result.rows.length > 0) {
      await db.query("DELETE FROM likes WHERE user_id = $1 AND post_id = $2", [userId, postId]);
    } else {
      await db.query("INSERT INTO likes (user_id, post_id) VALUES ($1, $2)", [userId, postId]);
    }
    const likeCount = await db.query("SELECT COUNT(*) FROM likes WHERE post_id = $1", [postId]);
    res.json({ likes: likeCount.rows[0].count });
  } catch (err) {
    console.error(err);
    res.status(500).render("error.ejs", { error: "Failed to toggle like" });
  }
});


// Bookmark a post
app.post("/posts/:id/bookmark", ensureAuthenticated, async (req, res) => {
  const postId = req.params.id;
  const userId = req.user.id;
  try {
    await db.query(
      "INSERT INTO bookmarks (user_id, post_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
      [userId, postId]
    );
    const result = await db.query("SELECT COUNT(*) FROM bookmarks WHERE post_id = $1", [postId]);
    res.json({ bookmarks: result.rows[0].count });
  } catch (err) {
    console.error(err);
    res.status(500).render("error.ejs", { error: "Failed to bookmark post" });
  }
});


app.get("/category/:slug", ensureAuthenticated, async (req, res) => {
  const slug = req.params.slug;
  const catObj = categories.find(c => c.slug === slug);
  const result = await db.query("SELECT count FROM total_visitors WHERE id = 1");
  const visitors = result.rows[0].count;
  if (!catObj) return res.status(404).send("Invalid category");
  try {
    const posts = await loadPosts(catObj.name);
    res.render("index.ejs", { posts, user: req.user || null, categories, visitors });
  } catch (err) {
    console.error(err);
    res.render("error.ejs", { error: "Failed to load posts for category" });
  }
});

app.post("/register", incrementVisitorCount, async (req, res) => {
  const { username, email, password } = req.body;

  try {
    const existingUser = await db.query("SELECT * FROM users WHERE email = $1", [email]);
    if (existingUser.rows.length > 0) return res.redirect("/login");

    bcrypt.hash(password, saltRounds, async (err, hashedPassword) => {
      if (err) return res.status(500).render("error.ejs", { error: "Failed to hash password" });

      const result = await db.query(
        "INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING *",
        [username, email, hashedPassword]
      );

      req.login(result.rows[0], err => {
        if (err) return res.redirect("/login");
        res.redirect("/blogs");
      });
    });
  } catch (err) {
    console.error(err);
    res.status(500).render("error.ejs", { error: "Failed to register user" });
  }
});

app.post("/login", incrementVisitorCount,
  passport.authenticate("local", {
    successRedirect: "/blogs",
    failureRedirect: "/login",
  })
);

app.get("/auth/google", passport.authenticate("google", { scope: ["profile", "email"] }));

app.get("/auth/google/callback",
  passport.authenticate("google", { failureRedirect: "/login" }),
  async function (req, res) {
    try {
      await db.query("UPDATE total_visitors SET count = count + 1 WHERE id = 1");
    } catch (err) {
      console.error("Error updating total visitors:", err);
    }
    res.redirect("/blogs");
  }
);

app.get("/user", ensureAuthenticated, async (req, res) => {
  const profileUserId = req.user.id;
  const loggedInUserId = req.user.id;

  try {
    const userRes = await db.query(`
      SELECT id, username, email, bio, created_at, profile_photo_url
      FROM users
      WHERE id = $1
    `, [profileUserId]);

    const profileUser = userRes.rows[0];

    const likedRes = await db.query(`
      SELECT p.id, p.title
      FROM likes l JOIN posts p ON l.post_id = p.id
      WHERE l.user_id = $1
    `, [profileUserId]);

    const bookmarkedRes = await db.query(`
      SELECT p.id, p.title
      FROM bookmarks b JOIN posts p ON b.post_id = p.id
      WHERE b.user_id = $1
    `, [profileUserId]);

    const commentedRes = await db.query(`
      SELECT DISTINCT p.id, p.title
      FROM comments c JOIN posts p ON c.post_id = p.id
      WHERE c.user_id = $1
    `, [profileUserId]);

    const followersRes = await db.query(`
      SELECT u.id, u.username, u.profile_photo_url
      FROM follows f
      JOIN users u ON f.follower_id = u.id
      WHERE f.following_id = $1
    `, [profileUserId]);

    const followingRes = await db.query(`
      SELECT u.id, u.username, u.profile_photo_url
      FROM follows f
      JOIN users u ON f.following_id = u.id
      WHERE f.follower_id = $1
    `, [profileUserId]);

    // Since it's your own profile, no need to check for isFollowing
    const isOwnProfile = true;
    const isFollowing = false;

    res.render("user.ejs", {
      user: profileUser,
      likedPosts: likedRes.rows,
      bookmarkedPosts: bookmarkedRes.rows,
      commentedPosts: commentedRes.rows,
      followers: followersRes.rows,
      following: followingRes.rows,
      isOwnProfile,
      isFollowing
    });
  } catch (err) {
    console.error(err);
    res.status(500).render("error.ejs", { error: "Failed to load your profile" });
  }
});


app.get("/user/:id", ensureAuthenticated, async (req, res) => {
  const profileUserId = parseInt(req.params.id); // profile being visited
  const loggedInUserId = req.user.id;

  try {
    const userRes = await db.query(`
      SELECT id, username, email, bio, created_at, profile_photo_url
      FROM users
      WHERE id = $1
    `, [profileUserId]);

    if (userRes.rows.length === 0) {
      return res.status(404).render("error.ejs", { error: "User not found" });
    }

    const profileUser = userRes.rows[0];

    const likedRes = await db.query(`
      SELECT p.id, p.title
      FROM likes l JOIN posts p ON l.post_id = p.id
      WHERE l.user_id = $1
    `, [profileUserId]);

    const bookmarkedRes = await db.query(`
      SELECT p.id, p.title
      FROM bookmarks b JOIN posts p ON b.post_id = p.id
      WHERE b.user_id = $1
    `, [profileUserId]);

    const commentedRes = await db.query(`
      SELECT DISTINCT p.id, p.title
      FROM comments c JOIN posts p ON c.post_id = p.id
      WHERE c.user_id = $1
    `, [profileUserId]);

    const followersRes = await db.query(`
      SELECT u.id, u.username, u.profile_photo_url
      FROM follows f
      JOIN users u ON f.follower_id = u.id
      WHERE f.following_id = $1
    `, [profileUserId]);

    const followingRes = await db.query(`
      SELECT u.id, u.username, u.profile_photo_url
      FROM follows f
      JOIN users u ON f.following_id = u.id
      WHERE f.follower_id = $1
    `, [profileUserId]);

    const isFollowingRes = await db.query(`
      SELECT 1 FROM follows
      WHERE follower_id = $1 AND following_id = $2
    `, [loggedInUserId, profileUserId]);

    const isOwnProfile = (loggedInUserId === profileUserId);
    const isFollowing = (isFollowingRes.rowCount > 0);
    console.log(loggedInUserId, profileUserId, isOwnProfile, isFollowing);

    res.render("user.ejs", {
      user: profileUser,
      likedPosts: likedRes.rows,
      bookmarkedPosts: bookmarkedRes.rows,
      commentedPosts: commentedRes.rows,
      followers: followersRes.rows,
      following: followingRes.rows,
      isOwnProfile,
      isFollowing
    });
  } catch (err) {
    console.error(err);
    res.status(500).render("error.ejs", { error: "Failed to load user details" });
  }
});



app.post("/upload-profile-photo", ensureAuthenticated, upload.single("profilePhoto"), async (req, res) => {
  const userId = req.user.id;
  const file = req.file;

  if (!file) {
    return res.status(400).send("No file uploaded");
  }

  try {
    const photoUrl = req.file.path;
    await db.query(
      `UPDATE users SET profile_photo_url = $1 WHERE id = $2`,
      [photoUrl, userId]
    );
    res.redirect("/user");
  } catch (err) {
    console.error(err);
    res.status(500).send("Failed to update profile photo");
  }
});
app.post("/follow/:id", ensureAuthenticated, async (req, res) => {
  const followerId = req.user.id;
  const followingId = parseInt(req.params.id);

  if (followerId === followingId) return res.status(400).send("Cannot follow yourself.");

  try {
    await db.query("INSERT INTO follows (follower_id, following_id) VALUES ($1, $2) ON CONFLICT DO NOTHING", [followerId, followingId]);
    res.redirect(`/user/${followingId}`);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error following user.");
  }
});
app.post("/unfollow/:id", ensureAuthenticated, async (req, res) => {
  const followerId = req.user.id;
  const followingId = parseInt(req.params.id);

  try {
    await db.query("DELETE FROM follows WHERE follower_id = $1 AND following_id = $2", [followerId, followingId]);
    res.redirect(`/user/${followingId}`);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error unfollowing user.");
  }
});


app.post("/submit", ensureAuthenticated, upload.single("postImage"), async (req, res) => {
  console.log("req.file = ", req.file);
  if (!req.file) {
    return res.status(400).render("error.ejs", { error: "No image uploaded" });
  }
  const { postTitle, postBody, postCategory } = req.body;
  const image = req.file ? req.file.path : null; // Cloudinary URL
  console.log("Uploaded image info:", req.file);
  const imageUrl = req.file.path;
  console.log("Image URL:", imageUrl);


  if (!postTitle || !postBody || !postCategory) {
    return res.status(400).render("error.ejs", { error: "All fields are required" });
  }

  try {
    await db.query(
      "INSERT INTO posts (title, body, category, user_id, image) VALUES ($1, $2, $3, $4, $5)",
      [postTitle, postBody, postCategory, req.user.id, image]
    );
    res.redirect("/blogs");
  } catch (err) {
    console.error("Error saving post:", err);
    res.status(500).render("error.ejs", { error: "Failed to save post" });
  }
});


app.post("/edit/:id", ensureAuthenticated, async (req, res) => {
  const { postTitle, postBody } = req.body;
  const postId = req.params.id;
  const userId = req.user.id;
  const result = await db.query('SELECT * FROM posts WHERE id = $1', [postId]);
  const post = result.rows[0];

  if (!post) {
    return res.status(404).send("Post not found");
  }

  if (post.user_id !== userId) {
    return res.status(403).send("Unauthorized to edit this post");
  }
  await db.query("UPDATE posts SET title = $1, body = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3 AND user_id = $4",
    [postTitle, postBody, postId, userId]);
  res.redirect("/blogs");
});

app.post("/delete/:id", ensureAuthenticated, async (req, res) => {
  const postId = req.params.id;
  const userId = req.user.id;  // from session

  const post = await db.query("SELECT * FROM posts WHERE id = $1", [postId]);

  if (post.rows.length === 0) {
    return res.status(404).send("Post not found");
  }

  if (post.rows[0].user_id !== userId) {
    return res.status(403).send("Unauthorized to delete this post");
  }
  await db.query("DELETE FROM posts WHERE id = $1 AND user_id = $2", [postId, userId]);
  res.redirect("/blogs");
});

app.post("/update-bio", ensureAuthenticated, async (req, res) => {
  const userId = req.user.id;
  const { bio } = req.body;
  try {
    await db.query("UPDATE users SET bio = $1 WHERE id = $2", [bio, userId]);
    res.redirect("/user");
  } catch (err) {
    console.error(err);
    res.status(500).render("error.ejs", { error: "Failed to update bio" });
  }
});


app.post("/comment/:postId", ensureAuthenticated, async (req, res) => {
  const { commentBody } = req.body;
  const postId = req.params.postId;
  const userId = req.user.id;
  await db.query("INSERT INTO comments (post_id, user_id, content) VALUES ($1, $2, $3)", [postId, userId, commentBody]);
  res.redirect("/blogs");
});

app.post("/reply/:commentId", ensureAuthenticated, async (req, res) => {
  const { replyContent } = req.body;
  const commentId = req.params.commentId;
  const userId = req.user.id;
  await db.query("INSERT INTO replies (comment_id, user_id, reply_body) VALUES ($1, $2, $3)", [commentId, userId, replyContent]);
  res.redirect("/blogs");
});

passport.use("local",
  new Strategy({ usernameField: "email" }, async (email, password, cb) => {
    try {
      const result = await db.query("SELECT * FROM users WHERE email = $1", [email]);
      if (result.rows.length === 0) return cb(null, false);
      const user = result.rows[0];
      bcrypt.compare(password, user.password_hash, (err, valid) => {
        if (err) return cb(err);
        if (!valid) return cb(null, false);
        return cb(null, user);
      });
    } catch (err) {
      return cb(err);
    }
  })
);

passport.use("google", new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: "http://localhost:3000/auth/google/callback",
  userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo",
},
  async (accessToken, refreshToken, profile, cb) => {
    try {
      const email = profile.emails[0].value;
      const username = profile.displayName || profile.name?.givenName || email.split("@")[0] || "GoogleUser";
      const result = await db.query("SELECT * FROM users WHERE email = $1", [email]);
      if (result.rows.length === 0) {
        const newUser = await db.query(
          "INSERT INTO users (email, username, password_hash) VALUES ($1, $2, $3) RETURNING *",
          [email, username, "google"]
        );
        return cb(null, newUser.rows[0]);
      } else {
        return cb(null, result.rows[0]);
      }
    } catch (err) {
      return cb(err);
    }
  }
));

passport.serializeUser((user, cb) => cb(null, user));
passport.deserializeUser((user, cb) => cb(null, user));

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
