# PokemonPOE

非營利的寶可夢倖存者遊戲,加入 **Path of Exile 風格的招式插槽(Socket)** 玩法。
基於 [PokéSurvivor](https://github.com/JPTER78/pokesurvivor)(作者 JPTER78)改造。

> 目前是 **M1 原型**:只實作了招式插槽系統,其餘維持原版 PokéSurvivor。

## 怎麼玩

### 方法一:本機直接開(最簡單)
1. 下載這個 repo(Code → Download ZIP,解壓縮;或 `git clone`)。
2. 雙擊資料夾裡的 `index.html`,用 Chrome / Edge / Firefox 開啟。
3. 選「訪客」進入 → 做性格測驗 → 開始遊戲。

全部在本機執行,**不需要網路、不需要安裝任何東西**。存檔在瀏覽器的 localStorage(換瀏覽器或清除網站資料就會消失)。

### 方法二:GitHub Pages(線上玩)
1. 到 repo 的 Settings → Pages。
2. Source 選 `Deploy from a branch`,Branch 選 `main`、資料夾 `/ (root)`,按 Save。
3. 約一兩分鐘後網址為 `https://<你的帳號>.github.io/pokemonpoe/`。

### 方法三:自己改程式
- 遊戲原始碼頁是 `dev.html`(直接開就會載入各個 `js/` 檔,方便除錯)。
- 改完後執行 `node tools/build.js` 重新產生 `index.html` 與 `js/app.min.js`(需要 Node.js)。

## 操作

| 按鍵 | 動作 |
|---|---|
| WASD / 方向鍵 | 移動 |
| 1–4 | 切換主招式 |
| Q / E | 循環切換招式 |
| Esc | 暫停(在這裡管理插槽) |
| R | 升級畫面重抽 |

手機有虛擬搖桿與觸控按鈕。

## 招式插槽玩法

- 每個**主招式**有若干**插槽**,可以把其他招式鑲進去。
- 鑲進去的招式會和主招式**同時發動**(各自保有獨立冷卻)。
- 代價:鑲入的招式**不再佔主招位**,也不能單獨當主招使用。
- 插槽數依你的**局內等級**:**5 / 10 / 15 / 20 級各 +1 格**,每個主招式最多 4 格。
- 升級抽到「新招式」卡後,選擇放進**新的主招位**,或某個主招的**空插槽**。
- 隨時按 Esc 暫停,在「插槽」區可以插入、取下、移轉、把鑲入的招式設為主招。
- 原版的「羈絆」(打贏傳說寶可夢融合招式)已移除。

詳細設計與實作紀錄見 `docs/`。

## 與原版 PokéSurvivor 的差異

- 新增招式插槽系統,移除羈絆。
- Firebase 設定已設為 `null`:**預設是純本機模式**(沒有雲端帳號、排行榜、線上合作)。原版設定指向原作者自己的 Firebase 專案,不應在 fork 中沿用。若要線上功能,請自建 Firebase 專案(見 `docs/FIREBASE.md`)。
- 移除了原站的 `CNAME`(pokesurvivor.com)。
- 已知限制:合作模式下新招式自動放置;暫停畫面的插槽管理尚未美化、未做手機版;多語系新字串僅有英文與繁體中文。

原版 README 保留在 [`docs/README-pokesurvivor.md`](docs/README-pokesurvivor.md)。

## 授權與聲明

- 程式碼:[PolyForm Noncommercial 1.0.0](LICENSE-NONCOMMERCIAL.md),**僅限非商業使用**。必須保留下列聲明:

  `Required Notice: Copyright 2026 JPTER78 (https://github.com/JPTER78/pokesurvivor)`

- 圖片素材:CC BY-NC 4.0,需標示來源,詳見 [`CREDITS.md`](CREDITS.md)。
- Pokémon 及其角色名稱為任天堂 / Game Freak / The Pokémon Company 的商標與版權。本專案為粉絲自製的非營利作品,與上述公司無關,不得販售或用於營利。
- 本專案沒有任何加密貨幣、代幣或 NFT。
