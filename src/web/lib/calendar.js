import rawCalendar from '../../data/calendar.json';

const calendar = rawCalendar.map((game) => ({ ...game, date: new Date(game.date) }));

export default calendar;
