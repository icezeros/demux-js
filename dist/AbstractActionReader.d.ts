import { Block } from './interfaces';
/**
 * Reads blocks from a blockchain, outputting normalized `Block` objects.
 */
export declare abstract class AbstractActionReader {
    startAtBlock: number;
    protected onlyIrreversible: boolean;
    protected maxHistoryLength: number;
    headBlockNumber: number;
    currentBlockNumber: number;
    isFirstBlock: boolean;
    protected currentBlockData: Block | null;
    protected blockHistory: Block[];
    protected tmpBlocks: Block[];
    protected index: number;
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
    constructor(startAtBlock?: number, onlyIrreversible?: boolean, maxHistoryLength?: number);
    /**
     * Loads the head block number, returning a promise for an int.
     * If onlyIrreversible is true, return the most recent irreversible block number
     */
    abstract getHeadBlockNumber(): Promise<number>;
    /**
     * Loads a block with the given block number, returning a promise for a `Block`.
     */
    abstract getBlock(blockNumber: number): Promise<Block>;
    /**
     * Loads, processes, and returns the next block, updating all relevant state. Return value at index 0 is the `Block`
     * instance; return value at index 1 boolean `isRollback` determines if the implemented `AbstractActionHandler` needs
     * to potentially reverse processed blocks (in the event of a fork); return value at index 2 boolean `isNewBlock`
     * indicates if the `Block` instance returned is the same one that was just returned from the last call of
     * `nextBlock`.
     */
    nextBlock(): Promise<[Block, boolean, boolean]>;
    /**
     * Changes the state of the `AbstractActionReader` instance to have just processed the block at the given block
     * number. If the block exists in its temporary block history, it will use this, otherwise it will fetch the block
     * using `getBlock`.
     *
     * The next time `nextBlock()` is called, it will load the block after this input block number.
     */
    seekToBlock(blockNumber: number): Promise<void>;
    /**
     * Incrementally rolls back reader state one block at a time, comparing the blockHistory with
     * newly fetched blocks. Fork resolution is finished when either the current block's previous hash
     * matches the previous block's hash, or when history is exhausted.
     */
    protected resolveFork(): Promise<void>;
    /**
     * When history is exhausted in resolveFork(), this is run to handle the situation. If left unimplemented,
     * then only instantiate with `onlyIrreversible` set to true.
     */
    protected historyExhausted(): void;
}
