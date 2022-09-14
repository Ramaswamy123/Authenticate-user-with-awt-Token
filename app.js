const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");
const express = require("express");
const path = require("path");
const jwt = require("jsonwebtoken");

const app = express();
app.use(express.json());
const dbPath = path.join(__dirname, "covid19IndiaPortal.db");

let db = null;

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server Running at http://localhost:3000/");
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    process.exit(1);
  }
};
initializeDBAndServer();

//AuthenticateToken API
const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "abcdefgh", async (error, payload) => {
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

//USER login API
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `
              SELECT * FROM user WHERE username = '${username}';`;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched === true) {
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "abcdefgh");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

// GET all states API
app.get("/states/", authenticateToken, async (request, response) => {
  const getAllStatesDataQuery = `
                 SELECT
                    *
                  FROM 
                    state`;
  const getQueryResult = await db.all(getAllStatesDataQuery);
  const dbDataToNormalData = getQueryResult.map((each) => {
    return {
      stateId: each.state_id,
      stateName: each.state_name,
      population: each.population,
    };
  });
  response.send(dbDataToNormalData);
});

//GET single state details API
app.get("/states/:stateId/", authenticateToken, async (request, response) => {
  const { stateId } = request.params;
  const getUniqueStateDataQuery = `
                   SELECT 
                      *
                    FROM
                      state
                    WHERE state_id = ${stateId}`;
  const getStateQueryResult = await db.get(getUniqueStateDataQuery);

  response.send({
    stateId: getStateQueryResult.state_id,
    stateName: getStateQueryResult.state_name,
    population: getStateQueryResult.population,
  });
});

//Post new State Data API
app.post("/districts/", authenticateToken, async (request, response) => {
  const districtData = request.body;
  const { districtName, stateId, cases, cured, active, deaths } = districtData;
  const postDistrictDataQuery = `
                 INSERT INTO 
                 district (district_name,state_id,cases,cured,active,deaths)
                 VALUES ("${districtName}",${stateId},${cases},${cured},${active},${deaths});`;
  await db.run(postDistrictDataQuery);
  response.send("District Successfully Added");
});

//get single district details API
app.get(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const getUniqueDistrictDataQuery = `
                    SELECT 
                       *
                    FROM
                       district
                    WHERE district_id = ${districtId}`;
    const getDistrictQueryResult = await db.get(getUniqueDistrictDataQuery);
    response.send({
      districtId: getDistrictQueryResult.district_id,
      districtName: getDistrictQueryResult.district_name,
      stateId: getDistrictQueryResult.state_id,
      cases: getDistrictQueryResult.cases,
      cured: getDistrictQueryResult.cured,
      active: getDistrictQueryResult.active,
      deaths: getDistrictQueryResult.deaths,
    });
  }
);

//DELETE district data API
app.delete(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const deleteDistrictDataQuery = `
                DELETE FROM district
                WHERE district_id = ${districtId};`;
    await db.run(deleteDistrictDataQuery);
    response.send("District Removed");
  }
);

//UPDATE district data API
app.put(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const districtDetails = request.body;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = districtDetails;
    const updateDistrictDataQuery = `
                  UPDATE 
                     district 
                  SET 
                    district_name = "${districtName}",
                    state_id = ${stateId},
                    cases = ${cases},
                    cured = ${cured},
                    active = ${active},
                    deaths = ${deaths}
                  WHERE 
                     district_id = ${districtId}`;
    await db.run(updateDistrictDataQuery);
    response.send("District Details Updated");
  }
);

//get specific state statics API

app.get(
  "/states/:stateId/stats/",
  authenticateToken,
  async (request, response) => {
    const { stateId } = request.params;
    const getTotalCasesQuery = `
                 SELECT 
                    SUM(cases),
                    SUM(cured),
                    SUM(active),
                    SUM(deaths)
                 FROM
                    district
                 WHERE state_id = ${stateId}`;
    const stats = await db.get(getTotalCasesQuery);
    response.send({
      totalCases: stats["SUM(cases)"],
      totalCured: stats["SUM(cured)"],
      totalActive: stats["SUM(active)"],
      totalDeaths: stats["SUM(deaths)"],
    });
  }
);

//get district details API
// app.get("/districts/:districtId/details/", async (request, response) => {
//   const { districtId } = request.params;
//   const getStateNamesQuery = `
//                    SELECT
//                       state_name
//                    FROM
//                       district
//                    NATURAL JOIN
//                       state
//                    WHERE
//                       district_id = ${districtId}`;
//   const resultQuery = await db.get(getStateNamesQuery);
//   response.send({
//     stateName: resultQuery.state_name,
//   });
// });
module.exports = app;
