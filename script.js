let cart = [];
let total = 0;

// Initialize bill number from localStorage (start at 1 if not set)
let billNo = parseInt(localStorage.getItem("billNo")) || 1;

function addToCart(item, price) {
  cart.push({ name: item, price });
  total += price;
  displayCart();
}

function displayCart() {
  let cartItems = document.getElementById("cart-items");
  cartItems.innerHTML = "";
  cart.forEach(c => {
    let li = document.createElement("li");
    li.textContent = `${c.name} - ₹${c.price}`;
    cartItems.appendChild(li);
  });
  document.getElementById("cart-total").innerText = total;
}

async function checkout() {
  const tableNo = document.getElementById('tableNo').value;
  if (!tableNo) {
    alert('Please enter a table number');
    return;
  }

  if (cart.length === 0) {
    alert("Your cart is empty!");
    return;
  }

  try {
    // Send order to backend (optional – if you still want backend storage)
    const response = await fetch('http://localhost:3000/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userName: 'Guest',
        tableNo: tableNo,
        items: cart,
        total: total,
        billNo: billNo   // ✅ send billNo too
      })
    });

    const result = await response.json();

    if (response.ok) {
      // Update bill UI
      document.getElementById('billTable').textContent = tableNo;
      document.getElementById('billUser').textContent = 'Guest';
      document.getElementById('billNo').textContent = billNo; // ✅ use local billNo
      document.getElementById('billDate').textContent = new Date().toLocaleString();
      document.getElementById('bill-total').textContent = total;

      const billItems = document.getElementById('bill-items');
      billItems.innerHTML = '';
      cart.forEach(item => {
        const li = document.createElement('li');
        li.textContent = `${item.name} - ₹${item.price}`;
        billItems.appendChild(li);
      });

      document.getElementById('bill').style.display = 'block';

      // ✅ Increase bill number and save to localStorage
      billNo++;
      localStorage.setItem("billNo", billNo);

      // Reset cart
      cart = [];
      total = 0;
      displayCart();
      document.getElementById('tableNo').value = '';
    } else {
      alert('Error saving order: ' + result.error);
    }
  } catch (error) {
    alert('Error connecting to server: ' + error.message);
  }
}
