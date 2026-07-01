import React, { useState, useEffect, useCallback } from 'react';
import CalendarPicker, { CalendarProps } from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import '../../styles/calendar.css';
import { useMsal } from '@azure/msal-react';

interface OutlookEvent {
  id: string;
  subject: string;
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
  location?: { displayName: string };
  isAllDay?: boolean;
}

async function fetchUpcomingEvents(msalInstance: any): Promise<OutlookEvent[]> {
  try {
    const accounts = msalInstance.getAllAccounts();
    if (!accounts.length) return [];

    const result = await msalInstance.acquireTokenSilent({
      scopes: ['Calendars.Read'],
      account: accounts[0],
    });

    const now = new Date().toISOString();
    const future = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days ahead

    const res = await fetch(
      `https://graph.microsoft.com/v1.0/me/calendarView?startDateTime=${now}&endDateTime=${future}&$select=subject,start,end,location,isAllDay&$orderby=start/dateTime&$top=10`,
      { headers: { Authorization: `Bearer ${result.accessToken}`, Prefer: 'outlook.timezone="UTC"' } }
    );

    if (!res.ok) return [];
    const data = await res.json();
    return data.value as OutlookEvent[];
  } catch {
    return [];
  }
}

function formatEventTime(event: OutlookEvent): string {
  if (event.isAllDay) return 'All day';
  const start = new Date(event.start.dateTime + 'Z');
  const end = new Date(event.end.dateTime + 'Z');
  return `${start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} – ${end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

function formatEventDate(event: OutlookEvent): string {
  const d = new Date(event.start.dateTime + 'Z');
  return d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

const CalendarComponent: React.FC = () => {
  const { instance } = useMsal();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [events, setEvents] = useState<OutlookEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const loadEvents = useCallback(async () => {
    setLoading(true);
    const data = await fetchUpcomingEvents(instance);
    setEvents(data);
    setLoading(false);
  }, [instance]);

  useEffect(() => { loadEvents(); }, [loadEvents]);

  // Dates that have events (for tile highlighting)
  const eventDates = events.map(e => new Date(e.start.dateTime + 'Z'));

  const tileClassName: CalendarProps['tileClassName'] = ({ date }) =>
    eventDates.some(d => sameDay(d, date)) ? 'has-event' : null;

  const eventsOnSelected = events.filter(e =>
    sameDay(new Date(e.start.dateTime + 'Z'), selectedDate)
  );

  const upcomingEvents = events.slice(0, 5);

  const onChange: CalendarProps['onChange'] = (val) => {
    if (val instanceof Date) setSelectedDate(val);
  };

  return (
    <div className="calendar-container">
      <CalendarPicker
        onChange={onChange}
        value={selectedDate}
        tileClassName={tileClassName}
      />

      {/* Events on selected date */}
      {eventsOnSelected.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#555', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {selectedDate.toLocaleDateString([], { month: 'short', day: 'numeric' })}
          </div>
          {eventsOnSelected.map(ev => (
            <div key={ev.id} style={{ background: '#eef2ff', borderLeft: '3px solid #0d6efd', borderRadius: '0 6px 6px 0', padding: '6px 10px', marginBottom: 6 }}>
              <div style={{ fontWeight: 600, fontSize: 13, color: '#1a1a2e' }}>{ev.subject}</div>
              <div style={{ fontSize: 11, color: '#666' }}>{formatEventTime(ev)}</div>
              {ev.location?.displayName && (
                <div style={{ fontSize: 11, color: '#888' }}>📍 {ev.location.displayName}</div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Upcoming events list */}
      <div style={{ marginTop: 14 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#555', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Upcoming
        </div>
        {loading && (
          <div style={{ fontSize: 13, color: '#aaa' }}>Loading events…</div>
        )}
        {!loading && upcomingEvents.length === 0 && (
          <div style={{ fontSize: 13, color: '#aaa' }}>No upcoming events in the next 30 days.</div>
        )}
        {!loading && upcomingEvents.map(ev => (
          <div key={ev.id} style={{ display: 'flex', gap: 10, marginBottom: 10, alignItems: 'flex-start' }}>
            <div style={{ textAlign: 'center', minWidth: 36, background: '#1a1a2e', borderRadius: 6, padding: '4px 0', color: '#fff' }}>
              <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', lineHeight: 1.2 }}>
                {new Date(ev.start.dateTime + 'Z').toLocaleDateString([], { month: 'short' })}
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, lineHeight: 1 }}>
                {new Date(ev.start.dateTime + 'Z').getDate()}
              </div>
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: 13, color: '#1a1a2e', lineHeight: 1.3 }}>{ev.subject}</div>
              <div style={{ fontSize: 11, color: '#777' }}>{formatEventDate(ev)} · {formatEventTime(ev)}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CalendarComponent;
