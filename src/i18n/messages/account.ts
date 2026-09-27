import type { Dictionary } from '@/i18n/messages/index';

/** Вход, регистрация, профиль. */
export const account: Dictionary = {
  // --- заголовки экранов входа и регистрации (передаются в AuthLayout) ---
  'account.signIn.eyebrow': { kk: 'Кіру', ru: 'Вход', en: 'Sign in' },
  'account.signIn.title': { kk: 'Қайта қош келдіңіз.', ru: 'С возвращением.', en: 'Welcome back.' },
  'account.signUp.eyebrow': { kk: 'Тіркелгі жасау', ru: 'Регистрация', en: 'Create account' },
  'account.signUp.title': { kk: 'Qyran-ға қосылыңыз.', ru: 'Присоединяйтесь к Qyran.', en: 'Join Qyran.' },

  // --- поля форм ---
  'account.field.fullName': { kk: 'Толық аты-жөні', ru: 'Имя и фамилия', en: 'Full name' },
  'account.field.fullName.ph': { kk: 'Айдос Серіков', ru: 'Иван Иванов', en: 'John Doe' },
  'account.field.email': { kk: 'Электрондық пошта', ru: 'Электронная почта', en: 'Email address' },
  'account.field.password': { kk: 'Құпия сөз', ru: 'Пароль', en: 'Password' },
  'account.field.password.ph': { kk: 'Кемінде 6 таңба', ru: 'Минимум 6 символов', en: 'At least 6 characters' },

  // --- вход ---
  'account.signIn.forgot': { kk: 'Құпия сөзді ұмыттыңыз ба?', ru: 'Забыли пароль?', en: 'Forgot password?' },
  'account.signIn.submit': { kk: 'Кіру', ru: 'Войти', en: 'Sign in' },
  'account.signIn.loading': { kk: 'Кіру орындалуда…', ru: 'Входим…', en: 'Signing in…' },
  'account.signIn.gesture': { kk: 'Ыммен кіру', ru: 'Войти жестом', en: 'Sign in with a gesture' },
  'account.signIn.noAccount': { kk: 'Тіркелгіңіз жоқ па?', ru: 'Нет аккаунта?', en: "Don't have an account?" },
  'account.signIn.toSignUp': { kk: 'Тіркелу', ru: 'Зарегистрироваться', en: 'Sign up' },
  'account.signIn.resend': {
    kk: 'Растау хатын қайта жіберу',
    ru: 'Отправить письмо ещё раз',
    en: 'Resend confirmation email',
  },
  'account.signIn.resent': {
    kk: 'Растау хаты {email} мекенжайына жіберілді. Кіріс жәшігіңізді (және «Спам» қалтасын) тексеріңіз.',
    ru: 'Письмо с подтверждением отправлено на {email}. Проверьте входящие (и папку «Спам»).',
    en: 'Confirmation email sent to {email}. Check your inbox (and spam folder).',
  },

  // --- регистрация ---
  'account.signUp.submit': { kk: 'Тіркелгі жасау', ru: 'Создать аккаунт', en: 'Create account' },
  'account.signUp.loading': { kk: 'Тіркелгі жасалуда…', ru: 'Создаём аккаунт…', en: 'Creating account…' },
  'account.signUp.haveAccount': { kk: 'Тіркелгіңіз бар ма?', ru: 'Уже есть аккаунт?', en: 'Already have an account?' },
  'account.signUp.toSignIn': { kk: 'Кіру', ru: 'Войти', en: 'Sign in' },

  // --- регистрация: экран «письмо отправлено» ---
  'account.signUp.done.title': { kk: 'Аз ғана қалды.', ru: 'Почти готово.', en: 'Almost there.' },
  'account.signUp.done.sent': {
    kk: 'Растау сілтемесін мына мекенжайға жібердік:',
    ru: 'Мы отправили ссылку для подтверждения на',
    en: 'We sent a confirmation link to',
  },
  'account.signUp.done.steps': { kk: 'Келесі қадамдар', ru: 'Что дальше', en: 'Next steps' },
  'account.signUp.done.step1': {
    kk: 'Поштаңызды ашыңыз (спам қалтасын да қараңыз)',
    ru: 'Откройте почту (загляните и в «Спам»)',
    en: 'Open your inbox (check the spam folder too)',
  },
  'account.signUp.done.step2': {
    kk: 'Хаттағы растау сілтемесін басыңыз',
    ru: 'Нажмите ссылку подтверждения в письме',
    en: 'Click the confirmation link in the email',
  },
  'account.signUp.done.step3': {
    kk: 'Осында оралып, жүйеге кіріңіз',
    ru: 'Вернитесь сюда и войдите',
    en: 'Come back here and sign in',
  },
  'account.signUp.done.noEmail': {
    kk: 'Хат келмеді ме? Кіру бетінде жаңасын сұратыңыз.',
    ru: 'Письмо не пришло? Запросите новое на странице входа.',
    en: "Didn't get the email? Request a new one on the sign-in page.",
  },
  'account.signUp.done.goSignIn': { kk: 'Кіру бетіне өту', ru: 'Перейти ко входу', en: 'Go to sign in' },

  // --- ошибки и состояния ---
  'account.err.fillAll': { kk: 'Барлық өрісті толтырыңыз.', ru: 'Заполните все поля.', en: 'Please fill in all fields.' },
  'account.err.network': { kk: 'Желі қатесі. Қайта көріңіз.', ru: 'Ошибка сети. Попробуйте ещё раз.', en: 'Network error. Please try again.' },
  'account.err.emailFirst': { kk: 'Алдымен жоғарыдағы поштаңызды жазыңыз.', ru: 'Сначала введите почту выше.', en: 'Enter your email above first.' },
  'account.err.resendFailed': { kk: 'Қайта жіберу мүмкін болмады.', ru: 'Не удалось отправить письмо.', en: 'Failed to resend.' },
  'account.err.passwordShort': {
    kk: 'Құпия сөз кемінде 6 таңбадан тұруы керек.',
    ru: 'Пароль должен быть не короче 6 символов.',
    en: 'Password must be at least 6 characters.',
  },
  'account.action.sending': { kk: 'Жіберілуде…', ru: 'Отправка…', en: 'Sending…' },
  'account.or': { kk: 'НЕМЕСЕ', ru: 'ИЛИ', en: 'OR' },
  'account.badge.experimental': { kk: 'СЫНАҚ', ru: 'ЭКСПЕРИМЕНТ', en: 'EXPERIMENTAL' },

  // --- профиль ---
  'account.profile.title': { kk: 'Профиль', ru: 'Профиль', en: 'Profile' },
  'account.profile.sub': { kk: 'тіркелгі және сеанс', ru: 'аккаунт и сессия', en: 'account & session' },
  'account.profile.pill': { kk: 'Расталған · белсенді сеанс', ru: 'Подтверждён · активная сессия', en: 'Verified · active session' },
  'account.profile.member': { kk: 'Qyran қатысушысы', ru: 'Участник Qyran', en: 'Qyran member' },
  'account.profile.verified': { kk: 'Расталған', ru: 'Подтверждён', en: 'Verified' },
  'account.profile.defaultName': { kk: 'Қолданушы', ru: 'Пользователь', en: 'User' },
  'account.profile.row.name': { kk: 'Толық аты-жөні', ru: 'Имя и фамилия', en: 'Full name' },
  'account.profile.row.email': { kk: 'Пошта', ru: 'Почта', en: 'Email' },
  'account.profile.row.since': { kk: 'Қосылған күні', ru: 'С нами с', en: 'Member since' },
};
