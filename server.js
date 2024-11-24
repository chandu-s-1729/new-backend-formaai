const express = require("express");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const cors = require("cors");

const app = express();
app.use(express.json());
app.use(cors());

const path = require("path");
const dbPath = path.join(__dirname, "./formadata.db");

let db = null;

const initializeDBAndServer = async (request, response) => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });

    app.listen(3000, () => {
      console.log("Server Running at http://localhost:3000/");
    });
  } catch (e) {
    console.log(`DB Error ${e.message}`);
    process.exit(1);
  }
};

initializeDBAndServer();

module.exports = app;

// Authentication Middleware Function
const authenticateToken = async (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "CHANDUKALISETTI", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.username = payload.username;
        next();
      }
    });
  }
};

// API 1 - POST User Registration
app.post("/register/", async (request, response) => {
  const { name, username, password } = request.body;
  const hashedPassword = await bcrypt.hash(request.body.password, 10);
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}';`;
  const dbUser = await db.get(selectUserQuery);

  if (dbUser === undefined) {
    if (password.length < 6) {
      response.status(400);
      response.send("Password is too short");
    } else {
      const createUserQuery = `
            INSERT INTO 
                user (name, username, password )
            VALUES 
                (
                '${name}',
                '${username}',
                '${hashedPassword}'
                );`;
      const dbResponse = await db.run(createUserQuery);
      response.send("User created successfully");
    }
  } else {
    response.status(400);
    response.send("User already exists");
  }
});

// API 2 - POST User Login
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}';`;
  const dbUser = await db.get(selectUserQuery);

  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched === true) {
      const payload = {
        username: username,
      };
      const jwtToken = jwt.sign(payload, "CHANDUKALISETTI");

      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

// API 3 - POST Creating a  in the tweet table
app.post("/user/form/", authenticateToken, async (request, response) => {
  const { username } = request;
  const {
    age,
    gender,
    weight,
    height,
    goal,
    dietary,
    workoutTime,
    level,
  } = request.body;
  const userIdQuery = `SELECT user_id AS userId FROM user WHERE username = '${username}';`;
  const { userId } = await db.get(userIdQuery);

  const date = new Date();
  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();
  const hour = date.getHours();
  const minute = date.getMinutes();
  const second = date.getSeconds();

  const postFormDataQuery = `
        INSERT INTO
            formdata (user_id,age,gender,weight,height,goal,dietary,workout_time,level, date_time)
        VALUES
        (
             ${userId},
             ${age},
            '${gender}',
             ${weight},
             ${height},
            '${goal}',
            '${dietary}',
            '${workoutTime}',
            '${level}',
            '${year}-${month}-${day} ${hour}:${minute}:${second}'
        );
    `;

  await db.run(postFormDataQuery);
  response.send("Created a Form Data");
});

// API 4 - Updated data (last row) tails of user from formdata table
app.get(
  "/user/forms/details/",
  authenticateToken,
  async (request, response) => {
    const { username } = request;

    const getFormDetailsOfUser = `
        SELECT
            user.username AS username,
            user.name AS name,
            formdata.age AS age, 
            formdata.gender AS gender,
            formdata.weight AS weight,
            formdata.height AS height,
            formdata.goal AS goal,
            formdata.dietary AS dietary,
            formdata.workout_time AS workoutTime,
            formdata.level AS level,
            formdata.date_time AS dateTime
        FROM
            user INNER JOIN formdata 
                ON user.user_id = formdata.user_id
        WHERE 
            user.username = '${username}'
        ORDER BY
                dateTime DESC
        LIMIT
                1;
    `;

    const formDetailsOfUser = await db.all(getFormDetailsOfUser);
    response.send(formDetailsOfUser);
  }
);