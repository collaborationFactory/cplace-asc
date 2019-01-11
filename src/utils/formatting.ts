export function formatDuration(milliSeconds: number): string {
    const seconds = Math.floor(milliSeconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const sec = seconds % 60;
    return `${pad(minutes, 2)}m${pad(sec, 2)}s`;
}

export function pad(number: number, digits: number): string {
    let s = number.toString(10);
    while (s.length < digits) {
        s = `0${s}`;
    }
    return s;
}
