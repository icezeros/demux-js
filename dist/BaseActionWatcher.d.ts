import { AbstractActionHandler } from "./AbstractActionHandler";
import { AbstractActionReader } from "./AbstractActionReader";
/**
 * Coordinates implementations of `AbstractActionReader`s and `AbstractActionHandler`s in
 * a polling loop.
 */
export declare class BaseActionWatcher {
    protected actionReader: AbstractActionReader;
    protected actionHandler: AbstractActionHandler;
    protected pollInterval: number;
    /**
     * @param actionReader    An instance of an implemented `AbstractActionReader`
     * @param actionHandler   An instance of an implemented `AbstractActionHandler`
     * @param pollInterval    Number of milliseconds between each polling loop iteration
     */
    constructor(actionReader: AbstractActionReader, actionHandler: AbstractActionHandler, pollInterval: number);
    /**
     * Starts a polling loop running in replay mode.
     */
    replay(): Promise<void>;
    /**
     * Start a polling loop
     */
    watch(isReplay?: boolean): Promise<void>;
    /**
     * Use the actionReader and actionHandler to process new blocks.
     */
    protected checkForBlocks(isReplay?: boolean): Promise<void>;
}
