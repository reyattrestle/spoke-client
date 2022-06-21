
const dotenv = require("dotenv");
const jwt = require("jsonwebtoken");
const { SpokeClient } = require("./SpokeClient");

dotenv.config();

const token = {
    sub: "admin@spoke.test",
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 60 * 60,
    iss: process.env.TOKEN_AUTH_ISSUER,
    aud: process.env.TOKEN_AUTH_AUDIENCE,
};

const signed = jwt.sign(token, process.env.TOKEN_AUTH_SHARED_SECRET);


async function Main() {
    const client = new SpokeClient("http://localhost:3000", signed)
    console.log(await client.CreateOrganization("One call create"))
}

Main();