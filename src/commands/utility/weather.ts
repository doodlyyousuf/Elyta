
import { SlashCommandBuilder } from "discord.js";

export default {
  data: new SlashCommandBuilder()
    .setName("weather")
    .setDescription("Get weather information for a location")
    .addStringOption(option =>
      option
        .setName("location")
        .setDescription("City name or location")
        .setRequired(true)
    ),

  async execute(interaction: any) {
    const location = interaction.options.getString("location");

    try {
      const response = await fetch(
        `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(location)}&appid=${process.env.WEATHER_API_KEY}&units=metric`
      );

      if (!response.ok) {
        throw new Error("Location not found");
      }

      const data = await response.json();

      const embed = {
        color: 0x5865F2,
        title: `🌤️ Weather in ${data.name}`,
        fields: [
          { name: "Temperature", value: `${Math.round(data.main.temp)}°C`, inline: true },
          { name: "Feels Like", value: `${Math.round(data.main.feels_like)}°C`, inline: true },
          { name: "Humidity", value: `${data.main.humidity}%`, inline: true },
          { name: "Wind Speed", value: `${data.wind.speed} m/s`, inline: true },
          { name: "Description", value: data.weather[0].description, inline: true },
        ],
        thumbnail: {
          url: `https://openweathermap.org/img/wn/${data.weather[0].icon}@2x.png`,
        },
      };

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      await interaction.editReply(
        "❌ Failed to fetch weather data. Please check the location or try again later."
      );
    }
  },
};
