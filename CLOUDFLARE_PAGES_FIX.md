# Cloudflare Pages 部署配置修復

## 問題分析

### 當前 Cloudflare Pages 配置（有問題）
```yaml
Build command:
pnpm install --no-frozen-lockfile && cd frontend/project-01 && pnpm run build:cf

Build output directory:
/frontend/project-01/.open-next
```

### 問題所在

1. **錯誤的構建命令**：
   - 使用 `cd frontend/project-01 && pnpm run build:cf`
   - 這在 pnpm monorepo 環境中會導致工作區解析問題
   - pnpm 會忽略根目錄的 pnpm-lock.yaml 和跨工作區依賴

2. **錯誤的輸出目錄**：
   - 配置為 `/frontend/project-01/.open-next`
   - Cloudflare Pages 會從根目錄查找
   - 應該是 `frontend/project-01/.open-next`（無前導斜杠）

### 正確的配置

```yaml
Framework preset:
None

Build command:
pnpm install --no-frozen-lockfile && pnpm --filter="./frontend/project-01..." run build:cf

Build output directory:
frontend/project-01/.open-next

Root directory:
/ (keep as root)
```

## 修復步驟

### 步驟 1：更新 Cloudflare Pages 配置

登錄 Cloudflare Dashboard：
1. 前往 Pages → autoecoops → Settings → Build & deployments
2. 更新以下設置：

**Build command:**
```bash
pnpm install --no-frozen-lockfile && pnpm --filter="./frontend/project-01..." run build:cf
```

**Build output directory:**
```
frontend/project-01/.open-next
```

**Root directory:**
```
/
```

### 步驟 2：驗證 package.json 配置

確保 `frontend/project-01/package.json` 中的 build:cf 命令正確：

```json
{
  "scripts": {
    "build:cf": "NEXT_PUBLIC_SUPABASE_URL=https://yrfxijooswpvdpdseswy.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_rhTyBa4IqqV14nV_B87S7g_zKzDSYTd npx @opennextjs/cloudflare@1.16.5 build && mv .open-next/worker.js .open-next/_worker.js && if [ -d .open-next/assets ] && [ &quot;$(ls -A .open-next/assets 2>/dev/null)&quot; ]; then cp -r .open-next/assets/* .open-next/; else echo 'Warning: .open-next/assets is missing or empty; skipping asset copy.' >&2; fi && node -e 'require(&quot;fs&quot;).writeFileSync(&quot;.open-next/_routes.json&quot;, JSON.stringify({version:1,include:[&quot;/*&quot;],exclude:[&quot;/_next/static/*&quot;,&quot;/favicon.ico&quot;,&quot;/robots.txt&quot;,&quot;/sitemap.xml&quot;,&quot;/404.html&quot;,&quot;/BUILD_ID&quot;]},null,2))' && printf 'compatibility_date = &quot;2026-02-01&quot;\\ncompatibility_flags = [&quot;nodejs_compat&quot;]\\n' > .open-next/wrangler.toml"
  }
}
```

### 步驟 3：觸發新的部署

更新配置後，Cloudflare Pages 會自動觸發新的部署。

## 自動化修復工作流

我們已創建了 `.github/workflows/cloudflare-auto-fix.yml` 工作流，它可以：

1. **自動檢測問題**：
   - 檢查 package.json 中的 build:cf 命令
   - 驗證是否有 HTML 實體編碼
   - 確認 wrangler.toml 生成步驟
   - 檢查 nodejs_compat 標志

2. **自動修復問題**：
   - 使用正確的 JSON 轉義
   - 添加完整的後處理管道
   - 確保所有必要的步驟都存在

3. **自動創建 PR**：
   - 創建包含修復的 Pull Request
   - 添加詳細的修復說明
   - 標記為自動化修復

## 為什麼會持續出現問題？

1. **配置問題**：Cloudflare Pages 的構建命令使用了錯誤的 pnpm 語法
2. **JSON 轉義問題**：HTML 實體編碼 vs JSON 轉義的混淆
3. **工作區問題**：monorepo 環境下的工作區依賴解析

## 完全自動化解決方案

要實現完全自動化，需要：

1. ✅ **GitHub Actions 工作流**（已創建）：自動檢測和修復代碼問題
2. ⚠️ **Cloudflare Pages 配置**：需要手動更新一次（或使用 Cloudflare API）
3. ✅ **CI/CD 檢查**：在合併前驗證配置

## 立即行動

1. 更新 Cloudflare Pages 構建配置（使用上面的正確配置）
2. 觸發新的部署
3. 監控部署日誌確認成功

## 預期結果

使用正確配置後：
- ✅ pnpm 工作區依賴正確解析
- ✅ build:cf 命令正確執行
- ✅ wrangler.toml 正確生成
- ✅ Cloudflare Pages 部署成功
- ✅ 應用正常運行