// アプリケーションデータ
let appData = {
    products: [],
    sales: [],
    user: null,
    charts: {},
    autoRefreshInterval: null,
    autoRefreshEnabled: false,
    filteredProducts: [] // 検索結果を保存
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
    
    // ツールチップを初期化
    initializeTooltips();
}

// ツールチップ初期化
function initializeTooltips() {
    // 既存のツールチップを破棄
    const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    tooltipTriggerList.map(function (tooltipTriggerEl) {
        return new bootstrap.Tooltip(tooltipTriggerEl);
    });
}

// 検索機能
function searchProducts() {
    const searchTerm = document.getElementById('productSearch').value.toLowerCase();
    const searchCategory = document.getElementById('searchCategory').value;
    
    if (!searchTerm) {
        appData.filteredProducts = appData.products;
    } else {
        appData.filteredProducts = appData.products.filter(product => {
            switch(searchCategory) {
                case 'name':
                    return product.name && product.name.toLowerCase().includes(searchTerm);
                case 'sku':
                    return product.sku && product.sku.toLowerCase().includes(searchTerm);
                case 'price':
                    return product.price && product.price.toString().includes(searchTerm);
                default:
                    return (product.name && product.name.toLowerCase().includes(searchTerm)) ||
                           (product.sku && product.sku.toLowerCase().includes(searchTerm)) ||
                           (product.price && product.price.toString().includes(searchTerm));
            }
        });
    }
    
    displayProducts(appData.filteredProducts);
}

// 検索クリア
function clearSearch() {
    document.getElementById('productSearch').value = '';
    document.getElementById('searchCategory').value = 'all';
    appData.filteredProducts = appData.products;
    displayProducts(appData.products);
}

// 商品表示
function displayProducts(products) {
    const tbody = document.getElementById('productTableBody');
    if (tbody) {
        tbody.innerHTML = '';
        
        if (products.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" class="text-center text-muted">
                        <i class="fas fa-search me-2"></i>商品が見つかりませんでした
                    </td>
                </tr>
            `;
            return;
        }
        
        products.forEach(product => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>
                    <span data-bs-toggle="tooltip" data-bs-placement="top" title="SKU: ${product.sku}">
                        ${product.sku || ''}
                    </span>
                </td>
                <td>
                    <span data-bs-toggle="tooltip" data-bs-placement="top" title="商品名: ${product.name}">
                        ${product.name || ''}
                    </span>
                </td>
                <td>
                    <span data-bs-toggle="tooltip" data-bs-placement="top" title="価格: ¥${(product.price || 0).toLocaleString()}">
                        ¥${(product.price || 0).toLocaleString()}
                    </span>
                </td>
                <td>
                    <span class="badge ${product.quantity < 10 ? 'bg-danger' : product.quantity < 50 ? 'bg-warning' : 'bg-success'}" 
                          data-bs-toggle="tooltip" data-bs-placement="top" 
                          title="${product.quantity < 10 ? '在庫不足' : product.quantity < 50 ? '在庫注意' : '在庫充足'}">
                        ${product.quantity || 0}点
                    </span>
                </td>
                <td>
                    <button class="btn btn-sm btn-outline-primary me-1" onclick="editProduct(${product.id})"
                            data-bs-toggle="tooltip" data-bs-placement="top" title="商品を編集">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-danger" onclick="deleteProduct(${product.id})"
                            data-bs-toggle="tooltip" data-bs-placement="top" title="商品を削除">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            `;
            tbody.appendChild(row);
        });
        
        // 新しいツールチップを初期化
        initializeTooltips();
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
        
        // KPI更新
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
        
        // 在庫僅少商品テーブル更新
        updateLowStockTable();
        
    } catch (error) {
        console.error('ダッシュボード更新エラー:', error);
    }
}

async function updateProductList() {
    try {
        const response = await fetch('/api/products');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const products = await response.json();
        appData.products = products;
        appData.filteredProducts = products;
        
        displayProducts(products);
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
    updateSalesHistory();
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
        updateMonthlySalesChart(data.chart_data || []);
        updateProductSalesChart(data.chart_data || []);
        
        // 分析テーブル更新
        updateAnalysisTable(data.sales_history || []);
        
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

// 月別売上チャート更新
function updateMonthlySalesChart(chartData) {
    const ctx = document.getElementById('monthlySalesChart');
    if (!ctx) return;
    
    // 既存のチャートを破棄
    if (appData.charts.monthlySalesChart) {
        appData.charts.monthlySalesChart.destroy();
    }
    
    const labels = chartData.map(item => item.product || '');
    const data = chartData.map(item => item.sales || 0);
    
    appData.charts.monthlySalesChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: '月別売上',
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

// 商品別売上チャート更新
function updateProductSalesChart(chartData) {
    const ctx = document.getElementById('productSalesChart');
    if (!ctx) return;
    
    // 既存のチャートを破棄
    if (appData.charts.productSalesChart) {
        appData.charts.productSalesChart.destroy();
    }
    
    const labels = chartData.map(item => item.product || '');
    const data = chartData.map(item => item.sales || 0);
    
    appData.charts.productSalesChart = new Chart(ctx, {
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

// 在庫僅少商品テーブル更新
async function updateLowStockTable() {
    try {
        const response = await fetch('/api/products');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const products = await response.json();
        
        const lowStockProducts = products.filter(product => product.quantity < 10);
        const lowStockTable = document.getElementById('lowStockTable');
        
        if (lowStockTable) {
            if (lowStockProducts.length === 0) {
                lowStockTable.innerHTML = '<p class="text-muted">在庫不足の商品はありません</p>';
            } else {
                let tableHTML = '<table class="table table-sm">';
                tableHTML += '<thead><tr><th>商品名</th><th>在庫数</th></tr></thead><tbody>';
                
                lowStockProducts.forEach(product => {
                    tableHTML += `<tr><td>${product.name}</td><td>${product.quantity}点</td></tr>`;
                });
                
                tableHTML += '</tbody></table>';
                lowStockTable.innerHTML = tableHTML;
            }
        }
    } catch (error) {
        console.error('在庫僅少商品テーブル更新エラー:', error);
    }
}

// 売上履歴更新
async function updateSalesHistory() {
    try {
        const response = await fetch('/api/sales-analysis');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        
        const tbody = document.getElementById('salesHistoryTable');
        if (tbody) {
            tbody.innerHTML = '';
            
            const salesHistory = data.sales_history || [];
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
    } catch (error) {
        console.error('売上履歴更新エラー:', error);
    }
}

// 分析テーブル更新
function updateAnalysisTable(salesHistory) {
    const tbody = document.getElementById('analysisTableBody');
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
    
    console.log("=== 商品登録開始 ===");
    
    const sku = document.getElementById('newSku').value.trim();
    const name = document.getElementById('newName').value.trim();
    const priceInput = document.getElementById('newPrice').value;
    const quantityInput = document.getElementById('newQuantity').value;
    
    console.log("入力値:", { sku, name, price: priceInput, quantity: quantityInput });
    
    // 入力値の検証
    if (!sku) {
        alert('SKUを入力してください');
        document.getElementById('newSku').focus();
        return;
    }
    if (!name) {
        alert('商品名を入力してください');
        document.getElementById('newName').focus();
        return;
    }
    if (!priceInput) {
        alert('価格を入力してください');
        document.getElementById('newPrice').focus();
        return;
    }
    if (!quantityInput) {
        alert('数量を入力してください');
        document.getElementById('newQuantity').focus();
        return;
    }
    
    // 数値変換と検証
    const price = parseInt(priceInput);
    const quantity = parseInt(quantityInput);
    
    if (isNaN(price) || price <= 0) {
        alert('価格は0より大きい数値を入力してください');
        document.getElementById('newPrice').focus();
        return;
    }
    if (isNaN(quantity) || quantity < 0) {
        alert('数量は0以上の数値を入力してください');
        document.getElementById('newQuantity').focus();
        return;
    }
    
    const formData = { sku, name, price, quantity };
    console.log("送信データ:", formData);
    
    try {
        console.log("APIリクエスト送信中...");
        const response = await fetch('/api/products', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(formData)
        });
        
        console.log("レスポンス受信:", response.status);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        console.log("API結果:", result);
        
        if (result.success) {
            alert('商品が登録されました');
            document.getElementById('addProductForm').reset();
            updateProductList();
            updateDashboard();
        } else {
            alert('商品登録に失敗しました: ' + result.message);
        }
    } catch (error) {
        console.error('商品追加エラー:', error);
        alert('商品追加エラーが発生しました: ' + error.message);
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
            updateSalesHistory();
        } else {
            alert('売上登録に失敗しました: ' + result.message);
        }
    } catch (error) {
        console.error('売上登録エラー:', error);
        alert('売上登録エラーが発生しました');
    }
}

// 日付範囲設定
function setDateRange(range) {
    const today = new Date();
    const startDate = document.getElementById('startDate');
    const endDate = document.getElementById('endDate');
    
    switch(range) {
        case 'today':
            startDate.value = today.toISOString().split('T')[0];
            endDate.value = today.toISOString().split('T')[0];
            break;
        case 'week':
            const weekStart = new Date(today);
            weekStart.setDate(today.getDate() - today.getDay());
            startDate.value = weekStart.toISOString().split('T')[0];
            endDate.value = today.toISOString().split('T')[0];
            break;
        case 'month':
            const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
            startDate.value = monthStart.toISOString().split('T')[0];
            endDate.value = today.toISOString().split('T')[0];
            break;
        case 'quarter':
            const quarter = Math.floor(today.getMonth() / 3);
            const quarterStart = new Date(today.getFullYear(), quarter * 3, 1);
            startDate.value = quarterStart.toISOString().split('T')[0];
            endDate.value = today.toISOString().split('T')[0];
            break;
        case 'year':
            const yearStart = new Date(today.getFullYear(), 0, 1);
            startDate.value = yearStart.toISOString().split('T')[0];
            endDate.value = today.toISOString().split('T')[0];
            break;
    }
    
    // 自動的に分析を実行
    updateAnalysis();
}

// 売上価格自動設定
function updateSalesPrice() {
    const productSelect = document.getElementById('salesProduct');
    const priceInput = document.getElementById('salesPrice');
    
    if (productSelect.value) {
        const selectedProduct = appData.products.find(p => p.id == productSelect.value);
        if (selectedProduct) {
            priceInput.value = selectedProduct.price;
            calculateTotal();
        }
    }
}

// 合計金額計算
function calculateTotal() {
    const quantity = parseInt(document.getElementById('salesQuantity').value) || 0;
    const price = parseInt(document.getElementById('salesPrice').value) || 0;
    const total = quantity * price;
    
    document.getElementById('salesTotal').value = `¥${total.toLocaleString()}`;
}

// 自動更新切り替え
function toggleAutoRefresh() {
    const button = document.getElementById('autoRefreshText');
    
    if (appData.autoRefreshEnabled) {
        // 自動更新を停止
        if (appData.autoRefreshInterval) {
            clearInterval(appData.autoRefreshInterval);
            appData.autoRefreshInterval = null;
        }
        appData.autoRefreshEnabled = false;
        button.textContent = '自動更新OFF';
    } else {
        // 自動更新を開始（30秒間隔）
        appData.autoRefreshInterval = setInterval(updateDashboard, 30000);
        appData.autoRefreshEnabled = true;
        button.textContent = '自動更新ON';
    }
}

// データエクスポート
function exportData() {
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;
    
    // CSVデータを作成
    let csvContent = "日付,商品名,数量,単価,売上\n";
    
    // 実際のデータを取得してCSVに追加
    fetch('/api/sales-analysis')
        .then(response => response.json())
        .then(data => {
            data.sales_history.forEach(sale => {
                csvContent += `${sale.date},${sale.product_name},${sale.quantity},${sale.price},${sale.total}\n`;
            });
            
            // CSVファイルをダウンロード
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `売上データ_${startDate}_${endDate}.csv`;
            link.click();
        });
}

// 商品エクスポート
function exportProducts() {
    let csvContent = "SKU,商品名,価格,在庫数\n";
    
    appData.products.forEach(product => {
        csvContent += `${product.sku},${product.name},${product.price},${product.quantity}\n`;
    });
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `商品一覧_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
}

// 一括在庫更新
function bulkUpdateStock() {
    const newStock = prompt('一括で設定する在庫数を入力してください:');
    if (newStock && !isNaN(newStock)) {
        if (confirm(`すべての商品の在庫数を${newStock}に設定しますか？`)) {
            // 実際の実装では、APIエンドポイントを作成して一括更新を行う
            alert('一括在庫更新機能は現在開発中です');
        }
    }
}

// 分析更新
async function updateAnalysis() {
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;
    
    try {
        let url = '/api/sales-analysis';
        if (startDate && endDate) {
            url += `?start_date=${startDate}&end_date=${endDate}`;
        }
        
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        
        // 分析チャート更新
        updateMonthlySalesChart(data.chart_data || []);
        updateProductSalesChart(data.chart_data || []);
        
        // 分析テーブル更新
        updateAnalysisTable(data.sales_history || []);
        
    } catch (error) {
        console.error('分析更新エラー:', error);
        alert('分析更新エラーが発生しました');
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
        // ゲストユーザー判定
        checkUserStatus();
        
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
        
        // 検索機能のイベントリスナー
        const productSearch = document.getElementById('productSearch');
        const searchCategory = document.getElementById('searchCategory');
        
        if (productSearch) {
            productSearch.addEventListener('input', searchProducts);
        }
        if (searchCategory) {
            searchCategory.addEventListener('change', searchProducts);
        }
        
        // ツールチップ初期化
        initializeTooltips();
        
        console.log('アプリケーション初期化完了');
    } catch (error) {
        console.error('アプリケーション初期化エラー:', error);
    }
}

// ユーザー状態チェック
function checkUserStatus() {
    // セッション情報を確認（簡易的な実装）
    const isGuest = !document.cookie.includes('session');
    const guestBanner = document.getElementById('guestBanner');
    
    if (isGuest && guestBanner) {
        guestBanner.classList.remove('hidden');
    }
    
    // ゲストユーザーの場合は一部機能を制限（商品登録は許可）
    if (isGuest) {
        // 編集・削除ボタンを非表示（商品登録は許可）
        const editButtons = document.querySelectorAll('.btn-outline-primary, .btn-outline-danger');
        editButtons.forEach(button => {
            button.style.display = 'none';
        });
    }
}

// DOM読み込み完了時に初期化
document.addEventListener('DOMContentLoaded', initializeApp); 