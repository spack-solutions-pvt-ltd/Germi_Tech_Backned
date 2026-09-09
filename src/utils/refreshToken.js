const { RefreshToken } = require("../models");
const { v4: uuidv4 } = require("uuid");


const createRefreshToken = async (user, type) => {
  let token = uuidv4();

  let expiryDate =
    type === "employee"
      ? Date.now() + 1000 * 60 * 10
      : Date.now() + 1000 * 60 * 60 * 24 * 100;


  let refreshToken = await RefreshToken.create({
    token: token,
    userId: user.id,
    expire: expiryDate,
    type: type,
  });
  return refreshToken;
};

module.exports = { createRefreshToken };
