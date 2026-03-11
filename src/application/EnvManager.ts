import fs from 'node:fs';

export default class EnvManager {
    private readonly env: Record<string, string> = {};

    constructor(envPath: string = '.env') {
        if (fs.existsSync(envPath)) {
            const content = fs.readFileSync(envPath, 'utf-8');
            this.env = Object.fromEntries(
                content.split('\n')
                    .filter(line => line.trim() && !line.startsWith('#'))
                    .map(line => {
                        const [key, value] = line.split('=');
                        return [key, value];
                    })
            );
        } else {
            console.warn('⚠ .env file not found! Using default values.');
            this.env = {
                FIRST_FLAG: 'DEFAULT_FIRST_FLAG',
                SECOND_FLAG: 'DEFAULT_SECOND_FLAG'
            };
        }
    }

    get(key: string, defaultValue: string = ''): string {
        return this.env[key] || defaultValue;
    }

    getFlags(): { FIRST_FLAG: string, SECOND_FLAG: string } {
        return {
            FIRST_FLAG: this.get('FIRST_FLAG', 'DEFAULT_FIRST_FLAG'),
            SECOND_FLAG: this.get('SECOND_FLAG', 'DEFAULT_SECOND_FLAG')
        };
    }
}