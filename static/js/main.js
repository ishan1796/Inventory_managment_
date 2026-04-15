// Global State for Cart
let cart = [];
let inventoryData = [];

document.addEventListener('DOMContentLoaded', () => {
    
    // Theme Switcher Logic
    const themeBtn = document.getElementById('theme-btn');
    if (themeBtn) {
        // Load saved theme
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme === 'dark') {
            document.documentElement.setAttribute('data-theme', 'dark');
        }

        themeBtn.addEventListener('click', () => {
            const currentTheme = document.documentElement.getAttribute('data-theme');
            if (currentTheme === 'dark') {
                document.documentElement.removeAttribute('data-theme');
                localStorage.setItem('theme', 'light');
            } else {
                document.documentElement.setAttribute('data-theme', 'dark');
                localStorage.setItem('theme', 'dark');
            }
            
            // If on dashboard, force charts to update their colors
            if (window.updateChartColors) {
                window.updateChartColors();
            }
        });
    }


    // --- INVENTORY PAGE LOGIC ---
    const addItemForm = document.getElementById('add-item-form');
    if (addItemForm) {
        fetchInventory();
        
        addItemForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const payload = {
                name: document.getElementById('item-name').value,
                price: document.getElementById('item-price').value,
                quantity: document.getElementById('item-quantity').value,
                expiry_date: document.getElementById('item-expiry').value || null
            };
            
            try {
                const res = await fetch('/api/add_item', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify(payload)
                });
                const data = await res.json();
                if(res.ok) {
                    alert('Item added successfully!');
                    addItemForm.reset();
                    fetchInventory(); // Reload table
                } else {
                    alert('Error: ' + data.error);
                }
            } catch (err) {
                console.error(err);
                alert('Request failed');
            }
        });
        
        // Edit Item Form Submit
        document.getElementById('edit-item-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const itemId = document.getElementById('edit-item-id').value;
            const payload = {
                name: document.getElementById('edit-item-name').value,
                price: document.getElementById('edit-item-price').value,
                quantity: document.getElementById('edit-item-quantity').value,
                expiry_date: document.getElementById('edit-item-expiry').value || null
            };
            
            try {
                const res = await fetch(`/api/edit_item/${itemId}`, {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify(payload)
                });
                const data = await res.json();
                if(res.ok) {
                    closeEditModal();
                    fetchInventory();
                } else {
                    alert('Error: ' + data.error);
                }
            } catch (err) {
                console.error(err);
                alert('Request failed');
            }
        });
    }

    // --- SELL PAGE LOGIC ---
    const addToCartForm = document.getElementById('add-to-cart-form');
    if(addToCartForm) {
        fetchInventoryForBilling();
        
        addToCartForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const itemIdStr = document.getElementById('sale-item').value;
            const qty = parseInt(document.getElementById('sale-quantity').value);
            
            const item = inventoryData.find(i => i.item_id === itemIdStr);
            if(!item) return;
            
            if(qty > item.quantity) {
                alert(`Cannot add ${qty}. Only ${item.quantity} in stock.`);
                return;
            }
            
            // Check if already in cart
            const existing = cart.find(i => i.item_id === itemIdStr);
            if(existing) {
                if(existing.quantity + qty > item.quantity) {
                    alert('Cannot exceed stock quantity.');
                    return;
                }
                existing.quantity += qty;
            } else {
                cart.push({ ...item, quantity: qty });
            }
            
            renderCart();
            document.getElementById('sale-quantity').value = 1;
        });

        document.getElementById('sale-discount').addEventListener('input', updateTotals);
        document.getElementById('checkout-btn').addEventListener('click', processCheckout);
    }
});

/* INVENTORY CRUD */
async function fetchInventory() {
    const tbody = document.getElementById('inventory-tbody');
    if(!tbody) return;
    
    tbody.innerHTML = '<tr><td colspan="7" style="text-align: center;">Loading...</td></tr>';
    
    try {
        const res = await fetch('/api/inventory');
        const data = await res.json();
        inventoryData = data.inventory; // Cache for edit
        
        tbody.innerHTML = '';
        data.inventory.forEach(item => {
            let statusClass = 'status-good';
            if (item.quantity === 0) statusClass = 'status-out';
            else if (item.quantity < 5) statusClass = 'status-low';

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${item.item_id}</strong></td>
                <td>${item.name}</td>
                <td>₹${item.price.toFixed(2)}</td>
                <td><span class="status-badge ${statusClass}">${item.quantity}</span></td>
                <td style="color:#64748b; font-size:14px">${item.expiry_date ? item.expiry_date : '-'}</td>
                <td style="color:#64748b; font-size:13px">${item.added_date}</td>
                <td>
                    <button class="edit-badge" onclick="openEditModal('${item.item_id}')">Edit ✏️</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (e) {
        console.error("Failed to load inventory", e);
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: red;">Failed to load data</td></tr>';
    }
}

function openEditModal(itemId) {
    const item = inventoryData.find(i => i.item_id === itemId);
    if (!item) return;
    
    document.getElementById('edit-item-id').value = item.item_id;
    document.getElementById('edit-item-name').value = item.name;
    document.getElementById('edit-item-price').value = item.price;
    document.getElementById('edit-item-quantity').value = item.quantity;
    document.getElementById('edit-item-expiry').value = item.expiry_date || '';
    
    document.getElementById('editModal').style.display = 'flex';
}

function closeEditModal() {
    document.getElementById('editModal').style.display = 'none';
}

/* BILLING CRITICAL FUNCTIONS */
async function fetchInventoryForBilling() {
    const select = document.getElementById('sale-item');
    if(!select) return;
    
    try {
        const res = await fetch('/api/inventory');
        const data = await res.json();
        inventoryData = data.inventory;
        
        select.innerHTML = '<option value="" disabled selected>Select an item...</option>';
        inventoryData.forEach(item => {
            const opt = document.createElement('option');
            opt.value = item.item_id;
            opt.text = `${item.name} (Stock: ${item.quantity}) - ₹${item.price.toFixed(2)}`;
            if(item.quantity === 0) opt.disabled = true;
            select.appendChild(opt);
        });
    } catch (e) {
        console.error("Failed to load items", e);
    }
}

function renderCart() {
    const tbody = document.getElementById('cart-tbody');
    if(!tbody) return;
    
    tbody.innerHTML = '';
    
    if(cart.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">Cart is empty</td></tr>';
        document.getElementById('checkout-btn').disabled = true;
        updateTotals();
        return;
    }
    
    document.getElementById('checkout-btn').disabled = false;
    
    cart.forEach((item, index) => {
        const total = item.price * item.quantity;
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="font-weight:600;">${item.name}</td>
            <td>${item.quantity}</td>
            <td>₹${item.price.toFixed(2)}</td>
            <td style="font-weight:600; color:var(--primary);">₹${total.toFixed(2)}</td>
            <td>
                <button class="btn btn-secondary" style="padding: 5px 10px; color: var(--danger); border-color: var(--danger);" onclick="removeFromCart(${index})">X</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
    
    updateTotals();
}

function removeFromCart(index) {
    cart.splice(index, 1);
    renderCart();
}

function updateTotals() {
    const subtotalEl = document.getElementById('summary-subtotal');
    if(!subtotalEl) return;
    
    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const discountPct = parseFloat(document.getElementById('sale-discount').value) || 0;
    
    const discountAmount = subtotal * (discountPct / 100);
    const afterDiscount = subtotal - discountAmount;
    const gstAmount = afterDiscount * 0.18;
    const finalTotal = afterDiscount + gstAmount;
    
    subtotalEl.innerText = `₹${subtotal.toFixed(2)}`;
    document.getElementById('summary-discount').innerText = `-₹${discountAmount.toFixed(2)}`;
    document.getElementById('summary-gst').innerText = `₹${gstAmount.toFixed(2)}`;
    document.getElementById('summary-total').innerText = `₹${finalTotal.toFixed(2)}`;
}

async function processCheckout() {
    const btn = document.getElementById('checkout-btn');
    btn.disabled = true;
    btn.innerText = "Processing...";
    
    const discountPct = parseFloat(document.getElementById('sale-discount').value) || 0;
    
    const payload = {
        cart: cart.map(i => ({ item_id: i.item_id, quantity: i.quantity })),
        discount_pct: discountPct
    };
    
    try {
        const res = await fetch('/api/sell', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(payload)
        });
        
        const data = await res.json();
        if(res.ok) {
            localStorage.setItem('last_bill', JSON.stringify(data.bill));
            window.location.href = '/invoice';
        } else {
            alert('Error: ' + data.error);
            btn.disabled = false;
            btn.innerText = "Checkout & Generate Bill";
        }
    } catch (e) {
        console.error(e);
        alert('Network error during checkout');
        btn.disabled = false;
        btn.innerText = "Checkout & Generate Bill";
    }
}
