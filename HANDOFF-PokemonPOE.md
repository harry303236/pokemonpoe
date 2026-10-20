# PokemonPOE — 交接文件（2026-10-20）

非營利寶可夢遊戲，玩法朝 Path of Exile（POE）式的 build 深度發展。
由 PokéSurvivor（原生 JS 瀏覽器遊戲）fork 而來。**使用者偏好繁體中文溝通**；程式碼註解與遊戲內來源字串為西班牙文。

## 1. 工作方式（先看這個）
- 倉庫：`github.com/harry303236/pokemonpoe`，分支 `main`。
- 讀 `CLAUDE.md`（原作者的規則，仍適用）：
  - 只改 `dev.html`，`index.html` 是產物。
  - 發佈：`node tools/build.js && node tools/export_data.js && python tools/make_seo_pages.py`（build 會產生 `index.html`、`js/app.min.js`、`version.json`）。
  - **commit 訊息不加 Co-Authored-By 或任何 AI 署名**。使用者要求時才 push。
  - 每個遊戲改動要寫進 `js/data/changelog.js`（西/英）。
  - 不要重新啟用原作者的 Firebase（`js/core/firebase-config.js` 是 `null` = 本機模式）。
- 全域物件 `G`，`dev.html` 依序載入約 80 支 script（順序有意義，例如 `link.js` 必須在 `coop.js` 之後、`support.js` 在 `combat.js` 之前）。
- 字串以西班牙文為 key，翻譯放 `js/data/lang-*.js`（`lang-support.js` 為繁/簡中、`lang-en.js` 為英文），改完跑 `node tools/build_langs.js` 產生 `js/lang/*.js`。fr/it/pt 目前未翻譯新增內容。
- 使用者本機資料夾（`C:\Users\Harry\Downloads\pokemonpoe-main\pokemonpoe-main`）**不是 git 倉庫**。之前的流程：在雲端 clone 改檔 → 用工具把檔案寫回使用者資料夾；push 由雲端 clone 做。若你直接改使用者資料夾，記得同步回倉庫。
- 使用者本機 `dev.html` 比倉庫多一行 `<script ... js/core/devcheat.js>`（開發作弊：金幣全滿、全寶可夢、經驗 10 倍、`G.DEV_SUPPORT` 讓輔助卡常出現、跳過人格測驗）。**倉庫與正式版不含 devcheat**；build 前要暫時拿掉那行（上次是用 `grep -v devcheat.js dev.html` 暫存後 build，再還原）。
- 瀏覽器有 service worker：測試時若看到舊版，F12 → Application → Service Workers → Unregister，再 Ctrl+Shift+R。測新功能請開 `dev.html`，`index.html` 可能是舊 build。
- 檔案換行不一致（部分 CRLF）：用程式 patch 時要處理 CRLF。

## 2. 已完成功能（本階段全部）
| 功能 | 說明 | 主要檔案 |
|---|---|---|
| 開發作弊 | 見上，僅測試用 | `js/core/devcheat.js` |
| Tab 插槽配置 | 按 Tab 開啟拖放配置。4 個主技能，各在 Lv.5/10/15/20 開 1 個插槽（上限 4）；升級學新招自動放入，不彈窗。寶可夢仍只能學自己屬性＋一般系的攻擊招式 | `js/ui/loadout-ui.js`、`player.js`（`slots`、`socketCap`、`dropMove`）、`game.js`（`toggleLoadout`、`learn`） |
| 局內進化 | Lv.8、Lv.15 進化，有分支時玩家選；開局只能選未進化型態 | `js/systems/evolution.js`、`js/data/evolutions.js`（PokeAPI 產生）、`game.js`（`startEvolution`） |
| 特性系統 | 271 個特性（僅最終型態；不進化者 Lv.10 選），一次一個，隱藏特性排最後；官方文字＋實際效果；強度分三級 | `js/systems/abilities.js`（引擎）、`js/data/ability-fx.js`（271 筆效果）、`js/data/abilities.js`（`tools/fetch_abilities.py` 產生）、`game.js`（`startAbilityChoice`） |
| 輔助招式（12 招） | 任何寶可夢都能學；治療／護盾／減傷／嘲諷／無敵／全隊加速；顏色跟施放者屬性 | `js/systems/support.js`、`js/data/moves.js`（`support:true`、`G.Moves.SUPPORT`）、`levelup.js`（輔助池、權重 0.6、最多持有 2 招） |
| 好友連線（免後端） | 房主產生「邀請碼」→ 朋友貼上產生「回覆碼」→ 房主貼回；WebRTC 直連＋Google STUN，無 TURN，最多 4 人 | `js/net/link.js`、`net.js`（`openLocal/hostOffer/guestAnswer/hostAccept`）、`social.js`（本地房間）、`social-ui.js`（大廳）、`dev.html`（`scr-link`、`#lobby-link`） |
| 多人中的進化／特性 | 各自選擇，全隊暫停（沿用 `holdStart/holdEnd`）；進化以事件 `['evo', uid, dex]` 同步外觀 | `game.js`（`coopChoices`）、`coop.js` |
| 正式版 | 已 build 並 push 一次（`index.html` 為當時版本，**不含**輔助招式） | `index.html`、`js/app.min.js` |

### 輔助招式清單
自我再生(`recover`)、治癒波動(`heal-pulse`)、生命水滴(`life-dew`)、治癒鈴聲(`heal-bell`)、守住(`protect`)、反射壁(`reflect`)、光牆(`light-screen`)、極光幕(`aurora-veil`)、鐵壁(`iron-defense`)、挑釁(`taunt`)、看我嘛(`follow-me`)、順風(`tailwind`)。
新增 `kind`：`heal / shield / guard / taunt / protect / rally`（參數見 `support.js` 檔頭）。
**多人機制**：不新增網路事件。隊友施放走既有 `['c', …]` 施放事件，本機以 ghost 模式判斷自己是否在半徑內並套用到自己；嘲諷另外記在 ghost 玩家上，因為敵人 AI 在房主端（`enemy.js nearestPlayer` → `G.Support.taunter`）。

## 3. 測試方法
- 雲端用 Playwright（chromium）開兩個分頁，`python3 -m http.server` 服務倉庫，兩頁都 `G.DB.playAsGuest()` 並設定 `save.partner=172`（皮丘）再 `G.Flow.afterLogin()`；房主 `G.Link.createRoom('A')` → `G.Link.invite()` → 朋友 `G.Link.answer(code,'B')` → 房主 `G.Link.accept(ans)` → 點 `#lobby-start`。已驗證連線、開局、Lv.8/15 升級卡同步、進化／特性、輔助招式。
- `G.Game.debugLevelUp()` 可強制升級；`G.Game.player.addMove('taunt')` 可直接學招式。
- 特性模擬：`node tools/test_abilities.js`（271 個皆通過）。
- **尚未做**：兩台不同網路的真機連線測試；輔助招式的手感與平衡。

## 4. 已知問題 / 待辦
1. **正式版過期**：要發佈需重新 build（拿掉 devcheat），並 push `index.html`、`js/app.min.js`、`version.json`。
2. 輔助招式數值為初估：守住 1 秒無敵／cd12、鐵壁護盾 25%、順風 +25% 速、嘲諷半徑 220/340 等。
3. HUD 尚未顯示護盾量；fr/it/pt 無新字串翻譯。
4. 特性待平衡：Huge Power、Pure Power、Adaptability、Wonder Guard、Supreme Overlord（第三級）。
5. 圖鑑 966 隻（官方約 1025），缺哪些尚未列出。
6. 連線：WebRTC 偵測對方直接關分頁需數秒～數十秒；嚴格 NAT／公司網路可能連不上（換網路或熱點）。
7. 存檔只在各自瀏覽器 localStorage；尚無匯出／匯入存檔（使用者可能想要，建議優先）。若要雲端存檔需使用者自建 Firebase（`docs/FIREBASE.md`）；討論過自架 SQLite，不建議（需常開電腦＋HTTPS 通道）。
8. 清理：`tools/_p/`（使用者資料夾內的暫存 patch 檔，我無權限刪）；`整理特性資料.bat` 只在使用者本機。
9. 發佈前還要處理原作者的殘留：`.firebaserc`、網域／贊助頁面、SEO 頁（`--sin-seo` 可略過）。

## 5. 路線圖（與使用者討論後的共識）
- 定位由「選的技能」決定，不設職業；輔助招式進共用池。
- 第二批輔助：祈願、光合作用、場地／天氣類、電磁波／鬼火類控場、鼓舞（隊友攻速）。
- 讓分工有價值：遠程怪、地面持續傷害區；隊伍組成小加成。
- 關卡目標（護送／守點／限時擊殺）、Boss 機制（預警範圍、召喚、階段）、裝備與道具詞綴。
- 每寶可夢專屬招式表：可用 PokeAPI 的 `pokemon/{id}.moves` 對應到我們的招式類型。

## 6. 專案文件（Claude Projects「PokemonPOE」，路徑 `claude/…`）
`pokemonpoe-decisions.md`、`-m1-notes.md`、`-loadout-tab.md`、`-abilities-design.md`、`-abilities-impl.md`、`-coop-link.md`、`-support-moves.md`、`pokesurvivor-analysis.md`。
