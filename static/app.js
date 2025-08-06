// アプリケーションデータ
let appData = {
    products: [],
    user: null
};

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

// ログアウト処理
async function logout() {
    try {
        const response = await fetch('/api/logout', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            }
        });
        
        if (response.ok) {
            window.location.href = '/login';
        }
    } catch (error) {
        console.error('ログアウトエラー:', error);
        window.location.href = '/login';
    }
}

// ダッシュボード更新
async function updateDashboard() {
    try {
        const response = await fetch('/api/dashboard');
        const data = await response.json();
        
        // メトリクス更新
        document.getElementById('totalProducts').textContent = data.total_products;
        document.getElementById('totalStock').textContent = data.total_stock.toLocaleString();
        document.getElementById('weeklySales').textContent = '¥' + data.weekly_sales.toLocaleString();
        document.getElementById('lowStockCount').textContent = data.low_stock;
        
        // 在庫僅少アラート
        updateLowStockAlert();
        
        // 売上チャート
        updateSalesChart();
    } catch (error) {
        console.error('ダッシュボード更新エラー:', error);
    }
}

// 在庫僅少アラート更新
async function updateLowStockAlert() {
    try {
        const response = await fetch('/api/products');
        const products = await response.json();
        
        const lowStockProducts = products.filter(product => product.quantity <= 10);
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
    } catch (error) {
        console.error('在庫アラート更新エラー:', error);
    }
}

// 売上チャート更新
async function updateSalesChart() {
    try {
        const response = await fetch('/api/sales/analysis?period=7');
        const data = await response.json();
        
        const ctx = document.getElementById('salesChart').getContext('2d');
        
        const labels = data.daily_sales.map(item => {
            const date = new Date(item.date);
            return date.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' });
        });
        const salesData = data.daily_sales.map(item => item.sales);
        
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
    } catch (error) {
        console.error('売上チャート更新エラー:', error);
    }
}

// 商品一覧更新
async function updateProductList() {
    try {
        const response = await fetch('/api/products');
        const products = await response.json();
        appData.products = products;
        
        const tbody = document.getElementById('productTableBody');
        tbody.innerHTML = '';
        
        products.forEach(product => {
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
    } catch (error) {
        console.error('商品一覧更新エラー:', error);
    }
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
async function addProduct(event) {
    event.preventDefault();
    
    const sku = document.getElementById('newSku').value;
    const name = document.getElementById('newName').value;
    const price = parseInt(document.getElementById('newPrice').value);
    const quantity = parseInt(document.getElementById('newQuantity').value);
    
    try {
        const response = await fetch('/api/products', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ sku, name, price, quantity })
        });
        
        const data = await response.json();
        
        if (data.success) {
            alert('商品が正常に登録されました');
            document.getElementById('addProductForm').reset();
            updateProductList();
            updateProductSelects();
            updateDashboard();
        } else {
            alert(data.message);
        }
    } catch (error) {
        console.error('商品追加エラー:', error);
        alert('エラーが発生しました');
    }
}

// 入庫処理
async function processInbound(event) {
    event.preventDefault();
    
    const productId = parseInt(document.getElementById('inboundProduct').value);
    const quantity = parseInt(document.getElementById('inboundQuantity').value);
    
    try {
        const response = await fetch(`/api/products/${productId}/stock`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ quantity: quantity })
        });
        
        const data = await response.json();
        
        if (data.success) {
            alert('入庫処理が完了しました');
            document.getElementById('inboundForm').reset();
            updateDashboard();
            updateProductList();
        } else {
            alert(data.message);
        }
    } catch (error) {
        console.error('入庫処理エラー:', error);
        alert('エラーが発生しました');
    }
}

// 出庫処理
async function processOutbound(event) {
    event.preventDefault();
    
    const productId = parseInt(document.getElementById('outboundProduct').value);
    const quantity = parseInt(document.getElementById('outboundQuantity').value);
    
    const product = appData.products.find(p => p.id === productId);
    if (product && product.quantity >= quantity) {
        try {
            const response = await fetch(`/api/products/${productId}/stock`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ quantity: product.quantity - quantity })
            });
            
            const data = await response.json();
            
            if (data.success) {
                alert('出庫処理が完了しました');
                document.getElementById('outboundForm').reset();
                updateDashboard();
                updateProductList();
            } else {
                alert(data.message);
            }
        } catch (error) {
            console.error('出庫処理エラー:', error);
            alert('エラーが発生しました');
        }
    } else {
        alert('在庫が不足しています');
    }
}

// 売上登録
async function registerSale(event) {
    event.preventDefault();
    
    const productId = parseInt(document.getElementById('salesProduct').value);
    const quantity = parseInt(document.getElementById('salesQuantity').value);
    const price = parseInt(document.getElementById('salesPrice').value);
    
    try {
        const response = await fetch('/api/sales', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ product_id: productId, quantity_sold: quantity, sale_price: price })
        });
        
        const data = await response.json();
        
        if (data.success) {
            alert('売上が正常に登録されました');
            document.getElementById('salesForm').reset();
            updateDashboard();
            updateProductList();
        } else {
            alert(data.message);
        }
    } catch (error) {
        console.error('売上登録エラー:', error);
        alert('エラーが発生しました');
    }
}

// 売上分析更新
async function updateAnalysis() {
    const period = document.getElementById('analysisPeriod').value;
    
    try {
        const response = await fetch(`/api/sales/analysis?period=${period}`);
        const data = await response.json();
        
        // 統計情報更新
        const totalSales = data.product_sales.reduce((sum, item) => sum + item.total_sales, 0);
        const totalItems = data.product_sales.reduce((sum, item) => sum + item.total_quantity, 0);
        const avgDaily = totalSales / parseInt(period);
        
        document.getElementById('totalSales').textContent = '¥' + totalSales.toLocaleString();
        document.getElementById('avgDailySales').textContent = '¥' + Math.round(avgDaily).toLocaleString();
        document.getElementById('totalItemsSold').textContent = totalItems.toLocaleString();
        
        // 売上詳細テーブル
        updateSalesTable(data.product_sales);
        
        // チャート更新
        updateAnalysisCharts(data);
    } catch (error) {
        console.error('売上分析更新エラー:', error);
    }
}

// 売上詳細テーブル更新
function updateSalesTable(sales) {
    const tbody = document.getElementById('salesTableBody');
    tbody.innerHTML = '';
    
    sales.forEach(sale => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${new Date().toLocaleDateString('ja-JP')}</td>
            <td>${sale.name}</td>
            <td>${sale.total_quantity}</td>
            <td>¥${Math.round(sale.total_sales / sale.total_quantity).toLocaleString()}</td>
            <td>¥${sale.total_sales.toLocaleString()}</td>
        `;
        tbody.appendChild(row);
    });
}

// 分析チャート更新
function updateAnalysisCharts(data) {
    // 売上推移チャート
    const trendCtx = document.getElementById('salesTrendChart').getContext('2d');
    
    const labels = data.daily_sales.map(item => {
        const date = new Date(item.date);
        return date.toLocaleDateString('ja-JP');
    });
    const salesData = data.daily_sales.map(item => item.sales);
    
    new Chart(trendCtx, {
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
    
    // 商品別売上チャート
    const productCtx = document.getElementById('productSalesChart').getContext('2d');
    
    const productNames = data.product_sales.map(item => item.name);
    const productSalesData = data.product_sales.map(item => item.total_sales);
    
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

// 初期化
async function initializeApp() {
    try {
        // 初期データ読み込み
        await updateDashboard();
        await updateProductList();
        
        // イベントリスナー設定
        document.getElementById('addProductForm').addEventListener('submit', addProduct);
        document.getElementById('inboundForm').addEventListener('submit', processInbound);
        document.getElementById('outboundForm').addEventListener('submit', processOutbound);
        document.getElementById('salesForm').addEventListener('submit', registerSale);
        document.getElementById('analysisPeriod').addEventListener('change', updateAnalysis);
        document.getElementById('salesProduct').addEventListener('change', updateCurrentStock);
        
    } catch (error) {
        console.error('アプリケーション初期化エラー:', error);
    }
}

// DOM読み込み完了時に初期化
document.addEventListener('DOMContentLoaded', initializeApp); 