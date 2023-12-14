const express = require("express");
const path = require("path");
const bcrypt = require("bcrypt");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const jwt = require("jsonwebtoken");

const app = express();
app.use(express.json());

const dbPath = path.join(__dirname, "project.db");

let db = null;

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });

    app.listen(3010, () => {
      console.log("server started");
    });
  } catch (e) {
    console.log(`DB error: ${e.message}`);
    process.exit(1);
  }
};

initializeDBAndServer();

// Authentication check of user

const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid Access Token");
  } else {
    jwt.verify(jwtToken, "secret", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("invalid jwt");
      } else {
        request.username = payload.username;
        next();
      }
    });
  }
};

//displaying the user profile

app.get("/profile/", authenticateToken, async (request, response) => {
  let { username } = request;
  console.log(username);
  const getUserDetails = `select * from login where username = '${username}';`;
  const dbUser = await db.get(getUserDetails);
  response.send(dbUser);
});

// creating tasks for the logged-in user

app.post("/create-your-task/", authenticateToken, async (request, response) => {
  const { username } = request;
  const todoDetails = request.body;
  const { title, description, dueDate, status } = todoDetails;
  const newTodoDetails = `
    INSERT INTO task (username, title, description, duedate, status)
    VALUES ('${username}', '${title}', '${description}', '${dueDate}', '${status}');
  `;
  const dbResponse = await db.run(newTodoDetails);
  response.send("task created successfully");
});

//get all tasks that are present in db irrespective user

app.get("/get-all-tasks/", authenticateToken, async (request, response) => {
  const getAllTodo = `select * from task;`;
  const getTodo = await db.all(getAllTodo);
  response.send(getTodo);
});

//getting all tasks that are belongs to logged-in user

app.get("/get-own-tasks/", authenticateToken, async (request, response) => {
  const { username } = request;
  const getAllTodo = `select * from task where username = '${username}';`;
  try {
    const todos = await db.all(getAllTodo);

    if (todos.length > 0) {
      response.json(todos);
    } else {
      response.status(404).send("No todos found for the user");
    }
  } catch (error) {
    response.status(500).send("Internal Server Error");
  }
});

//updating the particular task based on ID that belongs to the logged-in user

app.put(
  "/update-your-task/:todoId",
  authenticateToken,
  async (request, response) => {
    const { username } = request;
    const { todoId } = request.params;
    const updatedTodoDetails = request.body;
    const { title, description, dueDate, status } = updatedTodoDetails;

    // Check if the todo belongs to the authenticated user
    const checkOwnershipQuery = `
    SELECT * FROM task
    WHERE id = ${todoId} AND username = '${username}';
  `;

    try {
      const todoOwner = await db.get(checkOwnershipQuery);

      if (!todoOwner) {
        response
          .status(404)
          .send("Task not found or does not belong to the authenticated user");
        return;
      }

      // Update the todo for the authenticated user
      const updateTodoQuery = `
      UPDATE task
      SET title = '${title}', description = '${description}', duedate = '${dueDate}', status = '${status}'
      WHERE id = ${todoId} AND username = '${username}';
    `;

      const dbResponse = await db.run(updateTodoQuery);

      if (dbResponse.changes === 0) {
        response
          .status(404)
          .send("Task not found or does not belong to the authenticated user");
      } else {
        response.send("Task updated successfully");
      }
    } catch (error) {
      console.error(error);
      response.status(500).send("Internal Server Error");
    }
  }
);

//deleting the particular task based on ID that belongs to the logged-in user

app.delete(
  "/delete-your-task/:todoId",
  authenticateToken,
  async (request, response) => {
    const { username } = request;
    const { todoId } = request.params;

    // Check if the todo belongs to the authenticated user
    const checkOwnershipQuery = `
    SELECT * FROM task
    WHERE id = ${todoId} AND username = '${username}';
  `;

    try {
      const todoOwner = await db.get(checkOwnershipQuery);

      if (!todoOwner) {
        response
          .status(404)
          .send("Task not found or does not belong to the authenticated user");
        return;
      }

      // Delete the todo for the authenticated user
      const deleteTodoQuery = `
      DELETE FROM task
      WHERE id = ${todoId} AND username = '${username}';
    `;

      const dbResponse = await db.run(deleteTodoQuery);

      if (dbResponse.changes === 0) {
        response
          .status(404)
          .send("Task not found or does not belong to the authenticated user");
      } else {
        response.send("Task deleted successfully");
      }
    } catch (error) {
      console.error(error);
      response.status(500).send("Internal Server Error");
    }
  }
);

//creating user

app.post("/users/", async (request, response) => {
  const { username, password } = request.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  const selectUserQuery = `select * from login where username = '${username}';`;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    const createUser = `insert into login (username,password) values ('${username}','${hashedPassword}');`;
    await db.run(createUser);
    response.send("User created");
  } else {
    response.status(400);
    response.send("user already exists");
  }
});

//login function for registered user

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectedUser = `select * from login where username = '${username}';`;
  const dbUser = await db.get(selectedUser);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    isPassMatch = await bcrypt.compare(password, dbUser.password);
    if (isPassMatch) {
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "secret");
      response.send(jwtToken);
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});
