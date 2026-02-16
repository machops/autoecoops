#!/usr/bin/env python3
import json
import sys

# 讀取 package.json
with open('frontend/project-01/package.json', 'r') as f:
    data = json.load(f)

# 正確的構建命令
correct_command = """NEXT_PUBLIC_SUPABASE_URL=https://yrfxijooswpvdpdseswy.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_rhTyBa4IqqV14nV_B87S7g_zKzDSYTd npx @opennextjs/cloudflare@1.16.5 build && mv .open-next/worker.js .open-next/_worker.js && if [ -d .open-next/assets ] && [ "$(ls -A .open-next/assets 2>/dev/null)" ]; then cp -r .open-next/assets/* .open-next/; else echo 'Warning: .open-next/assets is missing or empty; skipping asset copy.' >&2; fi && node -e 'require(&quot;fs&quot;).writeFileSync(&quot;.open-next/_routes.json&quot;, JSON.stringify({version:1,include:[&quot;/*&quot;],exclude:[&quot;/_next/static/*&quot;,&quot;/favicon.ico&quot;,&quot;/robots.txt&quot;,&quot;/sitemap.xml&quot;,&quot;/404.html&quot;,&quot;/BUILD_ID&quot;]},null,2))' && printf 'compatibility_date = &quot;2026-02-01&quot;\\ncompatibility_flags = [&quot;nodejs_compat&quot;]\\n' > .open-next/wrangler.toml"""

# 更新腳本
data['scripts']['build:cf'] = correct_command

# 寫回文件
with open('frontend/project-01/package.json', 'w') as f:
    json.dump(data, f, indent=2)

print("✅ package.json updated")