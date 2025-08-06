// 承認ユーザーリスト（SHA-1ハッシュで管理）
const users = [
  {
    username: "admin",
    // "admin123" のSHA-1ハッシュ
    passwordHash: "e99a18c428cb38d5f260853678922e03abd8335e"
  }
];

// SHA-1ハッシュ関数
async function sha1(str) {
  const buf = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

// アプリケーションデータ
let appData = {
    products: [
        { id: 1, sku: 'TSH001', name: 'ベーシックTシャツ', price: 2500, quantity: 50 },
        { id: 2, sku: 'JKT002', name: 'デニムジャケット', price: 8500, quantity: 20 },
        { id: 3, sku: 'PTS003', name: 'スキニーパンツ', price: 4500, quantity: 30 },
        { id: 4, sku: 'DRS004', name: 'ワンピース', price: 6500, quantity: 15 },
        { id: 5, sku: 'SNK005', name: 'スニーカー', price: 12000, quantity: 25 }
    ],
    sales: [
        { id: 1, productId: 1, quantity: 2, price: 2500, date: '2024-07-25' },
        { id: 2, productId: 2, quantity: 1, price: 8500, date: '2024-07-26' },
        { id: 3, productId: 3, quantity: 3, price: 4500, date: '2024-07-27' },
        { id: 4, productId: 1, quantity: 1, price: 2500, date: '2024-07-28' },
        { id: 5, productId: 4, quantity: 2, price: 6500, date: '2024-07-28' }
    ],
    users: [
        { username: 'admin', password: 'admin123', role: 'admin' }
    ]
};

// ローカルストレージからデータを読み込み
function loadData() {
    const savedProducts = localStorage.getItem('inventory_products');
    const savedSales = localStorage.getItem('inventory_sales');
    
    if (savedProducts) {
        appData.products = JSON.parse(savedProducts);
    }
    if (savedSales) {
        appData.sales = JSON.parse(savedSales);
    }
}

// データをローカルストレージに保存
function saveData() {
    localStorage.setItem('inventory_products', JSON.stringify(appData.products));
    localStorage.setItem('inventory_sales', JSON.stringify(appData.sales));
}

// ページ表示制御
function showPage(pageName) {
    // すべてのページを非表示
    document.querySelectorAll('[id$="Page"]').forEach(page => {
        page.classList.add('hidden');
    });
    
    // 指定されたページを表示
    document.getElementById(pageName + 'Page').classList.remove('hidden');
    
    // ナビゲーションのアクティブ状態を更新
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
    });
    event.target.classList.add('active');
    
    // ページに応じた初期化
    switch(pageName) {
        case 'dashboard':
            updateDashboard();
            break;
        case 'products':
            updateProductList();
            updateProductSelects();
            break;
        case 'inventory':
            updateProductSelects();
            break;
        case 'sales':
            updateProductSelects();
            break;
        case 'analysis':
            updateAnalysis();
            break;
    }
}

// 商品タブ表示制御
function showProductTab(tabName) {
    document.getElementById('productListTab').classList.add('hidden');
    document.getElementById('productAddTab').classList.add('hidden');
    document.getElementById('product' + tabName.charAt(0).toUpperCase() + tabName.slice(1) + 'Tab').classList.remove('hidden');
    
    // タブのアクティブ状態を更新
    document.querySelectorAll('.nav-tabs .nav-link').forEach(link => {
        link.classList.remove('active');
    });
    event.target.classList.add('active');
}

// ログイン処理
function login() {
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    
    const user = appData.users.find(u => u.username === username && u.password === password);
    
    if (user) {
        document.getElementById('loginScreen').classList.add('hidden');
        document.getElementById('mainApp').classList.remove('hidden');
        updateDashboard();
    } else {
        alert('ユーザー名またはパスワードが正しくありません');
    }
}

// ログアウト処理
function logout() {
    document.getElementById('loginScreen').classList.remove('hidden');
    document.getElementById('mainApp').classList.add('hidden');
    document.getElementById('loginForm').reset();
}

// ダッシュボード更新
function updateDashboard() {
    const totalProducts = appData.products.length;
    const totalStock = appData.products.reduce((sum, product) => sum + product.quantity, 0);
    
    // 今週の売上計算
    const today = new Date();
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const weeklySales = appData.sales
        .filter(sale => new Date(sale.date) >= weekAgo)
        .reduce((sum, sale) => sum + (sale.quantity * sale.price), 0);
    
    // 在庫僅少商品数
    const lowStockCount = appData.products.filter(product => product.quantity <= 10).length;
    
    // メトリクス更新
    document.getElementById('totalProducts').textContent = totalProducts;
    document.getElementById('totalStock').textContent = totalStock.toLocaleString();
    document.getElementById('weeklySales').textContent = '¥' + weeklySales.toLocaleString();
    document.getElementById('lowStockCount').textContent = lowStockCount;
    
    // 在庫僅少アラート
    updateLowStockAlert();
    
    // 売上チャート
    updateSalesChart();
}

// 在庫僅少アラート更新
function updateLowStockAlert() {
    const lowStockProducts = appData.products.filter(product => product.quantity <= 10);
    const alertDiv = document.getElementById('lowStockAlert');
    
    if (lowStockProducts.length === 0) {
        alertDiv.innerHTML = '<div class="alert alert-success">在庫僅少商品はありません</div>';
    } else {
        let alertHTML = '';
        lowStockProducts.forEach(product => {
            alertHTML += `
                <div class="alert alert-stock mb-2">
                    <strong>${product.name}</strong> - 在庫: ${product.quantity}点
                </div>
            `;
        });
        alertDiv.innerHTML = alertHTML;
    }
}

// 売上チャート更新
function updateSalesChart() {
    const ctx = document.getElementById('salesChart').getContext('2d');
    
    // 過去7日間の売上データ
    const today = new Date();
    const salesData = [];
    const labels = [];
    
    for (let i = 6; i >= 0; i--) {
        const date = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
        const dateStr = date.toISOString().split('T')[0];
        const daySales = appData.sales
            .filter(sale => sale.date === dateStr)
            .reduce((sum, sale) => sum + (sale.quantity * sale.price), 0);
        
        labels.push(date.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' }));
        salesData.push(daySales);
    }
    
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: '売上',
                data: salesData,
                borderColor: '#667eea',
                backgroundColor: 'rgba(102, 126, 234, 0.1)',
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return '¥' + value.toLocaleString();
                        }
                    }
                }
            }
        }
    });
}

// 商品一覧更新
function updateProductList() {
    const tbody = document.getElementById('productTableBody');
    tbody.innerHTML = '';
    
    appData.products.forEach(product => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${product.sku}</td>
            <td>${product.name}</td>
            <td>¥${product.price.toLocaleString()}</td>
            <td>${product.quantity}点</td>
            <td>
                <button class="btn btn-sm btn-outline-primary" onclick="editProduct(${product.id})">
                    <i class="fas fa-edit"></i>
                </button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

// 商品セレクトボックス更新
function updateProductSelects() {
    const selects = ['inboundProduct', 'outboundProduct', 'salesProduct'];
    
    selects.forEach(selectId => {
        const select = document.getElementById(selectId);
        if (select) {
            select.innerHTML = '<option value="">商品を選択</option>';
            appData.products.forEach(product => {
                const option = document.createElement('option');
                option.value = product.id;
                option.textContent = `${product.name} (¥${product.price.toLocaleString()})`;
                select.appendChild(option);
            });
        }
    });
}

// 商品追加
function addProduct(event) {
    event.preventDefault();
    
    const sku = document.getElementById('newSku').value;
    const name = document.getElementById('newName').value;
    const price = parseInt(document.getElementById('newPrice').value);
    const quantity = parseInt(document.getElementById('newQuantity').value);
    
    // SKU重複チェック
    if (appData.products.find(p => p.sku === sku)) {
        alert('SKUが重複しています');
        return;
    }
    
    const newProduct = {
        id: Math.max(...appData.products.map(p => p.id)) + 1,
        sku: sku,
        name: name,
        price: price,
        quantity: quantity
    };
    
    appData.products.push(newProduct);
    saveData();
    
    alert('商品が正常に登録されました');
    document.getElementById('addProductForm').reset();
    updateProductList();
    updateProductSelects();
}

// 入庫処理
function processInbound(event) {
    event.preventDefault();
    
    const productId = parseInt(document.getElementById('inboundProduct').value);
    const quantity = parseInt(document.getElementById('inboundQuantity').value);
    
    const product = appData.products.find(p => p.id === productId);
    if (product) {
        product.quantity += quantity;
        saveData();
        alert('入庫処理が完了しました');
        document.getElementById('inboundForm').reset();
        updateDashboard();
    }
}

// 出庫処理
function processOutbound(event) {
    event.preventDefault();
    
    const productId = parseInt(document.getElementById('outboundProduct').value);
    const quantity = parseInt(document.getElementById('outboundQuantity').value);
    
    const product = appData.products.find(p => p.id === productId);
    if (product) {
        if (product.quantity >= quantity) {
            product.quantity -= quantity;
            saveData();
            alert('出庫処理が完了しました');
            document.getElementById('outboundForm').reset();
            updateDashboard();
        } else {
            alert('在庫が不足しています');
        }
    }
}

// 売上登録
function registerSale(event) {
    event.preventDefault();
    
    const productId = parseInt(document.getElementById('salesProduct').value);
    const quantity = parseInt(document.getElementById('salesQuantity').value);
    const price = parseInt(document.getElementById('salesPrice').value);
    
    const product = appData.products.find(p => p.id === productId);
    if (product) {
        if (product.quantity >= quantity) {
            // 売上記録
            const newSale = {
                id: Math.max(...appData.sales.map(s => s.id)) + 1,
                productId: productId,
                quantity: quantity,
                price: price,
                date: new Date().toISOString().split('T')[0]
            };
            appData.sales.push(newSale);
            
            // 在庫減少
            product.quantity -= quantity;
            
            saveData();
            alert('売上が正常に登録されました');
            document.getElementById('salesForm').reset();
            updateDashboard();
        } else {
            alert('在庫が不足しています');
        }
    }
}

// 売上分析更新
function updateAnalysis() {
    const period = parseInt(document.getElementById('analysisPeriod').value);
    const today = new Date();
    const startDate = new Date(today.getTime() - period * 24 * 60 * 60 * 1000);
    
    const periodSales = appData.sales.filter(sale => new Date(sale.date) >= startDate);
    
    // 統計情報更新
    const totalSales = periodSales.reduce((sum, sale) => sum + (sale.quantity * sale.price), 0);
    const totalItems = periodSales.reduce((sum, sale) => sum + sale.quantity, 0);
    const avgDaily = totalSales / period;
    
    document.getElementById('totalSales').textContent = '¥' + totalSales.toLocaleString();
    document.getElementById('avgDailySales').textContent = '¥' + Math.round(avgDaily).toLocaleString();
    document.getElementById('totalItemsSold').textContent = totalItems.toLocaleString();
    
    // 売上詳細テーブル
    updateSalesTable(periodSales);
    
    // チャート更新
    updateAnalysisCharts(periodSales);
}

// 売上詳細テーブル更新
function updateSalesTable(sales) {
    const tbody = document.getElementById('salesTableBody');
    tbody.innerHTML = '';
    
    sales.forEach(sale => {
        const product = appData.products.find(p => p.id === sale.productId);
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${sale.date}</td>
            <td>${product ? product.name : '不明'}</td>
            <td>${sale.quantity}</td>
            <td>¥${sale.price.toLocaleString()}</td>
            <td>¥${(sale.quantity * sale.price).toLocaleString()}</td>
        `;
        tbody.appendChild(row);
    });
}

// 分析チャート更新
function updateAnalysisCharts(sales) {
    // 売上推移チャート
    const trendCtx = document.getElementById('salesTrendChart').getContext('2d');
    const dailySales = {};
    
    sales.forEach(sale => {
        if (dailySales[sale.date]) {
            dailySales[sale.date] += sale.quantity * sale.price;
        } else {
            dailySales[sale.date] = sale.quantity * sale.price;
        }
    });
    
    const dates = Object.keys(dailySales).sort();
    const salesData = dates.map(date => dailySales[date]);
    
    new Chart(trendCtx, {
        type: 'line',
        data: {
            labels: dates.map(date => new Date(date).toLocaleDateString('ja-JP')),
            datasets: [{
                label: '売上',
                data: salesData,
                borderColor: '#667eea',
                backgroundColor: 'rgba(102, 126, 234, 0.1)',
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return '¥' + value.toLocaleString();
                        }
                    }
                }
            }
        }
    });
    
    // 商品別売上チャート
    const productCtx = document.getElementById('productSalesChart').getContext('2d');
    const productSales = {};
    
    sales.forEach(sale => {
        const product = appData.products.find(p => p.id === sale.productId);
        if (product) {
            if (productSales[product.name]) {
                productSales[product.name] += sale.quantity * sale.price;
            } else {
                productSales[product.name] = sale.quantity * sale.price;
            }
        }
    });
    
    const productNames = Object.keys(productSales);
    const productSalesData = productNames.map(name => productSales[name]);
    
    new Chart(productCtx, {
        type: 'bar',
        data: {
            labels: productNames,
            datasets: [{
                label: '売上',
                data: productSalesData,
                backgroundColor: [
                    '#667eea',
                    '#764ba2',
                    '#f093fb',
                    '#f5576c',
                    '#4facfe'
                ]
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return '¥' + value.toLocaleString();
                        }
                    }
                }
            }
        }
    });
}

// 商品選択時の在庫表示
function updateCurrentStock() {
    const productId = parseInt(document.getElementById('salesProduct').value);
    const product = appData.products.find(p => p.id === productId);
    
    if (product) {
        document.getElementById('currentStock').value = `${product.quantity}点`;
        document.getElementById('salesPrice').value = product.price;
    } else {
        document.getElementById('currentStock').value = '';
        document.getElementById('salesPrice').value = '';
    }
}

// イベントリスナー設定
document.addEventListener('DOMContentLoaded', function() {
    loadData();
    
    // ログインフォーム
    document.getElementById('loginForm').addEventListener('submit', function(e) {
        e.preventDefault();
        login();
    });
    
    // 商品追加フォーム
    document.getElementById('addProductForm').addEventListener('submit', addProduct);
    
    // 入庫フォーム
    document.getElementById('inboundForm').addEventListener('submit', processInbound);
    
    // 出庫フォーム
    document.getElementById('outboundForm').addEventListener('submit', processOutbound);
    
    // 売上フォーム
    document.getElementById('salesForm').addEventListener('submit', registerSale);
    
    // 分析期間変更
    document.getElementById('analysisPeriod').addEventListener('change', updateAnalysis);
    
    // 商品選択時の在庫表示
    document.getElementById('salesProduct').addEventListener('change', updateCurrentStock);
    
    // ログイン処理の修正
    document.getElementById("loginForm").addEventListener("submit", async function(e) {
      e.preventDefault();
      const username = document.getElementById("username").value;
      const password = document.getElementById("password").value;
      const hash = await sha1(password);
  
      const user = users.find(u => u.username === username && u.passwordHash === hash);
      if (user) {
        document.getElementById("loginScreen").classList.add("hidden");
        document.getElementById("mainApp").classList.remove("hidden");
      } else {
        alert("ユーザー名またはパスワードが違います");
      }
    });
});