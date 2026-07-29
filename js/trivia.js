/** Catholic Trivia — question bank + helpers for Vehicle Strike gates. */

/** @typedef {{ q: string, choices: string[], answer: number, note?: string }} TriviaQ */

/** @type {TriviaQ[]} */
export const CATHOLIC_TRIVIA = [
  {
    q: 'How many sacraments are there in the Catholic Church?',
    choices: ['Five', 'Seven', 'Ten', 'Twelve'],
    answer: 1,
    note: 'Baptism, Confirmation, Eucharist, Penance, Anointing of the Sick, Holy Orders, Matrimony.',
  },
  {
    q: 'What prayer begins “Hail Mary, full of grace”?',
    choices: ['Our Father', 'Gloria', 'Hail Mary', 'Act of Contrition'],
    answer: 2,
  },
  {
    q: 'Who is the first Pope according to Catholic tradition?',
    choices: ['St. Paul', 'St. Peter', 'St. John', 'St. James'],
    answer: 1,
  },
  {
    q: 'What does “Catholic” literally mean?',
    choices: ['Holy', 'Universal', 'Ancient', 'Roman'],
    answer: 1,
  },
  {
    q: 'Which sacrament is also called Confession?',
    choices: ['Baptism', 'Confirmation', 'Penance / Reconciliation', 'Holy Orders'],
    answer: 2,
  },
  {
    q: 'What is the central act of Catholic worship?',
    choices: ['The Rosary', 'The Mass', 'Eucharistic Adoration alone', 'Stations of the Cross'],
    answer: 1,
  },
  {
    q: 'At Mass, Catholics believe the bread and wine become…',
    choices: ['Symbols only', 'The Body and Blood of Christ', 'Holy water', 'Blessed salt'],
    answer: 1,
    note: 'This teaching is called the Real Presence / Transubstantiation.',
  },
  {
    q: 'How many decades are in a standard Rosary set of mysteries?',
    choices: ['Three', 'Five', 'Seven', 'Ten'],
    answer: 1,
  },
  {
    q: 'Which season prepares for Christmas?',
    choices: ['Lent', 'Advent', 'Easter', 'Ordinary Time'],
    answer: 1,
  },
  {
    q: 'Which season prepares for Easter?',
    choices: ['Advent', 'Lent', 'Christmas', 'Pentecost'],
    answer: 1,
  },
  {
    q: 'What is the Triduum?',
    choices: ['Three Magi', 'Holy Thursday–Easter Vigil climax of the year', 'Three Popes', 'A Marian feast'],
    answer: 1,
  },
  {
    q: 'Who is Mary’s husband, foster-father of Jesus?',
    choices: ['Zechariah', 'Joseph', 'Nicodemus', 'Simeon'],
    answer: 1,
  },
  {
    q: 'The Immaculate Conception refers to…',
    choices: [
      'Jesus born without sin',
      'Mary conceived without original sin',
      'The Resurrection',
      'Pentecost',
    ],
    answer: 1,
  },
  {
    q: 'What are the two main parts of the Mass?',
    choices: [
      'Entrance & Exit',
      'Liturgy of the Word & Liturgy of the Eucharist',
      'Homily & Collection',
      'Confiteor & Creed',
    ],
    answer: 1,
  },
  {
    q: '“In the name of the Father, and of the Son, and of the Holy Spirit” invokes…',
    choices: ['The Trinity', 'The Apostles', 'The Saints', 'The Angels'],
    answer: 0,
  },
  {
    q: 'Which Gospel is not one of the four?',
    choices: ['Matthew', 'Thomas', 'Luke', 'John'],
    answer: 1,
  },
  {
    q: 'Pentecost celebrates…',
    choices: ['Jesus’ birth', 'The coming of the Holy Spirit', 'The Ascension only', 'All Souls'],
    answer: 1,
  },
  {
    q: 'Ash Wednesday begins which season?',
    choices: ['Advent', 'Lent', 'Easter', 'Christmas'],
    answer: 1,
  },
  {
    q: 'A bishop’s ordinary church is called a…',
    choices: ['Chapel', 'Oratory', 'Cathedral', 'Basilica only'],
    answer: 2,
  },
  {
    q: 'What is a patron saint?',
    choices: [
      'A saint who founded Rome',
      'A saint invoked as special protector of a place, person, or cause',
      'Any priest',
      'The Pope’s secretary',
    ],
    answer: 1,
  },
  {
    q: 'The Sign of the Cross recalls…',
    choices: ['Noah’s ark', 'Christ’s Cross and the Trinity', 'The Exodus only', 'Purim'],
    answer: 1,
  },
  {
    q: 'Holy Orders confers ministry as…',
    choices: ['Only monks', 'Bishop, priest, or deacon', 'Only the Pope', 'Lay lectors alone'],
    answer: 1,
  },
  {
    q: 'What do Catholics celebrate on Easter?',
    choices: ['Jesus’ baptism', 'The Resurrection of Jesus', 'The Last Supper only', 'Mary’s birthday'],
    answer: 1,
  },
  {
    q: 'The Our Father was taught by…',
    choices: ['Moses', 'Jesus', 'St. Paul', 'King David'],
    answer: 1,
  },
  {
    q: 'Confirmation completes baptismal grace with a special outpouring of…',
    choices: ['Holy water', 'The Holy Spirit', 'Indulgences', 'Palm branches'],
    answer: 1,
  },
  {
    q: 'Which day commemorates Jesus’ death on the Cross?',
    choices: ['Holy Thursday', 'Good Friday', 'Holy Saturday', 'Divine Mercy Sunday'],
    answer: 1,
  },
  {
    q: 'The Vatican is the seat of…',
    choices: ['The Ecumenical Patriarch only', 'The Pope / Holy See', 'UNESCO', 'The Jesuits alone'],
    answer: 1,
  },
  {
    q: 'Anointing of the Sick is especially for…',
    choices: ['Weddings', 'Those seriously ill or aged', 'New cars', 'Final exams'],
    answer: 1,
  },
  {
    q: '“Amen” most nearly means…',
    choices: ['Hello', 'So be it / truly', 'Goodbye', 'Alleluia'],
    answer: 1,
  },
  {
    q: 'Who appeared to St. Bernadette at Lourdes?',
    choices: ['St. Michael', 'Our Lady', 'St. Joseph', 'St. Anthony'],
    answer: 1,
  },
  {
    q: 'The Angelus is traditionally prayed…',
    choices: ['Only at funerals', 'Morning, noon, and evening', 'Once a year', 'Only by monks'],
    answer: 1,
  },
  {
    q: 'What is sacred Scripture in the Mass often followed by?',
    choices: ['The collection only', 'A homily', 'Baptism', 'Extreme Unction'],
    answer: 1,
  },
  {
    q: 'Corpus Christi honors…',
    choices: ['The Holy Spirit as dove', 'The Body of Christ in the Eucharist', 'St. Peter’s keys', 'All angels'],
    answer: 1,
  },
  {
    q: 'A Nicene Creed profession is chiefly about…',
    choices: ['Parish fundraisers', 'What the Church believes', 'Roman law', 'Monastic schedules'],
    answer: 1,
  },
  {
    q: 'Who is called the “Mother of God” (Theotokos) in Catholic teaching?',
    choices: ['St. Anne', 'Mary', 'St. Elizabeth', 'Martha'],
    answer: 1,
  },
  {
    q: 'Fridays in Lent traditionally emphasize…',
    choices: ['Feasting', 'Penance / abstinence from meat (in many places)', 'Weddings only', 'Ordinations only'],
    answer: 1,
  },
  {
    q: 'St. Francis of Assisi is especially linked with…',
    choices: ['Naval warfare', 'Poverty, peace, and care for creation', 'Writing the Vulgate', 'Building the Colosseum'],
    answer: 1,
  },
  {
    q: 'The Bible’s first book is…',
    choices: ['Exodus', 'Genesis', 'Psalms', 'Matthew'],
    answer: 1,
  },
  {
    q: '“Catholic Social Teaching” begins from the dignity of…',
    choices: ['The state alone', 'The human person', 'Markets', 'Armies'],
    answer: 1,
  },
  {
    q: 'A blessing with the Eucharist in a monstrance is often called…',
    choices: ['Matins', 'Benediction', 'Compline only', 'Tenebrae only'],
    answer: 1,
  },
];

function shuffleInPlace(arr) {
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Pick `count` unique questions; choices stay in written order (answer index stable). */
export function pickTriviaQuestions(count = 1) {
  const n = Math.max(1, Math.min(count, CATHOLIC_TRIVIA.length));
  const pool = shuffleInPlace([...CATHOLIC_TRIVIA]);
  return pool.slice(0, n).map((item) => ({
    q: item.q,
    choices: [...item.choices],
    answer: item.answer,
    note: item.note || '',
  }));
}

export function defaultPassNeed(count) {
  if (count <= 1) return 1;
  if (count <= 3) return Math.max(2, count - 1);
  return Math.max(3, Math.ceil(count * 0.8)); // 5 → 4
}

const SKIP_KEY = 'vehicle_strike_no_questions';

/** When true, Catholic Trivia gates auto-pass. */
export function isTriviaSkipped() {
  try {
    if (localStorage.getItem(SKIP_KEY) === '1') return true;
  } catch {
    /* ignore */
  }
  try {
    // Lazy import avoided — DEV checked via account username in localStorage account blob
    const raw = localStorage.getItem('vehicle_strike_account_v1');
    if (raw) {
      const a = JSON.parse(raw);
      if (String(a?.username || '').trim().toUpperCase() === 'DEV') return true;
    }
  } catch {
    /* ignore */
  }
  return false;
}

export function setTriviaSkipped(on) {
  const next = !!on;
  try {
    if (next) localStorage.setItem(SKIP_KEY, '1');
    else localStorage.removeItem(SKIP_KEY);
  } catch {
    /* ignore */
  }
  return next;
}

/** Toggle skip mode. Returns the new skipped state. */
export function toggleTriviaSkipped() {
  return setTriviaSkipped(!isTriviaSkipped());
}

