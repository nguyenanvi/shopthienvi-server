const path = require("path");
const Dotenv = require("dotenv-webpack");

module.exports = {
  entry: path.resolve(__dirname, "src", "index.js"), // Ensure correct entry file path
  output: {
    filename: "bundle.js",
    path: path.resolve(__dirname, "dist") // Ensures compatibility across OS
  },
  plugins: [
    new Dotenv()
  ],
  mode: "production", // You can switch to "development" if debugging
};