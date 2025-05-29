  var orders_arr = [];

  function openDetailPopup(event) {
    // Open a popup or modal with order details
    const order = event.currentTarget;
    const orderId = order.closest('tr').getAttribute('data-orderid');
    // find the order in the orders_arr
    const orderDetails = orders_arr.find(o => o._id === orderId);
    console.log("orderid"+orderId);
    console.log("arr"+orders_arr);
    console.log("detail:"+orderDetails);
    
    const orderid = document.getElementById('orderid');
    const customerName = document.getElementById('customerName');
    const customerPhone = document.getElementById('customerPhone');
    const productName = document.getElementById('productName');
    const quantity = document.getElementById('quantity');
    const isUsingZalo = document.getElementById('zalo');
    const isUsingMail = document.getElementById('email');
    const note = document.getElementById('note');
    const timestamps = document.getElementById('timestamps');
    const specs = document.getElementById('specs');
    const isRead = document.getElementById('isRead');

    // get the value of the order add to the modal
    orderid.innerText = orderDetails._id;
    customerName.innerText = orderDetails.customerName;
    productName.innerText = orderDetails.productName;
    quantity.innerText = orderDetails.quantity;
    isUsingZalo.innerText = orderDetails.isUsingZalo ? 'Có' : 'Không';
    isUsingMail.innerText = orderDetails.email ? orderDetails.email : 'Không';
    customerPhone.innerText = orderDetails.customerPhone;
    note.innerText = orderDetails.note;
    timestamps.innerText = new Date(orderDetails.createdAt).toLocaleString();
    specs.innerText = orderDetails.specs;
    isRead.innerText = orderDetails.isRead ? 'Đã đọc' : 'Chưa đọc';

    // open the modal
    const modal = document.querySelector('.modal');
    modal.style.display = 'flex';
  }
  
  function closeModal() {
    const modal = document.querySelector('.modal');
    modal.style.display = 'none';
  }

  function deleteRow(event) {
    // Get the button that was clicked
    const btn = event.currentTarget;
    // Find the closest parent <tr> and remove it
    const row = btn.closest('tr');
    if (row) {
      row.remove();
    }
  }

  const response = await fetch(
    config.serverUri + '/order/get',
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${sessionStorage.token}`,
      },
    }
  );
  if(response.ok) {
    const data = await response.json();
    console.log(data);
    // clear the table
    const table = document.getElementById('orders-table');
    // remove all rows except the header
    // while (table.rows.length > 1) {
    //   table.deleteRow(1);
    // }

    // orders_arr = res.json().orders;
    orders_arr = data.orders;
    // for each order, create a new row in the table
    orders_arr.forEach(order => {
      const row = document.createElement('tr');
      row.setAttribute('data-orderid', order._id);
      row.innerHTML = `
        <td>${new Date(order.createdAt).toLocaleString()}</td>
        <td>${order.customerName}</td>
        <td>${order.productName}</td>
        <td>${order.isUsingZalo ? 'Zalo' : 'Email'}</td>
        <td><span style="color: ${order.isRead ? 'green' : 'red'};">${order.isRead ? 'Đã đọc' : 'Chưa đọc'}</span></td>
        <td><button class="primary-btn" for="openDetailPopup">Xem</button>
        <button class="delete-btn" for="deleteRow">Xóa</button></td>
      `;
      table.appendChild(row);
    });
  } else {
    orders_arr = [];
    throw new Error('Failed to fetch orders');
  }

    // fetch data from the server (/order/get) and render it in the table
  document.querySelectorAll('[for=deleteRow]').forEach(btn => {
    btn.addEventListener('click', deleteRow);
  })
  document.querySelectorAll('[for=openDetailPopup]').forEach(row => {
    row.addEventListener('click', openDetailPopup);
  });
  document.querySelector('[for=closeModal]').addEventListener('click', closeModal);