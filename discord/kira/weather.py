import aiohttp
import asyncio

WEATHER_CODE_MAP = {
    0: "Clear sky",
    1: "Mainly clear",
    2: "Partly cloudy",
    3: "Overcast",
    45: "Fog",
    48: "Depositing rime fog",
    51: "Light drizzle",
    53: "Moderate drizzle",
    55: "Dense drizzle",
    56: "Light freezing drizzle",
    57: "Dense freezing drizzle",
    61: "Slight rain",
    63: "Moderate rain",
    65: "Heavy rain",
    66: "Light freezing rain",
    67: "Heavy freezing rain",
    71: "Slight snow fall",
    73: "Moderate snow fall",
    75: "Heavy snow fall",
    77: "Snow grains",
    80: "Slight rain showers",
    81: "Moderate rain showers",
    82: "Violent rain showers",
    85: "Slight snow showers",
    86: "Heavy snow showers",
    95: "Thunderstorm",
    96: "Thunderstorm with slight hail",
    99: "Thunderstorm with heavy hail"
}

async def get_coordinates(city):
    url = f"https://geocoding-api.open-meteo.com/v1/search?name={city}&count=1&language=en&format=json"
    async with aiohttp.ClientSession() as session:
        async with session.get(url) as resp:
            data = await resp.json()
    if "results" not in data or len(data["results"]) == 0:
        return None
    result = data["results"][0]
    return result["latitude"], result["longitude"], result["name"]

async def get_weather_report(city):
    coords = await get_coordinates(city)
    if not coords:
        return None
    lat, lon, name = coords

    forecast_url = (
        f"https://api.open-meteo.com/v1/forecast"
        f"?latitude={lat}&longitude={lon}"
        f"&current_weather=true"
        f"&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_probability_max"
        f"&timezone=auto"
    )

    async with aiohttp.ClientSession() as session:
        async with session.get(forecast_url) as resp:
            data = await resp.json()

    current = data.get("current_weather", {})
    daily = data.get("daily", {})

    current_temp = int(round(current.get("temperature", 0)))
    current_code = current.get("weathercode", 0)
    today_desc = WEATHER_CODE_MAP.get(current_code, "Unknown")

    today_high = None
    today_low = None
    today_rain = None
    tomorrow_temp = None
    tomorrow_desc = None

    if daily:
        today_high = int(round(daily["temperature_2m_max"][0]))
        today_low = int(round(daily["temperature_2m_min"][0]))
        today_rain = daily.get("precipitation_probability_max", [None])[0]
        if today_rain is not None:
            today_rain = int(today_rain)

        if len(daily["time"]) > 1:
            tomorrow_temp = int(round(daily["temperature_2m_max"][1]))
            tomorrow_code = daily["weathercode"][1]
            tomorrow_desc = WEATHER_CODE_MAP.get(tomorrow_code, "Unknown")

    lines = []
    lines.append(f"# {name}")
    lines.append(f"# {current_temp}°")
    lines.append(f"Today weather is {today_desc}")

    if today_high is not None and today_low is not None and today_rain is not None:
        lines.append(f"**High**: {today_high}° | **Low**: {today_low}° | **Rain**: {today_rain}%")

    if tomorrow_temp is not None and tomorrow_desc is not None:
        lines.append("")
        lines.append("# Tomorrow")
        lines.append(f"{tomorrow_temp}° and {tomorrow_desc} is coming tomorrow")

    return "\n".join(lines)