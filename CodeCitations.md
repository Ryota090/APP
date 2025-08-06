# Code Citations

## License: MIT  
本プロジェクトの一部コードは、以下のMITライセンスのリポジトリを参考にしています。  
著作権表示: Copyright (c) roopesh04

参考元URL（コミットID指定）:  
https://github.com/roopesh04/employee_management/blob/209bcfe845cd74e1e751ae06da3dd7871b8de9b0/script.js

<!-- app.jsのログイン処理で利用 -->

```javascript
// 参考元のコード（一部改変）: ログインフォームの送信イベントを非同期で処理
document.getElementById("loginForm").addEventListener("submit", async function(e) {
  e.preventDefault();
  const username = document.getElementById("username").value;
  const password = document.getElementById("password").value;
  // ここで認証処理を実装
});
```

> 上記のコードは、ログインフォームの送信イベントを非同期で処理する部分に参考にしました。

---

## 追加で発生した問題とその解決

1. **ファイル名にスペースが含まれている**  
   → ファイル名を `CodeCitations.md` に変更しました。

2. **ライセンスの説明が不足している**  
   → 下部にMITライセンスの簡単な説明を追記しました。

3. **参考コードの利用範囲が曖昧**  
   → どの機能で参考にしたか（ログイン処理）を明記しました。

4. **日本語と英語の表記が混在している**  
   → 日本語に統一しました。

5. **参考元リポジトリのコミットIDが記載されていない**  
   → URLにコミットIDを含めて明確化しました。

6. **コードブロックの言語指定がなかった**  
   → ```javascript を明記しました。

7. **コメントの書き方が不統一**  
   → コード内コメントも日本語に統一しました。

8. **参考元コードの改変点が不明確**  
   → 「一部改変」と明記し、どこを参考にしたか説明を追加しました。

9. **ライセンス条文が記載されていない**  
   → MITライセンスの要点を下記に記載しました。

---

#### MITライセンスについて
MITライセンスは、著作権表示とライセンス文を残せば、商用利用・改変・再配布が自由なオープンソースライセンスです。  
詳細は[MIT License 日本語訳](https://licenses.opensource.jp/MIT/MIT.html)などをご参照ください。