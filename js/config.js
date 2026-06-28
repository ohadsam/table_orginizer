'use strict';

const CONFIG = Object.freeze({
  APP_VERSION:          '2.2',
  STORAGE_KEY:          'seating_planner_v2',        // legacy — kept for migration only
  STORAGE_META_KEY:     'seating_planner_meta',
  STORAGE_EVENT_PREFIX: 'seating_planner_event_',
  CANVAS_WIDTH: 4000,
  CANVAS_HEIGHT: 3000,
  MIN_ZOOM: 0.15,
  MAX_ZOOM: 3,
  ZOOM_STEP: 0.15,
  GRID_SIZE: 25,

  TABLE_SIZES: {
    circle:    { width: 130, height: 130 },
    square:    { width: 130, height: 130 },
    rectangle: { width: 170, height: 110 }
  },
  DANCEFLOOR_SIZE:  { width: 320, height: 220 },
  DJ_SIZE:          { width: 160, height: 90  },
  DOOR_SIZE:        { width: 80,  height: 30  },
  SHAPE_SIZE:       { width: 110, height: 110 },
  STAIRS_SIZE:      { width: 90,  height: 60  },
  ELEVATOR_SIZE:    { width: 60,  height: 60  },
  KITCHEN_SIZE:     { width: 120, height: 80  },
  BALCONY_SIZE:     { width: 160, height: 100 },
  POOL_SIZE:        { width: 200, height: 120 },
  WATERFALL_SIZE:   { width: 80,  height: 120 },
  BAR_SIZE:         { width: 160, height: 80  },
  STAGE_SIZE:       { width: 200, height: 100 },
  PHOTO_SIZE:       { width: 100, height: 80  },
  BUFFET_SIZE:      { width: 160, height: 80  },
  BATHROOM_SIZE:    { width: 60,  height: 50  },

  SEAT_RADIUS: 9,
  TABLE_PADDING: 16,

  COLORS: {
    tableEmpty:    '#e3f2fd',
    tablePartial:  '#fff9c4',
    tableFull:     '#ffe0b2',
    tableOver:     '#ffcdd2',
    seatEmpty:     '#b0bec5',
    seatOccupied:  '#43a047',
    seatOver:      '#e53935',
    seatMismatch:  '#ff8c00',
    dancefloor:    '#f3e5f5',
    dj:            '#e8eaf6',
    door:          '#e8f5e9',
    shape:         '#fafafa',
    stairs:        '#eceff1',
    elevator:      '#e8eaf6',
    kitchen:       '#fff3e0',
    balcony:       '#e8f5e9',
    pool:          '#e3f2fd',
    waterfall:     '#e1f5fe',
    bar:           '#fce4ec',
    stage:         '#f3e5f5',
    photo:         '#fff8e1',
    buffet:        '#fff3e0',
    bathroom:      '#f9fbe7'
  },

  TAG_PALETTE: [
    '#EF5350','#EC407A','#AB47BC','#5C6BC0',
    '#42A5F5','#26A69A','#66BB6A','#FFA726',
    '#FF7043','#8D6E63','#78909C','#26C6DA'
  ],

  DEFAULT_TAGS: ['משפחה','חברים','עבודה','שכנים','VIP','ילדים'],

  // Seating proximity preferences (used by smart auto-assign)
  PROXIMITY: {
    nearDance:    { label: 'קרוב לרחבה',  icon: '🕺', target: 'dancefloor', want: 'near' },
    farDance:     { label: 'רחוק מהרחבה', icon: '🤫', target: 'dancefloor', want: 'far'  },
    nearEntrance: { label: 'קרוב לכניסה', icon: '🚪', target: 'door',       want: 'near' }
  },

  // Guest dependency/relationship types for the dependency diagram
  DEPENDENCY_TYPES: {
    spouses:    { label: 'בני זוג',          strength: 'required',  color: '#EC407A', icon: '💑',  category: 'family'     },
    parents:    { label: 'הורים/ילדים',       strength: 'required',  color: '#AB47BC', icon: '👨‍👩‍👧', category: 'family'     },
    family:     { label: 'משפחה',             strength: 'preferred', color: '#66BB6A', icon: '👪',  category: 'family'     },
    friends:    { label: 'חברים',             strength: 'preferred', color: '#42A5F5', icon: '👫',  category: 'friends'    },
    colleagues: { label: 'עמיתים',            strength: 'preferred', color: '#26A69A', icon: '💼',  category: 'colleagues' },
    divorced:   { label: 'גרושים',            strength: 'avoid',     color: '#FFA726', icon: '💔',  category: 'apart'      },
    separated:  { label: 'פרודים/נפרדים',    strength: 'avoid',     color: '#FF8A65', icon: '😶',  category: 'apart'      },
    expartners: { label: 'שותפים לשעבר',    strength: 'avoid',     color: '#B0BEC5', icon: '🤷',  category: 'apart'      },
    conflict:   { label: 'לא מסתדרים',       strength: 'avoid',     color: '#FF7043', icon: '⚡',  category: 'conflict'   },
    prohibited: { label: 'אסור להושיב יחד', strength: 'forbidden', color: '#EF5350', icon: '🚫',  category: 'conflict'   }
  },

  DEPENDENCY_CATEGORIES: {
    family:     { label: 'משפחה',        icon: '👨‍👩‍👧', color: '#AB47BC' },
    friends:    { label: 'חברים',         icon: '👫',    color: '#42A5F5' },
    colleagues: { label: 'עמיתים',        icon: '💼',    color: '#26A69A' },
    apart:      { label: 'בנפרד',         icon: '💔',    color: '#FFA726' },
    conflict:   { label: 'לא מסתדרים',   icon: '⚡',    color: '#EF5350' }
  },

  DEFAULT_INFERENCE_RULES: [
    { id: 'ir_1', fromCat: 'family',     toCat: 'family',     resultType: 'family',     weight: 0.8, enabled: true },
    { id: 'ir_2', fromCat: 'friends',    toCat: 'friends',    resultType: 'friends',    weight: 0.5, enabled: true },
    { id: 'ir_3', fromCat: 'colleagues', toCat: 'colleagues', resultType: 'colleagues', weight: 0.5, enabled: true },
    { id: 'ir_4', fromCat: 'family',     toCat: 'friends',    resultType: 'friends',    weight: 0.3, enabled: true },
    { id: 'ir_5', fromCat: 'friends',    toCat: 'family',     resultType: 'friends',    weight: 0.3, enabled: false },
  ],

  LOCK_COLOR: '#ff8f00',

  EVENT_TYPES: {
    wedding:     'חתונה',
    bar_mitzvah: 'בר מצווה',
    bat_mitzvah: 'בת מצווה',
    birthday:    'יום הולדת',
    other:       'אחר'
  },

  CHANGELOG: {
    '2.2': {
      date: '2026-06-28',
      features: [
        { title: 'קטגוריות בסוגי קשרים', desc: 'כל סוג קשר משויך לקטגוריה (משפחה, חברים, בנפרד וכו׳) לתצוגה והסקה חכמה יותר', helpRef: '#dependencies' },
        { title: 'מסך כללי היסק', desc: 'לשונית חדשה "⚙️ כללי היסק" בתרשים הקשרים — הגדר, ערוך ומחק כללי הסקה אוטומטיים', helpRef: '#inference-rules' },
        { title: 'תצוגות תרשים', desc: 'תרשים קשרים עם 3 מצבי תצוגה: עיגול, אלפביתי ולפי קטגוריה, עם חיפוש מובנה', helpRef: '#dependencies' },
        { title: 'סוגי קשרים חדשים', desc: 'פרודים/נפרדים 😶 ושותפים לשעבר 🤷 — לציון הימנעות ישיבה משותפת', helpRef: '#dependencies' },
        { title: 'הצעות חכמות משופרות', desc: 'הצעות מבוססות-היסק בשתי לשוניות: בזמן הוספת קשר ובלשונית ההצעות', helpRef: '#dependencies' },
      ]
    },
    '2.1': {
      date: '2025-12-01',
      features: [
        { title: 'תלויות בין מוזמנים', desc: 'מערכת ניהול קשרים מלאה עם תרשים, הוספת קשר, טבלה, סוגי קשרים והצעות', helpRef: '#dependencies' },
        { title: 'שיבוץ אוטומטי חכם', desc: 'מינימום N ריצות, הגרלה מחדש (reroll), שמירה כפריסה, קבוצות תלויות', helpRef: '#autoassign' },
        { title: 'ניווט פריטים', desc: 'פאנל ניווט מהיר בצד שמאל לכל פריטי האולם עם תצוגה מקדימה', helpRef: '#canvas' },
      ]
    }
  },
});

