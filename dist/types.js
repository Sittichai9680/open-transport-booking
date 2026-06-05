// ---- Seats ----
export class BookingError extends Error {
    code;
    constructor(message, code) {
        super(message);
        this.code = code;
        this.name = 'BookingError';
    }
}
//# sourceMappingURL=types.js.map