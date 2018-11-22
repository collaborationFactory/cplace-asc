/*
 * Copyright 2018, collaboration Factory AG. All rights reserved.
 */
/**
 * Basic implementation of map that only accepts strings as keys
 * Essentially just a wrapper over basic javascript object
 */
export class StringMap<T> {
    private readonly _data: { [key: string]: T };

    constructor() {
        this._data = {};
    }

    get(key: string): T | undefined {
        return this._data[key];
    }

    has(key: string): boolean {
        return !!this._data[key];
    }

    set(key: string, value: T) {
        this._data[key] = value;
        return this;
    }

    // keys are in insertion order
    keys(): string[] {
        return Object.keys(this._data);
    }

    // values are in insertion order
    values(): T[] {
        return Object.keys(this._data).map((key) => {
            return this._data[key];
        });
    }

    size(): number {
        return this.keys().length;
    }

    // iterates in insertion order
    forEach(iteratorFunction: (value: T, key: string) => void) {
        Object.keys(this._data).forEach((key) => {
            iteratorFunction(this._data[key], key);
        });
    }
}
