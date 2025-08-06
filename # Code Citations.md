# Code Citations

## License: MIT  
本プロジェクトの一部コードは、以下のMITライセンスのリポジトリを参考にしています。  
著作権表示: Copyright (c) roopesh04

https://github.com/roopesh04/employee_management/blob/209bcfe845cd74e1e751ae06da3dd7871b8de9b0/script.js

<!-- app.jsのログイン処理で利用 -->

```javascript
// 参考元のコード（一部改変）
document.getElementById("loginForm").addEventListener("submit", async function(e) {
  e.preventDefault();
  const username = document.getElementById("username").value;
  const password = document.getElementById("password").value;
  // ここで認証処理を実装
});
```

> 上記のコードは、ログインフォームの送信イベントを非同期で処理する部分に参考にしました。

---

### 修正した残りの問題点

6. **ライセンスの説明が不足している**  
   → MITライセンスの簡単な説明を追加

7. **参考コードの利用範囲が曖昧**  
   → どの機能で参考にしたかを明記

8. **日本語と英語の表記が混在している**  
   → 必要に応じて統一（今回は日本語で統一）

9. **ファイル名にスペースが含まれている**  
   → ファイル名を `CodeCitations.md` などにリネーム推奨

10. **参考元リポジトリのコミットIDが記載されていない**  
    → 参考にしたコミットIDをURLに含めることで明確化

---

#### MITライセンスについて
MITライセンスは、著作権表示とライセンス文を残せば、商用・改変・再配布が自由なオープンソースライセンスです。

