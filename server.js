const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const path = require("path");
require("dotenv").config();
const { corsList } = require("./src/constants/cors");
const errorMiddleware = require("./src/middleWare/error.middleware");
const { sequelize } = require("./src/models/index");
const adminRoutes = require("./src/routes/index");

const app = express();

// Security
app.use(helmet());

// CORS
app.use(
  cors({
    origin: corsList,
    credentials: true,
  }),
);

// Body Parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// file uploads
app.use("/uploads", express.static(path.join(__dirname, "src", "uploads")));

// Main Routes
app.use("/v1/admin", adminRoutes);

// Global Error Handler
app.use(errorMiddleware);

// to start server
const startServer = async () => {
  try {
    await sequelize.authenticate();
    console.log("Database connected successfully");
    app.listen(process.env.PORT, () => {
      console.log(`Server running on port ${process.env.PORT}`);
    });
  } catch (error) {
    console.error("Database connection failed:", error);
  }
};

startServer();
