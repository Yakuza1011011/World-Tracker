import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import env from "dotenv";

const app = express();
const port = 3000;
env.config();

const db = new pg.Client({
  user: process.env.PG_USER,
  host: process.env.PG_HOST,
  database: process.env.PG_DATABASE,
  password: process.env.PG_PASSWORD, // Use your existing password here.
  port: process.env.PG_PORT,
});

await db.connect();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

let currentUserId = 1;

app.get("/", async (req, res, next) => {
  try {
    const userId = currentUserId;
    const usersResult = await db.query(
      "SELECT id, name, color FROM users ORDER BY id"
    );
    const users = usersResult.rows;
    const currentUser = users.find((user) => user.id === userId);

    if (!currentUser) {
      return res.status(404).send("Selected user was not found.");
    }

    const visitedResult = await db.query(
      "SELECT country_code FROM visited_countries WHERE user_id = $1",
      [userId]
    );
    const countries = visitedResult.rows.map((row) => row.country_code);

    res.render("index.ejs", {
      countries,
      total: countries.length,
      users,
      color: currentUser.color,
    });
  } catch (error) {
    next(error);
  }
});

app.post("/add", async (req, res, next) => {
  const userId = currentUserId;
  const input = (req.body.country || "").trim();

  if (!input) {
    return res.status(400).send("Please enter a country name.");
  }

  try {
    const result = await db.query(
      "SELECT country_code FROM countries WHERE LOWER(country_name) = LOWER($1)",
      [input]
    );

    if (result.rows.length === 0) {
      return res.status(404).send("Country not found. Enter the full country name.");
    }

    await db.query(
      "INSERT INTO visited_countries (country_code, user_id) VALUES ($1, $2)",
      [result.rows[0].country_code, userId]
    );

    res.redirect("/");
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).send("This country has already been added.");
    }
    next(error);
  }
});

app.post("/user", (req, res) => {
  if (req.body.add === "new") {
    return res.render("new.ejs");
  }

  currentUserId = Number(req.body.user);
  res.redirect("/");
});

app.post("/new", async (req, res, next) => {
  try {
    const { name, color } = req.body;
    const result = await db.query(
      "INSERT INTO users (name, color) VALUES ($1, $2) RETURNING id",
      [name, color]
    );

    currentUserId = result.rows[0].id;
    res.redirect("/");
  } catch (error) {
    next(error);
  }
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});