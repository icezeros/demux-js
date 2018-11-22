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
 * Takes `block`s output from implementations of `AbstractActionReader` and processes their actions through the
 * `Updater`s and `Effect`s of the current `HandlerVersion`. Pass an object exposing a persistence API as `state` to the
 * `handleWithState` method. Persist and retrieve information about the last block processed with `updateIndexState` and
 * `loadIndexState`. Implement `rollbackTo` to handle when a fork is encountered.
 *
 */
class AbstractActionHandler {
    /**
     * @param handlerVersions  An array of `HandlerVersion`s that are to be used when processing blocks. The default
     *                         version name is `"v1"`.
     */
    constructor(handlerVersions) {
        this.lastProcessedBlockNumber = 0;
        this.lastProcessedBlockHash = "";
        this.handlerVersionName = "v1";
        this.handlerVersionMap = {};
        this.initHandlerVersions(handlerVersions);
    }
    /**
     * Receive block, validate, and handle actions with updaters and effects
     */
    handleBlock(block, isRollback, isFirstBlock, isReplay = false) {
        return __awaiter(this, void 0, void 0, function* () {
            const { blockInfo } = block;
            if (isRollback || (isReplay && isFirstBlock)) {
                const rollbackBlockNumber = blockInfo.blockNumber - 1;
                const rollbackCount = this.lastProcessedBlockNumber - rollbackBlockNumber;
                console.info(`Rolling back ${rollbackCount} blocks to block ${rollbackBlockNumber}...`);
                yield this.rollbackTo(rollbackBlockNumber);
                yield this.refreshIndexState();
            }
            else if (this.lastProcessedBlockNumber === 0 && this.lastProcessedBlockHash === "") {
                yield this.refreshIndexState();
            }
            const nextBlockNeeded = this.lastProcessedBlockNumber + 1;
            // Just processed this block; skip
            if (blockInfo.blockNumber === this.lastProcessedBlockNumber
                && blockInfo.blockHash === this.lastProcessedBlockHash) {
                return [false, 0];
            }
            // If it's the first block but we've already processed blocks, seek to next block
            if (isFirstBlock && this.lastProcessedBlockHash) {
                return [true, nextBlockNeeded];
            }
            // Only check if this is the block we need if it's not the first block
            if (!isFirstBlock) {
                if (blockInfo.blockNumber !== nextBlockNeeded) {
                    return [true, nextBlockNeeded];
                }
                // Block sequence consistency should be handled by the ActionReader instance
                if (blockInfo.previousBlockHash !== this.lastProcessedBlockHash) {
                    throw Error("Block hashes do not match; block not part of current chain.");
                }
            }
            const handleWithArgs = (state, context = {}) => __awaiter(this, void 0, void 0, function* () {
                yield this.handleActions(state, block, context, isReplay);
            });
            yield this.handleWithState(handleWithArgs);
            return [false, 0];
        });
    }
    /**
     * Process actions against deterministically accumulating `Updater` functions. Returns a promise of versioned actions
     * for consumption by `runEffects`, to make sure the correct effects are run on blocks that include a `HandlerVersion`
     * change. To change a `HandlerVersion`, have an `Updater` function return the `versionName` of the corresponding
     * `HandlerVersion` you want to change to.
     */
    applyUpdaters(state, block, isReplay, context) {
        return __awaiter(this, void 0, void 0, function* () {
            const versionedActions = [];
            const { actions, blockInfo } = block;
            for (const action of actions) {
                let updaterIndex = -1;
                for (const updater of this.handlerVersionMap[this.handlerVersionName].updaters) {
                    updaterIndex += 1;
                    if (action.type === updater.actionType) {
                        const { payload } = action;
                        const newVersion = yield updater.apply(state, payload, blockInfo, context);
                        if (newVersion && !this.handlerVersionMap.hasOwnProperty(newVersion)) {
                            this.warnHandlerVersionNonexistent(newVersion);
                        }
                        else if (newVersion) {
                            console.info(`BLOCK ${blockInfo.blockNumber}: Updating Handler Version to '${newVersion}'`);
                            this.warnSkippingUpdaters(updaterIndex, action.type);
                            yield this.updateIndexState(state, block, isReplay, newVersion, context);
                            this.handlerVersionName = newVersion;
                            break;
                        }
                    }
                }
                versionedActions.push([action, this.handlerVersionName]);
            }
            return versionedActions;
        });
    }
    /**
     * Process versioned actions against asynchronous side effects.
     */
    runEffects(versionedActions, block, context) {
        for (const [action, handlerVersionName] of versionedActions) {
            for (const effect of this.handlerVersionMap[handlerVersionName].effects) {
                if (action.type === effect.actionType) {
                    const { payload } = action;
                    effect.run(payload, block, context);
                }
            }
        }
    }
    /**
     * Calls `applyUpdaters` and `runEffects` on the given actions
     */
    handleActions(state, block, context, isReplay) {
        return __awaiter(this, void 0, void 0, function* () {
            const { blockInfo } = block;
            const versionedActions = yield this.applyUpdaters(state, block, isReplay, context);
            if (!isReplay) {
                this.runEffects(versionedActions, block, context);
            }
            yield this.updateIndexState(state, block, isReplay, this.handlerVersionName, context);
            this.lastProcessedBlockNumber = blockInfo.blockNumber;
            this.lastProcessedBlockHash = blockInfo.blockHash;
        });
    }
    initHandlerVersions(handlerVersions) {
        if (handlerVersions.length === 0) {
            throw new Error("Must have at least one handler version.");
        }
        for (const handlerVersion of handlerVersions) {
            if (this.handlerVersionMap.hasOwnProperty(handlerVersion.versionName)) {
                throw new Error(`Handler version name '${handlerVersion.versionName}' already exists. ` +
                    "Handler versions must have unique names.");
            }
            this.handlerVersionMap[handlerVersion.versionName] = handlerVersion;
        }
        if (!this.handlerVersionMap.hasOwnProperty(this.handlerVersionName)) {
            console.warn(`No Handler Version found with name '${this.handlerVersionName}': starting with ` +
                `'${handlerVersions[0].versionName}' instead.`);
            this.handlerVersionName = handlerVersions[0].versionName;
        }
        else if (handlerVersions[0].versionName !== "v1") {
            console.warn(`First Handler Version '${handlerVersions[0].versionName}' is not '${this.handlerVersionName}', ` +
                `and there is also '${this.handlerVersionName}' present. Handler Version ` +
                `'${this.handlerVersionName}' will be used, even though it is not first.`);
        }
    }
    warnHandlerVersionNonexistent(newVersion) {
        console.warn(`Attempted to switch to handler version '${newVersion}', however this version ` +
            `does not exist. Handler will continue as version '${this.handlerVersionName}'`);
    }
    warnSkippingUpdaters(updaterIndex, actionType) {
        const remainingUpdaters = this.handlerVersionMap[this.handlerVersionName].updaters.length - updaterIndex - 1;
        if (remainingUpdaters) {
            console.warn(`Handler Version was updated to version '${this.handlerVersionName}' while there ` +
                `were still ${remainingUpdaters} updaters left! These updaters will be skipped for the ` +
                `current action '${actionType}'.`);
        }
    }
    refreshIndexState() {
        return __awaiter(this, void 0, void 0, function* () {
            const { blockNumber, blockHash, handlerVersionName } = yield this.loadIndexState();
            this.lastProcessedBlockNumber = blockNumber;
            this.lastProcessedBlockHash = blockHash;
            this.handlerVersionName = handlerVersionName;
        });
    }
}
exports.AbstractActionHandler = AbstractActionHandler;
