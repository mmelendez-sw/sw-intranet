import React, { useEffect, useState } from 'react';
import logo from '../../images/sti-horizontal-white.png';

interface HeaderProps {
  userInfo?: {
    isAuthenticated: boolean;
    isEliteGroup: boolean;
    hasPowerBILicense?: boolean;
  };
}

/** Office / lobby TV location (White Plains, NY). */
const WEATHER_LAT = 41.034;
const WEATHER_LON = -73.7629;
const WEATHER_REFRESH_MS = 15 * 60 * 1000;

interface WeatherInfo {
  tempF: number;
  label: string;
  emoji: string;
}

const formatTime = (date: Date) =>
  date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });

const formatDate = (date: Date) =>
  date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

function weatherFromCode(code: number): { label: string; emoji: string } {
  if (code === 0) return { label: 'Clear', emoji: '☀️' };
  if (code <= 3) return { label: 'Partly cloudy', emoji: '⛅' };
  if (code <= 48) return { label: 'Fog', emoji: '🌫️' };
  if (code <= 57) return { label: 'Drizzle', emoji: '🌦️' };
  if (code <= 67) return { label: 'Rain', emoji: '🌧️' };
  if (code <= 77) return { label: 'Snow', emoji: '❄️' };
  if (code <= 82) return { label: 'Showers', emoji: '🌧️' };
  if (code <= 86) return { label: 'Snow showers', emoji: '🌨️' };
  if (code <= 99) return { label: 'Thunderstorm', emoji: '⛈️' };
  return { label: 'Weather', emoji: '🌤️' };
}

async function fetchWeather(): Promise<WeatherInfo | null> {
  const url =
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${WEATHER_LAT}&longitude=${WEATHER_LON}` +
    `&current=temperature_2m,weather_code` +
    `&temperature_unit=fahrenheit&timezone=America%2FNew_York`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  const temp = data?.current?.temperature_2m;
  const code = data?.current?.weather_code;
  if (typeof temp !== 'number' || typeof code !== 'number') return null;
  const { label, emoji } = weatherFromCode(code);
  return { tempF: Math.round(temp), label, emoji };
}

const Header: React.FC<HeaderProps> = () => {
  const [now, setNow] = useState(() => new Date());
  const [weather, setWeather] = useState<WeatherInfo | null>(null);

  useEffect(() => {
    const timerId = window.setInterval(() => {
      setNow(new Date());
    }, 1000);

    return () => window.clearInterval(timerId);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const next = await fetchWeather();
        if (!cancelled && next) setWeather(next);
      } catch {
        // Keep last reading on failure
      }
    };

    void load();
    const id = window.setInterval(load, WEATHER_REFRESH_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  return (
    <header className="header" style={{ zIndex: 5000 }}>
      <img src={logo} alt="Symphony Towers" className="header-logo" />
      <div className="header-meta">
        <div className="header-datetime">
          <div className="header-time">{formatTime(now)}</div>
          <div className="header-date">{formatDate(now)}</div>
        </div>
        {weather && (
          <div className="header-weather" aria-label={`Weather ${weather.tempF} degrees Fahrenheit, ${weather.label}`}>
            <div className="header-weather-text">
              <div className="header-weather-temp">{weather.tempF}°F</div>
              <div className="header-weather-label">{weather.label}</div>
            </div>
            <span className="header-weather-emoji" aria-hidden="true">{weather.emoji}</span>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;
