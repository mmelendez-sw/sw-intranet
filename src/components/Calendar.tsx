import React, { useState } from 'react';
import Calendar, { CalendarProps } from 'react-calendar';
import 'react-calendar/dist/Calendar.css';

const CalendarComponent: React.FC = () => {
  // Update the type of 'value' to match the types returned by react-calendar
  const [value, setValue] = useState<Date | [Date, Date] | null>(new Date());

  // Adjust the onChange function to accept the appropriate types
  const onChange: CalendarProps['onChange'] = (newDate) => {
    setValue(newDate as Date | [Date, Date] | null);
    console.log('Selected date:', newDate);
  };

  return (
    <div className="calendar-container">
      {/* <h2>Calendar</h2> */}
      <Calendar onChange={onChange} value={value} />
      <p>
        Selected Date:{' '}
        {Array.isArray(value)
          ? value.map(date => date.toDateString()).join(', ')
          : value?.toDateString()}
      </p>
    </div>
  );
};

export default CalendarComponent;