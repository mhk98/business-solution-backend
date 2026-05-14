const jwt = require("jsonwebtoken");
const ApiError = require("../error/ApiError");
require("dotenv").config();

exports.generateToken = (userInfo, extraClaims = {}) => {
  try {
    const payload = {
      Id: userInfo.Id,
      Email: userInfo.Email,
      role: userInfo.role,
      ...extraClaims,
    };

    const token = jwt.sign(payload, process.env.TOKEN_SECRET, {
      expiresIn: "2h",
    });

    return token;
  } catch (error) {
    console.error("Error generating token:", error);
    throw new ApiError(500, "Token generation failed");
  }
};

exports.generateRefreshToken = (userInfo) => {
  try {
    const payload = {
      Id: userInfo.Id,
      Email: userInfo.Email,
      role: userInfo.role,
    };

    const token = jwt.sign(payload, process.env.REFRESH_SECRET, {
      expiresIn: "7d",
    });

    return token;
  } catch (error) {
    console.error("Error generating refresh token:", error);
    throw new ApiError(500, "Refresh token generation failed");
  }
};

exports.verifyRefreshToken = (token) => {
  try {
    return jwt.verify(token, process.env.REFRESH_SECRET);
  } catch (error) {
    throw new ApiError(401, "Invalid or expired refresh token");
  }
};
