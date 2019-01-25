export class JobDetails {
    public readonly before: string[];
    public readonly after: string[];

    constructor(public readonly key: string,
                before: string[],
                after: string[]) {
        this.before = [...before];
        this.after = [...after];
    }
}

export class JobTracker {
    private readonly keyToDetails: Map<string, JobDetails> = new Map<string, JobDetails>();
    private readonly dirtyKeys = new Set<string>();
    private readonly pendingKeys = new Set<string>();
    private readonly alreadyCompletedOnce = new Set<string>();

    constructor(public readonly jobs: JobDetails[]) {
        jobs.forEach(j => {
            this.keyToDetails.set(j.key, j);
            this.dirtyKeys.add(j.key);
        });
    }

    /**
     * Marks the given `key` as dirty resulting in all `JobDetails.after` keys to be marked
     * as dirty recursively, too.
     */
    public markDirty(key: string): void {
        if (!this.keyToDetails.has(key)) {
            throw Error(`unknown job key: ${key}`);
        }
        if (this.dirtyKeys.has(key)) {
            return;
        }
        this.dirtyKeys.add(key);
        this.getDetails(key)
            .after
            .forEach(after => this.markDirty(after));
    }

    /**
     * Marks the given `key` as currently being processed
     */
    public markProcessing(key: string): void {
        if (!this.keyToDetails.has(key)) {
            throw Error(`unknown job key: ${key}`);
        }
        this.dirtyKeys.delete(key);
        this.pendingKeys.add(key);
    }

    /**
     * Marks the given `key` as processed and returns `true` iff the given `key`
     * has been processed the first time.
     */
    public markCompleted(key: string): boolean {
        if (!this.keyToDetails.has(key)) {
            throw Error(`unknown job key: ${key}`);
        }
        this.pendingKeys.delete(key);

        if (!this.alreadyCompletedOnce.has(key)) {
            this.alreadyCompletedOnce.add(key);
            return true;
        } else {
            return false;
        }
    }

    /**
     * Get the next key ready for processing.
     *
     * The return value of this method will be as follows:
     * - a `string` if there is a key to be processed
     * - `null` if all keys have been processed completely
     * - `undefined` if there is not yet a key available due to pending processing operations
     */
    public getNextKey(): string | null | undefined {
        if (this.dirtyKeys.size === 0 && this.pendingKeys.size === 0) {
            return null;
        }

        const ready = [...this.dirtyKeys.values()]
            .map(key => this.getDetails(key))
            // Check if a dependency is still pending...
            .filter(details => details
                .before
                .filter(beforeKey => this.isDirtyOrPending(beforeKey))
                .length === 0
            )
            // Check if the same plugin is already being compiled (can't run in parallel)
            .filter(details => !this.pendingKeys.has(details.key))
            .map(details => details.key);
        return ready.length > 0 ? ready[0] : undefined;
    }

    private getDetails(key: string): JobDetails {
        const details = this.keyToDetails.get(key);
        if (!details) {
            throw Error(`unexpectly missing key ${key}`);
        }
        return details;
    }

    private isDirtyOrPending(key: string): boolean {
        return this.dirtyKeys.has(key) || this.pendingKeys.has(key);
    }
}
