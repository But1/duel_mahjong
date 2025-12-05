// 常數與全域變數
const TILES = [
    "🀇","🀈","🀉","🀊","🀋","🀌","🀍","🀎","🀏", 
    "🀙","🀚","🀛","🀜","🀝","🀞","🀟","🀠","🀡", 
    "🀐","🀑","🀒","🀓","🀔","🀕","🀖","🀗","🀘", 
    "🀀","🀁","🀂","🀃","🀆","🀅","🀄"          
];

const mjLogic = new MahjongLogic(); // 實例化邏輯物件

let deck = [], deadWall = [];
let doraIndicator, uraDoraIndicator;
let uraRevealed = false;

let players = {
    user: { hand: [], melds: [], river: [], score: 30000, isTenpai: false, waits: [], calculatedWaits: [] },
    ai: { hand: [], melds: [], river: [], score: 30000, isTenpai: false, waits: [] }
};
let turn = 'user', phase = 'A';
let attacker = null, defender = null;
let drawCount = 0, maxDraws = 5;
let pickerMode = '', selectedTiles = [];
let pendingDiscard = null, pendingDiscarder = null;

// --- Init ---
function resetFullGame() { players.user.score = 30000; players.ai.score = 30000; startNewRound(); }

function startNewRound() {
    let allTiles = [];
    for(let i=0; i<34; i++) for(let j=0; j<4; j++) allTiles.push({id: i, char: TILES[i], uid: i*4+j});
    deck = shuffle(allTiles);
    deadWall = deck.splice(0, 14);
    doraIndicator = deadWall[4]; uraDoraIndicator = deadWall[5];
    uraRevealed = false;

    players.user.hand = []; players.user.melds = []; players.user.river = []; 
    players.user.isTenpai = false; players.user.waits = []; players.user.calculatedWaits = [];
    players.ai.hand = []; players.ai.melds = []; players.ai.river = []; 
    players.ai.isTenpai = false; players.ai.waits = [];

    turn = 'user'; phase = 'A';
    attacker = null; defender = null;

    for(let i=0; i<13; i++) { drawTile('user'); drawTile('ai'); }
    sortHand('user'); sortHand('ai');
    drawTile('user'); 

    document.getElementById('next-round-btn').style.display = 'none';
    resetDoraUI(); updateUI();
    showStatus("Phase A: 你的回合");
    // 不再直接 enable，交由 updateUI 中的 checkTenpai 判斷
    closePicker(); hideNakiButtons();
}

function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

// --- Round End ---
function onRoundEnd() {
    revealAIHand();
    document.getElementById('next-round-btn').style.display = 'block';
    showStatus("本局結束。請檢討牌局，準備好後點擊按鈕。");
    document.getElementById('btn-tenpai').disabled = true;
    hideNakiButtons();
}

// --- Dora ---
function getNextDora(id) {
    if(id <= 8) return (id === 8) ? 0 : id + 1;
    if(id <= 17) return (id === 17) ? 9 : id + 1;
    if(id <= 26) return (id === 26) ? 18 : id + 1;
    if(id <= 30) return (id === 30) ? 27 : id + 1;
    return (id === 33) ? 31 : id + 1;
}
function isDora(tileId) {
    if(tileId === getNextDora(doraIndicator.id)) return true;
    if(uraRevealed && tileId === getNextDora(uraDoraIndicator.id)) return true;
    return false;
}
function resetDoraUI() {
    const d = document.getElementById('dora-indicator'); d.innerText = doraIndicator.char; d.classList.remove('hidden');
    document.getElementById('ura-dora-container').style.display = 'none';
}
function showUraDora() {
    uraRevealed = true;
    const u = document.getElementById('ura-dora-indicator'); u.innerText = uraDoraIndicator.char; u.classList.remove('hidden');
    document.getElementById('ura-dora-container').style.display = 'block'; 
    document.getElementById('ura-dora-container').style.opacity = '1';
    updateUI();
}

// --- Core Logic ---
function drawTile(who) {
    if(deck.length === 0) return null;
    const tile = deck.pop(); players[who].hand.push(tile); return tile;
}
function drawRinshan(who) {
    if(deadWall.length === 0) return null;
    const tile = deadWall.pop(); players[who].hand.push(tile); return tile;
}
function sortHand(who) { players[who].hand.sort((a,b) => a.id - b.id); }

function revealAIHand() {
    const aiDiv = document.getElementById('ai-hand'); aiDiv.innerHTML = '';
    players.ai.hand.sort((a,b) => a.id - b.id);
    players.ai.hand.forEach(tile => {
        let d = document.createElement('div'); d.className = 'tile'; 
        if(isDora(tile.id)) d.classList.add('dora-tile');
        d.innerText = tile.char; d.style.boxShadow = "0 0 5px yellow";
        aiDiv.appendChild(d);
    });
}

function handleTileClick(index) {
    if(phase !== 'A' || turn !== 'user') return;
    const discarded = players.user.hand.splice(index, 1)[0];
    players.user.river.push(discarded);
    sortHand('user'); 
    
    // 玩家打出牌後，聽牌按鈕應該禁用 (直到下一輪摸牌或吃碰後)
    document.getElementById('btn-tenpai').disabled = true;
    updateUI(); 
    
    pendingDiscard = discarded; pendingDiscarder = 'user';
    if(checkDraw()) return;

    if(aiCheckCall(discarded)) {
        showStatus("AI 鳴牌!");
        setTimeout(() => {
            aiExecuteCall(discarded);
            turn = 'ai'; setTimeout(aiDiscardPhase, 1000);
        }, 800);
    } else {
        turn = 'ai'; showStatus("AI 思考中..."); setTimeout(aiTurn, 800);
    }
}

function aiTurn() {
    if(phase !== 'A') return;
    drawTile('ai');
    // 簡單 AI 聽牌判定：這裡暫時還是用隨機，之後可以接上 mahjong-logic
    if(!players.ai.isTenpai && Math.random() < 0.08 && deck.length > 10) {
        aiDeclareTenpai(); return;
    }
    aiDiscardPhase();
}

function aiDiscardPhase() {
    const discardIdx = Math.floor(Math.random() * players.ai.hand.length);
    const discarded = players.ai.hand.splice(discardIdx, 1)[0];
    players.ai.river.push(discarded);
    updateUI();
    
    if(checkDraw()) return;

    pendingDiscard = discarded; pendingDiscarder = 'ai';
    const canChi = checkChi(players.user.hand, discarded);
    const canPon = checkPon(players.user.hand, discarded);
    const canKan = checkKan(players.user.hand, discarded);
    
    if(canChi || canPon || canKan) {
        showNakiButtons(canChi, canPon, canKan); showStatus("是否要鳴牌?");
    } else {
        proceedToUserTurn();
    }
}

function proceedToUserTurn() {
    turn = 'user';
    sortHand('user'); 
    drawTile('user'); 
    updateUI(); 
    showStatus("Phase A: 你的回合");
}

// --- Naki ---
function checkPon(hand, tile) { return hand.filter(t => t.id === tile.id).length >= 2; }
function checkKan(hand, tile) { return hand.filter(t => t.id === tile.id).length === 3; }
function checkChi(hand, tile) {
    if(tile.id >= 27) return false;
    let min, max;
    if(tile.id <= 8) { min=0; max=8; } else if(tile.id <= 17) { min=9; max=17; } else { min=18; max=26; }
    const ids = hand.map(t => t.id); const t = tile.id;
    const hasM2 = (t-2 >= min) && ids.includes(t-2);
    const hasM1 = (t-1 >= min) && ids.includes(t-1);
    const hasP1 = (t+1 <= max) && ids.includes(t+1);
    const hasP2 = (t+2 <= max) && ids.includes(t+2);
    return (hasM2 && hasM1) || (hasM1 && hasP1) || (hasP1 && hasP2);
}
function showNakiButtons(c, p, k) {
    const div = document.getElementById('naki-buttons');
    document.getElementById('btn-chi').style.display = c ? 'block' : 'none';
    document.getElementById('btn-pon').style.display = p ? 'block' : 'none';
    document.getElementById('btn-kan').style.display = k ? 'block' : 'none';
    div.style.display = 'flex';
}
function hideNakiButtons() { document.getElementById('naki-buttons').style.display = 'none'; }
function skipCall() { hideNakiButtons(); proceedToUserTurn(); }

function doCall(type) {
    hideNakiButtons(); players[pendingDiscarder].river.pop(); 
    if(type === 'PON') performPon('user', pendingDiscard);
    else if (type === 'KAN') performKan('user', pendingDiscard);
    else if (type === 'CHI') performChi('user', pendingDiscard); 
    sortHand('user');
    turn = 'user'; updateUI(); showStatus("鳴牌成功，請打出一張牌");
}

function performPon(who, tile) {
    const hand = players[who].hand; let removed = 0, newHand = [], meldTiles = [tile];
    for(let t of hand) { if(t.id === tile.id && removed < 2) { meldTiles.push(t); removed++; } else newHand.push(t); }
    players[who].hand = newHand; players[who].melds.push(meldTiles);
}
function performKan(who, tile) {
    const hand = players[who].hand; let removed = 0, newHand = [], meldTiles = [tile];
    for(let t of hand) { if(t.id === tile.id && removed < 3) { meldTiles.push(t); removed++; } else newHand.push(t); }
    players[who].hand = newHand; players[who].melds.push(meldTiles); 
    drawRinshan(who); 
}
function performChi(who, tile) {
    const hand = players[who].hand; let ids = hand.map(t => t.id); let t = tile.id;
    let min, max; if(t<=8){min=0;max=8;} else if(t<=17){min=9;max=17;} else {min=18;max=26;}
    let pairToEat = [];
    if(t-1>=min && t+1<=max && ids.includes(t-1) && ids.includes(t+1)) pairToEat = [t-1, t+1];
    else if (t-2>=min && t-1>=min && ids.includes(t-2) && ids.includes(t-1)) pairToEat = [t-2, t-1];
    else if (t+1<=max && t+2<=max && ids.includes(t+1) && ids.includes(t+2)) pairToEat = [t+1, t+2];
    let newHand = [], meldTiles = [tile], p1=false, p2=false;
    for(let tileObj of hand) {
        if(!p1 && tileObj.id === pairToEat[0]) { meldTiles.push(tileObj); p1 = true; }
        else if(!p2 && tileObj.id === pairToEat[1]) { meldTiles.push(tileObj); p2 = true; }
        else newHand.push(tileObj);
    }
    meldTiles.sort((a,b) => a.id - b.id);
    players[who].hand = newHand; players[who].melds.push(meldTiles);
}
function aiCheckCall(tile) { return checkPon(players.ai.hand, tile); }
function aiExecuteCall(tile) { players.user.river.pop(); performPon('ai', tile); updateUI(); }
function checkDraw() {
    if(deck.length === 0) { showInfo("流局", "牌山已空。", onRoundEnd); return true; }
    return false;
}

// --- Phase B ---
// [Updated] 修改聽牌宣告邏輯，使用自動計算
function openDeclareModal() {
    if(phase !== 'A' || turn !== 'user') return;
    
    // 使用 Logic 計算
    const waits = mjLogic.getWaitingTiles(players.user.hand);
    
    if (waits.length === 0) {
        alert("系統判定尚未聽牌，無法宣告！");
        return;
    }

    players.user.calculatedWaits = waits;
    pickerMode = 'DECLARE'; 
    selectedTiles = [...waits]; // 自動選中聽牌
    openPicker("宣告聽牌", `系統計算聽牌：${waits.map(id=>TILES[id]).join(' ')}。請確認並打出宣言牌。`);
}

function aiDeclareTenpai() {
    players.ai.isTenpai = true;

    // 1. [修正] AI 必須打出一張牌作為「宣言牌」
    // 這裡目前是隨機切牌 (因為 AI 尚無牌理邏輯)，之後可接上 mahjong-logic 來切出效率最高的牌
    const discardIdx = Math.floor(Math.random() * players.ai.hand.length);
    const discarded = players.ai.hand.splice(discardIdx, 1)[0];
    players.ai.river.push(discarded);

    // 2. 更新 UI，確保玩家能看到 AI 打出的這張宣言牌
    updateUI();

    // 3. 生成 AI 的聽牌列表 (目前仍是隨機生成用於 Phase B 測試)
    let count = Math.floor(Math.random() * 2) + 1; // 隨機聽 1 或 2 張
    players.ai.waits = [];
    while(players.ai.waits.length < count) {
        let w = Math.floor(Math.random() * 34);
        // 簡單防呆：聽的牌不應該是剛剛打出去的那張 (振聽)，且不重複
        if (w !== discarded.id && !players.ai.waits.includes(w)) {
            players.ai.waits.push(w);
        }
    }

    // 4. 彈出訊息通知玩家，並顯示打出了哪張牌
    showInfo("AI 宣告", `AI 打出「${discarded.char}」並宣告聽牌！\n準備進入 Phase B`, () => {
        attacker = 'ai';
        defender = 'user';
        startPhaseB();
    });
}

function startPhaseB() {
    phase = 'B_GUESS'; drawCount = 0; document.getElementById('btn-tenpai').disabled = true;
    hideNakiButtons(); updateUI();
    if(defender === 'user') { pickerMode = 'GUESS'; setTimeout(() => { openPicker("Phase B", "指出AI聽的牌"); }, 500); }
    else { showStatus("Phase B: AI 猜測中..."); setTimeout(aiGuess, 2000); }
}
function aiGuess() {
    const g1 = Math.floor(Math.random()*34); let g2 = Math.floor(Math.random()*34); while(g2===g1) g2=Math.floor(Math.random()*34);
    const hit = players.user.waits.some(w => [g1,g2].includes(w));
    let msg = `AI 指出: ${TILES[g1]} ${TILES[g2]}`;
    if(hit) showInfo("Phase B", `${msg}。AI 猜中了！(防守成功)`, onRoundEnd);
    else showInfo("Phase B", `${msg}。沒猜中！你獲得自摸機會。`, startDrawPhase);
}
function checkGuess(ids) {
    const hit = players.ai.waits.some(w => ids.includes(w));
    if(hit) { revealAIHand(); showInfo("Phase B", "你猜中了！(AI手牌公開)", onRoundEnd); }
    else showInfo("Phase B", "沒猜中... AI 自摸。", startDrawPhase);
}
function startDrawPhase() { phase = 'B_DRAW'; drawCount = 0; executeDrawLoop(); }
function executeDrawLoop() {
    if(deck.length === 0) { showInfo("流局", "牌山空了。", onRoundEnd); return; }
    if(drawCount >= maxDraws) { showInfo("自摸失敗", "機會用盡，攻守交換", () => startPhaseB()); return; }
    drawCount++;
    const tile = deck.pop(); updateUI();
    let msg = `${attacker==='user'?'你':'AI'} 第${drawCount}次自摸: ${tile.char}`;
    const isWin = players[attacker].waits.includes(tile.id);
    if(attacker === 'user') {
        if(isWin) {
            setTimeout(() => {
                if(confirm(`摸到 ${tile.char}！\n宣告自摸嗎？`)) { 
                    showUraDora(); showInfo("胡牌！", "自摸獲勝！", onRoundEnd); 
                } else { players.user.river.push(tile); updateUI(); setTimeout(executeDrawLoop, 500); }
            }, 100);
        } else { showStatus(msg + " ...未中"); players.user.river.push(tile); setTimeout(executeDrawLoop, 1000); }
    } else {
        showStatus(msg);
        if(isWin) { 
            players.ai.hand.push(tile); showUraDora(); revealAIHand(); 
            setTimeout(() => showInfo("敗北", `AI 自摸 ${tile.char}！`, onRoundEnd), 500); 
        } else { players.ai.river.push(tile); setTimeout(executeDrawLoop, 800); }
    }
}

// --- UI Update ---
function updateUI() {
    const userDiv = document.getElementById('user-hand'); userDiv.innerHTML = '';
    const needGap = (players.user.hand.length % 3 === 2) && (turn === 'user') && (phase === 'A');

    players.user.hand.forEach((tile, idx) => {
        let d = document.createElement('div'); d.className = 'tile';
        if(isDora(tile.id)) d.classList.add('dora-tile');
        d.innerText = tile.char; d.onclick = () => handleTileClick(idx);
        if(needGap && idx === players.user.hand.length - 1) d.style.marginLeft = "20px";
        userDiv.appendChild(d);
    });
    renderMelds('user', 'user-melds');

    const aiDiv = document.getElementById('ai-hand'); 
    if(document.getElementById('next-round-btn').style.display === 'none') {
        aiDiv.innerHTML = '';
        players.ai.hand.forEach(t => { let d = document.createElement('div'); d.className = 'tile hidden'; aiDiv.appendChild(d); });
    }
    renderMelds('ai', 'ai-melds');
    renderRiver('user', 'user-river'); renderRiver('ai', 'ai-river');
    document.getElementById('wall-count').innerText = deck.length;
    
    let pText = "A (準備)";
    if(phase === 'B_GUESS') pText = "B (識破中)";
    if(phase === 'B_DRAW') pText = `B (自摸 ${drawCount}/5)`;
    document.getElementById('phase-indicator').innerText = pText;

    document.getElementById('score-ai').innerText = players.ai.score;
    document.getElementById('score-user').innerText = players.user.score;

    // [Updated] 檢查聽牌狀態並控制按鈕
    const btnTenpai = document.getElementById('btn-tenpai');
    if (phase === 'A' && turn === 'user') {
        const waits = mjLogic.getWaitingTiles(players.user.hand);
        if (waits.length > 0) {
            btnTenpai.disabled = false;
            btnTenpai.innerText = `宣告聽牌 (${waits.length}面聽)`;
        } else {
            btnTenpai.disabled = true;
            btnTenpai.innerText = "宣告聽牌";
        }
    } else {
        btnTenpai.disabled = true;
    }
}

function renderMelds(who, elId) {
    const div = document.getElementById(elId); div.innerHTML = '';
    players[who].melds.forEach(group => {
        let gDiv = document.createElement('div'); gDiv.className = 'meld-group';
        group.forEach(tile => {
            let d = document.createElement('div'); d.className = 'tile';
            if(isDora(tile.id)) d.classList.add('dora-tile');
            d.innerText = tile.char; gDiv.appendChild(d);
        });
        div.appendChild(gDiv);
    });
}

function renderRiver(who, elId) {
    const div = document.getElementById(elId); div.innerHTML = '';
    players[who].river.forEach(tile => {
        let d = document.createElement('div'); d.className = 'tile';
        if(isDora(tile.id)) d.classList.add('dora-tile');
        d.innerText = tile.char; div.appendChild(d);
    });
}

function showStatus(text) { document.getElementById('status-msg').innerText = text; }

let onInfoClose = null;
function showInfo(title, text, callback) {
    document.getElementById('info-title').innerText = title; document.getElementById('info-text').innerText = text;
    document.getElementById('info-panel').style.display = 'block'; onInfoClose = callback;
}
function closeInfo() {
    document.getElementById('info-panel').style.display = 'none';
    if(onInfoClose) { const cb = onInfoClose; onInfoClose = null; cb(); }
}

function openPicker(title, desc) {
    document.getElementById('picker-title').innerText = title; document.getElementById('picker-desc').innerText = desc;
    if (pickerMode !== 'DECLARE') { selectedTiles = []; } // Declare模式時，已在外部預先填入
    renderPickerTiles(); updatePickedDisplay();
    
    const modalOverlay = document.getElementById('picker-modal');
    const modalContent = modalOverlay.querySelector('.modal-content');
    if (pickerMode === 'GUESS') {
        modalOverlay.classList.add('glass-mode');
        modalContent.classList.add('glass-mode');
    } else {
        modalOverlay.classList.remove('glass-mode');
        modalContent.classList.remove('glass-mode');
    }
    
    modalOverlay.style.display = 'flex';
}
function closePicker() { document.getElementById('picker-modal').style.display = 'none'; }
function renderPickerTiles() {
    const area = document.getElementById('tile-picker-area'); area.innerHTML = '';
    const groups = [{start:0,end:8},{start:9,end:17},{start:18,end:26},{start:27,end:33}];
    groups.forEach(g => {
        let gd = document.createElement('div'); gd.className = 'tile-picker-group';
        for(let i=g.start; i<=g.end; i++) {
            let t = document.createElement('div'); t.className = 'tile'; t.innerText = TILES[i];
            t.onclick = () => togglePick(i, t); t.dataset.id = i; 
            if(selectedTiles.includes(i)) t.classList.add('selected');
            gd.appendChild(t);
        }
        area.appendChild(gd);
    });
}
function togglePick(id, el) {
    if(pickerMode === 'DECLARE') return; // 聽牌模式下，不允許使用者手動修改聽牌內容(由系統計算)

    if(selectedTiles.includes(id)) { selectedTiles = selectedTiles.filter(x=>x!==id); el.classList.remove('selected'); }
    else {
        if(pickerMode === 'GUESS' && selectedTiles.length >= 2) {
            let f = selectedTiles.shift(); document.querySelector(`.tile-picker-group .tile[data-id="${f}"]`)?.classList.remove('selected');
        }
        selectedTiles.push(id); el.classList.add('selected');
    }
    updatePickedDisplay();
}
function updatePickedDisplay() { document.getElementById('picked-display').innerHTML = selectedTiles.map(id=>TILES[id]).join(' '); }
function submitPicker() {
    if(selectedTiles.length === 0) return;
    if(pickerMode === 'DECLARE') {
        players.user.isTenpai = true; players.user.waits = [...selectedTiles];
        closePicker(); attacker = 'user'; defender = 'ai'; startPhaseB();
    } else if (pickerMode === 'GUESS') {
        if(selectedTiles.length !== 2) { alert("請選 2 張"); return; }
        closePicker(); checkGuess(selectedTiles);
    }
}

startNewRound();