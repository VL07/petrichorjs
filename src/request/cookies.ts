/** Class storing cookies on requests, can only be read. */
export class Cookies {
    private cookies: Map<string, string> = new Map();

    constructor(cookieHeader: string) {
        this.parseCookieHeader(cookieHeader);
    }

    /**
     * Parses the cookie header and mutates this class, therefor it dosn't
     * return anything.
     */
    parseCookieHeader(cookieHeader: string): void {
        const cookies = cookieHeader.split(";").filter((cookie) => cookie);
        for (const cookie of cookies) {
            const splited = cookie.trim().split("=");
            if (splited.length !== 2) continue;

            // They are not going to be undefined because i checked the length
            const name = splited[0]!.trim();
            const value = splited[1]!.trim();

            this.cookies.set(name, value);
        }
    }

    /**
     * Gets one cookie from the incomming request, if it dosnt exist the
     * function will return `undefined`.
     */
    get(name: string): string | undefined {
        return this.cookies.get(name);
    }

    /** Gets all the cookies as a map from the incomming request. */
    all(): Readonly<Map<string, string>> {
        return this.cookies;
    }

    /** The number of cookies with the incomming request. */
    size(): number {
        return this.cookies.size;
    }
}
