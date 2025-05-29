const express = require("express");
const path = require("path");
const crypto = require("crypto");
const mongoose = require("mongoose");
const nodemailer = require("nodemailer");
const cors = require("cors");
const fs = require("fs");
const jwt = require("jsonwebtoken");
const { get } = require("http");
require("dotenv").config().parsed;

// Define the trusted origins
const trustedOrigins = [
  // "http://127.0.0.1:3000", 
  "https://shopthienvi.web.app"
];

const corsOptions = {
  origin: function (origin, callback) {
    console.log("Origin request:", origin); // Debugging
    if (!origin || trustedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
};

// Create Express app
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Serve static files from the CDN folder
app.use("/cdn", express.static(path.join(__dirname, "cdn")));

app.use("/dist", express.static(path.join(__dirname, "../dist/bundle.js")));

// Connect to MongoDB (use MONGO_URI if set, otherwise defaults to a local database)
mongoose
  .connect(process.env.MONGO_URI || "mongodb://localhost:27017/orderdb", {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error("MongoDB connection error:", err));

// Create Order model
const orderSchema = new mongoose.Schema(
  {
    productName: { type: String, required: true },
    quantity: { type: Number, required: true },
    specs: String,
    customerName: { type: String, required: true },
    customerPhone: { type: String, required: true },
    isUsingZalo: { type: Boolean, default: false },
    email: { type: String, required: false },
    note: String,
    isRead: { type: Boolean, default: false },
  },
  { timestamps: true }
);

const Order = mongoose.model("Order", orderSchema);

// 1. POST /login route
app.post("/login", (req, res) => {
  const { username, password } = req.body;

  console.log("try to login: ", username, password);

  // Check for required fields
  if (!username || !password) {
    return res.status(400).send("Missing required fields.");
  }

  // Compare username against the one stored in password.env file
  if (username !== process.env.ADMIN_USERNAME) {
    return res.status(401).send("Invalid username or password.");
  }

  // Hash the incoming password with SHA256 (or use bcrypt in production)
  const hash = crypto.createHash("sha256").update(password).digest("hex");
  if (hash !== process.env.ADMIN_PASSWORD_HASH) {
    return res.status(401).send("Invalid username or password.");
  }

  const token = jwt.sign({ username }, process.env.JWT_SECRET, {
    expiresIn: "1h",
  });

  console.log("✅ User authenticated:", token);
  res.status(200).json({
    token,
    expiresIn: 3600, // 1 hour
  });
});

// Middleware to check authentication
const isAuthenticated = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  console.log("An user is trying to call protected route, token: ", token);

  if (!token) {
    return res.status(403).json({ message: "Access denied" });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ message: "Invalid token" });
    }
    req.user = decoded;
    next();
  });
};

// 2. GET /fetch-content route ------------------------
app.get("/fetch-content/:filename/:fileext", isAuthenticated, (req, res) => {
  const { filename, fileext } = req.params;
  const filefullname = filename + "." + fileext;
  console.log("Try to fetch ", filefullname);

  if (fs.existsSync(path.join(__dirname, filefullname))) {
    console.log(filefullname + "is exist");

    return res.json({
      file: fs.readFileSync(path.join(__dirname, filefullname), "utf8"),
    });
  }

  res.status(404).json({ message: "File not found" });
});

// ----------------------------------------------
// 2. POST /order/add route, no middleware required, send from the client side
app.post("/order/add", async (req, res) => {
  console.log("An user is trying to add an order: ", req.body);
  try {
    // Destructure order fields from request body
    if (typeof req.body !== "object" || Array.isArray(req.body)) {
      return res.status(400).send("Request body is not a valid JSON object.");
    }

    const {
      productName,
      quantity,
      specs,
      customerName,
      customerPhone,
      isUsingZalo,
      email,
      note,
    } = req.body;

    // Validate required fields
    if (!quantity || !customerName || !customerPhone) {
      return res.status(400).send("Missing required fields.");
    } else {
    // Save the order to the database
    const newOrder = new Order({
      productName,
      quantity,
      specs,
      customerName,
      customerPhone,
      isUsingZalo: isUsingZalo == 'on',
      email: email || "",
      note,
    });
    await newOrder.save();
    // Prepare to send an email using nodemailer
    let transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST, // e.g., 'smtp.gmail.com'
      port: process.env.EMAIL_PORT || 465, // Default SMTP port
      secure: process.env.EMAIL_SECURE === "true", // true for 465, false for other ports
      auth: {
        user: process.env.EMAIL_USER, // Your email address
        pass: process.env.EMAIL_PASS, // Your email password or app password
      },
    });

    // get mailsample.html file and replace the placeholders with actual values
    const fs = require("fs");
    const path = require("path");

    const emailHtml = fs.readFileSync(
      path.join(__dirname, "mailsample.html"),
      "utf8"
    );
    const emailContent = emailHtml.toString()
      .replace("{{productName}}", productName ? productName.toString() : "Không có tên sản phẩm")
      .replace("{{quantity}}", quantity ? quantity.toString() : "Không có số lượng")
      .replace("{{specs}}", specs ? specs.toString(): "Không có thông số kỹ thuật")
      .replace("{{customerName}}", customerName ? customerName.toString() : "Không có tên khách hàng")
      .replace("{{customerPhone}}", customerPhone ? customerPhone.toString() : "Không có số điện thoại khách hàng")
      .replace("{{isUsingZalo}}", isUsingZalo ? "Có Zalo" : "Không có Zalo")
      .replace("{{email}}", email ? email.toString() : "Không có email")
      .replace("{{note}}", note ? note.toString() : "Không có ghi chú")
      .replace("{{timestamps}}", new Date().toLocaleString())
      .replace("{{clientUri}}", process.env.CLIENT_URI || "http://localhost:3000");

    console.log("Email content prepared:", emailContent);
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: process.env.EMAIL_TO,
      subject: "New Order Received",
      html: emailContent, // Use the prepared HTML content
    };
    await transporter.sendMail(mailOptions);

    console.log("Email sent successfully");
    res.status(200).json({ message: "Order received and email sent." });
    }

  } catch (error) {
    console.error("Error in /subcribe:", error);
    res.status(500).send("Error processing order subscription.");
  }
});

// ----------------------------------------------
// Protected routes (requires a valid session)

// GET /order/get: Retrieve all orders
app.get("/order/get", isAuthenticated, async (req, res) => {
  console.log("An user is trying to get all orders");
  try {
    const orders = await Order.find();
    console.log("Orders retrieved:", orders.length);
    res.json({ orders });
  } catch (error) {
    console.error("Error retrieving orders:", error);
    res.status(500).send("Error retrieving orders.");
  }
});

// // GET /order/:id: Get details of a specific order
// app.get("/order/:id", isAuthenticated, async (req, res) => {
//   try {
//     const order = await Order.findById(req.params.id);
//     if (!order) {
//       return res.status(404).send("Order not found.");
//     }
//     res.json(order);
//   } catch (error) {
//     console.error("Error retrieving order:", error);
//     res.status(500).send("Error retrieving the order.");
//   }
// });

// // DELETE /order/delete: Delete an order (expects the order id in query or body)
// app.delete("/order/delete", isAuthenticated, async (req, res) => {
//   // You can send the order id either as a query parameter (e.g., /order/delete?id=XYZ)
//   // or in the JSON body. Here we check for both.
//   const orderId = req.query.id || req.body.id;
//   if (!orderId) {
//     return res.status(400).send("Order id is required.");
//   }

//   try {
//     const deletedOrder = await Order.findByIdAndDelete(orderId);
//     if (!deletedOrder) {
//       return res.status(404).send("Order not found.");
//     }
//     res.json({ message: "Order deleted successfully." });
//   } catch (error) {
//     console.error("Error deleting order:", error);
//     res.status(500).send("Error deleting the order.");
//   }
// });

// // PUT /order/markasread: Update an order’s read status
// app.put("/order/markasread", isAuthenticated, async (req, res) => {
//   const { id, isRead } = req.body;
//   if (typeof id === "undefined" || typeof isRead === "undefined") {
//     return res.status(400).send("Order id and isRead status are required.");
//   }

//   try {
//     const updatedOrder = await Order.findByIdAndUpdate(
//       id,
//       { isRead: isRead },
//       { new: true }
//     );
//     if (!updatedOrder) {
//       return res.status(404).send("Order not found.");
//     }
//     res.json({
//       message: "Order read status updated successfully.",
//       order: updatedOrder,
//     });
//   } catch (error) {
//     console.error("Error updating order:", error);
//     res.status(500).send("Error updating the order status.");
//   }
// });

// ----------------------------------------------
// Start the Server
const PORT = process.env.SERVER_PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log("environment variables loaded:", process.env.NODE_ENV);
  console.log("MONGO_URI:", process.env.MONGO_URI);
  console.log("EMAIL_HOST:", process.env.EMAIL_HOST);
  console.log("EMAIL_PORT:", process.env.EMAIL_PORT);
  console.log("EMAIL_USER:", process.env.EMAIL_USER);
  console.log("EMAIL_TO:", process.env.EMAIL_TO);

  console.log("trusted origins:", trustedOrigins);
  console.log("Server is ready to accept requests.");

});
