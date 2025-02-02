const { ApplicationCommandOptionType, EmbedBuilder } = require("discord.js");

module.exports = {
    name: "skipto",
    description: "Skip songs to a specific queue position.",
    category: "Music",
    options: [
        {
            name: "position",
            description: "Provide queue position.",
            type: ApplicationCommandOptionType.Number,
            required: true,
            min_value: 1,
        },
    ],
    permissions: {
        bot: [],
        channel: [],
        user: [],
    },
    settings: {
        optionType: 2,
        inVc: true,
        sameVc: true,
        player: true,
        current: true,
        owner: false,
    },
    run: async (client, interaction, player) => {
        await interaction.deferReply();

        const value = interaction.options.getNumber("position");

        if (value > player.queue.length) {
            const embed = new EmbedBuilder().setDescription(`\`❌\` | Queue position was not found`).setColor(client.color);
            return interaction.editReply({ embeds: [embed] });
        }

        if (value === 1) {
            await player.stop();
            const embed = new EmbedBuilder().setColor(client.color).setDescription(`\`⏭️\` | Skipped to position: \`${value}\``);
            return interaction.editeReply({ embeds: [embed] });
        }

        await player.queue.splice(0, value - 1);
        await player.stop();

        const embed = new EmbedBuilder().setColor(client.color).setDescription(`\`⏭️\` | Skipped to position: \`${value}\``);
        return interaction.editeReply({ embeds: [embed] });
    },
};
