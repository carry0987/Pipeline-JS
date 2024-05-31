/**
 * Centralized logging lib
 *
 * This class needs some improvements but so far it has been used to have a coherent way to log
 */
class Logger {
    private format(message: string, type: string): string {
        return `[Pipeline-JS] [${type.toUpperCase()}]: ${message}`;
    }

    error(message: unknown, throwException: true): never;
    error(message: unknown, throwException?: false): void;
    error(message: unknown, throwException = false): void | never {
        const msg = this.format(message as string, 'error');

        if (throwException) {
            throw Error(msg);
        } else {
            console.error(msg);
        }
    }

    warn(message: unknown): void {
        console.warn(this.format(message as string, 'warn'));
    }

    info(message: unknown): void {
        console.info(this.format(message as string, 'info'));
    }
}

export default new Logger();
