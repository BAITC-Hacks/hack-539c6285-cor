import type { Dictionary } from '@/i18n/messages/index';

/** Страницы про технологии под капотом. */
export const tech: Dictionary = {
  /* --- общий каркас страницы технологии --- */
  'tech.pill.stable': { kk: 'Өнімде · тұрақты', ru: 'В продакшене · стабильно', en: 'Production · stable' },
  'tech.features.eyebrow': { kk: 'Негізгі мүмкіндіктер', ru: 'Ключевые возможности', en: 'Key features' },
  'tech.features.title': { kk: 'Нені жақсы істейді.', ru: 'Что он делает хорошо.', en: 'What it does well.' },
  'tech.chart.performance': { kk: 'Өнімділік', ru: 'Производительность', en: 'Performance' },
  'tech.chart.overTime': { kk: 'уақыт бойынша', ru: 'по времени', en: 'over time' },
  'tech.chart.latency': { kk: 'Кідіріс', ru: 'Задержка', en: 'Latency' },
  'tech.chart.perFrame': { kk: 'бір кадрға', ru: 'на кадр', en: 'per frame' },
  'tech.code.eyebrow': { kk: 'Жүзеге асыру мысалы', ru: 'Пример реализации', en: 'Implementation example' },
  'tech.code.title': { kk: 'Кодтағы жүзеге асыру.', ru: 'Реализация в коде.', en: 'Implementation in code.' },
  'tech.steps.eyebrow': { kk: 'Qyran оны қалай қолданады', ru: 'Как Qyran это использует', en: 'How Qyran uses it' },
  'tech.steps.title': { kk: 'Тізбек.', ru: 'Конвейер.', en: 'The pipeline.' },

  /* ---------------------------------------------------------------- MediaPipe */
  'tech.mediapipe.tagline': { kk: 'Қол мен дене нүктелері', ru: 'Точки рук и тела', en: 'Hand & body landmarks' },
  'tech.mediapipe.badge': { kk: 'Google-дің ML шешімі', ru: 'ML-решение от Google', en: "Google's ML Solution" },
  'tech.mediapipe.description': {
    kk: 'MediaPipe — Qyran-дағы қолды нақты уақытта бақылау жүйесінің негізі: құрылғының өзінде жұмыс істейтін жылдам машиналық оқыту, ым тілін дәл тану және құпиялылыққа нұқсан келтірмеу.',
    ru: 'MediaPipe — основа системы отслеживания рук в Qyran: очень быстрое машинное обучение прямо на устройстве, точное распознавание жестового языка и никакого ущерба приватности.',
    en: "MediaPipe is the backbone of Qyran's real-time hand tracking system, providing blazing-fast, on-device machine learning for accurate sign language recognition without compromising privacy.",
  },

  'tech.mediapipe.f1.title': { kk: 'Қолдың 21 нүктесі', ru: '21 точка руки', en: '21 hand landmarks' },
  'tech.mediapipe.f1.desc': {
    kk: 'Қолдың 21 үш өлшемді нүктесін нақты уақытта бақылайды — ымды толық талдауға жетеді.',
    ru: 'Отслеживает 21 трёхмерную точку руки в реальном времени — этого хватает для полного разбора жеста.',
    en: 'Tracks 21 3D hand keypoints in real-time for comprehensive gesture recognition.',
  },
  'tech.mediapipe.f1.metric': { kk: 'дәлдігі 99,2%', ru: 'точность 99,2%', en: '99.2% accuracy' },

  'tech.mediapipe.f2.title': { kk: 'Нақты уақыттағы өңдеу', ru: 'Обработка в реальном времени', en: 'Real-time processing' },
  'tech.mediapipe.f2.desc': {
    kk: 'Телефонда секундына 60 кадр жылдамдығында өте төмен кідіріс.',
    ru: 'Сверхнизкая задержка при 60 кадрах в секунду на телефоне.',
    en: 'Ultra-low latency processing at 60 FPS on mobile devices.',
  },
  'tech.mediapipe.f2.metric': { kk: 'кідіріс < 40 мс', ru: 'задержка < 40 мс', en: '< 40ms latency' },

  'tech.mediapipe.f3.title': { kk: 'Құрылғыдағы ML', ru: 'ML на устройстве', en: 'On-device ML' },
  'tech.mediapipe.f3.desc': {
    kk: 'TensorFlow Lite арқылы толығымен құрылғыда жұмыс істейді — жылдамырақ әрі құпиялырақ.',
    ru: 'Работает целиком на устройстве через TensorFlow Lite — быстрее и приватнее.',
    en: 'Runs entirely on-device using TensorFlow Lite for maximum privacy and speed.',
  },
  'tech.mediapipe.f3.metric': { kk: 'Желісіз', ru: 'Без сети', en: 'Zero network' },

  'tech.mediapipe.f4.title': { kk: 'Екі қолды бірден', ru: 'Обе руки сразу', en: 'Multi-hand detection' },
  'tech.mediapipe.f4.desc': {
    kk: 'Бірнеше қолды бір мезгілде жоғары дәлдікпен тауып, бақылайды.',
    ru: 'Одновременно находит и ведёт несколько рук с высокой точностью.',
    en: 'Simultaneously detects and tracks multiple hands with high precision.',
  },
  'tech.mediapipe.f4.metric': { kk: '2 қолға дейін', ru: 'До 2 рук', en: 'Up to 2 hands' },

  'tech.mediapipe.metric.primary': { kk: 'Ең жоғары дәлдік', ru: 'Пиковая точность', en: 'Peak accuracy' },
  'tech.mediapipe.metric.secondary': { kk: 'Орташа кідіріс', ru: 'Средняя задержка', en: 'Avg. latency' },
  'tech.mediapipe.series.accuracy': { kk: 'дәлдік', ru: 'точность', en: 'accuracy' },
  'tech.mediapipe.series.latency': { kk: 'кідіріс', ru: 'задержка', en: 'latency' },

  'tech.mediapipe.s1.title': { kk: 'Қолды табу', ru: 'Поиск руки', en: 'Hand detection' },
  'tech.mediapipe.s1.body': {
    kk: 'MediaPipe тікелей видеодан қолдарды секундына 60 кадр жылдамдығымен табады.',
    ru: 'MediaPipe находит руки в живом видео со скоростью 60 кадров в секунду.',
    en: 'MediaPipe identifies hands in the live video feed at 60 FPS.',
  },
  'tech.mediapipe.s2.title': { kk: 'Нүктелерді алу', ru: 'Съём точек', en: 'Landmark extraction' },
  'tech.mediapipe.s2.body': {
    kk: 'Әр қолдан 21 үш өлшемді нүкте алынады, қалыпқа келтіріліп, тегістеледі.',
    ru: 'С каждой руки снимается 21 трёхмерная точка — их нормализуют и сглаживают.',
    en: '21 3D keypoints per hand are extracted, normalized, and smoothed.',
  },
  'tech.mediapipe.s3.title': { kk: 'Ымды тану', ru: 'Распознавание жеста', en: 'Gesture recognition' },
  'tech.mediapipe.s3.body': {
    kk: 'Qyran нейрожелісі нүктелер жиынын РЖЯ ымына жатқызады.',
    ru: 'Нейросеть Qyran относит набор точек к жесту РЖЯ.',
    en: "Qyran's neural network classifies the landmarks into RSL signs.",
  },

  'tech.mediapipe.outro1.pre': { kk: 'MediaPipe — Qyran ым тану тізбегінің ', ru: 'MediaPipe — это ', en: 'MediaPipe serves as the ' },
  'tech.mediapipe.outro1.hl': { kk: 'негізгі қабаты', ru: 'фундамент', en: 'foundational layer' },
  'tech.mediapipe.outro1.post': {
    kk: '. Қолдағы 21 нүктені телефонда секундына 60 кадр жылдамдығымен дәл бақылай алуы ымды кідіріссіз, нақты уақытта тануға мүмкіндік береді.',
    ru: ' всего конвейера распознавания жестов Qyran. Умение точно отслеживать 21 точку руки при 60 кадрах в секунду прямо на телефоне даёт распознавание в реальном времени, без задержек.',
    en: " of Qyran's sign language recognition pipeline. Its ability to accurately track 21 hand landmarks at 60 FPS on mobile devices enables seamless, real-time gesture recognition without any lag.",
  },
  'tech.mediapipe.outro2.pre': { kk: 'Толығымен ', ru: 'Работая целиком ', en: 'By running entirely ' },
  'tech.mediapipe.outro2.hl': { kk: 'құрылғының өзінде', ru: 'на устройстве', en: 'on-device' },
  'tech.mediapipe.outro2.post': {
    kk: ' жұмыс істейтіндіктен, MediaPipe пайдаланушының видеосы телефоннан шықпайтынына кепілдік береді. Құпиялылық ең жоғары деңгейде, ал нәтиже — лезде. Мұндай құрылым Qyran-ға интернетсіз жұмыс істеуге және ымды 50 мс-тан жылдам талдауға мүмкіндік береді, сол себепті естімейтін және нашар еститін адамдар үшін әңгіме табиғи сезіледі.',
    ru: ', MediaPipe гарантирует: видео пользователя не покидает телефон. Приватность на максимуме, а результат мгновенный. Такая архитектура позволяет Qyran работать без интернета и разбирать жест быстрее 50 мс, из-за чего разговор ощущается естественным для глухих и слабослышащих.',
    en: ", MediaPipe ensures users' video data never leaves their phone, maintaining the highest standards of privacy while delivering instantaneous results. This architecture allows Qyran to function offline and process signs with sub-50ms latency, creating a natural conversation experience for deaf and hard-of-hearing users.",
  },
  'tech.mediapipe.outro3.pre': {
    kk: 'MediaPipe-тың қолды бақылауы мен Qyran-ның өз тану модельдері саладағы ең жоғары ',
    ru: 'Связка отслеживания рук в MediaPipe и собственных моделей распознавания Qyran даёт лучшую в отрасли ',
    en: "The combination of MediaPipe's hand tracking and Qyran's custom-trained gesture recognition models achieves an industry-leading ",
  },
  'tech.mediapipe.outro3.hl': { kk: '98,7% дәлдікті', ru: 'точность 98,7%', en: '98.7% accuracy rate' },
  'tech.mediapipe.outro3.post': {
    kk: ' береді — орыс ымдау тілінде (РЖЯ).',
    ru: ' на русском жестовом языке (РЖЯ).',
    en: ' on Russian Sign Language (RSL).',
  },

  /* ------------------------------------------------------------ TensorFlow.js */
  'tech.tensorflow.tagline': { kk: 'Ымды жіктеу', ru: 'Классификация жестов', en: 'Sign classification' },
  'tech.tensorflow.badge': { kk: 'Браузердегі ML ортасы', ru: 'ML прямо в браузере', en: 'Browser-native ML runtime' },
  'tech.tensorflow.description': {
    kk: 'int8-ге дейін қысқартылған TensorFlow.js моделі ым жіктеуішін тікелей браузерде іске қосады: серверге барудың да, логотип суретінен ауыр жүктеменің де қажеті жоқ. Ондаған мың РЖЯ бейнеүзіндісінде үйретілген.',
    ru: 'Квантованная модель TensorFlow.js крутит классификатор жестов прямо в браузере: ни походов на сервер, ни загрузки тяжелее картинки логотипа. Обучена на десятках тысяч клипов РЖЯ.',
    en: 'A quantised TensorFlow.js model runs the sign classifier directly in the browser — no server round-trips, no model download bigger than a logo image. Trained on tens of thousands of RSL clips.',
  },

  'tech.tensorflow.f1.title': { kk: 'Құрылғыдағы болжам', ru: 'Вывод на устройстве', en: 'On-device inference' },
  'tech.tensorflow.f1.desc': {
    kk: 'Салмақтар бір рет жүктеледі, әрі қарай әр болжам жергілікті есептеледі — әр кадр сайын API-ге сұраныс жоқ.',
    ru: 'Веса скачиваются один раз, дальше каждое предсказание считается локально — никаких запросов к API на каждый кадр.',
    en: 'Model weights stream once, then every prediction stays local — no API call per frame.',
  },
  'tech.tensorflow.f1.metric': { kk: 'салмағы < 10 МБ', ru: 'веса < 10 МБ', en: '< 10MB weights' },

  'tech.tensorflow.f2.title': { kk: 'int8-ге дейін қысқарту', ru: 'Квантование в int8', en: 'Quantised int8' },
  'tech.tensorflow.f2.desc': {
    kk: 'Оқытудан кейінгі қысқарту модельді дәлдігін жоғалтпай төрт есе кішірейтеді — телефондарда да жылдам.',
    ru: 'Квантование после обучения ужимает модель вчетверо без потери точности — на телефонах тоже быстро.',
    en: 'Post-training quantisation cuts the model 4× without losing accuracy — fast on phones too.',
  },
  'tech.tensorflow.f2.metric': { kk: '4× кіші', ru: 'в 4× меньше', en: '4× smaller' },

  'tech.tensorflow.f3.title': { kk: 'WebGL арқылы жеделдету', ru: 'Ускорение через WebGL', en: 'WebGL acceleration' },
  'tech.tensorflow.f3.desc': {
    kk: 'Болжам WebGL шейдерлері арқылы видеокартада жүреді — жылдамдығы нативті кодқа жақын.',
    ru: 'Вывод идёт на видеокарте через шейдеры WebGL — скорость почти как у нативного кода.',
    en: 'Inference runs on the GPU through WebGL shaders, hitting native-class throughput.',
  },
  'tech.tensorflow.f3.metric': { kk: 'тұрақты 60 FPS', ru: 'стабильные 60 FPS', en: '60 FPS sustained' },

  'tech.tensorflow.f4.title': { kk: 'Модельді жүрісте ауыстыру', ru: 'Смена модели на лету', en: 'Hot-swap models' },
  'tech.tensorflow.f4.desc': {
    kk: 'Басқа ым тілі жұмыс үстінде жүктеледі — қолданбаны қайта қоспай, жүктеу терезесінсіз.',
    ru: 'Другой жестовый язык подгружается на ходу — без перезапуска приложения и окон загрузки.',
    en: 'Load a different sign language at runtime — no app reload, no download dialog.',
  },
  'tech.tensorflow.f4.metric': { kk: '15+ модель', ru: '15+ моделей', en: '15+ models' },

  'tech.tensorflow.metric.primary': { kk: '25-эпохадағы валидация дәлдігі', ru: 'Точность на валидации, эпоха 25', en: 'Validation accuracy at epoch 25' },
  'tech.tensorflow.metric.secondary': { kk: 'Телефондағы орташа болжам', ru: 'Средний вывод на телефоне', en: 'Avg. mobile inference' },
  'tech.tensorflow.series.train': { kk: 'оқыту', ru: 'обучение', en: 'train' },
  'tech.tensorflow.series.val': { kk: 'валидация', ru: 'валидация', en: 'validation' },
  'tech.tensorflow.series.ms': { kk: 'мс', ru: 'мс', en: 'ms' },
  'tech.tensorflow.device.desktop': { kk: 'Компьютер', ru: 'Компьютер', en: 'Desktop' },

  'tech.tensorflow.s1.title': { kk: 'Кадр кіреді', ru: 'Кадр на вход', en: 'Frame in' },
  'tech.tensorflow.s1.body': {
    kk: '21 нүктеден тұратын вектор MediaPipe-тан шамамен әр 16 мс сайын келеді.',
    ru: 'Вектор из 21 точки приходит от MediaPipe примерно каждые 16 мс.',
    en: 'A 21-landmark vector arrives from MediaPipe every ~16ms.',
  },
  'tech.tensorflow.s2.title': { kk: 'Болжам', ru: 'Вывод', en: 'Inference' },
  'tech.tensorflow.s2.body': {
    kk: 'TF.js int8 графын WebGL-де жүргізеді — көп телефонда 20 мс-тан аз.',
    ru: 'TF.js прогоняет int8-граф на WebGL — меньше 20 мс на большинстве телефонов.',
    en: 'TF.js runs the int8 graph on WebGL — under 20ms on most phones.',
  },
  'tech.tensorflow.s3.title': { kk: 'Тегістеу және шығару', ru: 'Сглаживание и вывод', en: 'Smooth + emit' },
  'tech.tensorflow.s3.body': {
    kk: 'Жылжымалы терезе шулы кадрларды басып, таза ым белгісін береді.',
    ru: 'Скользящее окно гасит шумные кадры и отдаёт чистую метку жеста.',
    en: 'A sliding window stabilises noisy frames and emits a clean sign label.',
  },

  'tech.tensorflow.outro1.pre': {
    kk: 'Жіктеуіш PyTorch-та РЖЯ деректер жиынында үйретілген, содан кейін ONNX-ке шығарылып, оқытудан кейінгі int8 қысқартуымен TensorFlow.js-ке көшірілген. Браузердегі орта ',
    ru: 'Классификатор обучен в PyTorch на датасете РЖЯ, затем экспортирован в ONNX и переведён в TensorFlow.js с квантованием int8 после обучения. Рантайм в браузере укладывается в ',
    en: 'The classifier was trained in PyTorch on an RSL dataset, then exported to ONNX and converted to TensorFlow.js with int8 post-training quantisation. The browser-side runtime stays under ',
  },
  'tech.tensorflow.outro1.hl': { kk: '10 МБ', ru: '10 МБ', en: '10 MB' },
  'tech.tensorflow.outro1.post': {
    kk: ' шегінен аспайды және алғаш жүктелгенде шамамен 600 мс-та қосылады.',
    ru: ' и стартует примерно за 600 мс при первой загрузке.',
    en: ' and starts up in roughly 600 ms on first load.',
  },
  'tech.tensorflow.outro2': {
    kk: 'Жіктеу клиент жағында жүргендіктен, Qyran интернеті нашар сыныптарда да, клиникалардағы жабық киоскілерде де, камера кадрлары құрылғыдан шықпауы керек жеке әңгімелерде де жұмыс істейді.',
    ru: 'Классификация на стороне клиента значит, что Qyran работает и в классах с плохим интернетом, и в клиниках на закрытых киосках, и в личных разговорах, где кадры с камеры не должны покидать устройство.',
    en: 'Running classification client-side means we can run Qyran in classrooms with flaky internet, in clinics on locked-down kiosks, and in private conversations where the camera frames must never leave the device.',
  },

  /* ------------------------------------------------------------------ PyTorch */
  'tech.pytorch.tagline': { kk: 'Оқыту тізбегі', ru: 'Конвейер обучения', en: 'Training pipeline' },
  'tech.pytorch.badge': { kk: 'Зерттеу → өнім', ru: 'Исследование → продакшен', en: 'Research → production' },
  'tech.pytorch.description': {
    kk: 'Qyran модельдері PyTorch-та дүниеге келеді. Өз деректер жиындары, трансформерге негізделген тізбектік модельдер және естімейтіндер қауымымен тығыз кері байланыс әр шығарылымды қалыптастырады. Үйретілген салмақтар кейін браузерге арнап шығарылып, қысқартылады.',
    ru: 'В PyTorch рождаются модели Qyran. Свои датасеты, последовательностные модели на трансформерах и плотная обратная связь с сообществом глухих формируют каждый релиз. Обученные веса потом экспортируются и квантуются для браузера.',
    en: "PyTorch is where Qyran's models are born. Custom datasets, transformer-style sequence models, and a tight feedback loop with the Deaf community shape every release. The trained weights are then exported and quantised for the browser.",
  },

  'tech.pytorch.f1.title': { kk: 'Динамикалық графтар', ru: 'Динамические графы', en: 'Dynamic graphs' },
  'tech.pytorch.f1.desc': {
    kk: 'Define-by-run архитектураларды жылдам сынауға мүмкіндік береді: қабат қостың, шығын қисығын көрдің, шығардың.',
    ru: 'Define-by-run позволяет быстро пробовать архитектуры: добавил слой, посмотрел кривую потерь, выкатил.',
    en: 'Define-by-run lets us prototype gesture architectures fast — try a layer, see the loss curve, ship.',
  },
  'tech.pytorch.f1.metric': { kk: 'Бірнеше минутта итерация', ru: 'Итерация за минуты', en: 'Iterate in minutes' },

  'tech.pytorch.f2.title': { kk: 'Ашық деректер жиыны', ru: 'Открытый датасет', en: 'Open dataset' },
  'tech.pytorch.f2.desc': {
    kk: 'РЖЯ бойынша 20 мыңнан астам белгіленген бейнеүзінді — ашық SLOVO деректер жинағы.',
    ru: '20 тысяч размеченных клипов РЖЯ — открытый датасет SLOVO.',
    en: '20K labelled RSL clips — the open SLOVO dataset.',
  },
  'tech.pytorch.f2.metric': { kk: '20 400 үлгі', ru: '20 400 образцов', en: '20,400 samples' },

  'tech.pytorch.f3.title': { kk: 'Трансформер энкодері', ru: 'Трансформерный энкодер', en: 'Transformer encoder' },
  'tech.pytorch.f3.desc': {
    kk: '21 нүктелі тізбектер үстіндегі алты қабатты self-attention энкодері қол пішінінің ауысуын аңғарады.',
    ru: 'Шестислойный энкодер с self-attention над последовательностями из 21 точки ловит переходы между конфигурациями руки.',
    en: '6-layer self-attention encoder over 21-landmark sequences captures temporal handshape transitions.',
  },
  'tech.pytorch.f3.metric': { kk: '6 қабат · 8 бас', ru: '6 слоёв · 8 голов', en: '6 layers · 8 heads' },

  'tech.pytorch.f4.title': { kk: 'Қайталанатын зерттеу', ru: 'Воспроизводимое исследование', en: 'Reproducible research' },
  'tech.pytorch.f4.desc': {
    kk: 'Әр шығарылымда оқыту сценарийі, деректер жиынының картасы және валидация есебі бар.',
    ru: 'В каждом релизе лежат скрипт обучения, карточка датасета и отчёт о валидации.',
    en: 'Every release ships the training script, dataset card, and validation report.',
  },
  'tech.pytorch.f4.metric': { kk: 'Ашық салмақтар', ru: 'Открытые веса', en: 'Open weights' },

  'tech.pytorch.metric.primary': { kk: 'Соңғы кросс-энтропия шығыны', ru: 'Итоговая кросс-энтропия', en: 'Final cross-entropy loss' },
  'tech.pytorch.metric.secondary': { kk: 'Жиналған белгіленген бейнеүзінді', ru: 'Собрано размеченных клипов', en: 'Labelled clips collected' },
  'tech.pytorch.series.loss': { kk: 'шығын', ru: 'потери', en: 'loss' },
  'tech.pytorch.series.samples': { kk: 'үлгілер', ru: 'образцы', en: 'samples' },
  'tech.pytorch.month.jan': { kk: 'Қаң', ru: 'Янв', en: 'Jan' },
  'tech.pytorch.month.feb': { kk: 'Ақп', ru: 'Фев', en: 'Feb' },
  'tech.pytorch.month.mar': { kk: 'Нау', ru: 'Мар', en: 'Mar' },
  'tech.pytorch.month.apr': { kk: 'Сәу', ru: 'Апр', en: 'Apr' },
  'tech.pytorch.month.may': { kk: 'Мам', ru: 'Май', en: 'May' },
  'tech.pytorch.month.jun': { kk: 'Мау', ru: 'Июн', en: 'Jun' },

  'tech.pytorch.s1.title': { kk: 'Жинау', ru: 'Сбор', en: 'Collect' },
  'tech.pytorch.s1.body': {
    kk: 'Ым тілінің иелері бейнеүзінді жазады, естімейтін кеңесшілер әр шығарылым сайын оларды белгілейді.',
    ru: 'Носители языка записывают клипы, глухие консультанты размечают их к каждому релизу.',
    en: 'Native signers record clips, labelled by Deaf consultants on every release.',
  },
  'tech.pytorch.s2.title': { kk: 'Оқыту', ru: 'Обучение', en: 'Train' },
  'tech.pytorch.s2.body': {
    kk: 'Трансформер энкодері 21 нүктелі тізбектерде Adam және белгілерді тегістеу арқылы үйренеді.',
    ru: 'Трансформерный энкодер учится на последовательностях из 21 точки: Adam и сглаживание меток.',
    en: 'A transformer encoder is trained on 21-landmark sequences with Adam + label smoothing.',
  },
  'tech.pytorch.s3.title': { kk: 'Шығару', ru: 'Экспорт', en: 'Export' },
  'tech.pytorch.s3.body': {
    kk: 'Салмақтар ONNX арқылы браузерге арналған TensorFlow.js ортасына көшеді.',
    ru: 'Веса уходят через ONNX в TensorFlow.js для браузерного рантайма.',
    en: 'Weights flow through ONNX into TensorFlow.js for the browser runtime.',
  },

  'tech.pytorch.outro1': {
    kk: 'Зерттеу кезінде модель толығымен PyTorch-та тұрады — аугментациялар, абляциялар, гиперпараметрлерді сұрыптау. Содан кейін детерминистік шығару тізбегі (PyTorch → ONNX → int8 қысқартуымен TF.js) оны мінез-құлқын өзгертпей өнімге береді.',
    ru: 'Во время исследования модель целиком живёт в PyTorch — аугментации, абляции, переборы гиперпараметров. Затем детерминированный экспорт (PyTorch → ONNX → TF.js с квантованием int8) передаёт её в продакшен без изменения поведения.',
    en: 'The model lives in PyTorch end-to-end during research — augmentations, ablations, sweeps. Then a deterministic export pipeline (PyTorch → ONNX → TF.js with int8 quantisation) hands it off to production with no behavioural drift.',
  },
  'tech.pytorch.outro2.pre': { kk: 'Әр шығарылымға ', ru: 'К каждому релизу мы публикуем ', en: 'Every release we publish a ' },
  'tech.pytorch.outro2.hl': { kk: 'деректер жиынының картасын', ru: 'карточку датасета', en: 'dataset card' },
  'tech.pytorch.outro2.post': {
    kk: ' жариялаймыз: сыныптардың теңгерімі, түсірілгендердің құрамы, әр сынып бойынша қателер кестесі. Әр бейнеүзінді үшін естімейтіндер қауымына ақы төлейміз, ал қатысушылар өзгерістер тізімінде аталады.',
    ru: ': баланс классов, состав снимавшихся, матрица ошибок по классам. За каждый клип мы платим сообществу глухих, а участники перечислены в списке изменений.',
    en: ' showing class balance, signer demographics, and per-class confusion. We pay the Deaf community for every clip, and contributors are credited in the changelog.',
  },

  /* ------------------------------------------------------------------- OpenCV */
  'tech.opencv.tagline': { kk: 'Кадрды алдын ала өңдеу', ru: 'Предобработка кадра', en: 'Frame preprocessing' },
  'tech.opencv.badge': { kk: 'Сыналған компьютерлік көру құралдары', ru: 'Проверенные примитивы компьютерного зрения', en: 'Battle-tested CV primitives' },
  'tech.opencv.description': {
    kk: 'Кадр модельге жетпес бұрын оны OpenCV тазалайды: қол аймағын қиып алу, жарықты теңестіру, дірілді басу, қозғалыстан пайда болған бұлдырды жою. Бір кадрға кететін жұмыс аз, ал әрі қарайғы жіктеуішке айтарлықтай оңай.',
    ru: 'Прежде чем кадр дойдёт до модели, его чистит OpenCV: обрезать область руки, выровнять освещение, погасить дрожание, побороть смаз от движения. Работы на кадр немного, а классификатору дальше заметно спокойнее.',
    en: 'Before any frame reaches the model, OpenCV cleans it up. Crop the hand region, normalise lighting, smooth jitter, fight motion blur. Tiny per-frame work, huge stability gains for the downstream classifier.',
  },

  'tech.opencv.f1.title': { kk: 'Қажет аймақты қиып алу', ru: 'Обрезка по области интереса', en: 'Region of interest crop' },
  'tech.opencv.f1.desc': {
    kk: 'Қолдың шеңберімен қиямыз — жіктеуіш фонды емес, сигналды көреді.',
    ru: 'Режем по рамке руки, чтобы классификатор видел сигнал, а не фон.',
    en: 'Cut around the hand bounding box so the classifier sees signal, not background noise.',
  },
  'tech.opencv.f1.metric': { kk: '~2× жылдамдық', ru: 'ускорение ~2×', en: '~2× speed up' },

  'tech.opencv.f2.title': { kk: 'Гистограмманы теңестіру', ru: 'Нормализация гистограммы', en: 'Histogram normalisation' },
  'tech.opencv.f2.desc': {
    kk: 'Кадрлар арасындағы жарықты теңестіреді: модель күн түскен бөлмеде де, ымыртта да бірдей жұмыс істейді.',
    ru: 'Выравнивает освещение между кадрами: модель одинаково работает и в солнечной комнате, и в полумраке.',
    en: 'Equalises lighting across frames so the model generalises from sunlit rooms to dim ones.',
  },
  'tech.opencv.f2.metric': { kk: 'дәлдікке + 12%', ru: '+ 12% к точности', en: '+ 12% accuracy' },

  'tech.opencv.f3.title': { kk: 'Уақыт бойынша тегістеу', ru: 'Сглаживание во времени', en: 'Temporal smoothing' },
  'tech.opencv.f3.desc': {
    kk: 'Қол орнына қойылған шағын Калман тәрізді сүзгі дірілді басады, кідіріс қоспайды.',
    ru: 'Небольшой фильтр вроде калмановского гасит дрожание позиции руки и не добавляет задержки.',
    en: 'A small Kalman-like filter on hand position kills jitter without adding latency.',
  },
  'tech.opencv.f3.metric': { kk: 'тұрақтылық < 2 px', ru: 'стабильность < 2 px', en: '< 2px stable' },

  'tech.opencv.f4.title': { kk: 'Қозғалыс бұлдырын жою', ru: 'Убираем смаз движения', en: 'Motion deblur' },
  'tech.opencv.f4.desc': {
    kk: 'Жеңіл Винер тәрізді өңдеу адам ымды жылдам көрсеткенде шеттерді қайта айқындайды.',
    ru: 'Лёгкий винеровский деблюр возвращает чёткие края, когда человек показывает жест быстро.',
    en: 'Lightweight Wiener-style deblur recovers crisp edges when the signer moves fast.',
  },
  'tech.opencv.f4.metric': { kk: '40% айқынырақ', ru: 'на 40% чётче', en: '40% sharper' },

  'tech.opencv.metric.primary': { kk: 'Тізбек бойында алынған шу', ru: 'Шума убрано за конвейер', en: 'Noise reduced through pipeline' },
  'tech.opencv.metric.secondary': { kk: 'Флагман құрылғыларда', ru: 'На флагманских устройствах', en: 'On flagship devices' },
  'tech.opencv.series.noise': { kk: 'шу', ru: 'шум', en: 'noise' },
  'tech.opencv.stage.raw': { kk: 'Шикі', ru: 'Сырой', en: 'Raw' },
  'tech.opencv.stage.crop': { kk: 'Қию', ru: 'Обрезка', en: 'Crop' },
  'tech.opencv.stage.norm': { kk: 'Теңест.', ru: 'Норм.', en: 'Norm' },
  'tech.opencv.stage.smooth': { kk: 'Тегіс.', ru: 'Сглаж.', en: 'Smooth' },
  'tech.opencv.stage.out': { kk: 'Шығыс', ru: 'Выход', en: 'Out' },
  'tech.opencv.device.midAndroid': { kk: 'Орташа Android', ru: 'Средний Android', en: 'Mid Android' },
  'tech.opencv.device.oldAndroid': { kk: 'Ескі Android', ru: 'Старый Android', en: 'Old Android' },

  'tech.opencv.s1.title': { kk: 'Қию', ru: 'Обрезка', en: 'Crop' },
  'tech.opencv.s1.body': {
    kk: 'MediaPipe берген қол шеңбері бойынша, білезік те кіретіндей қормен.',
    ru: 'По рамке руки от MediaPipe с запасом, чтобы запястье попало в кадр.',
    en: 'Around the MediaPipe hand bbox with padding so the wrist is included.',
  },
  'tech.opencv.s2.title': { kk: 'Теңестіру', ru: 'Нормализация', en: 'Normalise' },
  'tech.opencv.s2.body': {
    kk: 'CLAHE гистограмманы теңестіреді — жіктеуіш тұрақты жарық көреді.',
    ru: 'CLAHE выравнивает гистограмму — классификатор видит стабильное освещение.',
    en: 'CLAHE evens the histogram. The classifier sees consistent lighting.',
  },
  'tech.opencv.s3.title': { kk: 'Тегістеу', ru: 'Сглаживание', en: 'Smooth' },
  'tech.opencv.s3.body': {
    kk: 'Билатералды сүзгі дірілді жояды, бірақ саусақ шеттерін өткір қалдырады.',
    ru: 'Билатеральный фильтр убирает дрожание, но края пальцев оставляет резкими.',
    en: 'Bilateral filter knocks out jitter, but keeps finger edges sharp.',
  },

  'tech.opencv.outro1': {
    kk: 'OpenCV — көзге түспейтін жұмысшы: айқайлы тақырыпсыз, жай ғана тұрақты кадр тізбегі, оның арқасында әрі қарайғының бәрі жеңілдейді. Мұнда алынған шу TF.js жіктеуішіне сол дәлдікке жету үшін азырақ параметр керек дегенді білдіреді — құрылғыдағы ортаны шағын ұстап тұрған да осы.',
    ru: 'OpenCV — незаметная рабочая лошадка: без заголовков, просто ровный конвейер кадров, от которого всему дальнейшему легче. Убранный здесь шум значит, что классификатору на TF.js нужно меньше параметров для той же точности — именно это держит рантайм на устройстве маленьким.',
    en: 'OpenCV is the unsexy workhorse: no headlines, just a steady frame pipeline that makes everything downstream easier. Cutting noise here means the TF.js classifier needs fewer parameters to hit the same accuracy — which is what keeps the on-device runtime small.',
  },
  'tech.opencv.outro2.pre': {
    kk: 'Ескі Android құрылғыларында бүкіл алдын ала өңдеу тізбегі ',
    ru: 'На старых Android вся цепочка предобработки укладывается в ',
    en: 'On older Android devices the entire preprocessing chain stays under ',
  },
  'tech.opencv.outro2.hl': { kk: 'бір кадрға 4 мс', ru: '4 мс на кадр', en: '4 ms per frame' },
  'tech.opencv.outro2.post': {
    kk: ' шегінен аспайды, сондықтан 16 мс (секундына 60 кадр) терезесіне MediaPipe те, модель болжамы да еркін сыяды.',
    ru: ', так что в окно 16 мс (60 кадров в секунду) спокойно помещаются и MediaPipe, и вывод модели.',
    en: ', leaving plenty of budget for MediaPipe and inference inside the 16 ms 60 FPS window.',
  },
};
