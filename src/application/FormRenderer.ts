import fs from 'node:fs';
import path from 'node:path';

interface FormContext {
    TITLE: string;
    ACTION: string;
    BUTTON_TEXT: string;
    REDIRECT_LINK: string;
    REDIRECT_TEXT: string;
}

export class FormRenderer {
    private FORM_CONTEXT: Record<string, FormContext> = {
        register: {
            TITLE: 'Регистрация',
            ACTION: '/register',
            BUTTON_TEXT: 'Зарегистрироваться',
            REDIRECT_LINK: '/login',
            REDIRECT_TEXT: 'Уже зарегистрированы?'
        },
        login: {
            TITLE: 'Авторизация',
            ACTION: '/login',
            BUTTON_TEXT: 'Войти',
            REDIRECT_LINK: '/register',
            REDIRECT_TEXT: 'Регистрация'
        }
    };

    private formPath = path.join(process.cwd(), 'src', 'views', 'form.html');

    renderForm(formKey: 'register' | 'login', error: string = ''): string {
        let form = fs.readFileSync(this.formPath, 'utf-8');
        const context = this.FORM_CONTEXT[formKey];

        for (const key in context) {
            const regex = new RegExp(`{{${key.toUpperCase()}}}`, 'g');
            form = form.replace(regex, context[key as keyof FormContext]);
        }

        form = form.replace(/{{ERROR}}/g, error);
        return form;
    }
}