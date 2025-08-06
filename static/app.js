// アプリケーションデータ
let appData = {
    products: [],
    user: null
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
        
        if (totalProductsEl) totalProductsEl.textContent = data.total_products || 0;
        if (totalStockEl) totalStockEl.textContent = (data.total_stock || 0).toLocaleString();
        
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
                `;
                tbody.appendChild(row);
            });
        }
    } catch (error) {
        console.error('商品一覧更新エラー:', error);
    }
}

// 初期化
async function initializeApp() {
    try {
        // 初期データ読み込み
        await updateDashboard();
        await updateProductList();
        
    } catch (error) {
        console.error('アプリケーション初期化エラー:', error);
    }
}

// DOM読み込み完了時に初期化
document.addEventListener('DOMContentLoaded', initializeApp); 