"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Reads blocks from a blockchain, outputting normalized `Block` objects.
 */
class AbstractActionReader {
    /**
     * @param startAtBlock      For positive values, this sets the first block that this will start at. For negative
     *                          values, this will start at (most recent block + startAtBlock), effectively tailing the
     *                          chain. Be careful when using this feature, as this will make your starting block dynamic.
     *
     * @param onlyIrreversible  When false (default), `getHeadBlockNumber` will load the most recent block number. When
     *                          true, `getHeadBlockNumber` will return the block number of the most recent irreversible
     *                          block. Keep in mind that `getHeadBlockNumber` is an abstract method and this functionality
     *                          is the responsibility of the implementing class.
     *
     * @param maxHistoryLength  This determines how many blocks in the past are cached. This is used for determining
     *                          block validity during both normal operation and when rolling back.
     */
    constructor(startAtBlock = 1, onlyIrreversible = false, maxHistoryLength = 600) {
        this.startAtBlock = startAtBlock;
        this.onlyIrreversible = onlyIrreversible;
        this.maxHistoryLength = maxHistoryLength;
        this.headBlockNumber = 0;
        this.isFirstBlock = true;
        this.currentBlockData = null;
        this.blockHistory = [];
        this.tmpBlocks = [];
        this.index = 0;
        this.currentBlockNumber = startAtBlock - 1;
    }
    /**
     * Loads, processes, and returns the next block, updating all relevant state. Return value at index 0 is the `Block`
     * instance; return value at index 1 boolean `isRollback` determines if the implemented `AbstractActionHandler` needs
     * to potentially reverse processed blocks (in the event of a fork); return value at index 2 boolean `isNewBlock`
     * indicates if the `Block` instance returned is the same one that was just returned from the last call of
     * `nextBlock`.
     */
    nextBlock() {
        return __awaiter(this, void 0, void 0, function* () {
            let blockData = null;
            let isRollback = false;
            let isNewBlock = false;
            // If we're on the head block, refresh current head block
            if (this.currentBlockNumber === this.headBlockNumber || !this.headBlockNumber) {
                this.headBlockNumber = yield this.getHeadBlockNumber();
                this.tmpBlocks = [];
                this.index = 0;
            }
            // If currentBlockNumber is negative, it means we wrap to the end of the chain (most recent blocks)
            // This should only ever happen when we first start, so we check that there's no block history
            if (this.currentBlockNumber < 0 && this.blockHistory.length === 0) {
                this.currentBlockNumber = this.headBlockNumber + this.currentBlockNumber;
                this.startAtBlock = this.currentBlockNumber + 1;
            }
            // If we're now behind one or more new blocks, process them
            if (this.currentBlockNumber < this.headBlockNumber) {
                if (this.tmpBlocks.length === 0) {
                    let task = [];
                    for (let i = (this.currentBlockNumber = 0); i < this.headBlockNumber; i++) {
                        task.push(this.getBlock(i));
                    }
                    const result = yield Promise.all(task);
                    this.tmpBlocks = result;
                }
                // const unvalidatedBlockData = await this.getBlock(this.currentBlockNumber + 1);
                const unvalidatedBlockData = this.tmpBlocks[this.index];
                this.index++;
                const expectedHash = this.currentBlockData !== null ? this.currentBlockData.blockInfo.blockHash : 'INVALID';
                const actualHash = unvalidatedBlockData.blockInfo.previousBlockHash;
                // Continue if the new block is on the same chain as our history, or if we've just started
                if (expectedHash === actualHash || this.blockHistory.length === 0) {
                    blockData = unvalidatedBlockData; // Block is now validated
                    if (this.currentBlockData) {
                        this.blockHistory.push(this.currentBlockData); // No longer current, belongs on history
                    }
                    this.blockHistory.splice(0, this.blockHistory.length - this.maxHistoryLength); // Trim history
                    this.currentBlockData = blockData; // Replaced with the real current block
                    isNewBlock = true;
                    this.currentBlockNumber = this.currentBlockData.blockInfo.blockNumber;
                }
                else {
                    // Since the new block did not match our history, we can assume our history is wrong
                    // and need to roll back
                    console.info('!! FORK DETECTED !!');
                    console.info(`  MISMATCH:`);
                    console.info(`    ✓ NEW Block ${unvalidatedBlockData.blockInfo.blockNumber} previous: ${actualHash}`);
                    console.info(`    ✕ OLD Block ${this.currentBlockNumber} id:       ${expectedHash}`);
                    yield this.resolveFork();
                    isNewBlock = true;
                    isRollback = true; // Signal action handler that we must roll back
                    // Reset for safety, as new fork could have less blocks than the previous fork
                    this.headBlockNumber = yield this.getHeadBlockNumber();
                }
            }
            // Let handler know if this is the earliest block we'll send
            this.isFirstBlock = this.currentBlockNumber === this.startAtBlock;
            if (this.currentBlockData === null) {
                throw Error('currentBlockData must not be null.');
            }
            return [this.currentBlockData, isRollback, isNewBlock];
        });
    }
    /**
     * Changes the state of the `AbstractActionReader` instance to have just processed the block at the given block
     * number. If the block exists in its temporary block history, it will use this, otherwise it will fetch the block
     * using `getBlock`.
     *
     * The next time `nextBlock()` is called, it will load the block after this input block number.
     */
    seekToBlock(blockNumber) {
        return __awaiter(this, void 0, void 0, function* () {
            // Clear current block data
            this.currentBlockData = null;
            this.headBlockNumber = 0;
            if (blockNumber < this.startAtBlock) {
                throw Error('Cannot seek to block before configured startAtBlock.');
            }
            // If we're going back to the first block, we don't want to get the preceding block
            if (blockNumber === 1) {
                this.blockHistory = [];
                this.currentBlockNumber = 0;
                return;
            }
            // Check if block exists in history
            let toDelete = -1;
            for (let i = this.blockHistory.length - 1; i >= 0; i--) {
                if (this.blockHistory[i].blockInfo.blockNumber === blockNumber) {
                    break;
                }
                else {
                    toDelete += 1;
                }
            }
            if (toDelete >= 0) {
                this.blockHistory.splice(toDelete);
                this.currentBlockData = this.blockHistory.pop() || null;
            }
            // Load current block
            this.currentBlockNumber = blockNumber - 1;
            if (!this.currentBlockData) {
                this.currentBlockData = yield this.getBlock(this.currentBlockNumber);
            }
        });
    }
    /**
     * Incrementally rolls back reader state one block at a time, comparing the blockHistory with
     * newly fetched blocks. Fork resolution is finished when either the current block's previous hash
     * matches the previous block's hash, or when history is exhausted.
     */
    resolveFork() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.currentBlockData === null) {
                throw Error('`currentBlockData` must not be null when initiating fork resolution.');
            }
            // Pop off blocks from cached block history and compare them with freshly fetched blocks
            while (this.blockHistory.length > 0) {
                const [previousBlockData] = this.blockHistory.slice(-1);
                console.info(`Refetching Block ${this.currentBlockData.blockInfo.blockNumber}...`);
                this.currentBlockData = yield this.getBlock(this.currentBlockData.blockInfo.blockNumber);
                if (this.currentBlockData !== null) {
                    const { blockInfo: currentBlockInfo } = this.currentBlockData;
                    const { blockInfo: previousBlockInfo } = previousBlockData;
                    if (currentBlockInfo.previousBlockHash === previousBlockInfo.blockHash) {
                        console.info('  MATCH:');
                        console.info(`    ✓ NEW Block ${currentBlockInfo.blockNumber} previous: ${currentBlockInfo.previousBlockHash}`); // tslint:disable-line
                        console.info(`    ✓ OLD Block ${previousBlockInfo.blockNumber} id:       ${previousBlockInfo.blockHash}`);
                        console.info('!! FORK RESOLVED !!');
                        break;
                    }
                    console.info('  MISMATCH:');
                    console.info(`    ✓ NEW Block ${currentBlockInfo.blockNumber} previous: ${currentBlockInfo.previousBlockHash}`);
                    console.info(`    ✕ OLD Block ${previousBlockInfo.blockNumber} id:       ${previousBlockInfo.blockHash}`);
                }
                this.currentBlockData = previousBlockData;
                this.blockHistory.pop();
            }
            if (this.blockHistory.length === 0) {
                yield this.historyExhausted();
            }
            this.currentBlockNumber = this.blockHistory[this.blockHistory.length - 1].blockInfo.blockNumber + 1;
        });
    }
    /**
     * When history is exhausted in resolveFork(), this is run to handle the situation. If left unimplemented,
     * then only instantiate with `onlyIrreversible` set to true.
     */
    historyExhausted() {
        console.info('Fork resolution history has been exhausted!');
        throw Error('Fork resolution history has been exhausted, and no history exhaustion handling has been implemented.');
    }
}
exports.AbstractActionReader = AbstractActionReader;
