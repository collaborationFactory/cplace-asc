/*
 * Copyright 2018, collaboration Factory AG. All rights reserved.
 */

/**
 * Basic implementation of set that only works with strings
 */
export class StringSet {
    private readonly _data: { [item: string]: boolean };

    constructor(items?: string[]) {
        this._data = {};
        if (items && items.length) {
            items.forEach((item) => {
                this._data[item] = true;
            });
        }
    }

    add(item: string) {
        this._data[item] = true;
        return this;
    }

    delete(item: string) {
        delete this._data[item];
        return this;
    }

    has(item: string) {
        return !!this._data[item];
    }

    hasAll(items: string[]) {
        const len = items.length;
        for (let i = 0; i < len; i++) {
            if (!this.has(items[i])) {
                return false;
            }
        }

        return true;
    }

    size() {
        return this.asArray().length;
    }

    asArray() {
        return Object.keys(this._data);
    }

    forEach(iteratorFunction: (item: string) => void) {
        let items = this.asArray();
        items.forEach(iteratorFunction);
    }

    copy() {
        return new StringSet(this.asArray());
    }
}
