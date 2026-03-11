import fs from "node:fs";

type Flags = {
    FIRST_FLAG: string;
    SECOND_FLAG: string;
};

export default class EnvManager {
    private readonly flags: Flags;

    private constructor(flags: Flags) {
        this.flags = flags;
    }

    static create(envFile: string = ".env"): EnvManager {
        if (!fs.existsSync(envFile)) {
            console.warn("⚠ .env file not found! Using default values.");

            return new EnvManager({
                FIRST_FLAG: "DEFAULT_FIRST_FLAG",
                SECOND_FLAG: "DEFAULT_SECOND_FLAG"
            });
        }

        const content = fs.readFileSync(envFile, "utf-8");

        const parsed = Object.fromEntries(
            content
                .split("\n")
                .filter(line => line.trim() !== "" && !line.startsWith("#"))
                .map(line => {
                    const [key, value] = line.split("=");
                    return [key.trim(), value.trim()];
                })
        );

        return new EnvManager({
            FIRST_FLAG: parsed.FIRST_FLAG ?? "DEFAULT_FIRST_FLAG",
            SECOND_FLAG: parsed.SECOND_FLAG ?? "DEFAULT_SECOND_FLAG"
        });
    }

    public getFlags(): Flags {
        return this.flags;
    }

    public get(key: keyof Flags) {
        return this.flags[key];
    }
}