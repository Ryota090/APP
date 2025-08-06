// アプリケーションデータ
let appData = {
    products: [],
    sales: [],
    user: null,
    charts: {}
};

// ページ表示制御
function showPage(pageName, event) {
    // すべてのページを非表示
    document.querySelectorAll('[id$="Page"]').forEach(page => {
        page.classList.add('hidden');
    });
    
    // 指定されたページを表示
    const targetPage = document.getElementById(pageName + 'Page');
    if (targetPage) {
        targetPage.classList.remove('hidden');
    }
    
    // ナビゲーションのアクティブ状態を更新
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
    });
    if (event && event.target) {
        event.target.classList.add('active');
    }
    
    // ページに応じた初期化
    switch(pageName) {
        case 'dashboard':
            updateDashboard();
            break;
        case 'products':
            updateProductList();
            break;
        case 'inventory':
            updateInventoryPage();
            break;
        case 'sales':
            updateSalesPage();
            break;
        case 'analysis':
            updateAnalysisPage();
            break;
    }
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
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        
        // メトリクス更新
        const totalProductsEl = document.getElementById('totalProducts');
        const totalStockEl = document.getElementById('totalStock');
        const lowStockCountEl = document.getElementById('lowStockCount');
        const totalSalesEl = document.getElementById('totalSales');
        
        if (totalProductsEl) totalProductsEl.textContent = data.total_products || 0;
        if (totalStockEl) totalStockEl.textContent = (data.total_stock || 0).toLocaleString();
        if (lowStockCountEl) lowStockCountEl.textContent = data.low_stock_count || 0;
        if (totalSalesEl) totalSalesEl.textContent = `¥${(data.total_sales || 0).toLocaleString()}`;
        
        // 在庫不足アラート
        const lowStockAlert = document.getElementById('lowStockAlert');
        if (lowStockAlert) {
            if (data.low_stock_count > 0) {
                lowStockAlert.classList.remove('hidden');
            } else {
                lowStockAlert.classList.add('hidden');
            }
        }
        
        // 売上チャート更新
        updateSalesChart(data.sales_data || []);
        
    } catch (error) {
        console.error('ダッシュボード更新エラー:', error);
    }
}

// 商品一覧更新
async function updateProductList() {
    try {
        const response = await fetch('/api/products');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const products = await response.json();
        appData.products = products;
        
        const tbody = document.getElementById('productTableBody');
        if (tbody) {
            tbody.innerHTML = '';
            
            products.forEach(product => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${product.sku || ''}</td>
                    <td>${product.name || ''}</td>
                    <td>¥${(product.price || 0).toLocaleString()}</td>
                    <td>${product.quantity || 0}点</td>
                    <td>
                        <button class="btn btn-sm btn-outline-primary" onclick="editProduct(${product.id})">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-danger" onclick="deleteProduct(${product.id})">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                `;
                tbody.appendChild(row);
            });
        }
    } catch (error) {
        console.error('商品一覧更新エラー:', error);
    }
}

// 在庫管理ページ更新
function updateInventoryPage() {
    updateProductSelects();
}

// 売上管理ページ更新
function updateSalesPage() {
    updateProductSelects();
}

// 分析ページ更新
async function updateAnalysisPage() {
    try {
        const response = await fetch('/api/sales-analysis');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        
        // 分析チャート更新
        updateAnalysisChart(data.chart_data || []);
        
        // 売上履歴テーブル更新
        updateSalesTable(data.sales_history || []);
        
    } catch (error) {
        console.error('分析ページ更新エラー:', error);
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
                option.textContent = `${product.sku} - ${product.name}`;
                select.appendChild(option);
            });
        }
    });
}

// 売上チャート更新
function updateSalesChart(salesData) {
    const ctx = document.getElementById('salesChart');
    if (!ctx) return;
    
    // 既存のチャートを破棄
    if (appData.charts.salesChart) {
        appData.charts.salesChart.destroy();
    }
    
    const labels = salesData.map(item => item.date || '');
    const data = salesData.map(item => item.amount || 0);
    
    appData.charts.salesChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: '売上',
                data: data,
                borderColor: '#667eea',
                backgroundColor: 'rgba(102, 126, 234, 0.1)',
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'top',
                }
            },
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

// 分析チャート更新
function updateAnalysisChart(chartData) {
    const ctx = document.getElementById('analysisChart');
    if (!ctx) return;
    
    // 既存のチャートを破棄
    if (appData.charts.analysisChart) {
        appData.charts.analysisChart.destroy();
    }
    
    const labels = chartData.map(item => item.product || '');
    const data = chartData.map(item => item.sales || 0);
    
    appData.charts.analysisChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: '売上',
                data: data,
                backgroundColor: 'rgba(102, 126, 234, 0.8)',
                borderColor: '#667eea',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'top',
                }
            },
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

// 売上履歴テーブル更新
function updateSalesTable(salesHistory) {
    const tbody = document.getElementById('salesTableBody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    salesHistory.forEach(sale => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${sale.date || ''}</td>
            <td>${sale.product_name || ''}</td>
            <td>${sale.quantity || 0}</td>
            <td>¥${(sale.price || 0).toLocaleString()}</td>
            <td>¥${(sale.total || 0).toLocaleString()}</td>
        `;
        tbody.appendChild(row);
    });
}

// 商品追加
async function addProduct(event) {
    event.preventDefault();
    
    const formData = {
        sku: document.getElementById('newSku').value,
        name: document.getElementById('newName').value,
        price: parseInt(document.getElementById('newPrice').value),
        quantity: parseInt(document.getElementById('newQuantity').value)
    };
    
    try {
        const response = await fetch('/api/products', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(formData)
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        if (result.success) {
            alert('商品が追加されました');
            document.getElementById('addProductForm').reset();
            updateProductList();
            updateDashboard();
        } else {
            alert('商品追加に失敗しました: ' + result.message);
        }
    } catch (error) {
        console.error('商品追加エラー:', error);
        alert('商品追加エラーが発生しました');
    }
}

// 入庫処理
async function processInbound(event) {
    event.preventDefault();
    
    const formData = {
        product_id: document.getElementById('inboundProduct').value,
        quantity: parseInt(document.getElementById('inboundQuantity').value)
    };
    
    try {
        const response = await fetch('/api/inventory/inbound', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(formData)
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        if (result.success) {
            alert('入庫処理が完了しました');
            document.getElementById('inboundForm').reset();
            updateProductList();
            updateDashboard();
        } else {
            alert('入庫処理に失敗しました: ' + result.message);
        }
    } catch (error) {
        console.error('入庫処理エラー:', error);
        alert('入庫処理エラーが発生しました');
    }
}

// 出庫処理
async function processOutbound(event) {
    event.preventDefault();
    
    const formData = {
        product_id: document.getElementById('outboundProduct').value,
        quantity: parseInt(document.getElementById('outboundQuantity').value)
    };
    
    try {
        const response = await fetch('/api/inventory/outbound', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(formData)
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        if (result.success) {
            alert('出庫処理が完了しました');
            document.getElementById('outboundForm').reset();
            updateProductList();
            updateDashboard();
        } else {
            alert('出庫処理に失敗しました: ' + result.message);
        }
    } catch (error) {
        console.error('出庫処理エラー:', error);
        alert('出庫処理エラーが発生しました');
    }
}

// 売上登録
async function registerSale(event) {
    event.preventDefault();
    
    const formData = {
        product_id: document.getElementById('salesProduct').value,
        quantity: parseInt(document.getElementById('salesQuantity').value),
        price: parseInt(document.getElementById('salesPrice').value)
    };
    
    try {
        const response = await fetch('/api/sales', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(formData)
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        if (result.success) {
            alert('売上が登録されました');
            document.getElementById('salesForm').reset();
            updateDashboard();
        } else {
            alert('売上登録に失敗しました: ' + result.message);
        }
    } catch (error) {
        console.error('売上登録エラー:', error);
        alert('売上登録エラーが発生しました');
    }
}

// 商品編集
function editProduct(productId) {
    // 商品編集機能（将来的に実装）
    alert('商品編集機能は現在開発中です');
}

// 商品削除
async function deleteProduct(productId) {
    if (!confirm('この商品を削除しますか？')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/products/${productId}`, {
            method: 'DELETE'
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        if (result.success) {
            alert('商品が削除されました');
            updateProductList();
            updateDashboard();
        } else {
            alert('商品削除に失敗しました: ' + result.message);
        }
    } catch (error) {
        console.error('商品削除エラー:', error);
        alert('商品削除エラーが発生しました');
    }
}

// 初期化
async function initializeApp() {
    try {
        // 初期データ読み込み
        await updateDashboard();
        await updateProductList();
        
        // イベントリスナー設定
        const addProductForm = document.getElementById('addProductForm');
        const inboundForm = document.getElementById('inboundForm');
        const outboundForm = document.getElementById('outboundForm');
        const salesForm = document.getElementById('salesForm');
        
        if (addProductForm) {
            addProductForm.addEventListener('submit', addProduct);
        }
        if (inboundForm) {
            inboundForm.addEventListener('submit', processInbound);
        }
        if (outboundForm) {
            outboundForm.addEventListener('submit', processOutbound);
        }
        if (salesForm) {
            salesForm.addEventListener('submit', registerSale);
        }
        
    } catch (error) {
        console.error('アプリケーション初期化エラー:', error);
    }
}

// DOM読み込み完了時に初期化
document.addEventListener('DOMContentLoaded', initializeApp); 