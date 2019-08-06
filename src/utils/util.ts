export function sleepBusy(ms) {
    const waitTill = new Date(new Date().getTime() + ms);
    while (waitTill > new Date()) {
        // busy busy!
    }
}
