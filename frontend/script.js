// Global Variables
let cart = [];
let total = 0;

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    // Load cart from localStorage
    const savedCart = localStorage.getItem('burgerHutCart');
    if (savedCart) {
        cart = JSON.parse(savedCart);
        updateCartCount();
    }
    
    // Set today's date as min for reservation
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('date').min = today;
    
    // Initialize menu
    showSection('home');
    
    // Mobile menu toggle
    const menuToggle = document.getElementById('menuToggle');
    const navMenu = document.getElementById('navMenu');
    
    menuToggle.addEventListener('click', function() {
        navMenu.classList.toggle('active');
        menuToggle.innerHTML = navMenu.classList.contains('active') ? 
            '<i class="fas fa-times"></i>' : '<i class="fas fa-bars"></i>';
    });
    
    // Close mobile menu when clicking outside
    document.addEventListener('click', function(event) {
        if (!event.target.closest('.nav-menu') && !event.target.closest('.menu-toggle')) {
            navMenu.classList.remove('active');
            menuToggle.innerHTML = '<i class="fas fa-bars"></i>';
        }
    });
});

// Show specific section
function showSection(sectionId) {
    // Hide all sections
    document.querySelectorAll('.section').forEach(section => {
        section.classList.remove('active');
    });
    
    // Show selected section
    document.getElementById(sectionId).classList.add('active');
    
    // Update active nav link
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
    });
    
    // Find and activate corresponding nav link
    const activeLink = document.querySelector(`[onclick="showSection('${sectionId}')"]`);
    if (activeLink) {
        activeLink.classList.add('active');
    }
    
    // Close mobile menu
    const navMenu = document.getElementById('navMenu');
    const menuToggle = document.getElementById('menuToggle');
    navMenu.classList.remove('active');
    menuToggle.innerHTML = '<i class="fas fa-bars"></i>';
}

// Show specific menu category
function showMenuCategory(categoryId) {
    // Hide all categories
    document.querySelectorAll('.menu-category').forEach(category => {
        category.classList.remove('active');
    });
    
    // Show selected category
    document.getElementById(categoryId).classList.add('active');
    
    // Update active tab
    document.querySelectorAll('.menu-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Find and activate corresponding tab
    const activeTab = document.querySelector(`[onclick="showMenuCategory('${categoryId}')"]`);
    if (activeTab) {
        activeTab.classList.add('active');
    }
}

// Add item to cart
function addToCart(itemName, price) {
    // Check if item already exists in cart
    const existingItemIndex = cart.findIndex(item => item.name === itemName);
    
    if (existingItemIndex > -1) {
        // Update quantity
        cart[existingItemIndex].quantity++;
    } else {
        // Add new item
        cart.push({
            name: itemName,
            price: price,
            quantity: 1
        });
    }
    
    // Update cart display
    updateCartCount();
    saveCartToStorage();
    
    // Show notification
    showNotification(`${itemName} added to cart!`);
}

// Update cart count display
function updateCartCount() {
    const count = cart.reduce((total, item) => total + item.quantity, 0);
    document.getElementById('cart-count').textContent = count;
}

// Save cart to localStorage
function saveCartToStorage() {
    localStorage.setItem('burgerHutCart', JSON.stringify(cart));
}

// Open cart modal
function openCart() {
    const modal = document.getElementById('cartModal');
    updateCartModal();
    modal.style.display = 'flex';
}

// Close cart modal
function closeCart() {
    const modal = document.getElementById('cartModal');
    modal.style.display = 'none';
}

// Update cart modal content
function updateCartModal() {
    const cartItemsContainer = document.getElementById('cart-items');
    const cartSubtotal = document.getElementById('cart-subtotal');
    const cartTax = document.getElementById('cart-tax');
    const cartTotal = document.getElementById('cart-total');
    
    // Clear current items
    cartItemsContainer.innerHTML = '';
    
    // Calculate totals
    let subtotal = 0;
    
    // Add items to modal
    cart.forEach((item, index) => {
        const itemTotal = item.price * item.quantity;
        subtotal += itemTotal;
        
        const itemElement = document.createElement('div');
        itemElement.className = 'cart-item';
        itemElement.innerHTML = `
            <div class="cart-item-info">
                <h4>${item.name}</h4>
                <p>₹${item.price} × ${item.quantity} = ₹${itemTotal}</p>
            </div>
            <div class="cart-item-controls">
                <div class="cart-item-quantity">
                    <button class="quantity-btn" onclick="updateCartQuantity(${index}, -1)">-</button>
                    <span>${item.quantity}</span>
                    <button class="quantity-btn" onclick="updateCartQuantity(${index}, 1)">+</button>
                </div>
                <button class="btn btn-sm" onclick="removeFromCart(${index})">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;
        cartItemsContainer.appendChild(itemElement);
    });
    
    // Update totals
    const tax = subtotal * 0.05; // 5% tax
    const totalAmount = subtotal + tax;
    
    cartSubtotal.textContent = subtotal.toFixed(2);
    cartTax.textContent = tax.toFixed(2);
    cartTotal.textContent = totalAmount.toFixed(2);
}

// Update item quantity in cart
function updateCartQuantity(index, change) {
    const newQuantity = cart[index].quantity + change;
    
    if (newQuantity < 1) {
        // Remove item if quantity becomes 0
        cart.splice(index, 1);
    } else {
        // Update quantity
        cart[index].quantity = newQuantity;
    }
    
    // Update display
    updateCartCount();
    updateCartModal();
    saveCartToStorage();
    
    // Show notification
    if (newQuantity >= 1) {
        showNotification(`Updated quantity for ${cart[index].name}`);
    }
}

// Remove item from cart
function removeFromCart(index) {
    const itemName = cart[index].name;
    cart.splice(index, 1);
    
    // Update display
    updateCartCount();
    updateCartModal();
    saveCartToStorage();
    
    // Show notification
    showNotification(`${itemName} removed from cart`);
}

// Checkout function
function checkout() {
    if (cart.length === 0) {
        showNotification('Your cart is empty!', 'error');
        return;
    }
    
    // In a real app, this would redirect to payment page
    showNotification('Proceeding to checkout...');
    
    // Clear cart after checkout
    cart = [];
    updateCartCount();
    updateCartModal();
    saveCartToStorage();
    
    // Close modal after delay
    setTimeout(() => {
        closeCart();
        showNotification('Order placed successfully!');
    }, 1000);
}

// Book table function
function bookTable() {
    const name = document.getElementById('name').value;
    const phone = document.getElementById('phone').value;
    const date = document.getElementById('date').value;
    const time = document.getElementById('time').value;
    const guests = document.getElementById('guests').value;
    const table = document.getElementById('table').value;
    
    // Basic validation
    if (!name || !phone || !date || !time) {
        showNotification('Please fill in all required fields', 'error');
        return;
    }
    
    // In a real app, this would send to server
    const reservation = {
        name,
        phone,
        date,
        time,
        guests,
        table
    };
    
    // Save to localStorage for demo
    const reservations = JSON.parse(localStorage.getItem('burgerHutReservations') || '[]');
    reservations.push(reservation);
    localStorage.setItem('burgerHutReservations', JSON.stringify(reservations));
    
    // Clear form
    document.getElementById('name').value = '';
    document.getElementById('phone').value = '';
    document.getElementById('date').value = '';
    document.getElementById('time').value = '';
    document.getElementById('guests').value = '2';
    document.getElementById('table').value = 'indoor';
    
    // Show success message
    showNotification(`Table booked for ${guests} people on ${date} at ${time}`);
}

// Toggle theme (dark/light)
function toggleTheme() {
    const body = document.body;
    const isDark = body.classList.contains('dark-theme');
    
    if (isDark) {
        body.classList.remove('dark-theme');
        localStorage.setItem('theme', 'light');
        showNotification('Switched to light theme');
    } else {
        body.classList.add('dark-theme');
        localStorage.setItem('theme', 'dark');
        showNotification('Switched to dark theme');
    }
}

// Show notification
function showNotification(message, type = 'success') {
    // Remove existing notification
    const existingNotification = document.querySelector('.notification');
    if (existingNotification) {
        existingNotification.remove();
    }
    
    // Create new notification
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <i class="fas fa-${type === 'error' ? 'exclamation-circle' : 'check-circle'}"></i>
        <span>${message}</span>
    `;
    
    // Add styles
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === 'error' ? '#ff6b6b' : '#4CAF50'};
        color: white;
        padding: 1rem 1.5rem;
        border-radius: 10px;
        display: flex;
        align-items: center;
        gap: 10px;
        z-index: 1002;
        animation: slideIn 0.3s ease;
        box-shadow: 0 5px 15px rgba(0,0,0,0.2);
    `;
    
    document.body.appendChild(notification);
    
    // Remove after 3 seconds
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Add notification animations to styles
const notificationStyles = document.createElement('style');
notificationStyles.textContent = `
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
    
    .dark-theme {
        background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
        color: #ffffff;
    }
    
    .dark-theme .menu-item,
    .dark-theme .offer-card,
    .dark-theme .reservation-form {
        background: #2c3e50;
        color: #ffffff;
    }
    
    .dark-theme .menu-item-content p,
    .dark-theme .offer-content p {
        color: rgba(255,255,255,0.8);
    }
    
    .dark-theme .form-group input,
    .dark-theme .form-group select {
        background: #34495e;
        border-color: #4a6583;
        color: white;
    }
`;
document.head.appendChild(notificationStyles);

// Close modal when clicking outside
window.addEventListener('click', function(event) {
    const modal = document.getElementById('cartModal');
    if (event.target === modal) {
        closeCart();
    }
});