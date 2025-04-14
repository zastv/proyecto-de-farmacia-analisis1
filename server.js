const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const bodyParser = require('body-parser');
const cors = require('cors');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3001;

// Configuración básica de middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));

// Conexión a MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/farmacia-capsula', {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('✅ Conectado a MongoDB'))
.catch(err => console.error('❌ Error de conexión:', err));

// Modelos
const User = mongoose.model('User', new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true }
}, { timestamps: true }));

const Product = mongoose.model('Product', new mongoose.Schema({
  name: { type: String, required: true },
  price: { type: Number, required: true },
  description: String,
  stock: { type: Number, required: true }
}, { timestamps: true }));

const Cart = mongoose.model('Cart', new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  products: [{
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    quantity: { type: Number, min: 1 }
  }]
}, { timestamps: true }));

// Middleware de autenticación
const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ message: 'Acceso no autorizado' });
    
    // Verificación básica (reemplazar con JWT en producción)
    const userId = authHeader.split(' ')[1];
    const user = await User.findById(userId);
    if (!user) return res.status(401).json({ message: 'Usuario no válido' });
    
    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ message: 'Token inválido' });
  }
};

// Rutas de autenticación
app.post('/api/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    const hashedPassword = bcrypt.hashSync(password, 10);
    const user = await User.create({ username, password: hashedPassword });
    res.status(201).json({ id: user._id });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username });
    
    if (!user || !bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ message: 'Credenciales inválidas' });
    }
    
    res.json({ token: user._id.toString() }); // En producción usar JWT
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Rutas de productos
app.get('/api/products', async (req, res) => {
  try {
    const products = await Product.find();
    res.json(products);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Rutas protegidas
app.use('/api/cart', authMiddleware);

app.get('/api/cart', async (req, res) => {
  try {
    const cart = await Cart.findOne({ userId: req.user._id }).populate('products.productId');
    res.json(cart || { products: [] });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post('/api/cart', async (req, res) => {
  try {
    const { productId, quantity } = req.body;
    
    let cart = await Cart.findOne({ userId: req.user._id }) || 
               new Cart({ userId: req.user._id, products: [] });
    
    const existingItem = cart.products.find(item => item.productId.equals(productId));
    
    if (existingItem) {
      existingItem.quantity += quantity;
    } else {
      cart.products.push({ productId, quantity });
    }
    
    await cart.save();
    res.json(await cart.populate('products.productId'));
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Manejo de errores
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Error interno del servidor' });
});

// Iniciar servidor
app.listen(port, () => {
  console.log(`🚀 Servidor ejecutándose en http://localhost:${port}`);
});

module.exports = app;