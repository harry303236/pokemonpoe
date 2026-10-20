# PokemonPOE — 交接文件（2026-10-21）

非營利寶可夢遊戲，玩法朝 Path of Exile 式的 build 深度發展。
由 PokéSurvivor（原生 JS 瀏覽器遊戲）fork 而來。**使用者偏好繁體中文溝通**；程式碼註解與遊戲內來源字串為西班牙文。

明天若換人接手，先讀第 0 節與第 5.1 節。第 0 節是 2026-10-21 已寫進原始碼、尚未發布的改動。第 5.1 節是同一天晚上的玩法討論，尚未寫程式。更後面的流派發想（化學反應、特性配招）寫在 `發想-流派.md`，那份是給不同 agent 接著討論用的，不是已決定的規格。第 2 節以後是更早完成、仍然有效的功能。`README.md` 與 `GDD.md` 仍描述舊的「每個主招 4 孔」，不要照那兩份把程式改回去。`js/data/changelog.js` 裡 2026-10-20 那句「cada ataque principal gana una ranura en Nv.5, 10, 15 y 20」是歷史紀錄，不要改寫。

## 0. 2026-10-21 尚未發布的改動

兩件事都在使用者本機的原始碼裡。**沒有**執行 `tools/build.js`，**沒有** commit、push。`index.html`、`js/app.min.js`、`tools/cache/app.js`、`version.json` 仍是舊的 4-4-4-4 插槽。測功能開 `dev.html`。不要手改那三個產物。

### 0.1 輔助與嘲諷改為圖鑑可學才出現

輔助與嘲諷不再是全員共用池。某隻寶可夢的 `learnSet` 與升級卡只在它的全國圖鑑編號出現在官方學習名單時，才包含該輔助招。名單在 `js/data/support-learn.js`（`tools/fetch_support_learnsets.py` 從 PokeAPI 產生）。**遊戲執行時不要打網路。** 缺名單時 `supportFor` 回空陣列，不會退回「所有人都能學」。

`dev.html` 必須先載入 `js/data/support-learn.js`，緊接在 `js/data/moves.js` 之前。`moves.js` 載入當下就把 `G.SUPPORT_LEARN` 抄進 `SUPPORT_WHO`。

- 傷害池仍按屬性（`poolFor`：本體屬性 + 一般系）。開局招、禁用招用 `poolFor`，輔助不是免費的開局攻擊。
- 只看**當前種族**，不把進化系聯集進來。全國編號 1–1025。進化時不要剝掉已經學會的招。
- 電磁波（`thunder-wave`，kind `stun`）仍是電系傷害招，在控場分類，走前排。會打人的鬼火（`will-o-wisp`，kind `turret`）也是前排傷害招。不造成傷害的灼燒是 `spirit-burn`（Llama Espectral），走後排，學習者沿用官方鬼火名單。
- 守住幾乎人人有（官方 TM，約 1003 種）是資料正確，不是 bug。皮丘／皮卡丘官方會求雨，也是對的。小拉達、鯉魚王輔助為 0。小火龍／噴火龍有大晴天、沒有求雨；傑尼龜／水箭龜有求雨、沒有大晴天。
- 圖鑑提示（西文來源，已進字典）：「點一個招式來看它做什麼。輔助招只有這隻寶可夢真的學得會才會出現。」

21 個 `support: true` 的 id：`recover`、`heal-pulse`、`life-dew`、`heal-bell`、`protect`、`reflect`、`light-screen`、`aurora-veil`、`iron-defense`、`taunt`、`follow-me`、`tailwind`、`wish`、`synthesis`、`sunny-day`、`rain-dance`、`grassy-terrain`、`electric-terrain`、`glare`、`spirit-burn`、`coaching`。

不是 support、但分欄時要特別看的 buff：`swords-dance`（patk）、`nasty-plot`（satk）、`dragon-dance`（patk）、`agility`（spd）走前排；`harden`（def）走後排；`aqua-ring`（regen）算治療。

輔助數值是初估，不要順手重調。第二批已定的數字：祈願 cd 16、amount 0.42、delay 3.5、radius 180；光合作用 cd 12、amount 0.26；大晴天／求雨 cd 24、dur 16；青草場地治療 amount 0.028、dur 8、radius 170、cd 14；電氣場地攻速 amount 0.18、同樣時間；瞪眼麻痺 cd 9、radius 200、stun 1.3；靈焰灼燒 cd 8、radius 180、burn 2；鼓勵 amount 0.22、dur 6、radius 420、cd 14。

施放引擎在 `js/systems/support.js` 與 `js/systems/combat.js`（support kind 在 switch 前就 return）。不要把輔助的 `reset` 重新綁回 `clearFields`。天氣由房主權威。合作的 ghost 施放維持原樣。

### 0.2 插槽改成 4／3／2／2，孔跟「鍵」走

使用者要的配置（「20 等就滿格」）。孔數屬於鍵欄（index 0–3），不屬於招式。交換兩條主招會交換整組，上限留在原欄。治療不能拖到第 1 鍵去拿 4 孔。到達的那組若已鑲的招比目的地上限多（`group.length - 1 > destCap`），拒絕這次交換或移動。

`Player.SOCKET_PLAN`（快取在 `Player._SOCKET_PLAN`）：

| 等級 | 鍵 1（index 0） | 鍵 2（1） | 鍵 3（2） | 鍵 4（3） |
| --- | --- | --- | --- | --- |
| 5 | 1 | 1 | — | — |
| 10 | 2 | 2 | 1 | — |
| 15 | 3 | 3 | 1 | 1 |
| 20 | 4 | 3 | 2 | 2 |

存成 `[[5,10,15,20],[5,10,15],[10,20],[15,20]]`。25 級以後不再加。`socketCap(which)` 接受欄 index 或該欄目前的 group；沒傳、或傳了不在 `slots` 裡的東西，回 0。`socketMax(i)` 是該欄最終孔數。舊的 `SOCKET_EVERY`、`SOCKET_MAX`、`placements()` 已從原始碼移除。`js/ui/run-ui.js` 約第 238 行的註解還提到 `placements()`，那條 `showPlace` 已經沒人呼叫，可留著。

5／10／15／20 級都會開到某一欄的孔，提示仍是 `G.T('¡Nueva ranura!')`（已譯「新插槽！」）。這是插槽解鎖，不是「那一鍵在解鎖前不存在」。第 3、4 鍵可以先放主招、孔還沒開（例如 6 級把守住放在第 3 鍵，10 級才有第 1 孔）。

**前排（index 0、1）**「跟這個鍵一起打」：

- 傷害招，含電磁波、會打人的鬼火。
- 加攻：劍舞、詭計、龍之舞。
- 速度／攻速：高速移動、順風、鼓勵、電氣場地。
- 強化屬性傷害的天氣：大晴天、求雨。

同一組可以是噴射火焰 + 劍舞 + 大晴天。一起發動，各自冷卻。

**後排（index 2、3）**「自己按的另一個工作」：

- 治療：祈願、光合作用、自我再生、治癒波動、生命水滴、治癒鈴聲，加上水流環（`aqua-ring`，buff `regen`，不是 `support:true`）與青草場地（`grassy-terrain`，field `heal`）。這些不能鑲進攻擊，不能邊打邊回。
- 生存：守住、反射壁、光牆、極光幕、鐵壁、變硬。
- 嘲諷：挑釁、看我嘛。
- 不造成傷害的控場：瞪眼、靈焰。

**整套最多一個治療，而且只能當第 3 或第 4 鍵的主招（`group[0]`）。** 它的插槽可以是守住、反射壁、挑釁，不能是第二個治療、攻擊或劍舞。治療不能當插槽。把治療從主招換進插槽的 promote 要拒絕。後排若主招是守住、插槽是挑釁，promote 可以。

加攻、速度、大晴天、求雨只放前排。放後排的話只有按下第 3／4 鍵才會發動，使用者不要這樣。

分類不要用 `roleOf`（順風的 role 是速度卻走前排；青草場地的 role 是場地卻是治療；大晴天／求雨的 role 是場地卻走前排）。用 `G.Moves.homeOf`，回 `'front'`、`'back'` 或 `'heal'`。`heal` 是後排的子情況。`instance()` 會把 `kind`、`stat`、`support`、`field`、`id` 抄到實例上，所以 id 與實例都能丟進 `homeOf`。`fitsColumn(id, col)` 只看家族：前排 `col < 2`，後排／治療 `col >= 2 && col < 4`。它**不知道**場上已經有一個治療；一個治療 id 對第 3 和第 4 鍵都算 fits。真正的「只能一個、且必須是主招」在 `Player.moveFits`。

前排加攻上限：`buffs >= 2 && isFrontBuff` 才不再提供。算進這 2 的是劍舞、詭計、龍之舞、高速移動。變硬、水流環不算。上限只在發卡時檢查，`learnInto` 不再查一次。`G.DEV_SUPPORT` 仍把輔助卡權重從 0.6 拉到 8，放置規則照舊。前排輔助（順風、大晴天、求雨、鼓勵、電氣場地）也是這個權重。

### 0.3 放置、稀疏欄、快捷鍵

欄 index 就是按鍵 1–4。中間可以是洞（`slots[i] = null`）。不要 `splice` 把後面的欄往前擠，那樣會偷走別欄的孔數上限。`padSlots()` 補到 `maxMoves`（4）。`arrange()` 寫出長度 4 的陣列，不要裁掉尾端的 null。`groupOf`／`hasFreeSocket`／`freeSockets` 要跳過 null。

`placeHome(id)` 取代舊的 `placements()`，給升級自動學招用：

1. 先找該家族的空主招欄（前排 0 再 1；後排／治療 2 再 3）。
2. 治療永不進插槽。其他招再找該家族有空孔的組。
3. 沒有合法位置就回 null，升級卡不要提供這招（`levelup.js` 的 pool 有 `!!pl.placeHome(id)`）。

因此：場上只有 1 招時學到治療，不能掉進前排。第 3 個攻擊在 5 級前（前排孔還沒開、兩格主招都滿）不提供；5 級後鑲進前排，不會變成第 3 鍵。`canLearn()` 不帶 id，給屬性卡權重用（`w: pl.canLearn() ? 4 : 7`）：任一欄是空的，或任一組還有空孔，就是 true。

`addMove` 只接受 `placeHome` 回 `{kind:'slot'}` 的新主招。插槽要走 `learn` → `learnInto`。`game.js` 的 `learn(id)` 先 `placeHome`，再 `place`：slot 呼叫 `addMove`，socket 呼叫 `learnInto`。開局招仍是 `addMove(startMove)`，第二招從 `poolFor` 排除 `kind === 'buff'`。

`learnInto` 與 `addMove` 會呼叫 `arrange()`。Tab 上的拖曳、插入、拔出、轉移、promote **不**呼叫 `arrange`，所以手動排好的盤面不會立刻被拽回去；下一次學招的 `arrange` 會再套用快捷鍵。這是故意沿用舊的 `addMove` 行為。

`arrange()` 不壓緊洞。家族優先於快捷鍵（`save.pbind`）。綁定的欄過不了 `groupFits` 就忽略（治療綁第 1 鍵、攻擊綁第 4 鍵）。未綁或綁了不合法的組，先留原 index，再試家族欄 `[0,1]` 或 `[2,3]`。真的沒有合法欄時不要丟掉這組：原 index 還空著就留著，否則放進第一個空欄（這時可能家族不對，只在綁定加孔數把合法佈局堵死時發生）。

`dropMove(m, to, dry)`：

- `{ move: t }`：兩組都要 `groupFits` 才交換。兩個主招對調整組（含插槽）。同組裡把治療主招與它的插槽對調會失敗。5 級以上、長度 5 的前排組不能換到上限 3 的第 2 鍵。治療主招不能與攻擊主招對調。
- `{ group: g }`：單獨的主招（`length === 1`）才能插入；已經在插槽裡的用 transfer。都要 `moveFits(..., false)`。主招自己還帶著插槽時不能再被鑲進去，要先拔掉。來源欄設成 null，不 splice。
- `{ column: n }`：只對空欄。拖的是主招就整組搬走（`groupFits`）。拖的是已鑲的招，用 `eject` 變成新主招，且 `moveFits(..., true)`。
- 舊的 `{ newSlot: true }` 已刪。空主招格是 `data-col` → `{ column }`。空插槽只有該欄已有主招才是 `data-gi`。
- `dry === true` 不能改資料。`markTargets` 用它把放得進去的格子加上 `.ok`。

`promote(m)` 只在同一組內對調，且對調後的組要 `groupFits`。不呼叫 `arrange`，所以不會換欄。

`setActive` 在選擇環之前就對 null／空欄 return。`cycle` 在 4 欄裡跳過洞。數字鍵 1–4 仍是 `setActive(i)`，畫面上的位置必須等於鍵號。HUD（`hud.js`）按 index 畫：`n = 最後一個有招的 index + 1`，尾端的空欄不畫。空欄不接觸控，畫一個暗的鍵號後就 continue。有招的欄只畫 `socketCap(i)` 個已開的孔，不畫鎖定孔，也不畫成每欄 4 個。

快捷鍵面板（`menu.js` `bindPanel`）的下拉只列 `learnSet(mon).filter(id => fitsColumn(id, col))`，所以祈願可以固定在第 3 鍵。存檔裡家族不對的 id 在打開面板時清掉並 `G.DB.commit()`。`db.js` 消毒 pbind 時同樣用 `fitsColumn` 丟棄。onchange 仍會清掉重複 id。

### 0.4 畫面上長什麼樣

Tab 配置的字串寫死在 `js/ui/loadout-ui.js` 的 `TXT`（zh-Hant、es、en），不走西班牙文 `G.T` 字典。zh-Hans 沿用現有 `dict()`，落到 zh-Hant。局內升級提示仍是 `G.T('¡Nueva ranura!')`。

欄標題：`輸出 4孔`／`輸出 3孔`／`職能 2孔`／`職能 2孔`（en `Attack 4`／`Role 2`，es `Ataque 4`／`Oficio 2`）。頂部是 `Lv.N` 加上 `已開 0·0·0·0／4·3·2·2`。鎖定格顯示該欄自己的解鎖等級（`SOCKET_PLAN[col][k]`），第 2 鍵沒有第四個 Lv.20，第 3 鍵是 Lv.10 與 Lv.20，第 4 鍵是 Lv.15 與 Lv.20。孔已開但欄是空的，顯示「先放主招」（`needMain`），不是再寫一個 Lv.5，而且那格不能當放置目標。1 級時孔都還沒開，所以空欄看到的是鎖，不是「先放主招」。

CSS：`.lo-col.job` 的綠底寫在 `.lo-col.active` **之前**，使用中的金框才蓋得過。

升級面板的西班牙文提示（DOM 裡的整句，給 i18n 當 key）已換成前後鍵分工的說明。舊句留在字典裡，舊版客戶端還翻譯得到。對應的繁中、簡中在 `js/data/lang-support.js`，英文在 `js/data/lang-en.js`。`node tools/build_langs.js` 已跑過（2026-10-21），`js/lang/zh-Hant.js` 與 `zh-Hans.js` 含新的快捷鍵句與更新日誌句。不要手改 `js/lang/*`。長度 ≥ 4 的 key 會被當成片段替換，新的通用字典 key 不要用短的常用詞。

`changelog.js` 的 2026-10-21 `chg` 已有西／英對照的插槽條目。繁中新聞走 `G.T(西班牙文)`，所以要字典裡有同一句西班牙文。

### 0.5 改過的檔

- `js/data/moves.js`：`homeOf`、`fitsColumn`、`isFrontBuff`，以及既有的 `supportFor`／`learnSet`。
- `js/data/support-learn.js`、`dev.html` 的 script 順序（輔助名單；插槽那次沒再改 `dev.html`）。
- `js/entities/player.js`：`SOCKET_PLAN`、`socketCap`、`socketMax`、`placeHome`、`moveFits`、`groupFits`、`arrange`、`dropMove`、`learnInto`、`addMove`、稀疏 `slots`。
- `js/game.js`：`learn`／`place`、`announceSocket`。
- `js/systems/levelup.js`：發卡過濾。
- `js/ui/hud.js`、`js/ui/loadout-ui.js`、`css/style.css`。
- `js/ui/menu.js`、`js/core/db.js`：快捷鍵家族。
- `js/ui/run-ui.js`：死掉的 `showPlace` 改呼叫 `socketCap(o.group)`。
- `js/data/changelog.js`、`js/data/lang-en.js`、`js/data/lang-support.js`、`js/lang/zh-Hans.js`、`js/lang/zh-Hant.js`（後兩個是 build 產物）。

合作的 ghost `netUpdate` 仍是 `this.slots = [this.moves.slice()]`（密陣列、長度 1）。本機 HUD 用 `G.Game.player`。不要為了稀疏欄去改 ghost。`js/core/i18n.js` 約第 141 行的 `p.slots` 是翻譯模板的槽，不是玩家的招式欄。

### 0.6 已驗證、還沒做

已驗證：

- 規則腳本（已刪，不在磁碟上）涵蓋分類、1／5／10／15／20／25 級的孔數、治療只能當第 3 或第 4 鍵主招、5 級前不提供第三個攻擊、5 級後鑲進第 1 鍵、兩個前排加攻之後不再提供第三個、非法快捷鍵被忽略、`cycle` 跳過洞、乾跑拖曳不改資料、滿孔的組不能換到第 2 鍵。
- 瀏覽器（`dev.html`、繁中、訪客、皮丘、1 級、Tab）：標題「技能配置」，「已開 0·0·0·0／4·3·2·2」，四欄「輸出 4孔／輸出 3孔／職能 2孔／職能 2孔」，鎖定等級與上表一致。點「電擊」之後只有第 2 鍵的空主招位帶 `.ok`，第 3、第 4 鍵不亮。無頁面錯誤。測完已關掉本機的 `python -m http.server`（8765）。

還沒在瀏覽器裡看過：升到 5 級以後孔真的打開、治療實際落在第 3 鍵、拖一個不合法的招再鬆開。那些走的是同一套 `dropMove`／`placeHome`，規則腳本過了。REA 的瀏覽器情境不能呼叫 `G.Game.debugLevelUp()`。

發布時才做：拿掉 `dev.html` 的 `devcheat.js` 再 `node tools/build.js && node tools/export_data.js && python tools/make_seo_pages.py`。使用者沒有要求發布。commit 訊息不要加 Co-Authored-By 或任何 AI 署名。使用者要求時才 push。本機資料夾不是 git 倉庫。

## 1. 工作方式

- 倉庫：`github.com/harry303236/pokemonpoe`，分支 `main`。
- 讀 `CLAUDE.md`（原作者的規則，仍適用）：
  - 只改 `dev.html`，`index.html` 是產物。
  - 發佈：`node tools/build.js && node tools/export_data.js && python tools/make_seo_pages.py`（build 會產生 `index.html`、`js/app.min.js`、`version.json`）。
  - **commit 訊息不加 Co-Authored-By 或任何 AI 署名**。使用者要求時才 push。
  - 每個遊戲改動要寫進 `js/data/changelog.js`（西／英，當天的 `new`／`chg`／`fix`）。伺服器、資料庫、費用不要寫進去。
  - 自動更新要留著：`js/core/updater.js` 每 5 分鐘看 `version.json`。局外 5 秒後重載（抽卡、強化商店、設定、正在打字時要等）；局內不動，回主選單再重載；重載前先把未上傳的雲端存檔送出。不要刪 `updater.js`，也不要拿掉 `tools/build.js` 寫 `version.json` 的那段。
  - Firebase 專案是 **pokesurvivor-free**。不要開啟 Identity Platform，也不要開任何會打開它的東西（阻擋函式、MFA、「更新以啟用」），那會依使用者計費。本機這份的 `js/core/firebase-config.js` 維持 `null`（純本機）。Cloudflare 只留網域 pokesurvivor.com；合作是 WebRTC 加 Google 的免費 STUN，不要加回付費 Worker 或 TURN。
  - `js/main.js` 的 `MAINTENANCE` 為 false 時大家進得去；`?dev` 可在維護中進入。
- 全域物件 `G`。`dev.html` 依序載入約 80 支 script，順序有意義。
- 字串以西班牙文為 key。英文在 `js/data/lang-en.js`（直接載入）。繁中／簡中等寫在 `js/data/lang-support.js` 等來源，改完跑 `node tools/build_langs.js` 產生 `js/lang/*.js`。fr／it／pt 目前沒翻這批新字串。
- 使用者本機資料夾（`C:\Users\Harry\Downloads\pokemonpoe-main\pokemonpoe-main`）**不是 git 倉庫**。改的是這個資料夾。若要 push，得先同步回真正的 clone。
- 本機 `dev.html` 最後一行是 `js/core/devcheat.js`（`DEV_CHEAT`：金幣全滿、全寶可夢、`G.DEV_XP = 10`、`G.DEV_SUPPORT`、跳過人格測驗，同伴會是皮丘）。倉庫與正式版不應含這支。build 前先拿掉那行，build 完再放回。
- 瀏覽器有 service worker。測 `dev.html` 時要擋 service worker，否則會看到舊的 `index.html` 行為。
- 部分檔案是 CRLF。用程式 patch 時要處理 CRLF。
- 不要刪 `tools/_p/`，也不要刪使用者本機的 `整理特性資料.bat`。

## 2. 更早完成、仍然有效

| 功能 | 說明 | 主要檔案 |
| --- | --- | --- |
| 開發作弊 | 見第 1 節，僅本機 `dev.html` | `js/core/devcheat.js` |
| Tab 插槽配置 | **規則以第 0.2 節為準**（4／3／2／2，前後鍵分工）。按 Tab 拖放。升級學新招自動放入，不彈窗 | `js/ui/loadout-ui.js`、`player.js`、`game.js` |
| 局內進化 | Lv.8、Lv.15 進化，有分支時玩家選；開局用該線的基礎型態 | `js/systems/evolution.js`、`js/data/evolutions.js`、`game.js` `startEvolution` |
| 特性系統 | 271 個特性（僅最終型態；不進化者 Lv.10 選），一次一個 | `js/systems/abilities.js`、`js/data/ability-fx.js`、`js/data/abilities.js` |
| 輔助招式 | **誰學得到以第 0.1 節為準**（21 招，圖鑑名單）。施放、治療、護盾、天氣、場地、控場、攻速的引擎不要推倒重寫 | `js/systems/support.js`、`js/data/moves.js` |
| 好友連線（免後端） | 邀請碼來回；WebRTC 直連＋Google STUN，無 TURN，最多 4 人 | `js/net/link.js`、`net.js`、`social.js`、`social-ui.js` |
| 多人中的進化／特性 | **現況是合作中直接跳過**：`startEvolution` 與 `startAbilityChoice` 在 `G.Coop.active` 時 `return false`（程式裡標了 TODO）。不要自行把合作範圍擴大 | `game.js` |

### 輔助招式在多人裡怎麼套用

不新增網路事件。隊友施放走既有 `['c', …]` 施放事件，本機以 ghost 判斷自己是否在半徑內並套用到自己。嘲諷記在 ghost 玩家上，因為敵人 AI 在房主端（`enemy.js` 的 `nearestPlayer` → `G.Support.taunter`）。

## 3. 測試方法

- 本機：一個 `python -m http.server 8765 --bind 127.0.0.1`，開 `http://127.0.0.1:8765/dev.html`。不要並行開好幾個瀏覽器打同一個單執行緒的 http.server，Windows 上容易變成兩個監聽、導覽失敗。測完把 server 關掉。
- 開局：等 `#boot.hidden`，點 `#tap-start`（無頭 Chrome 的音訊不會自動開，這層會蓋住畫面），再 `#btn-guest`，再 `button.menu-item.play[data-go="play"]`。繁中可先寫 `localStorage['ps.lang']='zh-Hant'`。
- `G.Game.debugLevelUp()` 可強制升級；`G.Game.player` 上可直接呼叫 `learn` 路徑要走 `G.Game.learn(id)`，只呼叫 `addMove` 不會把招鑲進插槽。
- 特性模擬：`node tools/test_abilities.js`。
- **尚未做**：兩台不同網路的真機連線；輔助招式的手感與平衡；第 0.6 節列的高等級瀏覽器路徑。

## 4. 已知問題／待辦

1. **正式版過期**：原始碼比 `index.html` 新。發布要重新 build（拿掉 devcheat），並在使用者要求時才 push。
2. 輔助招式數值仍是初估，見第 0.1 節。HUD 尚未顯示護盾量。fr／it／pt 沒有這批新字串。
3. 特性待平衡：Huge Power、Pure Power、Adaptability、Wonder Guard、Supreme Overlord（第三級）。
4. 圖鑑與官方 1025 的差距尚未逐隻列出。`support-learn.js` 只收到 1–1025。
5. 連線：對方直接關分頁要數秒到數十秒才偵測到；嚴格 NAT 可能連不上。
6. 本機模式存檔在各自瀏覽器的 localStorage。雲端存檔屬於 pokesurvivor-free，不要在這個 fork 裡打開計費功能。
7. `README.md`、`GDD.md`、更新日誌 2026-10-20 的插槽句是舊規則。
8. `arrange` 在綁定把合法欄全部堵住時，會把組放到家族不對的空欄，以免招式消失。正常對局不該走到這步。

## 5. 路線圖（討論過、尚未做的）

- 定位由身上的招決定，不另設職業。這部分的前後鍵分工已在第 0.2 節落地。
- 讓分工有價值：遠程怪、地面持續傷害區；隊伍組成小加成。
- 關卡目標（護送／守點／限時擊殺）、Boss 機制、裝備與道具詞綴。
- 傷害招目前仍是屬性池，不是每隻的官方招式表。輔助已經是官方名單。

裝備、技能樹先不要做。2026-10-21 晚上的結論在第 5.1 節，優先於本節的裝備與關卡目標。後續發想全集在 `發想-流派.md`。

## 5.1 2026-10-21 晚：玩法討論（明天從這裡接著，尚未寫程式）

使用者要的是 POE 融合寶可夢的玩法與趣味，不是再堆系統。討論時程式維持第 0 節的狀態，下面都還沒做。使用者沒有在「先做換鍵節奏」和「先做同一組相乘」之間選定，就休息了。建議的下一輪是把三件小的一起做，等他明天確認。

現況（實作已如此，`js/systems/combat.js` 的 `tick` 只跑 `activeGroup()`）：

- 第 1、2 鍵是兩組會一起放的技能。第 3、4 鍵是要自己按的藥劑，不是修改主招的輔助寶石。使用者先前已選過後排插槽是再放輔助招，不要做成升級寶石。
- 只有正在用的那一鍵會施放。切去祈願或守住時，輸出整組停下來。劍舞、天氣這類已經加上的效果會持續到它們自己的時間結束（`addBuff` 的 `dur`、天氣的 `left`）。
- 這就是 POE 藥劑：按一下，再切回輸出。單人這樣玩。合作時可以有人站在第 3 鍵當治療，因為他的輸出組不會同時跳。
- 現在的缺口是兩件事：為什麼要換鍵，以及插在同一組為什麼比分開強。怪若只靠走位就能清，玩家會一直站在第 1 鍵。

明天若做，按這個順序，先不要加技能樹、裝備詞綴、魔力：

1. **換鍵要有代價，而且按完能立刻切回去。** 後排做成「現在不按會痛」。祈願（先放、人已切回輸出才跳血）和守住（當下擋一下）是對的形狀。不要做要站在治療鍵上一直引導的治療，單人等於整段沒有輸出。場上偶爾一種看得到前搖的精英就夠，例如蓄力撞過來，開守住就擋掉，沒開就掉一大截血。先不要上一整套詞綴怪。
2. **畫面上能看到劍舞和天氣還剩幾秒。** 玩家才知道有空檔切去後排，以及該在增益結束前切回來。護盾量仍未顯示（第 4 節），這次先做這兩個計時。
3. **同一組的增益要乘在這一組的傷害招上，並在 Tab 配置寫一行人話。** 例如「大晴天：這組的火系更痛」、「劍舞：這組的物理招更痛」、「求雨：這組的水系更痛」。全域天氣可以留著，但插在同一鍵裡的那一份要明顯更強。這樣 4 孔和 3 孔才是配裝。不要把插槽改成 POE 那種改變技能形態的輔助寶石。

第 2 鍵的用法也定了方向：它是另一個答案（清群用第 1 鍵，打高防禦或剋屬用第 2 鍵），不是一個只加攻、自己不打人的鍵。增益放在玩家真正站著打的那一組。升級時偶爾明確給「另一個輸出鍵」的招，否則第 2 鍵會永遠不按。

個體差異先不要匯入整份官方傷害招式表。輔助已經是圖鑑名單。下一步若要每隻不一樣，先給每隻 2、3 個招牌招進升級池。

刻意先不做：被動技能樹、裝備詞綴、魔力。這些會變成第二套成長，蓋過玩家還沒摸熟的 4 個鍵。第 5 節的關卡目標、Boss、裝備留到這三件小的做完、使用者覺得換鍵有趣之後。

## 6. 舊的專案筆記

Claude Projects「PokemonPOE」裡還有 `pokemonpoe-decisions.md`、`-m1-notes.md`、`-loadout-tab.md`、`-abilities-design.md`、`-abilities-impl.md`、`-coop-link.md`、`-support-moves.md`、`pokesurvivor-analysis.md`。其中 loadout 與「輔助人人可學」的說法已被本檔第 0 節取代。
