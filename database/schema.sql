CREATE DATABASE IF NOT EXISTS shop;
USE shop;

CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  password_hash VARCHAR(100) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE products (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  description VARCHAR(255),
  image_url VARCHAR(255),
  price DECIMAL(10,2) NOT NULL
);

CREATE TABLE orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  total DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE order_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id INT NOT NULL,
  product_id INT NOT NULL,
  qty INT NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  FOREIGN KEY (order_id) REFERENCES orders(id),
  FOREIGN KEY (product_id) REFERENCES products(id)
);

INSERT INTO products (name, description, price, image_url) VALUES
('Mechanical Keyboard', 'Hot-swappable, tactile switches', 4999.00, '/images/keyboard.svg'),
('Wireless Mouse', 'Ergonomic, 2.4GHz + Bluetooth', 1499.00, '/images/mouse.svg'),
('USB-C Hub', '7-in-1 with HDMI and SD reader', 2299.00, '/images/usb-hub.svg'),
('27" Monitor', 'IPS, 75Hz, thin bezel', 14999.00, '/images/monitor.svg'),
('Laptop Stand', 'Aluminium, adjustable height', 1799.00, '/images/laptop-stand.svg'),
('Webcam 1080p', 'Auto-focus with built-in mic', 2999.00, '/images/webcam.svg');
