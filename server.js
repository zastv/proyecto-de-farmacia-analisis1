const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const bodyParser = require('body-parser');
const path = require('path');
const cors = require('cors');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3001;

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));

// Conexión a MongoDB optimizada
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/farmacia-capsula', {
      appName: "FarmaciaCapsula"  // Nombre identificable en Atlas
    });
    console.log('✅ MongoDB conectado');
  } catch (err) {
    console.error('❌ Error de conexión a MongoDB:', err.message);
    process.exit(1);
  }
};
connectDB();

// Modelos mejorados
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, trim: true },
  password: { type: String, required: true, minlength: 6 }
}, { timestamps: true });

const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  price: { type: Number, required: true, min: 0 },
  description: String,
  stock: { type: Number, required: true, min: 0 }
}, { timestamps: true });

const cartSchema = new mongoose.Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    required: true, 
    ref: 'User' 
  },
  products: [{
    productId: { 
      type: mongoose.Schema.Types.ObjectId, 
      required: true, 
      ref: 'Product' 
    },
    quantity: { 
      type: Number, 
      required: true, 
      min: 1,
      validate: {
        validator: async function(value) {
          const product = await mongoose.model('Product').findById(this.productId);
          return value <= product.stock;
        },
        message: 'Cantidad excede el stock disponible'
      }
    }
  }]
}, { timestamps: true });

const User = mongoose.model('User', userSchema);
const Product = mongoose.model('Product', productSchema);
const Cart = mongoose.model('Cart', cartSchema);

// Middleware de autenticación (ejemplo básico)
const authenticate = async (req, res, next) => {
  try {
    const userId = req.headers['user-id'];
    if (!userId) throw new Error('No autorizado');
    
    const user = await User.findById(userId);
    if (!user) throw new Error('Usuario no encontrado');
    
    req.user = user;
    next();
  } catch (err) {
    res.status(401).json({ message: err.message });
  }
};

// Rutas optimizadas
const router = express.Router();

// Autenticación
router.post('/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({ username, password: hashedPassword });
    res.status(201).json({ userId: user._id });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username });
    
    if (!user || !(await bcrypt.compare(password, user.password))) {
      throw new Error('Credenciales inválidas');
    }
    
    res.json({ userId: user._id });
  } catch (err) {
    res.status(401).json({ message: err.message });
  }
});

// Productos
router.get('/products', async (req, res) => {
  try {
    const products = await Product.find();
    res.json(products);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Carrito (protegido)
router.use('/cart', authenticate);

router.post('/cart', async (req, res) => {
  try {
    const { productId, quantity } = req.body;
    const product = await Product.findById(productId);
    
    if (!product) throw new Error('Producto no encontrado');
    
    let cart = await Cart.findOne({ userId: req.user._id }) || 
               new Cart({ userId: req.user._id, products: [] });
    
    const itemIndex = cart.products.findIndex(item => 
      item.productId.equals(productId)
    );
    
    if (itemIndex >= 0) {
      cart.products[itemIndex].quantity += quantity;
    } else {
      cart.products.push({ productId, quantity });
    }
    
    await cart.save();
    res.json(await cart.populate('products.productId'));
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

app.use('/api', router);

// Manejo de producción
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'client/build')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'client/build', 'index.html'));
  });
}

// Manejo de errores centralizado
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Error interno del servidor' });
});

app.listen(port, () => {
  console.log(`🚀 Servidor en http://localhost:${port}`);
});

module.exports = app;
module.exports = router;
module.exports = connectDB;
module.exports = authenticate;
module.exports = User;
module.exports = Product;
module.exports = Cart;
module.exports = userSchema;
module.exports = productSchema;
module.exports = cartSchema;
module.exports = bcrypt;
module.exports = mongoose;
module.exports = bodyParser;
module.exports = path;
module.exports = cors;
module.exports = express;
module.exports = app;
module.exports = port;
