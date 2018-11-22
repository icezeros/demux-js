import { Action, Block, HandlerVersion, IndexState } from "./interfaces";
/**
 * Takes `block`s output from implementations of `AbstractActionReader` and processes their actions through the
 * `Updater`s and `Effect`s of the current `HandlerVersion`. Pass an object exposing a persistence API as `state` to the
 * `handleWithState` method. Persist and retrieve information about the last block processed with `updateIndexState` and
 * `loadIndexState`. Implement `rollbackTo` to handle when a fork is encountered.
 *
 */
export declare abstract class AbstractActionHandler {
    protected lastProcessedBlockNumber: number;
    protected lastProcessedBlockHash: string;
    protected handlerVersionName: string;
    private handlerVersionMap;
    /**
     * @param handlerVersions  An array of `HandlerVersion`s that are to be used when processing blocks. The default
     *                         version name is `"v1"`.
     */
    constructor(handlerVersions: HandlerVersion[]);
    /**
     * Receive block, validate, and handle actions with updaters and effects
     */
    handleBlock(block: Block, isRollback: boolean, isFirstBlock: boolean, isReplay?: boolean): Promise<[boolean, number]>;
    /**
     * Updates the `lastProcessedBlockNumber` and `lastProcessedBlockHash` meta state, coinciding with the block
     * that has just been processed. These are the same values read by `updateIndexState()`.
     */
    protected abstract updateIndexState(state: any, block: Block, isReplay: boolean, handlerVersionName: string, context?: any): Promise<void>;
    /**
     * Returns a promise for the `lastProcessedBlockNumber` and `lastProcessedBlockHash` meta state,
     * coinciding with the block that has just been processed.
     * These are the same values written by `updateIndexState()`.
     * @returns A promise that resolves to an `IndexState`
     */
    protected abstract loadIndexState(): Promise<IndexState>;
    /**
     * Must call the passed-in `handle` function within this method, passing in a state object that will be passed in to
     * the `state` parameter to all calls of `Updater.apply`. Optionally, pass in a `context` object as a second
     * parameter, which can be utilized to share state across `Updater.apply` and `Effect.run` calls on a per-block basis.
     */
    protected abstract handleWithState(handle: (state: any, context?: any) => void): Promise<void>;
    /**
     * Process actions against deterministically accumulating `Updater` functions. Returns a promise of versioned actions
     * for consumption by `runEffects`, to make sure the correct effects are run on blocks that include a `HandlerVersion`
     * change. To change a `HandlerVersion`, have an `Updater` function return the `versionName` of the corresponding
     * `HandlerVersion` you want to change to.
     */
    protected applyUpdaters(state: any, block: Block, isReplay: boolean, context: any): Promise<Array<[Action, string]>>;
    /**
     * Process versioned actions against asynchronous side effects.
     */
    protected runEffects(versionedActions: Array<[Action, string]>, block: Block, context: any): void;
    /**
     * Will run when a rollback block number is passed to handleActions. Implement this method to
     * handle reversing actions full blocks at a time, until the last applied block is the block
     * number passed to this method.
     */
    protected abstract rollbackTo(blockNumber: number): Promise<void>;
    /**
     * Calls `applyUpdaters` and `runEffects` on the given actions
     */
    protected handleActions(state: any, block: Block, context: any, isReplay: boolean): Promise<void>;
    private initHandlerVersions;
    private warnHandlerVersionNonexistent;
    private warnSkippingUpdaters;
    private refreshIndexState;
}
