class MahjongLogic {
    constructor() {
        this.TILES_COUNT = 34;
    }

    /**
     * 將手牌物件陣列轉換為計數陣列
     * @param {Array} handObjects - 遊戲中的手牌物件陣列 [{id:0, char...}, ...]
     * @returns {Array} - 長度34的整數陣列
     */
    handToCounts(handObjects) {
        const counts = new Array(this.TILES_COUNT).fill(0);
        handObjects.forEach(t => counts[t.id]++);
        return counts;
    }

    /**
     * 獲取聽牌列表 (支持一般型 + 七對子)
     * @param {Array} handObjects - 手牌物件
     * @returns {Array} - 聽牌的 ID 列表 [0, 1, ...]
     */
    getWaitingTiles(handObjects) {
        // 麻將聽牌邏輯：嘗試多加一張任意牌，若能胡牌，則該張牌為聽牌
        const originalCounts = this.handToCounts(handObjects);
        const waits = [];

        // 檢查手牌是否為 13 張 (未鳴牌的七對子需要13張，已鳴牌的一般型需要 13 - 3*melds)
        // 這裡我們簡化：只對手牌部分做聽牌檢查
        // 為了相容性，這裡假設外部已經扣除了鳴牌，傳入的是純手牌

        for (let i = 0; i < this.TILES_COUNT; i++) {
            if (originalCounts[i] >= 4) continue; // 不可能摸到第5張

            const testCounts = [...originalCounts];
            testCounts[i]++;

            // 判斷是否胡牌 (一般型 或 七對子)
            if (this.canWin(testCounts, handObjects.length + 1)) {
                waits.push(i);
            }
        }
        return waits;
    }

    /**
     * 綜合胡牌判定
     * @param {Array} counts - 34種牌的張數
     * @param {Number} totalTiles - 手牌總張數 (包含測試加入的那一張)
     */
    canWin(counts, totalTiles) {
        // 判斷七對子 (只有門前清有效，也就是手牌必須是14張)
        if (totalTiles === 14 && this.checkChiitoitsu(counts)) {
            return true;
        }

        // 判斷一般型 (4面子+1雀頭)
        return this.checkStandardForm(counts);
    }

    // --- 七對子判定 ---
    checkChiitoitsu(counts) {
        let pairCount = 0;
        for (let i = 0; i < this.TILES_COUNT; i++) {
            if (counts[i] === 2) pairCount++;
            else if (counts[i] !== 0) return false; // 七對子不能有單張或刻子
        }
        return pairCount === 7;
    }

    // --- 一般型判定 (4面子+1雀頭) ---
    checkStandardForm(counts) {
        // 1. 窮舉雀頭
        for (let i = 0; i < this.TILES_COUNT; i++) {
            if (counts[i] >= 2) {
                counts[i] -= 2;
                if (this.checkMentsu(counts, 0)) {
                    counts[i] += 2; // 還原
                    return true;
                }
                counts[i] += 2; // 還原
            }
        }
        return false;
    }

    // 遞迴找面子 (remainingMentsuNeeded 取決於手牌張數，這裡簡化為找完所有牌)
    checkMentsu(counts, depth) {
        // 尋找第一張存在的牌
        let firstIndex = -1;
        for (let i = 0; i < this.TILES_COUNT; i++) {
            if (counts[i] > 0) {
                firstIndex = i;
                break;
            }
        }

        if (firstIndex === -1) return true; // 牌都檢查完了，代表全部組成面子

        let result = false;

        // 1. 嘗試組成刻子 (Pon)
        if (counts[firstIndex] >= 3) {
            counts[firstIndex] -= 3;
            if (this.checkMentsu(counts, depth + 1)) result = true;
            counts[firstIndex] += 3; // Backtrack
        }

        // 2. 嘗試組成順子 (Chi) - 字牌(27+)不可順
        if (!result && firstIndex < 27 && firstIndex % 9 < 7) {
            if (counts[firstIndex + 1] > 0 && counts[firstIndex + 2] > 0) {
                counts[firstIndex]--;
                counts[firstIndex + 1]--;
                counts[firstIndex + 2]--;
                if (this.checkMentsu(counts, depth + 1)) result = true;
                counts[firstIndex]++;
                counts[firstIndex + 1]++;
                counts[firstIndex + 2]++;
            }
        }

        return result;
    }
}