const express = require("express")
const mongoose = require("mongoose")
const cors = require("cors")
const exceljs = require("exceljs")
const path = require("path");  

const app = express()

// Middleware
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(cors())

app.use('/files', express.static(path.join(__dirname, 'public', 'files')));  

// MongoDB Connection
mongoose
  .connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("Could not connect to MongoDB", err))

// Define Item Schema
const itemSchema = new mongoose.Schema({
  item_code: String,
  item_name: String,
  item_group: String,
  image: String,
  valuation_rate: Number,
  name: String,
  custom_addon_applicable: Number,
  custom_combo_applicable: Number,
  custom_total_calories: Number,
  custom_total_protein: Number,
  ingredients: Array,
  addons: Array,
  combos: Array,
})

const Item = mongoose.model("Item", itemSchema)

// Define Customer Schema
const customerSchema = new mongoose.Schema({
  name: String,
  email: String,
  phone: String,
  address: String,
  pincode: String,
  paymentMode: String,
  accountManager: String,
  billingCurrency: String,
})

const Customer = mongoose.model("Customer", customerSchema)

// Define Sales Invoice Schema
const salesInvoiceSchema = new mongoose.Schema({
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Customer",
    required: true,
  },
  paymentMode: {
    type: String,
    required: true,
    enum: ["Cash", "UPI", "Card"],
  },
  totalAmount: {
    type: Number,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
})

const SalesInvoice = mongoose.model("SalesInvoice", salesInvoiceSchema)

// API Routes

// Create sales invoice
app.post("/api/create_sales_invoice", async (req, res) => {
  try {
    const { customerId, paymentMode, totalAmount } = req.body
    const newInvoice = new SalesInvoice({ customerId, paymentMode, totalAmount })
    const savedInvoice = await newInvoice.save()
    res.status(201).json({
      message: "Sales invoice created successfully",
      salesInvoice: savedInvoice,
    })
  } catch (error) {
    console.error("Error creating sales invoice:", error)
    res.status(500).json({ message: "Failed to create sales invoice" })
  }
})

// Get sales invoice details
app.get("/api/get_sales_invoice/:id", async (req, res) => {
  try {
    const invoiceId = req.params.id
    const invoice = await SalesInvoice.findById(invoiceId).populate("customerId", "name phone")
    if (!invoice) {
      return res.status(404).json({ message: "Invoice not found" })
    }
    res.status(200).json({ salesInvoice: invoice })
  } catch (error) {
    console.error("Error fetching invoice:", error)
    res.status(500).json({ message: "Failed to fetch invoice details" })
  }
})

// Get sales report
app.get("/api/sales_report", async (req, res) => {
  try {
    const salesData = await SalesInvoice.aggregate([
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          totalAmount: { $sum: "$totalAmount" },
        },
      },
      { $sort: { _id: 1 } },
    ])
    res.json(salesData)
  } catch (err) {
    console.error("Error fetching sales report:", err)
    res.status(500).json({ error: "Failed to fetch sales data" })
  }
})

// Download sales report as Excel
app.get("/api/download_sales_report", async (req, res) => {
  try {
    const salesData = await SalesInvoice.aggregate([
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          totalAmount: { $sum: "$totalAmount" },
        },
      },
      { $sort: { _id: 1 } },
    ])

    const workbook = new exceljs.Workbook()
    const worksheet = workbook.addWorksheet("Sales Report")

    worksheet.columns = [
      { header: "Date", key: "date", width: 20 },
      { header: "Total Sales (₹)", key: "totalAmount", width: 20 },
    ]

    salesData.forEach((item) => {
      worksheet.addRow({
        date: item._id,
        totalAmount: item.totalAmount,
      })
    })

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
    res.setHeader("Content-Disposition", "attachment; filename=sales_report.xlsx")

    await workbook.xlsx.write(res)
    res.end()
  } catch (err) {
    console.error("Error generating Excel report:", err)
    res.status(500).json({ error: "Failed to generate Excel report" })
  }
})

// Get all items
app.get("/api/items", async (req, res) => {
  try {
    const items = await Item.find()
    res.json(items)
  } catch (err) {
    res.status(500).json({ message: "Error fetching items", error: err })
  }
})

// Create a new item
app.post("/api/items", async (req, res) => {
  const { item_code, item_name, item_group, image, valuation_rate } = req.body
  const newItem = new Item({ item_code, item_name, item_group, image, valuation_rate })
  try {
    await newItem.save()
    res.status(201).json({ message: "Item created successfully", item: newItem })
  } catch (err) {
    res.status(400).json({ message: "Error creating item", error: err })
  }
})

// Get all customers
app.get("/api/customers", async (req, res) => {
  try {
    const customers = await Customer.find()
    res.json(customers)
  } catch (err) {
    res.status(500).json({ message: "Error fetching customers", error: err })
  }
})

// Create a new customer
app.post("/api/customers", async (req, res) => {
  const { name, email, phone, address, pincode, paymentMode, accountManager, billingCurrency } = req.body
  const newCustomer = new Customer({
    name,
    email,
    phone,
    address,
    pincode,
    paymentMode,
    accountManager,
    billingCurrency,
  })
  try {
    await newCustomer.save()
    res.status(201).json({ message: "Customer created successfully", customer: newCustomer })
  } catch (err) {
    res.status(400).json({ message: "Error creating customer", error: err })
  }
})

module.exports = app

