<img width="1348" height="621" alt="image" src="https://github.com/user-attachments/assets/fb6b24ba-7488-494b-836c-3105c8472f86" />

**Beyond90** is a powerful, feature-rich football blogging platform where users can express their passion for the game. It supports posting, commenting, liking, replying, bookmarking, following other users, and more—all within a sleek, Real Madrid–inspired UI. The app is built using **Node.js**, **Express**, **PostgreSQL**, and **EJS**, and is fully deployed with **Render**.

## 🌍 Live Demo

**[Deployed Link](https://beyond90.onrender.com)**  


---

## 🚀 Features

- ✅ **Authentication**
  - Local login/signup
  - Google OAuth login
  - Session management with Passport.js

- 📝 **Blog Functionality**
  - Create, edit, and delete posts
  - Rich content support with images (Multer + Cloudinary)
  - Category-based filtering
  - Like, bookmark, comment, and reply system

- 👥 **User Interaction**
  - Follow/unfollow users
  - View followers/following lists in modals
  - Notifications for likes, comments, follows, replies

- 🖼️ **UI/UX Highlights**
  - Dynamic homepage with player carousel
  - Overlay content with hover zoom and pop-out effects
  - Football-themed styling and animations

- 📂 **Database**
  - PostgreSQL with fully normalized schema:
    - `users`, `posts`, `comments`, `replies`, `likes`, `bookmarks`, `tags`, `post_tags`, `notifications`, `follows`

---

## 🛠️ Tech Stack

| Category       | Technology                      |
|----------------|----------------------------------|
| Backend        | Node.js, Express.js              |
| Database       | PostgreSQL (Render-hosted)       |
| Frontend       | HTML, CSS, EJS Templates         |
| Auth           | Passport.js, bcrypt, express-session |
| Uploads        | Multer, Cloudinary               |
| Deployment     | Render (Web + PostgreSQL)        |
| Styling        | CSS (custom), animations         |



## ⚙️ Database Setup

### 🔄 Restore a SQL Backup (Render DB)

To restore your PostgreSQL `.sql` dump on Render:

```bash
psql -h dpg-xxxxx.singapore-postgres.render.com -U your_user -d your_db -f beyond90_backup.sql
Replace:

your_user → your DB username

your_db → your DB name

xxxxx... → your Render DB host
It will prompt for your password.

You can also connect the Render DB to pgAdmin:

Host: dpg-xxxxx.singapore-postgres.render.com

Port: 5432

Username: your_user

Maintenance DB: your_db

Password: your_password


## 👨‍💻 Author

[Lagnajit Saha](https://github.com/LagnajitSaha)


