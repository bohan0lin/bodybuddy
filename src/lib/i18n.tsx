import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'

export type Lang = 'zh' | 'en'
const STORAGE_KEY = 'bodybuddy:lang'

type Dict = Record<string, string>

const zh: Dict = {
  // nav
  'nav.today': '今日',
  'nav.settings': '设置',
  'nav.logMeal': '记一餐',
  // common
  'common.backToday': '‹ 今日',
  'common.backTrend': '‹ 体重趋势',
  'common.backCalendar': '‹ 日历',
  'common.save': '保存',
  'common.cancel': '取消',
  'common.manage': '管理',
  'common.done': '完成',
  'common.noRecords': '还没有记录',
  // today
  'today.latestWeight': '最新体重',
  'today.bodyData': '身体数据',
  'today.pctFat': '% 体脂',
  'today.intake': '今日摄入',
  'today.logMeal': '记一餐',
  'today.kcal': '千卡',
  'today.aiButton': 'AI 生成今日饮食',
  'today.calendar': '记录日历',
  'day.total': '当日合计',
  'day.meals': '当日餐食',
  'day.empty': '这天还没有记录',
  // macros
  'macro.protein': '蛋白',
  'macro.carbs': '碳水',
  'macro.fat': '脂肪',
  // body
  'body.currentWeight': '当前体重',
  'body.bodyFatRate': '体脂率',
  'body.weightTrend': '体重趋势',
  'body.history': '历史记录',
  'body.trendEmpty': '再记录几次即可看到趋势曲线',
  'body.logOnce': '记录一次',
  'body.date': '日期',
  'body.weightKg': '体重 (kg)',
  'body.bodyFatOpt': '体脂 (%) 可选',
  // meal types
  'meal.breakfast': '早餐',
  'meal.lunch': '午餐',
  'meal.dinner': '晚餐',
  'meal.snack': '加餐',
  // log meal
  'log.photoTitle': '拍照识别食物',
  'log.photoSub': 'AI 估算营养并自动填入',
  'log.recognizing': '识别中…',
  'log.analyzing': 'AI 正在分析图片',
  'log.recogResult': '识别结果',
  'log.recogEmpty': '没识别出食物，换个角度或光线再拍试试',
  'log.recogHint': '点任意一项填入下方，可再微调分量',
  'log.freqFoods': '常用食物',
  'log.myMeals': '我的套餐',
  'log.noFreqFood': '还没有常用食物',
  'log.noFreqMeal': '还没有常用套餐',
  'log.saveHint': '在下方填写后勾选「保存到常用」即可',
  'log.mealType': '餐次',
  'log.foodName': '食物名称',
  'log.foodNamePh': '例如：鸡胸肉',
  'log.amount': '分量',
  'log.unit': '单位',
  'log.proteinG': '蛋白 (g)',
  'log.carbsG': '碳水 (g)',
  'log.fatG': '脂肪 (g)',
  'log.kcalField': '热量 (千卡)',
  'log.autoCal': '自动 {n}',
  'log.scaleHint': '营养值随分量自动换算 · 手动修改下方数值即可自定义',
  'log.saveToFreqFood': '保存到常用食物',
  'log.saveToFreqMeal': '保存到常用套餐',
  'log.saveBasis': '（按此分量为基准）',
  'log.saveRecord': '保存记录',
  'log.loggedToday': '今日已记录',
  'log.lookup': '查营养库',
  'log.looking': '查询中…',
  'log.lookupHit': '已用营养库数据填入',
  'log.lookupMiss': '营养库暂无，可手动填写',
  // units
  'unit.g': 'g',
  'unit.serving': '份',
  'unit.ml': 'ml',
  'unit.piece': '个',
  'unit.spoon': '勺',
  // settings
  'settings.personal': '个人信息',
  'settings.nickname': '昵称',
  'settings.heightCm': '身高 (cm)',
  'settings.dailyTargets': '每日目标',
  'settings.calKcal': '热量 (千卡)',
  'settings.saveTargets': '保存目标',
  'settings.saved': '已保存 ✓',
  'settings.account': '账号',
  'settings.signedIn': '已登录',
  'settings.signOut': '退出登录',
  'settings.language': '语言',
  'settings.theme': '主题',
  'theme.system': '跟随系统',
  'theme.light': '浅色',
  'theme.dark': '深色',
  'settings.energyUnit': '能量单位',
  'settings.energy': '热量',
  'settings.footer': 'BodyBuddy · 云端同步',
  'energy.kcal': '千卡',
  'energy.kJ': '千焦',
  'log.brand': '品牌 (可选)',
  'log.brandPh': '例如：某某牌',
  'log.edit': '编辑',
  'log.editing': '编辑常用项',
  'log.updateSaved': '更新常用',
  'log.searchPh': '搜索常用…',
  'log.noMatch': '没有匹配的常用项',
  'log.more': '更多',
  'log.allSaved': '全部常用',
  'log.editMeal': '编辑这一餐',
  'log.updateMeal': '更新记录',
  'log.addingTo': '补记到 {d}',
  // ai
  'ai.remaining': '还剩额度',
  'ai.fromLibrary': '从我的常用',
  'ai.fromLibrarySub': '食物 / 套餐里挑',
  'ai.general': '通用建议',
  'ai.generalSub': '不限于常用',
  'ai.headerLibrary': '从你的常用推荐',
  'ai.headerGeneral': '通用建议',
  'ai.thinking': '思考中…',
  'ai.regenerate': '重新生成',
  'ai.pickHint': '选一种方式，AI 会结合你今天已吃的来建议',
  'ai.failed': '生成失败：{msg}',
  'ai.noSuggestion': '暂时没有建议。',
  'ai.retryMsg': '请稍后再试',
  // login
  'login.welcomeBack': '欢迎回来',
  'login.createAccount': '创建账号',
  'login.email': '邮箱',
  'login.password': '密码',
  'login.passwordPh': '至少 6 位',
  'login.signIn': '登录',
  'login.signUp': '注册',
  'login.wait': '请稍候…',
  'login.toSignUp': '还没有账号？去注册',
  'login.toSignIn': '已有账号？去登录',
  'login.needConfirm': '注册成功 · 请到邮箱点击确认链接后再登录',
  'login.errInvalid': '邮箱或密码不正确',
  'login.errRegistered': '该邮箱已注册，请直接登录',
  'login.errPwLen': '密码至少需要 6 位',
  'login.errEmail': '请输入有效的邮箱地址',
  // assistant
  'assistant.title': 'AI 助手',
  'assistant.greeting': '你好！我能回答你的营养问题、帮你拍照记账、把食物加入常用。试试问我或说「帮我记录…」。',
  'assistant.placeholder': '问我，或说「帮我记录…」',
  'assistant.thinking': '思考中…',
  'assistant.confirm': '确认',
  'assistant.dismiss': '忽略',
  'assistant.logAction': '记录这一餐',
  'assistant.saveAction': '加入常用',
  'assistant.done': '已完成 ✓',
  'assistant.failed': '出错了，请重试',
  'assistant.busy': '模型有点忙（服务器繁忙），请过几秒再试一次 🙏',
  'assistant.photoReady': '已附带照片',
}

const en: Dict = {
  'nav.today': 'Today',
  'nav.settings': 'Settings',
  'nav.logMeal': 'Log meal',
  'common.backToday': '‹ Today',
  'common.backTrend': '‹ Weight trend',
  'common.backCalendar': '‹ Calendar',
  'common.save': 'Save',
  'common.cancel': 'Cancel',
  'common.manage': 'Manage',
  'common.done': 'Done',
  'common.noRecords': 'No records yet',
  'today.latestWeight': 'Latest weight',
  'today.bodyData': 'Body data',
  'today.pctFat': '% fat',
  'today.intake': "Today's intake",
  'today.logMeal': 'Log meal',
  'today.kcal': 'kcal',
  'today.aiButton': 'AI: plan today’s meals',
  'today.calendar': 'Log calendar',
  'day.total': 'Day total',
  'day.meals': 'Meals',
  'day.empty': 'Nothing logged this day',
  'macro.protein': 'Protein',
  'macro.carbs': 'Carbs',
  'macro.fat': 'Fat',
  'body.currentWeight': 'Current weight',
  'body.bodyFatRate': 'Body fat',
  'body.weightTrend': 'Weight trend',
  'body.history': 'History',
  'body.trendEmpty': 'Log a few more to see the trend',
  'body.logOnce': 'New entry',
  'body.date': 'Date',
  'body.weightKg': 'Weight (kg)',
  'body.bodyFatOpt': 'Body fat (%) optional',
  'meal.breakfast': 'Breakfast',
  'meal.lunch': 'Lunch',
  'meal.dinner': 'Dinner',
  'meal.snack': 'Snack',
  'log.photoTitle': 'Snap to identify food',
  'log.photoSub': 'AI estimates macros & fills in',
  'log.recognizing': 'Recognizing…',
  'log.analyzing': 'AI is analyzing the photo',
  'log.recogResult': 'Recognition result',
  'log.recogEmpty': 'No food found — try another angle or better light',
  'log.recogHint': 'Tap an item to fill in below, then tweak the amount',
  'log.freqFoods': 'Frequent foods',
  'log.myMeals': 'My meals',
  'log.noFreqFood': 'No frequent foods yet',
  'log.noFreqMeal': 'No saved meals yet',
  'log.saveHint': 'Fill in below and check "Save to library"',
  'log.mealType': 'Meal',
  'log.foodName': 'Food name',
  'log.foodNamePh': 'e.g. Chicken breast',
  'log.amount': 'Amount',
  'log.unit': 'Unit',
  'log.proteinG': 'Protein (g)',
  'log.carbsG': 'Carbs (g)',
  'log.fatG': 'Fat (g)',
  'log.kcalField': 'Calories (kcal)',
  'log.autoCal': 'auto {n}',
  'log.scaleHint': 'Macros auto-scale with amount · edit any value to override',
  'log.saveToFreqFood': 'Save to frequent foods',
  'log.saveToFreqMeal': 'Save to my meals',
  'log.saveBasis': '(using this amount as the base)',
  'log.saveRecord': 'Save',
  'log.loggedToday': 'Logged today',
  'log.lookup': 'Look up',
  'log.looking': 'Looking up…',
  'log.lookupHit': 'Filled from nutrition library',
  'log.lookupMiss': 'Not in library — fill manually',
  'unit.g': 'g',
  'unit.serving': 'serving',
  'unit.ml': 'ml',
  'unit.piece': 'piece',
  'unit.spoon': 'spoon',
  'settings.personal': 'Profile',
  'settings.nickname': 'Name',
  'settings.heightCm': 'Height (cm)',
  'settings.dailyTargets': 'Daily targets',
  'settings.calKcal': 'Calories (kcal)',
  'settings.saveTargets': 'Save targets',
  'settings.saved': 'Saved ✓',
  'settings.account': 'Account',
  'settings.signedIn': 'Signed in',
  'settings.signOut': 'Sign out',
  'settings.language': 'Language',
  'settings.theme': 'Theme',
  'theme.system': 'System',
  'theme.light': 'Light',
  'theme.dark': 'Dark',
  'settings.energyUnit': 'Energy unit',
  'settings.energy': 'Energy',
  'settings.footer': 'BodyBuddy · Cloud sync',
  'energy.kcal': 'kcal',
  'energy.kJ': 'kJ',
  'log.brand': 'Brand (optional)',
  'log.brandPh': 'e.g. a brand name',
  'log.edit': 'Edit',
  'log.editing': 'Editing saved item',
  'log.updateSaved': 'Update saved',
  'log.searchPh': 'Search saved…',
  'log.noMatch': 'No matching saved items',
  'log.more': 'More',
  'log.allSaved': 'All saved',
  'log.editMeal': 'Edit this meal',
  'log.updateMeal': 'Update entry',
  'log.addingTo': 'Logging to {d}',
  'ai.remaining': 'Remaining today',
  'ai.fromLibrary': 'From my library',
  'ai.fromLibrarySub': 'pick from foods & meals',
  'ai.general': 'General',
  'ai.generalSub': 'not limited to library',
  'ai.headerLibrary': 'From your library',
  'ai.headerGeneral': 'General suggestion',
  'ai.thinking': 'Thinking…',
  'ai.regenerate': 'Regenerate',
  'ai.pickHint': "Pick a mode — AI factors in what you've eaten today",
  'ai.failed': 'Failed: {msg}',
  'ai.noSuggestion': 'No suggestion right now.',
  'ai.retryMsg': 'please try again',
  'login.welcomeBack': 'Welcome back',
  'login.createAccount': 'Create account',
  'login.email': 'Email',
  'login.password': 'Password',
  'login.passwordPh': 'At least 6 characters',
  'login.signIn': 'Sign in',
  'login.signUp': 'Sign up',
  'login.wait': 'Please wait…',
  'login.toSignUp': "No account? Sign up",
  'login.toSignIn': 'Have an account? Sign in',
  'login.needConfirm': 'Registered · check your email to confirm, then sign in',
  'login.errInvalid': 'Incorrect email or password',
  'login.errRegistered': 'Email already registered — please sign in',
  'login.errPwLen': 'Password must be at least 6 characters',
  'login.errEmail': 'Please enter a valid email',
  // assistant
  'assistant.title': 'AI Assistant',
  'assistant.greeting': 'Hi! Ask me about your nutrition, snap a photo to log a meal, or add foods to your library. Try asking, or say "log …".',
  'assistant.placeholder': 'Ask me, or say "log …"',
  'assistant.thinking': 'Thinking…',
  'assistant.confirm': 'Confirm',
  'assistant.dismiss': 'Dismiss',
  'assistant.logAction': 'Log this meal',
  'assistant.saveAction': 'Save to library',
  'assistant.done': 'Done ✓',
  'assistant.failed': 'Something went wrong, try again',
  'assistant.busy': 'The model is busy right now — please try again in a few seconds 🙏',
  'assistant.photoReady': 'Photo attached',
}

const dict: Record<Lang, Dict> = { zh, en }

function detectLang(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'zh' || saved === 'en') return saved
  } catch {
    // ignore
  }
  return typeof navigator !== 'undefined' && navigator.language?.startsWith('zh') ? 'zh' : 'en'
}

interface I18nValue {
  lang: Lang
  setLang: (l: Lang) => void
  t: (key: string, vars?: Record<string, string | number>) => string
}

const I18nContext = createContext<I18nValue | null>(null)

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(detectLang)

  const setLang = useCallback((l: Lang) => {
    setLangState(l)
    try {
      localStorage.setItem(STORAGE_KEY, l)
    } catch {
      // ignore
    }
  }, [])

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) => {
      let s = dict[lang][key] ?? dict.zh[key] ?? key
      if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v))
      return s
    },
    [lang],
  )

  return <I18nContext.Provider value={{ lang, setLang, t }}>{children}</I18nContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useT(): I18nValue {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useT 必须在 I18nProvider 内使用')
  return ctx
}
