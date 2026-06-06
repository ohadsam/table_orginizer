'use strict';

const CONFIG = Object.freeze({
  STORAGE_KEY: 'seating_planner_v2',
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
    dancefloor:    '#f3e5f5',
    dj:            '#e8eaf6',
    door:          '#e8f5e9',
    shape:         '#fafafa'
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

  LOCK_COLOR: '#ff8f00',

  EVENT_TYPES: {
    wedding:     'חתונה',
    bar_mitzvah: 'בר מצווה',
    bat_mitzvah: 'בת מצווה',
    birthday:    'יום הולדת',
    other:       'אחר'
  }
});
